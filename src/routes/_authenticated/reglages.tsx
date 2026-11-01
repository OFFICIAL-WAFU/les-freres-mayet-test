import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exporterSauvegarde, importerSauvegarde } from "@/data/sauvegarde";
import { dateParis } from "@/lib/echeances";
import { nomFichierSauvegarde, TAILLE_MAX_SAUVEGARDE } from "@/lib/sauvegarde";
import { AppLayout } from "@/components/AppLayout";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { definirModeDemo, useEtatDocuments } from "@/data/documents";

export const Route = createFileRoute("/_authenticated/reglages")({
  head: () => ({
    meta: [
      { title: "Réglages — Les Frères Mayet" },
      { name: "description", content: "Réglages de l'application Les Frères Mayet." },
      { property: "og:title", content: "Réglages — Les Frères Mayet" },
      { property: "og:description", content: "Réglages de l'application Les Frères Mayet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function SauvegardeLocale() {
  const entree = useRef<HTMLInputElement>(null);
  const [occupe, setOccupe] = useState(false);
  const [compte, setCompte] = useState("");
  const exporter = async () => {
    setOccupe(true);
    try {
      const sv = await exporterSauvegarde();
      const url = URL.createObjectURL(new Blob([JSON.stringify(sv)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = nomFichierSauvegarde(dateParis()); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      setCompte(`Sauvegarde créée : ${sv.rapports.length} rapport(s), ${sv.interventions.length} intervention(s), ${sv.charges.length} charge(s), ${Object.keys(sv.suivis).length} suivi(s) de devis.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Sauvegarde impossible."); } finally { setOccupe(false); }
  };
  const importer = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > TAILLE_MAX_SAUVEGARDE) { toast.error("Fichier trop volumineux pour être une sauvegarde."); return; }
    setOccupe(true);
    try {
      const r = await importerSauvegarde(await f.text());
      setCompte(`Restauration terminée : ${r.rapports} rapport(s), ${r.interventions} intervention(s), ${r.charges} charge(s), ${r.suivis} suivi(s) ajoutés ; ${r.ignores} déjà présent(s) ou en conflit, laissé(s) tel(s) quel(s).`);
      toast.success("Sauvegarde restaurée");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Restauration impossible."); } finally { setOccupe(false); if (entree.current) entree.current.value = ""; }
  };
  return <section className="mt-6 max-w-3xl rounded-2xl border border-border bg-card p-4 sm:p-6">
    <h2 className="text-base font-semibold">Sauvegarde des données de cet appareil</h2>
    <p className="mt-1 text-sm text-muted-foreground">Rapports d’intervention, planning, suivi des devis et trésorerie sont conservés uniquement dans ce navigateur. Exportez-les régulièrement : vider les données du site ou changer d’appareil les efface. La restauration ajoute ce qui manque, sans rien écraser ni supprimer. Le fichier contient les signatures des clients : gardez-le en lieu sûr.</p>
    <div className="mt-4 flex flex-wrap gap-3"><Button variant="outline" disabled={occupe} onClick={() => void exporter()}>Exporter mes données</Button><Button variant="outline" disabled={occupe} onClick={() => entree.current?.click()}>Restaurer une sauvegarde</Button></div>
    <input ref={entree} type="file" accept="application/json,.json" className="sr-only" aria-label="Fichier de sauvegarde à restaurer" onChange={e => void importer(e.target.files?.[0])} />
    {compte && <p role="status" className="mt-3 text-sm">{compte}</p>}
  </section>;
}

function Page() {
  const { demo } = useEtatDocuments();
  return (
    <AppLayout titre="Réglages">
      <h1 className="text-2xl font-semibold lg:text-3xl">Réglages</h1>
      <section className="mt-6 max-w-3xl rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="mode-demo" className="text-base">Mode démonstration</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajoute à la liste Documents les documents fictifs des premières étapes, marqués « Fictif ». Ils ne sont jamais enregistrés.
              Désactivé par défaut et à chaque connexion.
            </p>
          </div>
          <Switch id="mode-demo" checked={demo} onCheckedChange={definirModeDemo} />
        </div>
      </section>
      <SauvegardeLocale />
    </AppLayout>
  );
}
