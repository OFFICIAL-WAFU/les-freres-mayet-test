import { createFileRoute } from "@tanstack/react-router";
import { PageBientot } from "@/components/AppLayout";

export const Route = createFileRoute("/entreprise")({
  head: () => ({
    meta: [
      { title: "Entreprise — Les Frères Mayet" },
      { name: "description", content: "Informations de la SARL Les Frères Mayet." },
      { property: "og:title", content: "Entreprise — Les Frères Mayet" },
      { property: "og:description", content: "Informations de la SARL Les Frères Mayet." },
    ],
  }),
  component: () => <PageBientot titre="Entreprise" />,
});
