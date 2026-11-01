export type SaisieMarge = { achatMateriel: string; venteMateriel: string; heures: string; coutHoraire: string; venteHoraire: string; autresCouts: string };
function decimal(valeur: string): bigint {
  const s = valeur.trim().replace(",", ".");
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(s)) throw new Error("Saisissez un montant positif ou nul, avec deux décimales au maximum.");
  const [entier = "0", fraction = ""] = s.split(".");
  return BigInt(entier) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function calculerMarge(v: SaisieMarge) {
  const achatMateriel = decimal(v.achatMateriel), venteMateriel = decimal(v.venteMateriel);
  const heures = decimal(v.heures), coutHoraire = decimal(v.coutHoraire), venteHoraire = decimal(v.venteHoraire), autresCouts = decimal(v.autresCouts);
  const coutMainOeuvre = (heures * coutHoraire + 50n) / 100n;
  const venteMainOeuvre = (heures * venteHoraire + 50n) / 100n;
  const cout = achatMateriel + coutMainOeuvre + autresCouts;
  const vente = venteMateriel + venteMainOeuvre;
  const marge = vente - cout;
  const pourcentage = (base: bigint) => {
    if (!base) return null;
    const n = marge < 0n ? -marge : marge;
    const valeur = Number((n * 10000n + base / 2n) / base) / 100;
    return marge < 0n ? -valeur : valeur;
  };
  return { achatMateriel, venteMateriel, coutMainOeuvre, venteMainOeuvre, autresCouts, cout, vente, marge,
    tauxMarque: pourcentage(vente), tauxMarge: pourcentage(cout) };
}
export const eurosMarge = (n: bigint) => { const a = n < 0n ? -n : n; return `${n < 0n ? "−" : ""}${(a / 100n).toLocaleString("fr-FR")},${String(a % 100n).padStart(2, "0")} €`; };
