import { useState } from "react";
import { AlertTriangle, Download, Loader2 } from "lucide-react";

import { versPublic } from "@/components/DevisApercu";
import { Button } from "@/components/ui/button";
import type { DocumentAvecDevis } from "@/data/documents";
import { useEtatEntreprise } from "@/data/entreprise";
import { telechargerDevisPdf } from "@/lib/devisPdf";

/** PDF de facture brouillon : uniquement les données enregistrées (sans notes internes) et la fiche entreprise enregistrée. */
export function FacturePdfBouton({ doc }: { doc: DocumentAvecDevis }) {
  const etatEnt = useEtatEntreprise();
  const finalisee = doc.statut === "Finalisé";
  // Facture finalisée : uniquement la copie figée de l'entreprise.
  const entreprise = finalisee ? doc.entrepriseFigee ?? null : etatEnt.statut === "pret" ? etatEnt.fiche : null;
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState(false);

  async function telecharger() {
    if (!doc.devis || !entreprise || enCours) return;
    const instantane = structuredClone(versPublic(doc.devis));
    setEnCours(true);
    setEchec(false);
    try {
      await telechargerDevisPdf(instantane, doc.numero, { ...entreprise }, false, { sourceRef: doc.devisSource?.reference ?? "", finalisee, ...(doc.pourcentage !== undefined ? { acompte: doc.pourcentage } : {}), ...(doc.deduction ? { deduction: doc.deduction } : {}) });
    } catch {
      setEchec(true);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={() => void telecharger()} disabled={enCours || !entreprise} aria-busy={enCours}>
        {enCours ? <Loader2 className="animate-spin" /> : <Download />}
        {enCours ? "Génération du PDF…" : finalisee ? "Télécharger le PDF" : "Télécharger le PDF brouillon"}
      </Button>
      {!finalisee && etatEnt.statut === "absente" && (
        <p className="text-xs text-muted-foreground">Enregistrez la fiche Entreprise pour télécharger le PDF.</p>
      )}
      {echec && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-card p-3 text-sm sm:flex-row sm:items-center">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <p className="flex-1">Le PDF n'a pas pu être généré. La facture est intacte ; vous pouvez réessayer.</p>
          <Button size="sm" variant="outline" onClick={() => void telecharger()} disabled={enCours}>Réessayer</Button>
        </div>
      )}
    </div>
  );
}
