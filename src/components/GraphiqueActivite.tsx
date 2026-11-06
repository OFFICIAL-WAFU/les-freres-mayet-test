import type { DocumentAvecDevis } from "@/data/documents";
import { formaterCentimes } from "@/data/devis";
import { activiteAnnuelle } from "@/lib/activite-annuelle";
import type { ModeMontant } from "@/lib/montants";
import { useState } from "react";
import { ListeDocumentsDialog } from "@/components/ListeDocumentsDialog";

const MOIS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
const MOIS_LONGS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

/** Montant court pour l’étiquette d’une barre : 4,4 k€ ou 132 €. */
function court(euros: number): string {
  const a = Math.abs(euros);
  const signe = euros < 0 ? "−" : "";
  if (a >= 10000) return `${signe}${Math.round(a / 1000)} k€`;
  if (a >= 1000) return `${signe}${(a / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€`;
  return `${signe}${Math.round(a).toLocaleString("fr-FR")} €`;
}

export function GraphiqueActivite({ documents, mode = "ht" }: { documents: DocumentAvecDevis[]; mode?: ModeMontant }) {
  const a = activiteAnnuelle(documents, undefined, mode);
  const tx = mode === "ttc" ? "TTC" : "HT";
  const [moisOuvert, setMoisOuvert] = useState<number | "annee" | null>(null);
  if (a.incomplets) return <p role="status" className="mt-3 rounded-xl bg-white/15 p-6">Graphique indisponible : {a.incomplets} document(s) sans montant HT ou date vérifiable. Rafraîchissez les documents pour réessayer.</p>;

  const valeurs = a.mois.map(v => Number(v) / 100);
  const maxAbs = Math.max(1, ...valeurs.map(v => Math.abs(v)));
  const maintenant = new Date();
  const anneeNum = Number(a.annee);
  const moisCourant = maintenant.getFullYear() === anneeNum ? maintenant.getMonth() : maintenant.getFullYear() > anneeNum ? 11 : -1;
  const ecoules = moisCourant >= 0 ? valeurs.slice(0, moisCourant + 1) : [];
  const moyenne = ecoules.length ? ecoules.reduce((t, v) => t + v, 0) / ecoules.length : 0;
  const meilleur = valeurs.reduce((m, v, i) => (v > (valeurs[m] ?? 0) ? i : m), 0);
  const aDesDonnees = valeurs.some(v => v !== 0);
  const courant = moisCourant >= 0 ? valeurs[moisCourant] ?? 0 : 0;
  const precedent = moisCourant > 0 ? valeurs[moisCourant - 1] ?? 0 : null;
  const evolution = precedent !== null && precedent > 0 ? Math.round(((courant - precedent) / precedent) * 100) : null;

  return <div className="mt-3 rounded-2xl bg-white/10 p-4 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <button type="button" onClick={() => setMoisOuvert("annee")} className="rounded text-left" title="Voir les factures et avoirs de l’année">
        <span className="block text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70">Facturé en {a.annee} · {tx}</span>
        <span className="block text-4xl font-extrabold tracking-tight text-[hsl(41_60%_72%)] sm:text-5xl">{formaterCentimes(a.total)}</span>
      </button>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-xs text-sidebar-foreground/70">Ce mois-ci</dt><dd className="font-bold">{moisCourant >= 0 ? court(courant) : "—"}{evolution !== null && <span className={`ml-1 text-xs font-semibold ${evolution >= 0 ? "text-emerald-300" : "text-red-300"}`}>{evolution >= 0 ? "▲" : "▼"} {Math.abs(evolution)} %</span>}</dd></div>
        <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-xs text-sidebar-foreground/70">Moyenne / mois</dt><dd className="font-bold">{ecoules.length ? court(moyenne) : "—"}</dd></div>
        <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-xs text-sidebar-foreground/70">Meilleur mois</dt><dd className="font-bold">{aDesDonnees ? `${MOIS[meilleur]} · ${court(valeurs[meilleur] ?? 0)}` : "—"}</dd></div>
      </dl>
    </div>

    <div className="relative mt-6" role="group" aria-label={`Facturation mensuelle ${a.annee}, ${tx}. Cliquez sur une barre pour voir les factures du mois.`}>
      {moyenne > 0 && <div className="pointer-events-none absolute inset-x-0 z-0 border-t border-dashed border-primary/60" style={{ bottom: `calc(2rem + (100% - 2rem - 1.5rem) * ${Math.min(1, moyenne / maxAbs)})` }}><span className="absolute -top-5 right-0 rounded bg-sidebar px-1.5 text-[11px] font-medium text-[hsl(41_60%_72%)]">moyenne {court(moyenne)}</span></div>}
      <div className="relative z-10 grid h-64 grid-cols-12 items-end gap-1.5 sm:gap-3">
        {valeurs.map((v, i) => {
          const hauteur = v === 0 ? 0 : Math.max(4, (Math.abs(v) / maxAbs) * 100);
          const futur = moisCourant >= 0 && i > moisCourant;
          const estCourant = i === moisCourant;
          const negatif = v < 0;
          return <button key={i} type="button" onClick={() => setMoisOuvert(i)} aria-label={`${MOIS_LONGS[i]} ${a.annee} : ${formaterCentimes(a.mois[i]!)} ${tx}. Voir les documents.`}
            className={`group flex h-full flex-col justify-end rounded-lg text-center outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-primary ${futur ? "opacity-40" : ""}`}>
            <span className={`mb-1 text-[11px] font-bold sm:text-xs ${v === 0 ? "text-sidebar-foreground/40" : "text-sidebar-foreground"}`}>{v === 0 ? "–" : court(v)}</span>
            <span className="flex min-h-0 flex-1 flex-col justify-end">
              <span className={`block w-full rounded-t-lg transition-all group-hover:brightness-110 ${negatif ? "bg-red-400" : estCourant ? "bg-accent" : "bg-primary"}`} style={{ height: `${hauteur}%` }} />
            </span>
            <span className={`mt-2 border-t border-white/15 pt-1.5 text-[11px] sm:text-xs ${estCourant ? "font-extrabold text-accent" : "text-sidebar-foreground/75"}`}>{MOIS[i]}</span>
          </button>;
        })}
      </div>
    </div>
    {!aDesDonnees && <p className="mt-4 text-center text-sm text-sidebar-foreground/75">Aucune facture finalisée pour l’instant en {a.annee}. Les barres apparaîtront dès la première facture.</p>}
    <p className="mt-4 text-xs text-sidebar-foreground/70">Cliquez sur une barre pour voir les factures du mois. <span className="inline-block size-2 rounded-full bg-accent align-middle" /> mois en cours · <span className="inline-block size-2 rounded-full bg-primary align-middle" /> mois passés.</p>
    <details className="mt-2 text-xs text-sidebar-foreground/70"><summary className="cursor-pointer">Comment c’est calculé ?</summary><p className="mt-2">Factures finalisées (montant {tx} complet, acompte compris), moins les avoirs, au mois de leur émission. Les factures d’acompte sont comptées avec la facture de solde. Ce graphique suit la facturation, pas les encaissements ni le solde bancaire.</p></details>
    <ListeDocumentsDialog ouvert={moisOuvert !== null} onFermer={() => setMoisOuvert(null)} mode={mode}
      titre={moisOuvert === "annee" ? `Chiffre d’affaires ${a.annee}` : moisOuvert !== null ? `Chiffre d’affaires — ${MOIS[moisOuvert]} ${a.annee}` : ""}
      description="Factures (montant complet, acompte compris) et avoirs en négatif."
      elements={moisOuvert === "annee" ? a.detail.flat() : moisOuvert !== null ? a.detail[moisOuvert]! : []} />
  </div>;
}
