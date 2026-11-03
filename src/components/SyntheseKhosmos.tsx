import { Link } from "@tanstack/react-router";
import type { DocumentAvecDevis } from "@/data/documents";
import { suivre } from "@/data/reglements";
import { formaterCentimes } from "@/data/devis";
import { suiviEcheance } from "@/lib/echeances";
import { GraphiqueActivite } from "@/components/GraphiqueActivite";

export function SyntheseKhosmos({ documents }: { documents: DocumentAvecDevis[] }) {
  const paiements = (type: "facture" | "acompte") => {
    const liste = documents.filter(d => !d.fictif && d.type === type && d.statut === "Finalisé" && d.aRegler !== undefined)
      .map(d => ({ doc: d, suivi: suivre(d.aRegler!, d.reglements ?? [], d.credite ?? 0n) }));
    return {
      attendu: liste.reduce((s,d) => s + d.suivi.reste, 0n),
      paye: liste.reduce((s,d) => s + d.suivi.regle, 0n),
      retard: liste.filter(d => suiviEcheance(d.doc.devis?.validite, d.suivi.reste).etat === "retard").reduce((s,d) => s + d.suivi.reste, 0n),
    };
  };
  return <section className="mt-6 rounded-2xl bg-primary p-4 text-white sm:p-6" aria-label="Synthèse des documents">
    <h2 className="text-xl font-semibold">Chiffre d’affaires annuel HT</h2>
    <GraphiqueActivite documents={documents} />
    <div className="mt-5 grid gap-5 sm:grid-cols-2">
      {(["facture", "acompte"] as const).map(type => { const p = paiements(type); return <div key={type} className="grid content-start gap-2"><h3 className="text-xl font-semibold">{type === "facture" ? "Factures" : "Acomptes"}</h3>{([
        ["En attente de paiement", p.attendu, "bg-orange-500"], ["Payé", p.paye, "bg-teal-500"], ["En retard", p.retard, "bg-rose-500"],
      ] as const).map(([label, montant, couleur]) => <Link key={label} to="/" className="rounded-xl bg-white/15 p-3 hover:bg-white/25"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${couleur}`}>{label}</span><p className="mt-1 text-xl font-semibold">{formaterCentimes(montant)}</p></Link>)}</div>; })}
    </div>
    <p className="mt-4 text-xs text-white/80">Règlements enregistrés dans cet espace, toutes périodes. Les archives Khosmos sont consultables séparément.</p>
  </section>;
}
