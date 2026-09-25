import { createFileRoute } from "@tanstack/react-router";
import { PageBientot } from "@/components/AppLayout";

export const Route = createFileRoute("/_authenticated/accueil")({
  head: () => ({
    meta: [
      { title: "Accueil — Les Frères Mayet" },
      { name: "description", content: "Accueil de la gestion Les Frères Mayet." },
      { property: "og:title", content: "Accueil — Les Frères Mayet" },
      { property: "og:description", content: "Accueil de la gestion Les Frères Mayet." },
    ],
  }),
  component: () => <PageBientot titre="Accueil" />,
});
