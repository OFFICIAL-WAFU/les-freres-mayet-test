import { useState } from "react";
import type { DocumentAvecDevis } from "@/data/documents";
import { formaterCentimes } from "@/data/devis";
import { GraphiqueActivite } from "@/components/GraphiqueActivite";
import { detailSynthese, type CaseSynthese } from "@/lib/statuts";
import { ListeDocumentsDialog } from "@/components/ListeDocumentsDialog";
import { PERIODES_DOCUMENTS, type PeriodeDocuments } from "@/lib/suivi-clients";
import { BasculeHtTtc } from "@/components/BasculeHtTtc";
import { ChevronRight } from "lucide-react";
import { useModeMontants } from "@/data/mode-montants";

type Pastille = readonly [cle: CaseSynthese, libelle: string, couleur: string, aide?: string];

function Colonne({ titre, cases, montant, nombre, ouvrir }: { titre: string; cases: Pastille[]; montant: (k: CaseSynthese) => bigint; nombre: (k: CaseSynthese) => number; ouvrir: (k: CaseSynthese, libelle: string) => void }) {
  return <div className="grid content-start gap-2">
    <h3 className="text-lg font-semibold">{titre}</h3>
    {cases.map(([cle, libelle, couleur, aide]) => <button type="button" key={cle} onClick={() => ouvrir(cle, libelle)}
      className="group rounded-xl bg-white/15 p-3 text-left transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white" aria-label={`${libelle} : voir les ${nombre(cle)} documents`}>
      <span className="flex items-center justify-between gap-2">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${couleur}`}>{libelle}</span>
        <ChevronRight className="size-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
      </span>
      <p className="mt-1 text-xl font-semibold">{formaterCentimes(montant(cle))}</p>
      <p className="text-xs text-sidebar-foreground/80">{nombre(cle)} document{nombre(cle) > 1 ? "s" : ""}{aide ? ` · ${aide}` : ""}</p>
    </button>)}
  </div>;
}

export function SyntheseKhosmos({ documents }: { documents: DocumentAvecDevis[] }) {
  const [periode, setPeriode] = useState<PeriodeDocuments>("mois");
  const mode = useModeMontants();
  const detail = detailSynthese(documents, periode, undefined, mode);
  const montant = (k: CaseSynthese) => detail[k].reduce((t, e) => t + e.montant, 0n);
  const nombre = (k: CaseSynthese) => detail[k].length;
  const [ouverte, setOuverte] = useState<{ cle: CaseSynthese; titre: string } | null>(null);
  const ouvrir = (cle: CaseSynthese, libelle: string) => {
    const groupe = cle.startsWith("devis") ? "Devis" : cle.startsWith("factures") ? "Factures" : cle.startsWith("acomptes") ? "Acomptes" : "";
    setOuverte({ cle, titre: `${groupe ? `${groupe} — ` : ""}${libelle} · ${PERIODES_DOCUMENTS[periode]}` });
  };
  const col = { montant, nombre, ouvrir };
  return <section className="mt-6 rounded-3xl bg-sidebar p-4 text-sidebar-foreground sm:p-6" aria-label="Synthèse des documents">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Chiffre d’affaires annuel {mode === "ttc" ? "TTC" : "HT"}</h2>
      <BasculeHtTtc clair />
    </div>
    <GraphiqueActivite documents={documents} mode={mode} />
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Suivi de l’activité</h2>
      <label className="flex items-center gap-2 text-sm">Période
        <select className="rounded-md border border-sidebar-foreground/30 bg-sidebar-foreground/10 p-1.5 text-sidebar-foreground [&>option]:text-foreground" value={periode} onChange={e => setPeriode(e.target.value as PeriodeDocuments)}>
          {(["mois", "30jours", "annee", "toutes"] as const).map(p => <option key={p} value={p}>{PERIODES_DOCUMENTS[p]}</option>)}
        </select>
      </label>
    </div>
    <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <Colonne titre="Devis" {...col} cases={[
        ["devis.attente", "En attente de signature", "bg-orange-500"],
        ["devis.signe", "Signé", "bg-teal-500"],
        ["devis.refuse", "Refusé", "bg-slate-500"],
        ["devis.expire", "Expiré", "bg-slate-400"],
      ]} />
      <Colonne titre="Factures" {...col} cases={[
        ["factures.attente", "En attente de paiement", "bg-orange-500"],
        ["factures.paye", "Payé", "bg-teal-500"],
        ["factures.retard", "En retard", "bg-rose-500"],
      ]} />
      <Colonne titre="Acomptes" {...col} cases={[
        ["acomptes.attente", "En attente de paiement", "bg-orange-500"],
        ["acomptes.paye", "Payé", "bg-teal-500"],
        ["acomptes.retard", "En retard", "bg-rose-500"],
      ]} />
      <Colonne titre="Autres repères" {...col} cases={[
        ["aFacturer", "Devis à facturer", "bg-sky-500", "signés, pas encore facturés"],
        ["encaisse", "Total encaissé", "bg-teal-600", "règlements enregistrés"],
      ]} />
    </div>
    <p className="mt-4 text-xs text-sidebar-foreground/80">Montants {mode === "ttc" ? "TTC" : "HT"} sur la période choisie, mêmes définitions que dans Khosmos. Cliquez sur une case pour voir ses documents ; l’interrupteur en haut passe tous les montants en {mode === "ttc" ? "HT" : "TTC"}. Les factures annulées par avoir sont exclues. En HT, la part hors taxes d’un règlement ou d’un reste à payer suit la proportion HT/TTC de son document.</p>
    <ListeDocumentsDialog ouvert={!!ouverte} onFermer={() => setOuverte(null)} titre={ouverte?.titre ?? ""} mode={mode}
      elements={ouverte ? detail[ouverte.cle] : []}
      encaisser={!!ouverte && /attente|retard/.test(ouverte.cle) && !ouverte.cle.startsWith("devis")}
      description={ouverte?.cle === "encaisse" ? "Montant encaissé sur la période pour chaque document." : ouverte?.cle === "aFacturer" ? "Part de chaque devis signé pas encore couverte par une facture ou un acompte." : ouverte?.cle.endsWith(".paye") ? "Documents soldés sur la période (montant complet) et règlements partiels de la période." : undefined} />
  </section>;
}
