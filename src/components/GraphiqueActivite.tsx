import type { DocumentAvecDevis } from "@/data/documents";
import { formaterCentimes } from "@/data/devis";
import { activiteAnnuelle } from "@/lib/activite-annuelle";
import type { ModeMontant } from "@/lib/montants";
import { useState } from "react";
import { ListeDocumentsDialog } from "@/components/ListeDocumentsDialog";

const MOIS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
export function GraphiqueActivite({ documents, mode = "ht" }: { documents: DocumentAvecDevis[]; mode?: ModeMontant }) {
  const a = activiteAnnuelle(documents, undefined, mode);
  const tx = mode === "ttc" ? "TTC" : "HT";
  const [moisOuvert, setMoisOuvert] = useState<number | "annee" | null>(null);
  if (a.incomplets) return <p role="status" className="mt-3 rounded-xl bg-white/15 p-6">Graphique indisponible : {a.incomplets} document(s) sans montant HT ou date vérifiable. Rafraîchissez les documents pour réessayer.</p>;
  const valeurs = a.mois.map(v => Number(v)/100);
  const min = Math.min(0, ...valeurs), max = Math.max(1, ...valeurs), amplitude = max-min;
  const x = (i:number) => 68+i*76;
  const y = (v:number) => 194-(v-min)/amplitude*152;
  return <div className="mt-3 rounded-2xl bg-white/10 p-3 sm:p-5">
    <button type="button" onClick={() => setMoisOuvert("annee")} className="rounded text-left text-2xl font-semibold underline-offset-4 hover:underline" title="Voir les factures et avoirs de l’année">{formaterCentimes(a.total)} <span className="text-sm font-normal">{tx} · {a.annee}</span></button>
    <svg viewBox="0 0 970 240" role="img" aria-label={`Chiffre d’affaires annuel ${tx} : ${formaterCentimes(a.total)}. Détail mensuel disponible ci-dessous.`} className="mt-3 w-full">
      {[0,1,2,3].map(i => { const v = min+amplitude*i/3; return <g key={i}><line x1="68" x2="910" y1={y(v)} y2={y(v)} stroke="white" opacity="0.18" /><text x="56" y={y(v)+4} textAnchor="end" fill="white" fontSize="12">{v.toLocaleString("fr-FR",{maximumFractionDigits:0})} €</text></g>; })}
      <polyline points={valeurs.map((v,i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round" />
      {valeurs.map((v,i) => <g key={i} role="button" tabIndex={0} className="cursor-pointer" onClick={() => setMoisOuvert(i)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setMoisOuvert(i); }}><rect x={x(i)-30} y="30" width="60" height="200" fill="transparent" /><circle cx={x(i)} cy={y(v)} r="5" fill="white"><title>{MOIS[i]} {a.annee} : {formaterCentimes(a.mois[i]!)} — cliquer pour voir les factures</title></circle><text x={x(i)} y="224" textAnchor="middle" fill="white" fontSize="12">{MOIS[i]}</text></g>)}
    </svg>
    <details className="text-sm"><summary className="cursor-pointer">Voir les montants mensuels</summary><dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{a.mois.map((v,i) => <div key={i}><dt className="text-xs text-sidebar-foreground/80">{MOIS[i]} {a.annee}</dt><dd><button type="button" className="font-semibold underline-offset-4 hover:underline" onClick={() => setMoisOuvert(i)}>{formaterCentimes(v)} <span className="text-xs font-normal">{tx}</span></button></dd></div>)}</dl></details>
    <p className="mt-3 text-xs text-sidebar-foreground/80">Factures finalisées (montant {tx} complet, acompte compris), moins les avoirs, au mois de leur émission — même calcul que Khosmos. Les factures d’acompte sont comptées avec la facture de solde. Ce graphique suit la facturation, pas les encaissements ni le solde bancaire. Cliquez sur un mois pour voir ses factures et avoirs.</p>
    <ListeDocumentsDialog ouvert={moisOuvert !== null} onFermer={() => setMoisOuvert(null)} mode={mode}
      titre={moisOuvert === "annee" ? `Chiffre d’affaires ${a.annee}` : moisOuvert !== null ? `Chiffre d’affaires — ${MOIS[moisOuvert]} ${a.annee}` : ""}
      description="Factures (montant complet, acompte compris) et avoirs en négatif."
      elements={moisOuvert === "annee" ? a.detail.flat() : moisOuvert !== null ? a.detail[moisOuvert]! : []} />
  </div>;
}
