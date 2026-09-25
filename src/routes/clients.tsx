import { createFileRoute } from "@tanstack/react-router";
import { PageBientot } from "@/components/AppLayout";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Clients — Les Frères Mayet" },
      { name: "description", content: "Fiches clients de l'entreprise Les Frères Mayet." },
      { property: "og:title", content: "Clients — Les Frères Mayet" },
      { property: "og:description", content: "Fiches clients de l'entreprise Les Frères Mayet." },
    ],
  }),
  component: () => <PageBientot titre="Clients" />,
});
