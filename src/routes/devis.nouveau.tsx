import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DevisForm } from "@/components/DevisForm";

export const Route = createFileRoute("/devis/nouveau")({
  head: () => ({
    meta: [
      { title: "Nouveau devis — Les Frères Mayet" },
      { name: "description", content: "Préparer un brouillon de devis de démonstration." },
      { property: "og:title", content: "Nouveau devis — Les Frères Mayet" },
      { property: "og:description", content: "Préparer un brouillon de devis de démonstration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppLayout titre="Nouveau devis">
      <DevisForm />
    </AppLayout>
  ),
});
