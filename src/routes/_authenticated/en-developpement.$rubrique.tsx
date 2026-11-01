import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { RUBRIQUES_EN_DEVELOPPEMENT, type RubriqueEnDeveloppement } from "@/lib/rubriques-en-developpement";

export const Route = createFileRoute("/_authenticated/en-developpement/$rubrique")({ component: Page });
function Page() {
  const { rubrique } = Route.useParams();
  if (rubrique === "mentions") return <Navigate to="/mentions" replace />;
  if (rubrique === "messages") return <Navigate to="/messages" replace />;
  if (rubrique === "fournisseurs") return <Navigate to="/fournisseurs" replace />;
  if (rubrique === "tresorerie") return <Navigate to="/tresorerie" replace />;
  if (rubrique === "rapports") return <Navigate to="/rapports" replace />;
  if (rubrique === "planning") return <Navigate to="/planning" replace />;
  const definition = Object.hasOwn(RUBRIQUES_EN_DEVELOPPEMENT, rubrique) ? RUBRIQUES_EN_DEVELOPPEMENT[rubrique as RubriqueEnDeveloppement] : null;
  return <AppLayout titre={definition?.titre ?? "Rubrique indisponible"}>
    <h1 className="text-2xl font-semibold lg:text-3xl">{definition?.titre ?? "Rubrique indisponible"}</h1>
    <p className="mt-2 text-sm text-muted-foreground">{definition?.description ?? "Cette rubrique n’existe pas."}</p>
    {definition && <div className="mt-6 grid gap-4 sm:grid-cols-2">{definition.elements.map(titre => <section key={titre} className="rounded-2xl border border-border bg-card p-5">
      <Construction aria-hidden="true" className="mb-4 size-6 text-muted-foreground" />
      <h2 className="font-semibold">{titre}</h2>
      <span className="mt-3 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">En développement</span>
    </section>)}</div>}
    <Link to="/" className="mt-6 inline-flex text-sm font-medium text-primary underline underline-offset-4">Revenir aux documents</Link>
  </AppLayout>;
}
