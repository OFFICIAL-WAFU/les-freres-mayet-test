/**
 * Génération locale (dans le navigateur) du PDF de brouillon de devis.
 * Reçoit uniquement des données publiques : aucune note interne n'est transmise.
 * Les montants proviennent du moteur de calcul partagé (recapituler / validerLigne).
 */
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

import { TYPE_ARTICLE_LABELS, UNITE_LABELS } from "@/data/catalogue";
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

export function definitionDevis(d: DevisPublic, numero: string, ent: Entreprise): TDocumentDefinitions {
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
  d.lignes.forEach((l) => {
    const calc = validerLigne(l).calcul;
    const morceaux = decouper(l.description.trim());
    const desig: Content[] = [{ text: l.designation, bold: true }];
    if (morceaux[0]) desig.push({ text: morceaux[0], color: GRIS, margin: [0, 2, 0, 0] });
    const type: Content = { text: TYPE_ARTICLE_LABELS[l.type].toUpperCase(), fontSize: 7, color: PALE, margin: [0, 2, 0, 0] };
    if (morceaux.length <= 1) desig.push(type);
    corps.push([
      { stack: desig },
      { text: t(formaterQuantite(l.quantite)), alignment: "right" },
      { text: l.unite ? UNITE_LABELS[l.unite] : "" },
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

  const totaux: Content[][] = [
    [{ text: "Total HT" }, { text: t(formaterCentimes(recap.ht)), alignment: "right", bold: true }],
    ...recap.parTaux.map((x) => [
      { text: t(`TVA ${labelTaux(x.taux)} (base ${formaterCentimes(x.base)})`), color: GRIS },
      { text: t(formaterCentimes(x.tva)), alignment: "right", color: GRIS },
    ] as Content[]),
    [{ text: "Total TVA" }, { text: t(formaterCentimes(recap.tva)), alignment: "right", bold: true }],
    [
      { text: "Total TTC", bold: true, fontSize: 12, margin: [0, 4, 0, 0] },
      { text: recap.complet ? t(formaterCentimes(recap.ttc)) : "Calcul incomplet", alignment: "right", bold: true, fontSize: 12, margin: [0, 4, 0, 0] },
    ],
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
            { text: "DEVIS — BROUILLON", fontSize: 15, bold: true },
            { text: `Réf. provisoire ${numero}`, color: GRIS, fontSize: 9 },
            { text: "BROUILLON — NON ÉMIS", color: OR_TEXTE, fontSize: 8, bold: true, margin: [0, 4, 0, 0] },
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
            titreSection("Devis"),
            { text: [{ text: "Objet : ", color: GRIS }, d.objet] },
            { text: [{ text: "Date : ", color: GRIS }, fr(d.date)] },
            ...(d.validite ? [{ text: [{ text: "Valable jusqu'au : ", color: GRIS }, fr(d.validite)] }] : []),
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
    info: { title: `Devis ${numero} — brouillon`, subject: "Brouillon de devis — non émis", creator: "Les Frères Mayet (démonstration)" },
    defaultStyle: { font: "Roboto", fontSize: 9.5, color: ENCRE, lineHeight: 1.2 },
    styles: {
      section: { fontSize: 7.5, bold: true, color: OR_TEXTE, margin: [0, 0, 0, 4] },
      th: { fontSize: 7.5, bold: true, color: OR_TEXTE },
    },
    header: (page) =>
      page > 1
        ? { text: `Devis ${numero} — brouillon (suite)`, fontSize: 7.5, color: PALE, alignment: "right", margin: [40, 22, 40, 0] }
        : { text: "" },
    footer: (page, total) => ({
      columns: [
        { text: "Brouillon — non émis · Document de démonstration", fontSize: 7.5, color: PALE },
        { text: `Page ${page} / ${total}`, fontSize: 7.5, color: PALE, alignment: "right" },
      ],
      margin: [40, 20, 40, 0],
    }),
    content,
  };
}

/** Génère le PDF et déclenche le téléchargement. Rejette en cas d'échec. */
export async function telechargerDevisPdf(d: DevisPublic, numero: string, ent: Entreprise): Promise<void> {
  const [{ default: pdfMake }, fonts] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const vfs = (fonts as unknown as { default?: Record<string, string> }).default ?? (fonts as unknown as Record<string, string>);
  const doc = pdfMake.createPdf(definitionDevis(d, numero, ent), undefined, undefined, (vfs as { pdfMake?: { vfs: Record<string, string> } }).pdfMake?.vfs ?? vfs);
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
  a.download = nomFichierDevis(numero);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
