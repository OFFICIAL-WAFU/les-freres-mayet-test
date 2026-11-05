import { useState } from "react";
import type { DocumentAvecDevis } from "@/data/documents";
import { formaterCentimes } from "@/data/devis";
import { GraphiqueActivite } from "@/components/GraphiqueActivite";
import { synthese } from "@/lib/statuts";
import { PERIODES_DOCUMENTS, type PeriodeDocuments } from "@/lib/suivi-clients";
import { BasculeHtTtc, MontantBasculable } from "@/components/BasculeHtTtc";
import { useModeMontants } from "@/data/mode-montants";

type Pastille = readonly [libelle: string, montant: bigint, couleur: string, aide?: string];

function Colonne({ titre, cases }: { titre: string; cases: Pastille[] }) {
  return <div className="grid content-start gap-2">
    <h3 className="text-lg font-semibold">{titre}</h3>
    {cases.map(([libelle, montant, couleur, aide]) => <div key={libelle} className="rounded-xl bg-white/15 p-3">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${couleur}`}>{libelle}</span>
      <p className="mt-1 text-xl font-semibold"><MontantBasculable>{formaterCentimes(montant)}</MontantBasculable></p>
      {aide && <p className="text-xs text-white/80">{aide}</p>}
    </div>)}
  </div>;
}

export function SyntheseKhosmos({ documents }: { documents: DocumentAvecDevis[] }) {
  const [periode, setPeriode] = useState<PeriodeDocuments>("mois");
  const mode = useModeMontants();
  const s = synthese(documents, periode, undefined, mode);
  const n = (k: number) => `${k} devis`;
  return <section className="mt-6 rounded-2xl bg-primary p-4 text-white sm:p-6" aria-label="Synthèse des documents">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Chiffre d’affaires annuel {mode === "ttc" ? "TTC" : "HT"}</h2>
      <BasculeHtTtc clair />
    </div>
    <GraphiqueActivite documents={documents} mode={mode} />
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Suivi de l’activité</h2>
      <label className="flex items-center gap-2 text-sm">Période
        <select className="rounded-md border border-white/30 bg-white/15 p-1.5 text-white [&>option]:text-foreground" value={periode} onChange={e => setPeriode(e.target.value as PeriodeDocuments)}>
          {(["mois", "30jours", "annee", "toutes"] as const).map(p => <option key={p} value={p}>{PERIODES_DOCUMENTS[p]}</option>)}
        </select>
      </label>
    </div>
    <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <Colonne titre="Devis" cases={[
        ["En attente de signature", s.devis.attente, "bg-orange-500", n(s.devis.nbAttente)],
        ["Signé", s.devis.signe, "bg-teal-500", n(s.devis.nbSigne)],
        ["Refusé", s.devis.refuse, "bg-slate-500", n(s.devis.nbRefuse)],
        ["Expiré", s.devis.expire, "bg-slate-400", n(s.devis.nbExpire)],
      ]} />
      <Colonne titre="Factures" cases={[
        ["En attente de paiement", s.factures.attente, "bg-orange-500"],
        ["Payé", s.factures.paye, "bg-teal-500"],
        ["En retard", s.factures.retard, "bg-rose-500"],
      ]} />
      <Colonne titre="Acomptes" cases={[
        ["En attente de paiement", s.acomptes.attente, "bg-orange-500"],
        ["Payé", s.acomptes.paye, "bg-teal-500"],
        ["En retard", s.acomptes.retard, "bg-rose-500"],
      ]} />
      <Colonne titre="Autres repères" cases={[
        ["Devis à facturer", s.aFacturer, "bg-sky-500", "Devis signés pas encore facturés"],
        ["Total encaissé", s.encaisse, "bg-teal-600", "Règlements enregistrés"],
      ]} />
    </div>
    <p className="mt-4 text-xs text-white/80">Montants {mode === "ttc" ? "TTC" : "HT"} sur la période choisie, mêmes définitions que dans Khosmos. Cliquez sur un montant pour passer en {mode === "ttc" ? "HT" : "TTC"}. Les factures annulées par avoir sont exclues. En HT, la part hors taxes d’un règlement ou d’un reste à payer suit la proportion HT/TTC de son document.</p>
  </section>;
}
