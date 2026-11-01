// Pure analysis: no database calls, no document creation and no renumbering.
export type SourceKhosmos = { path: string; hash: string; text: string; error?: string; pages?: number };
export type PieceKhosmos = {
  ref: string; type: "Devis" | "Facture" | "Acompte" | "Avoir";
  client: string; date: string; ht: number | null; tva: number | null; ttc: number | null;
  pdfTtc: number | null; pdfHt: number | null; pdfTva: number | null; net: number | null; statut: string; echeance: string;
  sources: string[]; liens: string[]; alertes: string[]; infos: string[];
  lignes: number; taux: string[];
};
export type AnalyseKhosmos = {
  documents: PieceKhosmos[]; fichiers: number; pdf: number; csv: number; pages: number;
  copies: { path: string; original: string }[];
  erreurs: { path: string; message: string }[];
  annexes: string[]; lignesCsv: number; genereLe: string;
};
const normaliser = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export function centimesKhosmos(s: string): number | null {
  const v = s.trim().replace(/[\s\u00a0\u202f€]/g, "").replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(v)) return null;
  const negatif = v.startsWith("-");
  const [entier, decimals = ""] = v.replace(/^-/, "").split(".");
  const n = Number(entier) * 100 + Number((decimals + "00").slice(0, 2)) + (Number(decimals[2] ?? "0") >= 5 ? 1 : 0);
  return Number.isSafeInteger(n) ? (negatif ? -n : n) : null;
}
export const eurosKhosmos = (v: number | null) => v === null ? "Non lu" : (v / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

// Quoted commas, escaped quotes, CRLF and multiline fields are all preserved.
export function lireCsvKhosmos(text: string): Record<string, string>[] {
  const s = text.replace(/^\uFEFF/, "");
  const first = s.split(/\r?\n/)[0] ?? "";
  const delimiter = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (quoted && s[i + 1] === '"') { value += '"'; i++; }
      else if (quoted || !value) quoted = !quoted;
      else value += c;
    } else if (!quoted && c === delimiter) { row.push(value); value = ""; }
    else if (!quoted && (c === "\n" || c === "\r")) {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(value); if (row.some(x => x.trim())) rows.push(row); row = []; value = "";
    } else value += c;
  }
  if (quoted) throw new Error("Champ CSV entre guillemets non terminé.");
  row.push(value); if (row.some(x => x.trim())) rows.push(row);
  const headers = rows.shift()?.map(x => x.trim()) ?? [];
  if (!headers.length || new Set(headers).size !== headers.length) throw new Error("En-têtes CSV absents ou en double.");
  return rows.map((r, i) => {
    if (r.length !== headers.length) throw new Error(`Ligne CSV ${i + 2} : nombre de colonnes inattendu.`);
    return Object.fromEntries(headers.map((h, j) => [h, (r[j] ?? "").trim()]));
  });
}
const champ = (r: Record<string, string>, name: string) => Object.entries(r).find(([k]) => normaliser(k) === normaliser(name))?.[1] ?? "";
const dateValide = (s: string) => {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(iso + "T00:00:00Z");
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === iso;
};
const somme = (rows: Record<string, string>[], name: string) => {
  const values = rows.map(r => centimesKhosmos(champ(r, name)));
  return values.some(v => v === null) ? null : values.reduce<number>((a, b) => a + (b ?? 0), 0);
};
// Compare the source decimals exactly. No blanket one-cent tolerance.
const PRECISION = 1_000_000_000_000n;
function decimalFiscal(s: string): bigint | null {
  const v = s.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,12})?$/.test(v)) return null;
  const [entier = "0", fraction = ""] = v.split(".");
  return BigInt(entier) * PRECISION + BigInt(fraction.padEnd(12, "0"));
}
const arrondiFiscal = (v: bigint) => Number((v + 5_000_000_000n) / 10_000_000_000n);
function expliquerArrondis(index: Map<string, PieceKhosmos>, sources: SourceKhosmos[]) {
  const preuves = new Map<string, { source: string; ht: bigint; tva: bigint; ttc: bigint; parts: bigint[] }[]>();
  for (const source of sources.filter(s => /archivage-(facture|avoir)\.csv$/i.test(s.path))) {
    try {
      for (const r of lireCsvKhosmos(source.text)) {
        const date = champ(r, "FAC-DAT"), num = champ(r, "FAC-NUM");
        if (!dateValide(date) || !/^\d{1,5}$/.test(num)) continue;
        const ref = (/avoir/i.test(source.path) ? "A" : "F") + date.slice(-4) + "-" + num.padStart(5, "0");
        const ht = decimalFiscal(champ(r, "FAC-TOT-MHT")), tva = decimalFiscal(champ(r, "FAC-TOT-TVA")), ttc = decimalFiscal(champ(r, "FAC-TOT-TTC-MTN"));
        const parts = champ(r, "FAC-TAX-TOT-MHT").split(/\s+/).map(decimalFiscal);
        if (ht === null || tva === null || ttc === null || parts.some(x => x === null)) continue;
        const liste = preuves.get(ref) ?? [];
        liste.push({ source: source.path, ht, tva, ttc, parts: parts as bigint[] }); preuves.set(ref, liste);
      }
    } catch { /* File-level errors remain visible in the analysis. */ }
  }
  const expliquees = new Map<string, PieceKhosmos>();
  for (const [ref, rows] of preuves) {
    const p = index.get(ref), r = rows[0];
    if (!p || !r || rows.some(x => x.ht !== r.ht || x.tva !== r.tva || x.ttc !== r.ttc || x.parts.join() !== r.parts.join())) continue;
    // Both published values and the precise source calculation must support the explanation.
    if (p.ht !== arrondiFiscal(r.ht) || p.pdfHt !== p.ht || p.pdfTva !== arrondiFiscal(r.tva) || p.pdfTtc !== arrondiFiscal(r.ttc) || arrondiFiscal(r.ht + r.tva) !== p.pdfTtc) continue;
    const pdfs = p.alertes.some(a => a.startsWith("Les versions PDF"));
    if (pdfs) continue;
    const simple = p.tva === arrondiFiscal(r.tva) && p.ttc === p.pdfTtc && p.ht !== null && p.ht + p.tva !== p.ttc;
    const parts = r.parts.length > 1 && r.parts.reduce((a, b) => a + b, 0n) === r.tva && p.tva === r.parts.reduce((s, x) => s + arrondiFiscal(x), 0) && p.ht !== null && p.ttc === p.ht + p.tva;
    if (!simple && !parts) continue;
    const removed = p.alertes.filter(a => a.startsWith("Écart HT + TVA / TTC source") || (parts && (a.startsWith("Écart CSV / PDF") || a.startsWith("Les montants HT ou TVA diffèrent"))));
    if (!removed.length) continue;
    p.alertes = p.alertes.filter(a => !removed.includes(a));
    p.infos.push(`${parts ? "Arrondi par taux dans le CSV et arrondi global dans le PDF" : "Arrondis indépendants du HT, de la TVA et du TTC"} confirmé(s) par ${r.source}, document ${ref}. Montants d’origine conservés.`, ...removed.map(a => `Écart expliqué : ${a}`));
    p.sources.push(r.source); expliquees.set(ref, p);
  }
  // A quote has no fiscal export: retain the distinction between direct proof and corroboration.
  for (const p of index.values()) {
    if (p.type !== "Devis") continue;
    const liee = [...expliquees.values()].find(f => f.liens.includes(p.ref) && f.client === p.client && f.ht === p.ht && f.tva === p.tva && f.ttc === p.ttc && f.pdfTtc === p.pdfTtc && f.taux.slice().sort().join() === p.taux.slice().sort().join());
    if (!liee) continue;
    p.infos.push(`Les mêmes montants sont présents sur la facture liée ${liee.ref}, dont l’écart d’arrondi est expliqué par l’archive fiscale. Le devis n’a pas sa propre preuve fiscale : son écart reste à vérifier.`);
  }
}
function piece(ref: string, type: PieceKhosmos["type"]): PieceKhosmos {
  return { ref, type, client: "", date: "", ht: null, tva: null, ttc: null, pdfTtc: null, pdfHt: null, pdfTva: null, net: null,
    statut: "Non connu", echeance: "", sources: [], liens: [], alertes: [], infos: [], lignes: 0, taux: [] };
}
function lirePdf(source: SourceKhosmos) {
  const text = source.text.replace(/\s+/g, " ").split(/CONDITIONS G[EÉ]N[EÉ]RALES/)[0] ?? "";
  const m = text.match(/(?:Devis|Facture|Avoir)\s+N[°ºo]?\s*:?\s*([FDA]\d{4}-\d{5})/i);
  if (!m) return null;
  const ref = m[1]!.toUpperCase();
  const amount = (label: string) => {
    const match = text.match(new RegExp(label + "\\s+(-?\\d[\\d \\u00a0\\u202f]*[,.]\\d{2})\\s*€", "i"));
    return match ? centimesKhosmos(match[1]!) : null;
  };
  const links = [...new Set((text.match(/\b[FDA]\d{4}-\d{5}\b/g) ?? []).filter(r => r !== ref))];
  return { ref, ht: amount("Total HT(?: Remis[eé])?"), tva: amount("Total TVA"), ttc: amount("Total TTC"), net: amount("Net [aà] payer"),
    date: text.match(/R[eé]alis[eé]e? le\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? "",
    echeance: text.match(/Date [eé]ch[eé]ance\s*:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? "",
    paid: /ACQUITT[EÉ]E|Facture pay[eé]e le/i.test(text),
    acompte: /FACTURE D['’]ACOMPTE|Facture d['’]acompte/i.test(text), links };
}

export function analyserSourcesKhosmos(sources: SourceKhosmos[]): AnalyseKhosmos {
  const result: AnalyseKhosmos = { documents: [], fichiers: sources.length, pdf: 0, csv: 0, pages: 0,
    copies: [], erreurs: [], annexes: [], lignesCsv: 0, genereLe: new Date().toISOString() };
  const index = new Map<string, PieceKhosmos>();
  const hashes = new Map<string, string>();
  const uniques = sources.filter(s => {
    if (/\.pdf$/i.test(s.path)) { result.pdf++; result.pages += s.pages ?? 0; }
    if (/\.csv$/i.test(s.path)) result.csv++;
    if (s.error) { result.erreurs.push({ path: s.path, message: s.error }); return false; }
    const original = hashes.get(s.hash);
    if (original) { result.copies.push({ path: s.path, original }); return false; }
    hashes.set(s.hash, s.path); return true;
  });
  // Summary CSV rows are VAT slices, never separate invoices.
  for (const source of uniques.filter(s => /\.csv$/i.test(s.path))) {
    try {
      const rows = lireCsvKhosmos(source.text);
      if (!rows.length || !champ(rows[0]!, "N° de document")) { result.annexes.push(source.path); continue; }
      const base = normaliser(source.path.split(/[\\/]/).pop() ?? "");
      const letter = /avoir/.test(base) ? "A" : /devis/.test(base) ? "D" : /facture/.test(base) ? "F" : "";
      if (!letter) throw new Error("Type du CSV non reconnu (Devis, Factures ou Avoirs attendu).");
      const groups = new Map<string, Record<string, string>[]>();
      for (const r of rows) {
        const date = champ(r, "Date"), num = champ(r, "N° de document");
        if (!/^\d+$/.test(num) || num.length > 5 || !dateValide(date)) throw new Error("Numéro ou date invalide : fichier exclu des montants consolidés.");
        const ref = letter + date.slice(-4) + "-" + num.padStart(5, "0");
        groups.set(ref, [...(groups.get(ref) ?? []), r]);
      }
      result.lignesCsv += rows.length;
      for (const [ref, rs] of groups) {
        const r = rs[0]!; const typologie = normaliser(champ(r, "Typologie"));
        const p = piece(ref, letter === "D" ? "Devis" : letter === "A" ? "Avoir" : typologie.includes("acompte") ? "Acompte" : "Facture");
        p.client = champ(r, "Client"); p.date = champ(r, "Date");
        p.ht = somme(rs, "Montant HT"); p.tva = somme(rs, "TVA"); p.ttc = somme(rs, "Montant TTC");
        p.taux = [...new Set(rs.map(x => champ(x, "Taux de TVA")))];
        p.sources = [source.path];
        const statuses = [...new Set(rs.map(x => champ(x, letter === "D" ? "Signé" : "Réglé")).filter(Boolean))];
        p.statut = letter === "A" ? "Émis (source CSV)" : statuses[0] === "Oui" ? letter === "D" ? "Signé (CSV)" : "Réglé (CSV)" : statuses[0] === "Non" ? letter === "D" ? "Non signé (CSV)" : "Non réglé (CSV)" : "Non connu";
        if (statuses.length > 1 || rs.some(x => champ(x, "Client") !== p.client || champ(x, "Date") !== p.date || champ(x, "Typologie") !== champ(r, "Typologie"))) p.alertes.push("Informations contradictoires entre les lignes CSV du même document.");
        if ([p.ht, p.tva, p.ttc].some(x => x === null)) p.alertes.push("Montant CSV illisible : document exclu des totaux contrôlés.");
        const old = index.get(ref);
        if (old) {
          old.sources.push(source.path);
          if (old.ht !== p.ht || old.tva !== p.tva || old.ttc !== p.ttc || old.client !== p.client || old.statut !== p.statut || old.type !== p.type || old.date !== p.date || old.taux.join() !== p.taux.join()) old.alertes.push("Deux CSV proposent des informations différentes : aucune fusion validée.");
          else old.infos.push("Même document dans plusieurs CSV, compté une seule fois.");
        } else index.set(ref, p);
      }
    } catch (e) { result.erreurs.push({ path: source.path, message: e instanceof Error ? e.message : "CSV illisible" }); }
  }
  const pdfs = new Map<string, ReturnType<typeof lirePdf>[]>();
  for (const source of uniques.filter(s => /\.pdf$/i.test(s.path))) {
    const pdf = lirePdf(source);
    if (!pdf) {
      if (!source.text.trim()) result.erreurs.push({ path: source.path, message: "PDF sans texte exploitable : lecture OCR nécessaire." });
      else result.annexes.push(source.path);
      continue;
    }
    let p = index.get(pdf.ref);
    if (!p) {
      p = piece(pdf.ref, pdf.ref[0] === "D" ? "Devis" : pdf.ref[0] === "A" ? "Avoir" : pdf.acompte ? "Acompte" : "Facture");
      p.ht = pdf.ht; p.tva = pdf.tva; p.ttc = pdf.net ?? pdf.ttc; p.date = pdf.date;
      p.alertes.push("Document présent en PDF sans ligne CSV correspondante."); index.set(pdf.ref, p);
    }
    p.sources.push(source.path);
    const variants = pdfs.get(pdf.ref) ?? []; variants.push(pdf); pdfs.set(pdf.ref, variants);
    p.pdfTtc = pdf.ttc; p.pdfHt = pdf.ht; p.pdfTva = pdf.tva; p.net = pdf.net; p.echeance = pdf.echeance;
    p.liens = [...new Set([...p.liens, ...pdf.links])];
    if (pdf.date && p.date && pdf.date !== p.date) p.alertes.push("La date du PDF diffère du CSV.");
    if (pdf.ttc === null) p.alertes.push("Total TTC non trouvé dans le PDF.");
    if (pdf.paid && p.statut === "Non réglé (CSV)") p.alertes.push("Le PDF est acquitté alors que le CSV indique non réglé.");
    if (pdf.acompte && p.type === "Facture") p.alertes.push("Le PDF indique un acompte, mais le CSV indique une facture ordinaire.");
  }
  // Reattach exact copies as provenance, without changing amounts or document counts.
  for (const copy of result.copies) {
    const p = [...index.values()].find(x => x.sources.includes(copy.original));
    if (p) p.sources.push(copy.path);
  }
  for (const [ref, p] of index) {
    const variants = pdfs.get(ref) ?? []; const pdf = variants[0];
    if (!pdf) p.alertes.push("PDF correspondant absent ou illisible.");
    if (variants.some(x => x && pdf && (x.ht !== pdf.ht || x.tva !== pdf.tva || x.ttc !== pdf.ttc || x.net !== pdf.net || x.echeance !== pdf.echeance || x.links.join() !== pdf.links.join()))) p.alertes.push("Les versions PDF ont des montants, échéances ou liens différents.");
    if (pdf && p.ht !== null && p.tva !== null && p.ttc !== null) {
      if (p.ttc !== (pdf.net ?? pdf.ttc)) p.alertes.push(`Écart CSV / PDF : ${eurosKhosmos(p.ttc)} contre ${eurosKhosmos(pdf.net ?? pdf.ttc)}.`);
      if (p.ht !== pdf.ht || p.tva !== pdf.tva) p.alertes.push("Les montants HT ou TVA diffèrent entre CSV et PDF.");
      if (p.ht + p.tva !== p.ttc) {
        const deduction = pdf.ttc !== null && pdf.net !== null ? pdf.ttc - pdf.net : 0;
        const acomptes = p.liens.filter(r => r[0] === "F").map(r => index.get(r)).filter(x => x?.type === "Acompte");
        if (deduction > 0 && pdf.ht !== null && pdf.tva !== null && pdf.ht + pdf.tva === pdf.ttc && pdf.net === p.ttc && acomptes.length && acomptes.reduce((s, x) => s + (x?.ttc ?? 0), 0) === deduction) {
          p.infos.push(`Écart HT + TVA / net expliqué par ${eurosKhosmos(deduction)} d'acompte(s) référencé(s) : ${acomptes.map(x => x?.ref).join(", ")}.`);
        } else p.alertes.push(`Écart HT + TVA / TTC source de ${eurosKhosmos(p.ht + p.tva - p.ttc)} : explication non confirmée.`);
      }
    }
    for (const link of p.liens) if (!index.has(link)) p.alertes.push(`Document lié ${link} absent du dossier.`);
    if (p.type === "Devis" && p.sources.some(s => normaliser(s).includes("devis signes")) && p.statut === "Non signé (CSV)") p.infos.push("Classé dans le dossier « Devis signés », mais non signé dans le CSV. Le classement seul ne prouve pas une signature ; statut CSV conservé.");
    p.alertes = [...new Set(p.alertes)]; p.infos = [...new Set(p.infos)];
  }
  // Fiscal line exports provide structured line counts; keep them separate from VAT summaries.
  for (const source of uniques.filter(s => /\.csv$/i.test(s.path) && /archivage.*ligne/i.test(s.path))) {
    try {
      const letter = /avoir/i.test(source.path) ? "A" : "F";
      for (const r of lireCsvKhosmos(source.text)) {
        const num = champ(r, letter === "A" ? "Référence avoir" : "Référence facture");
        const livraison = champ(r, "FAC-LIV-DAT"); const year = livraison.slice(0, 4);
        const candidates = [...index.values()].filter(p => p.ref[0] === letter && Number(p.ref.slice(-5)) === Number(num) && (!/^\d{4}$/.test(year) || p.ref.slice(1, 5) === year));
        if (candidates.length === 1) candidates[0]!.lignes++;
      }
    } catch { /* The file-level parsing error was already recorded above. */ }
  }
  expliquerArrondis(index, uniques);
  // Décision du propriétaire du 07/10/2026, limitée aux deux écarts connus.
  const acceptes = [{ ref: "D2026-00057", ht: 17644, tva: 1816, ttc: 19460, pdfTva: 1817, pdfTtc: 19461 },
    { ref: "D2026-00150", ht: 36363, tva: 3636, ttc: 40000, pdfTva: 3636, pdfTtc: 40000 }];
  for (const decision of acceptes) {
    const p = index.get(decision.ref);
    if (!p || p.ht !== decision.ht || p.pdfHt !== decision.ht || p.tva !== decision.tva || p.ttc !== decision.ttc || p.pdfTva !== decision.pdfTva || p.pdfTtc !== decision.pdfTtc) continue;
    const mineurs = p.alertes.filter(a => a.startsWith("Écart CSV / PDF") || a.startsWith("Écart HT + TVA / TTC") || a === "Les montants HT ou TVA diffèrent entre CSV et PDF.");
    if (!mineurs.length) continue;
    p.alertes = p.alertes.filter(a => !mineurs.includes(a));
    p.infos = p.infos.map(i => i.replace("son écart reste à vérifier.", "son écart a été accepté par le propriétaire."));
    p.infos.push("Écart d’un centime accepté par le propriétaire le 07/10/2026. Montants CSV et PDF d’origine conservés.", ...mineurs.map(a => `Écart accepté : ${a}`));
  }
  result.documents = [...index.values()].sort((a, b) => a.ref.localeCompare(b.ref));
  return result;
}
