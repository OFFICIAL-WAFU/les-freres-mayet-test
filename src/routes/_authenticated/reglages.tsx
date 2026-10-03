import { createFileRoute } from "@tanstack/react-router";
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
    </AppLayout>
  );
}
