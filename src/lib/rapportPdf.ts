import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Entreprise } from "@/data/entreprise";
import { formaterDuree, formaterQuantiteRapport, type Rapport } from "@/lib/rapports";

const OR_TEXTE = "#8a6d2c";
const ENCRE = "#1f2328";
const GRIS = "#5b6168";
const FILET = "#e8e3d8";
const t = (s: string) => s.replace(/ /g, " ");
const fr = (iso: string) => iso.split("-").reverse().join("/");

export function nomFichierRapport(numero: string) {
  return `Rapport_${numero.replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf`;
}

export function definitionRapport(r: Rapport, ent: Entreprise): TDocumentDefinitions {
  const adresseEnt = [ent.adresse, ent.complement, [ent.codePostal, ent.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const contenu: Content[] = [
    { columns: [
      { width: "*", stack: [
        { text: t(ent.nomCommercial || ent.raisonSociale), fontSize: 15, bold: true, color: ENCRE },
        ...(ent.activite ? [{ text: t(ent.activite), fontSize: 9, color: GRIS }] : []),
        { text: t(adresseEnt), fontSize: 9, color: GRIS, margin: [0, 2, 0, 0] as [number, number, number, number] },
        { text: t([ent.telephone, ent.email].filter(Boolean).join(" · ")), fontSize: 9, color: GRIS },
        ...(ent.siret ? [{ text: t(`SIRET ${ent.siret}`), fontSize: 8, color: GRIS }] : []),
      ] },
      { width: "auto", stack: [
        { text: "RAPPORT D’INTERVENTION", fontSize: 13, bold: true, color: OR_TEXTE, alignment: "right" },
        { text: t(r.numero), fontSize: 10, alignment: "right", color: ENCRE },
        { text: t(`Intervention du ${fr(r.date)}`), fontSize: 9, alignment: "right", color: GRIS },
      ] },
    ] },
    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: FILET }], margin: [0, 10, 0, 10] },
    { columns: [
      { width: "*", stack: [
        { text: "CLIENT", fontSize: 8, bold: true, color: GRIS },
        { text: t(r.client.nom), fontSize: 11, bold: true },
        ...(r.client.adresse ? [{ text: t(r.client.adresse), fontSize: 9, color: GRIS }] : []),
        ...(r.client.telephone ? [{ text: t(r.client.telephone), fontSize: 9, color: GRIS }] : []),
      ] },
      { width: "*", stack: [
        { text: "LIEU DE L’INTERVENTION", fontSize: 8, bold: true, color: GRIS },
        { text: t(r.chantier || "Adresse du client"), fontSize: 10 },
        ...(r.intervenant ? [{ text: t(`Intervenant : ${r.intervenant}`), fontSize: 9, color: GRIS, margin: [0, 4, 0, 0] as [number, number, number, number] }] : []),
        ...(r.minutes > 0 ? [{ text: t(`Durée : ${formaterDuree(r.minutes)}`), fontSize: 9, color: GRIS }] : []),
      ] },
    ] },
    { text: "OBJET", fontSize: 8, bold: true, color: GRIS, margin: [0, 14, 0, 2] },
    { text: t(r.objet), fontSize: 11, bold: true },
    { text: "TRAVAUX RÉALISÉS", fontSize: 8, bold: true, color: GRIS, margin: [0, 12, 0, 2] },
    { text: t(r.travaux), fontSize: 10, lineHeight: 1.25 },
  ];
  if (r.materiel.length) contenu.push(
    { text: "MATÉRIEL POSÉ", fontSize: 8, bold: true, color: GRIS, margin: [0, 12, 0, 4] },
    { table: { headerRows: 1, widths: ["*", 70], body: [
      [{ text: "Désignation", bold: true, fontSize: 9 }, { text: "Quantité", bold: true, fontSize: 9, alignment: "right" }],
      ...r.materiel.map(l => [{ text: t(l.designation), fontSize: 9 }, { text: t(`${formaterQuantiteRapport(l.quantite)}${l.unite ? ` ${l.unite}` : ""}`), fontSize: 9, alignment: "right" as const }]),
    ] }, layout: { hLineColor: () => FILET, vLineColor: () => FILET, hLineWidth: () => 0.7, vLineWidth: () => 0 } },
  );
  if (r.observations) contenu.push({ text: "OBSERVATIONS ET RECOMMANDATIONS", fontSize: 8, bold: true, color: GRIS, margin: [0, 12, 0, 2] }, { text: t(r.observations), fontSize: 10, lineHeight: 1.25 });
  if (r.photos.length) {
    contenu.push({ text: "PHOTOS", fontSize: 8, bold: true, color: GRIS, margin: [0, 12, 0, 4] });
    for (let i = 0; i < r.photos.length; i += 2) {
      contenu.push({ unbreakable: true, margin: [0, 0, 0, 8], columns: r.photos.slice(i, i + 2).map(ph => ({ width: "50%", stack: [{ image: ph.image, fit: [250, 190] }, ...(ph.legende ? [{ text: t(ph.legende), fontSize: 8, color: GRIS, margin: [0, 2, 0, 0] as [number, number, number, number] }] : [])] })) } as Content);
    }
  }
  contenu.push({ text: "SIGNATURE DU CLIENT", fontSize: 8, bold: true, color: GRIS, margin: [0, 18, 0, 4], unbreakable: true } as Content);
  contenu.push(r.signature
    ? { unbreakable: true, stack: [{ image: r.signature.image, width: 180 }, { text: t(`${r.signature.nom} — signé le ${fr(r.signature.signeLe)}`), fontSize: 9, color: GRIS }] } as Content
    : { text: "Rapport non signé.", fontSize: 9, color: GRIS } as Content);
  contenu.push({ text: "Ce rapport constate l’intervention réalisée. Il ne constitue ni un devis ni une facture.", fontSize: 8, color: GRIS, margin: [0, 18, 0, 0] });
  return { pageSize: "A4", pageMargins: [40, 40, 40, 50], defaultStyle: { fontSize: 10, color: ENCRE }, content: contenu,
    footer: (page: number, total: number) => ({ text: `${r.numero} · page ${page}/${total}`, fontSize: 8, color: GRIS, alignment: "center" }) };
}

export async function telechargerRapportPdf(r: Rapport, ent: Entreprise): Promise<void> {
  const [{ default: pdfMake }, fonts] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
  const vfs = (fonts as unknown as { default?: Record<string, string> }).default ?? (fonts as unknown as Record<string, string>);
  const doc = pdfMake.createPdf(definitionRapport(r, ent), undefined, undefined, (vfs as { pdfMake?: { vfs: Record<string, string> } }).pdfMake?.vfs ?? vfs);
  const blob: Blob = await new Promise((resolve, reject) => { try { doc.getBlob((b: Blob) => resolve(b)); } catch (e) { reject(e); } });
  if (!blob || blob.size === 0) throw new Error("PDF vide");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomFichierRapport(r.numero);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
