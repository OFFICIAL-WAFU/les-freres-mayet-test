import { deductionExcessive, MSG_DEDUCTION_EXCESSIVE, solde, type Deduction } from "@/data/deduction";
/**
 * Génération locale (dans le navigateur) du PDF de brouillon de devis.
 * Reçoit uniquement des données publiques : aucune note interne n'est transmise.
 * Les montants proviennent du moteur de calcul partagé (recapituler / validerLigne).
 */
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

import { TYPE_ARTICLE_LABELS, UNITE_LABELS } from "@/data/catalogue";
import { presentationLigne, debutLot } from '@/lib/lots';
import {
  formaterCentimes,
  formaterPrixSaisi,
  formaterQuantite,
  labelTaux,
  recapituler,
  validerLigne,
} from "@/data/devis";
import { formaterCapital, type Entreprise } from "@/data/entreprise";
import type { DevisPublic } from "@/components/DevisApercu";

const OR = "#b08d3c";
const OR_TEXTE = "#8a6d2c";
const ENCRE = "#1f2328";
const GRIS = "#5b6168";
const PALE = "#8b9096";
const FILET = "#e8e3d8";

/** Espaces insécables fines → espaces insécables simples (présentes dans la police). */
const t = (s: string) => s.replace(/\u202f/g, "\u00a0");
const fr = (iso: string) => iso.split("-").reverse().join("/");

/** Découpe un texte long en morceaux d'environ 900 caractères, aux espaces. */
function decouper(s: string): string[] {
  if (!s) return [];
  const out: string[] = [];
  let reste = s;
  while (reste.length > 1100) {
    let coupe = reste.lastIndexOf(" ", 900);
    if (coupe < 400) coupe = 900;
    out.push(reste.slice(0, coupe).trimEnd());
    reste = reste.slice(coupe).trimStart();
  }
  out.push(reste);
  return out;
}

export function nomFichierDevis(numero: string) {
  const propre = numero.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return `Devis_${propre || "brouillon"}.pdf`;
}

export type OptionFacture = { sourceRef: string; finalisee?: boolean; acompte?: number; deduction?: Deduction; avoir?: { motif: string } };

export function nomFichierFacture(numero: string) {
  return nomFichierDevis(numero).replace(/^Devis_/, numero.startsWith("AV-") ? "Avoir_" : numero.includes("-ACP-") ? "Acompte_" : "Facture_");
}

export function definitionDevis(d: DevisPublic, numero: string, ent: Entreprise, finalise = false, facture?: OptionFacture): TDocumentDefinitions {
  if (facture) finalise = !!facture.finalisee;
  const factB = !!facture && !finalise;
  const acp = facture?.acompte !== undefined;
  const av = facture?.avoir;
  const titreB = acp ? "FACTURE D'ACOMPTE — BROUILLON — NON ÉMISE" : "FACTURE — BROUILLON — NON ÉMISE";
  const mention = factB ? (facture?.acompte !== undefined ? "Facture d'acompte brouillon — non émise" : "Facture brouillon — non émise") : "Brouillon — non émis · Document de démonstration";
  const recap = recapituler(d.lignes);
  const c = d.client;
  const villeLigne = [ent.codePostal, ent.ville].filter(Boolean).join(" ");
  const coord = [ent.adresse, ent.complement, villeLigne, ent.pays].filter(Boolean);
  const contacts = [ent.telephone && `Tél. ${ent.telephone}`, ent.email, ent.site.replace(/^https?:\/\//, "").replace(/\/$/, "")].filter(Boolean) as string[];
  const legal = [
    [ent.raisonSociale, ent.formeJuridique].filter(Boolean).join(" — "),
    ent.capital && `Capital social : ${t(formaterCapital(ent.capital))}`,
    ent.siret && `SIRET : ${ent.siret}`,
    ent.tva && `TVA intracommunautaire : ${ent.tva}`,
    ent.immatriculation,
  ].filter(Boolean) as string[];

  const titreSection = (s: string): Content => ({ text: s.toUpperCase(), style: "section" });
  const entete = (s: string, align: "left" | "right" = "left") => ({ text: s.toUpperCase(), style: "th", alignment: align });

  // Chaque ligne reste sur une page (dontBreakRows). Une description très longue est découpée
  // en lignes de suite, sans filet, pour pouvoir continuer sur la page suivante sans perte.
  const suites = new Set<number>(); // index (dans body) des lignes de suite
  const corps: Content[][] = [];
  d.lignes.forEach((l,i) => {
    const calc = validerLigne(l).calcul;
    const p=presentationLigne(l),titre=debutLot(d.lignes,i);
    if(titre)corps.push([{text:titre.toUpperCase(),bold:true,colSpan:6,fillColor:'#edf3fa',margin:[0,2,0,2]} as Content,'','','','','']);
    const morceaux = decouper(p.description.trim());
    const desig: Content[] = [{ text: l.designation, bold: true }];
    if (morceaux[0]) desig.push({ text: morceaux[0], color: GRIS, margin: [0, 2, 0, 0] });
    const type: Content = { text: TYPE_ARTICLE_LABELS[l.type].toUpperCase(), fontSize: 7, color: PALE, margin: [0, 2, 0, 0] };
    if (morceaux.length <= 1) desig.push(type);
    corps.push([
      { stack: desig },
      { text: t(formaterQuantite(l.quantite)), alignment: "right" },
      { text: p.uniteSource ?? (l.unite ? UNITE_LABELS[l.unite] : "") },
      { text: t(formaterPrixSaisi(l.prix)), alignment: "right", noWrap: true },
      { text: l.taux !== null ? t(labelTaux(l.taux)) : "", alignment: "right", noWrap: true },
      { text: calc ? t(formaterCentimes(calc.ht)) : "", alignment: "right", noWrap: true, bold: true },
    ] as Content[]);
    morceaux.slice(1).forEach((m, i, arr) => {
      suites.add(corps.length + 1);
      const pile: Content[] = [{ text: m, color: GRIS }];
      if (i === arr.length - 1) pile.push(type);
      corps.push([{ stack: pile }, "", "", "", "", ""]);
    });
  });

  const ded = facture?.deduction;
  const totaux: Content[][] = [
    [{ text: "Total HT" }, { text: t(formaterCentimes(recap.ht)), alignment: "right", bold: true }],
    ...recap.parTaux.map((x) => [
      { text: t(`TVA ${labelTaux(x.taux)} (base ${formaterCentimes(x.base)})`), color: GRIS },
      { text: t(formaterCentimes(x.tva)), alignment: "right", color: GRIS },
    ] as Content[]),
    [{ text: "Total TVA" }, { text: t(formaterCentimes(recap.tva)), alignment: "right", bold: true }],
    [
      { text: av ? "Total de l'avoir TTC" : ded ? "Total des prestations TTC" : "Total TTC", bold: true, fontSize: ded ? 10 : 12, margin: [0, 4, 0, 0] },
      { text: recap.complet ? t(formaterCentimes(recap.ttc)) : "Calcul incomplet", alignment: "right", bold: true, fontSize: (ded ? 10 : 12), margin: [0, 4, 0, 0] },
    ],
    ...lignesDeduction(recap, ded),
  ];

  const content: Content[] = [
    {
      columns: [
        {
          width: "*",
          columns: [
            {
              width: 40,
              stack: [
                { canvas: [{ type: "ellipse", x: 18, y: 18, r1: 17, r2: 17, lineColor: OR, lineWidth: 1.5 }] },
                { text: "FM", color: OR, bold: true, fontSize: 11, alignment: "center", margin: [0, -25, 4, 0] },
              ],
            },
            {
              width: "*",
              stack: [
                { text: ent.nomCommercial || ent.raisonSociale, fontSize: 13, bold: true },
                ...(ent.activite ? [{ text: ent.activite, color: GRIS, fontSize: 9 }] : []),
                ...coord.map((x) => ({ text: x, color: GRIS, fontSize: 8 })),
                ...contacts.map((x) => ({ text: x, color: GRIS, fontSize: 8 })),
              ],
            },
          ],
          columnGap: 8,
        },
        {
          width: "auto",
          alignment: "right",
          stack: [
            { text: factB ? titreB : av ? "AVOIR" : facture ? (acp ? "FACTURE D'ACOMPTE" : "FACTURE") : finalise ? "DEVIS" : "DEVIS — BROUILLON", fontSize: factB ? 12 : 15, bold: true },
            { text: finalise ? `Réf. ${numero}` : `Réf. provisoire ${numero}`, color: GRIS, fontSize: 9 },
            ...(finalise || facture ? [] : [{ text: "BROUILLON — NON ÉMIS", color: OR_TEXTE, fontSize: 8, bold: true, margin: [0, 4, 0, 0] as [number, number, number, number] }]),
          ],
        },
      ],
    },
    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineColor: FILET, lineWidth: 1 }], margin: [0, 12, 0, 12] },
    {
      columns: [
        {
          width: "*",
          stack: [
            titreSection(av ? "Avoir" : acp ? "Facture d'acompte" : facture ? "Facture" : "Devis"),
            { text: [{ text: "Objet : ", color: GRIS }, d.objet] },
            { text: [{ text: "Date : ", color: GRIS }, fr(d.date)] },
            ...(facture && !acp && !av && d.prestationDebut ? [{ text: [{ text: d.prestationFin ? "Période de réalisation : " : "Date de réalisation : ", color: GRIS }, d.prestationFin ? `du ${fr(d.prestationDebut)} au ${fr(d.prestationFin)}` : fr(d.prestationDebut)] }] : []),
            ...(d.validite ? [{ text: [{ text: facture ? "Échéance : " : "Valable jusqu'au : ", color: GRIS }, fr(d.validite)] }] : []),
            ...(av ? [{ text: [{ text: "Facture d'origine : ", color: GRIS }, facture!.sourceRef] }, { text: [{ text: "Motif : ", color: GRIS }, av.motif] }] : facture?.sourceRef ? [{ text: [{ text: "Devis d'origine : ", color: GRIS }, facture.sourceRef] }] : []),
            ...(acp ? [{ text: [{ text: "Acompte : ", color: GRIS }, `${String(facture!.acompte).replace(".", ",")} % du devis`] }] : []),
          ],
        },
        {
          width: "*",
          stack: [
            titreSection("Destinataire"),
            { text: c.nom, bold: true },
            ...(c.contact ? [{ text: `À l'attention de ${c.contact}` }] : []),
            ...c.adresse.filter(Boolean).map((x) => ({ text: x })),
            ...(c.telephone ? [{ text: `Tél. ${c.telephone}` }] : []),
            ...(c.email ? [{ text: c.email }] : []),
          ],
        },
      ],
      columnGap: 20,
      margin: [0, 0, 0, 16],
    },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: ["*", 38, 42, 62, 34, 66],
        body: [
          [entete("Désignation"), entete("Qté", "right"), entete("Unité"), entete("P.U. HT", "right"), entete("TVA", "right"), entete("Total HT", "right")],
          ...corps,
        ],
      },
      layout: {
        hLineWidth: (i) => (i === 1 ? 1.2 : suites.has(i) ? 0 : 0.6),
        hLineColor: (i) => (i === 1 ? OR : FILET),
        vLineWidth: () => 0,
        paddingLeft: (i) => (i === 0 ? 0 : 4),
        paddingRight: (i, node) => (i === (node.table.widths?.length ?? 1) - 1 ? 0 : 4),
        paddingTop: (i) => (suites.has(i) ? 0 : 6),
        paddingBottom: (i) => (suites.has(i + 1) ? 0 : 6),
      },
    },
    {
      unbreakable: true,
      margin: [0, 14, 0, 0],
      columns: [
        { width: "*", text: "" },
        {
          width: 250,
          table: { widths: ["*", "auto"], body: totaux },
          layout: {
            hLineWidth: (i, node) => (i === node.table.body.length - 1 ? 1.2 : 0),
            hLineColor: () => OR,
            vLineWidth: () => 0,
            paddingLeft: () => 0,
            paddingRight: (i) => (i === 0 ? 8 : 0),
            paddingTop: () => 2,
            paddingBottom: () => 2,
          },
        },
      ],
    },
  ];

  if (!av && d.conditions?.trim()) {
    content.push({ stack: [titreSection("Conditions de paiement"), { text: d.conditions.trim() }], margin: [0, 18, 0, 0] });
  }
  if (d.remarques.trim()) {
    content.push({ stack: [titreSection("Remarques"), { text: d.remarques }], margin: [0, 18, 0, 0] });
  }
  if (legal.length) {
    content.push({
      stack: legal.map((x) => ({ text: x })),
      fontSize: 7.5,
      color: PALE,
      alignment: "center",
      margin: [0, 24, 0, 0],
    });
  }

  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [40, 48, 40, 52],
    info: av ? { title: `Avoir ${numero}`, subject: "Avoir", creator: "Les Frères Mayet" } : acp && finalise ? { title: `Facture d'acompte ${numero}`, subject: "Facture d'acompte", creator: "Les Frères Mayet" } : acp ? { title: `Facture d'acompte ${numero} — brouillon non émis`, subject: "Facture d'acompte brouillon — non émise", creator: "Les Frères Mayet" } : facture && finalise ? { title: `Facture ${numero}`, subject: "Facture", creator: "Les Frères Mayet" } : facture ? { title: `Facture ${numero} — brouillon non émis`, subject: "Facture brouillon — non émise", creator: "Les Frères Mayet" } : finalise ? { title: `Devis ${numero}`, subject: "Devis", creator: "Les Frères Mayet" } : { title: `Devis ${numero} — brouillon`, subject: "Brouillon de devis — non émis", creator: "Les Frères Mayet (démonstration)" },
    defaultStyle: { font: "Roboto", fontSize: 9.5, color: ENCRE, lineHeight: 1.2 },
    styles: {
      section: { fontSize: 7.5, bold: true, color: OR_TEXTE, margin: [0, 0, 0, 4] },
      th: { fontSize: 7.5, bold: true, color: OR_TEXTE },
    },
    header: (page) =>
      page > 1
        ? { text: factB ? `${titreB} · ${numero} (suite)` : av ? `Avoir ${numero} (suite)` : facture ? `${acp ? "Facture d'acompte" : "Facture"} ${numero} (suite)` : finalise ? `Devis ${numero} (suite)` : `Devis ${numero} — brouillon (suite)`, fontSize: 7.5, color: PALE, alignment: "right", margin: [40, 22, 40, 0] }
        : { text: "" },
    footer: (page, total) => ({
      columns: [
        { text: finalise ? `${av ? "Avoir" : facture ? "Facture" : "Devis"} ${numero}` : facture ? `${mention} · ${numero}` : mention, fontSize: 7.5, color: PALE },
        { text: `Page ${page} / ${total}`, fontSize: 7.5, color: PALE, alignment: "right" },
      ],
      margin: [40, 20, 40, 0],
    }),
    content,
  };
}

/** Génère le PDF et déclenche le téléchargement. Rejette en cas d'échec. */
export async function telechargerDevisPdf(d: DevisPublic, numero: string, ent: Entreprise, finalise = false, facture?: OptionFacture): Promise<void> {
  if (deductionExcessive(recapituler(d.lignes), facture?.deduction)) throw new Error(MSG_DEDUCTION_EXCESSIVE);
  const [{ default: pdfMake }, fonts] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const vfs = (fonts as unknown as { default?: Record<string, string> }).default ?? (fonts as unknown as Record<string, string>);
  const doc = pdfMake.createPdf(definitionDevis(d, numero, ent, finalise, facture), undefined, undefined, (vfs as { pdfMake?: { vfs: Record<string, string> } }).pdfMake?.vfs ?? vfs);
  const blob: Blob = await new Promise((resolve, reject) => {
    try {
      doc.getBlob((b: Blob) => resolve(b));
    } catch (e) {
      reject(e);
    }
  });
  if (!blob || blob.size === 0) throw new Error("PDF vide");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = facture ? (facture.acompte !== undefined ? nomFichierDevis(numero).replace(/^Devis_/, "Acompte_") : nomFichierFacture(numero)) : nomFichierDevis(numero);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function lignesDeduction(recap: ReturnType<typeof recapituler>, d: Deduction | undefined): Content[][] {
  if (!d) return [];
  if (d.statut !== "finalise") return [[{ text: t(`Acompte ${d.reference} encore en brouillon — non déduit`), color: GRIS, colSpan: 2 } as Content, ""]];
  const s = solde(recap, d);
  const fin = (x: bigint) => t(formaterCentimes(x));
  return [
    [{ text: t(`Acompte déjà facturé à déduire — ${d.reference}`), bold: true, colSpan: 2, margin: [0, 8, 0, 0] } as Content, ""],
    ...d.parTaux.map((p) => [
      { text: t(`Part à TVA ${labelTaux(p.taux)} : HT -${formaterCentimes(p.ht)} / TVA`), color: GRIS },
      { text: "-" + fin(p.tva), alignment: "right", color: GRIS },
    ] as Content[]),
    [{ text: "Acompte déjà facturé TTC" }, { text: "-" + fin(d.ttc), alignment: "right", bold: true }],
    [{ text: "Solde de cette facture", bold: true, colSpan: 2, margin: [0, 8, 0, 0] } as Content, ""],
    [{ text: "Solde HT" }, { text: fin(s.ht), alignment: "right", bold: true }],
    ...s.parTaux.map((p) => [
      { text: t(`TVA ${labelTaux(p.taux)} (base ${formaterCentimes(p.ht)})`), color: GRIS },
      { text: fin(p.tva), alignment: "right", color: GRIS },
    ] as Content[]),
    [{ text: "Solde TVA" }, { text: fin(s.tva), alignment: "right", bold: true }],
    [
      { text: "Solde TTC de cette facture", bold: true, fontSize: 12, margin: [0, 4, 0, 0] },
      { text: fin(s.ttc), alignment: "right", bold: true, fontSize: 12, margin: [0, 4, 0, 0] },
    ],
  ];
}
