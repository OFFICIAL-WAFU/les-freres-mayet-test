/**
 * Planning des interventions : agenda interne des passages prévus chez les clients. Local à l'appareil.
 * Dates AAAA-MM-JJ (Europe/Paris), jour courant toujours passé en paramètre. Les heures sont HH:MM, sans fuseau (heure locale).
 * Export .ics pour l'importer dans Google Agenda ou tout autre agenda : aucune connexion à un compte.
 */
export type StatutIntervention = "prevu" | "fait" | "annule";
export type Intervention = {
  id: string; date: string; debut: string; minutes: number; titre: string;
  client: string; adresse: string; notes: string; statut: StatutIntervention;
};
export type SaisieIntervention = Omit<Intervention, "id" | "statut">;
export type BibliothequePlanning = { version: number; interventions: Intervention[] };

const MAX = 1000;
export function dateReelle(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
}
function texte(t: unknown, nom: string, max: number, obligatoire: boolean, multi = false): string {
  if (typeof t !== "string") throw new Error(`${nom} : texte invalide.`);
  const v = (multi ? t.replace(/\r\n/g, "\n") : t).trim();
  if (obligatoire && !v) throw new Error(`${nom} est obligatoire.`);
  if (v.length > max || (multi ? /[\u0000-\u0009\u000b-\u001f]/ : /[\u0000-\u001f]/).test(v)) throw new Error(`${nom} : ${max} caractères au plus${multi ? "" : ", sur une seule ligne"}.`);
  return v;
}
export function validerSaisie(s: SaisieIntervention): SaisieIntervention {
  if (!dateReelle(s.date)) throw new Error("Date invalide.");
  if (typeof s.debut !== "string" || (s.debut !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.debut))) throw new Error("Heure de début invalide (exemple : 08:30).");
  if (!Number.isInteger(s.minutes) || s.minutes < 0 || s.minutes > 1440) throw new Error("Durée invalide (24 h au plus).");
  if (s.minutes > 0 && !s.debut) throw new Error("Indiquez l’heure de début pour fixer une durée.");
  return { date: s.date, debut: s.debut, minutes: s.minutes, titre: texte(s.titre, "Titre", 150, true), client: texte(s.client, "Client", 120, false), adresse: texte(s.adresse, "Adresse", 200, false), notes: texte(s.notes, "Notes", 2000, false, true) };
}
export function validerPlanning(b: unknown): BibliothequePlanning {
  const o = b as { version?: unknown; interventions?: unknown } | null;
  if (!o || typeof o !== "object" || !Number.isInteger(o.version) || (o.version as number) < 0 || !Array.isArray(o.interventions) || o.interventions.length > MAX) throw new Error("Planning illisible : données locales invalides.");
  const vus = new Set<string>();
  const interventions = (o.interventions as Intervention[]).map(i => {
    if (!i || typeof i.id !== "string" || !/^[\w-]{1,64}$/.test(i.id) || i.id === "__proto__" || vus.has(i.id)) throw new Error("Planning illisible : identifiant invalide.");
    vus.add(i.id);
    if (!["prevu", "fait", "annule"].includes(i.statut)) throw new Error("Planning illisible : statut invalide.");
    return { id: i.id, statut: i.statut, ...validerSaisie(i) };
  });
  return { version: o.version as number, interventions };
}
const trouver = (b: BibliothequePlanning, id: string) => { const i = b.interventions.findIndex(x => x.id === id); if (i < 0) throw new Error("Intervention introuvable."); return i; };
export function creerIntervention(b: BibliothequePlanning, s: SaisieIntervention, id: string): BibliothequePlanning {
  if (b.interventions.length >= MAX) throw new Error(`Limite de ${MAX} interventions atteinte : supprimez les plus anciennes.`);
  if (b.interventions.some(i => i.id === id)) throw new Error("Identifiant déjà utilisé.");
  return { ...b, interventions: [...b.interventions, { id, statut: "prevu", ...validerSaisie(s) }] };
}
export function modifierIntervention(b: BibliothequePlanning, id: string, s: SaisieIntervention): BibliothequePlanning {
  const k = trouver(b, id);
  return { ...b, interventions: b.interventions.map((x, j) => j === k ? { ...x, ...validerSaisie(s) } : x) };
}
export function changerStatut(b: BibliothequePlanning, id: string, statut: StatutIntervention): BibliothequePlanning {
  const k = trouver(b, id);
  return { ...b, interventions: b.interventions.map((x, j) => j === k ? { ...x, statut } : x) };
}
export function supprimerIntervention(b: BibliothequePlanning, id: string): BibliothequePlanning {
  trouver(b, id);
  return { ...b, interventions: b.interventions.filter(x => x.id !== id) };
}
const cle = (i: Intervention) => `${i.date} ${i.debut || "99:99"} ${i.id}`;
export function trier(l: Intervention[]) { return [...l].sort((a, b) => cle(a).localeCompare(cle(b))); }
export function ajouterJours(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function finIntervention(i: Intervention): string {
  if (!i.debut || !i.minutes) return "";
  const t = Number(i.debut.slice(0, 2)) * 60 + Number(i.debut.slice(3)) + i.minutes;
  return t >= 1440 ? "" : `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
/** Retard = prévues avant aujourd'hui, jamais marquées faites ou annulées. Jours = prévues de aujourd'hui à aujourd'hui + nombreJours - 1, groupées par date. */
export function preparerPlanning(l: Intervention[], aujourdHui: string, nombreJours = 14) {
  const fin = ajouterJours(aujourdHui, nombreJours - 1);
  const retard = trier(l.filter(i => i.statut === "prevu" && i.date < aujourdHui));
  const jours: { date: string; interventions: Intervention[] }[] = [];
  for (const i of trier(l.filter(x => x.statut !== "annule" && x.date >= aujourdHui && x.date <= fin))) {
    const dernier = jours[jours.length - 1];
    if (dernier && dernier.date === i.date) dernier.interventions.push(i); else jours.push({ date: i.date, interventions: [i] });
  }
  const plusTard = trier(l.filter(i => i.statut === "prevu" && i.date > fin));
  return { retard, jours, plusTard };
}
const echapper = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
function plier(ligne: string): string {
  const morceaux: string[] = []; let courant = "", octets = 0;
  for (const c of Array.from(ligne)) {
    const n = new TextEncoder().encode(c).length;
    if (octets + n > (morceaux.length ? 74 : 75)) { morceaux.push(courant); courant = ""; octets = 0; }
    courant += c; octets += n;
  }
  morceaux.push(courant); return morceaux.join("\r\n ");
}
/** Fichier iCalendar (RFC 5545) des interventions non annulées. Heures flottantes (heure locale de l'agenda qui importe). */
export function versIcs(l: Intervention[], maintenant: string): string {
  const stamp = maintenant.replace(/[-:]/g, "").replace(/\.\d+/, "").slice(0, 15) + "Z";
  const compact = (d: string) => d.replace(/-/g, "");
  const lignes = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Les Freres Mayet//Planning//FR", "CALSCALE:GREGORIAN"];
  for (const i of trier(l.filter(x => x.statut !== "annule"))) {
    lignes.push("BEGIN:VEVENT", `UID:${i.id}@planning.lesfreresmayet.invalid`, `DTSTAMP:${stamp}`);
    if (i.debut) {
      lignes.push(`DTSTART:${compact(i.date)}T${i.debut.replace(":", "")}00`);
      const fin = finIntervention(i);
      if (fin) lignes.push(`DTEND:${compact(i.date)}T${fin.replace(":", "")}00`);
    } else lignes.push(`DTSTART;VALUE=DATE:${compact(i.date)}`, `DTEND;VALUE=DATE:${compact(ajouterJours(i.date, 1))}`);
    lignes.push(`SUMMARY:${echapper(i.client ? `${i.titre} — ${i.client}` : i.titre)}`);
    if (i.adresse) lignes.push(`LOCATION:${echapper(i.adresse)}`);
    if (i.notes) lignes.push(`DESCRIPTION:${echapper(i.notes)}`);
    lignes.push("END:VEVENT");
  }
  lignes.push("END:VCALENDAR");
  return lignes.map(plier).join("\r\n") + "\r\n";
}
