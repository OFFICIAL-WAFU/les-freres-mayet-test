import { createFileRoute } from "@tanstack/react-router";
import { PageBientot } from "@/components/AppLayout";

export const Route = createFileRoute("/catalogue")({
  head: () => ({
    meta: [
      { title: "Catalogue — Les Frères Mayet" },
      { name: "description", content: "Catalogue des prestations et fournitures." },
      { property: "og:title", content: "Catalogue — Les Frères Mayet" },
      { property: "og:description", content: "Catalogue des prestations et fournitures." },
    ],
  }),
  component: () => <PageBientot titre="Catalogue" />,
});
