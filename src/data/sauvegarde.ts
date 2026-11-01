import { dateParis } from "@/lib/echeances";
import { validerPlanning } from "@/lib/planning";
import { validerRapports } from "@/lib/rapports";
import { creerSauvegarde, fusionner, fusionnerSuivis, lireSauvegarde, type Sauvegarde } from "@/lib/sauvegarde";
import { validerSuivis } from "@/lib/suivi-devis";
import { validerTresorerie } from "@/lib/tresorerie";
import { lirePlanning, modifierPlanning } from "@/data/planning";
import { lireRapports, modifierRapports } from "@/data/rapports";
import { lireSuivisDevis, modifierSuiviDevis } from "@/data/suivi-devis";
import { lireTresorerie, modifierTresorerie } from "@/data/tresorerie";

export type ResumeImport = { rapports: number; interventions: number; charges: number; suivis: number; ignores: number };

export async function exporterSauvegarde(): Promise<Sauvegarde> {
  const [r, p, t, s] = await Promise.all([lireRapports(), lirePlanning(), lireTresorerie(), lireSuivisDevis()]);
  return creerSauvegarde({ rapports: r.rapports, prochainRapport: r.prochain, interventions: p.interventions, charges: t.charges, solde: t.solde, suivis: s.suivis }, new Date().toISOString());
}

/** Fusionne une sauvegarde sans rien écraser. Tout est validé AVANT la première écriture. */
export async function importerSauvegarde(texte: string): Promise<ResumeImport> {
  const sv = lireSauvegarde(texte), j = dateParis();
  validerRapports({ version: 0, prochain: sv.prochainRapport, rapports: sv.rapports }, j);
  validerPlanning({ version: 0, interventions: sv.interventions });
  validerTresorerie({ version: 0, charges: sv.charges, ...(sv.solde ? { solde: sv.solde } : {}) });
  validerSuivis({ version: 0, suivis: sv.suivis }, j);

  const resume: ResumeImport = { rapports: 0, interventions: 0, charges: 0, suivis: 0, ignores: 0 };
  const r = await lireRapports();
  const fr = fusionner(r.rapports, sv.rapports, (a, b) => a.numero === b.numero);
  if (fr.ajoutes) await modifierRapports(r.version, b => ({ ...b, prochain: Math.max(b.prochain, sv.prochainRapport), rapports: fusionner(b.rapports, sv.rapports, (a, c) => a.numero === c.numero).resultat }));
  resume.rapports = fr.ajoutes; resume.ignores += fr.ignores;

  const p = await lirePlanning();
  const fp = fusionner(p.interventions, sv.interventions);
  if (fp.ajoutes) await modifierPlanning(p.version, b => ({ ...b, interventions: fusionner(b.interventions, sv.interventions).resultat }));
  resume.interventions = fp.ajoutes; resume.ignores += fp.ignores;

  const t = await lireTresorerie();
  const ft = fusionner(t.charges, sv.charges);
  const soldeAjoute = !t.solde && !!sv.solde;
  if (ft.ajoutes || soldeAjoute) await modifierTresorerie(t.version, b => ({ ...b, ...(b.solde || !sv.solde ? {} : { solde: sv.solde }), charges: fusionner(b.charges, sv.charges).resultat }));
  resume.charges = ft.ajoutes; resume.ignores += ft.ignores;

  const s = await lireSuivisDevis();
  const fs = fusionnerSuivis(s.suivis, sv.suivis);
  let version = s.version;
  for (const [id, suivi] of Object.entries(sv.suivis)) {
    if (Object.prototype.hasOwnProperty.call(s.suivis, id) || id === "__proto__") continue;
    version = (await modifierSuiviDevis(id, version, () => suivi)).version;
  }
  resume.suivis = fs.ajoutes; resume.ignores += fs.ignores;
  return resume;
}
