import { createFileRoute } from "@tanstack/react-router";
import { PageBientot } from "@/components/AppLayout";

export const Route = createFileRoute("/reglages")({
  head: () => ({
    meta: [
      { title: "Réglages — Les Frères Mayet" },
      { name: "description", content: "Réglages de l'application Les Frères Mayet." },
      { property: "og:title", content: "Réglages — Les Frères Mayet" },
      { property: "og:description", content: "Réglages de l'application Les Frères Mayet." },
    ],
  }),
  component: () => <PageBientot titre="Réglages" />,
});
