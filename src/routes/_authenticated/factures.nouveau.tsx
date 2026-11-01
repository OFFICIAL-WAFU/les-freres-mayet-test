import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { DevisForm } from "@/components/DevisForm";
import { Button } from "@/components/ui/button";
import { factureDirecteDisponible } from "@/data/documents";
export const Route = createFileRoute("/_authenticated/factures/nouveau")({ component: Page });
function Page() {
  const [etat, setEtat] = useState<"chargement" | "disponible" | "installation" | "erreur">("chargement");
  const [essai, setEssai] = useState(0);
  useEffect(() => {
    let actif = true;
    setEtat("chargement");
    void factureDirecteDisponible().then(ok => { if (actif) setEtat(ok ? "disponible" : "installation"); })
      .catch(() => { if (actif) setEtat("erreur"); });
    return () => { actif = false; };
  }, [essai]);
  return <AppLayout titre="Nouvelle facture">
    {etat === "disponible" ? <DevisForm facture={{ sourceRef: "", directe: true }} /> :
      <section className="max-w-2xl rounded-2xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">Facture sans devis</h1>
        <p className="mt-4" role="status">{etat === "chargement" ? "Vérification de la sauvegarde…" : etat === "installation" ? "Le formulaire est prêt. Son mécanisme de sauvegarde doit encore être installé dans cette base." : "La disponibilité n’a pas pu être vérifiée. Aucun document n’a été créé."}</p>
        {etat === "installation" && <p className="mt-3 text-sm text-muted-foreground">En attendant, vous pouvez créer une facture depuis un devis finalisé. Cette vérification ne consomme aucun numéro.</p>}
        {etat !== "chargement" && <Button className="mt-4" variant="outline" onClick={() => setEssai(x => x + 1)}>Vérifier à nouveau</Button>}
        <Link to="/" className="mt-4 block underline">Revenir aux documents</Link>
      </section>}
  </AppLayout>;
}
