import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpenCheck, Building2, Calculator, CalendarDays, ClipboardList, FileText, Home, LogOut, Menu, Package, Settings, StickyNote, Users, Wallet } from "lucide-react";

import { useEtatDocuments } from "@/data/documents";
import { seDeconnecter } from "@/lib/session";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";



function Marque() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
        FM
      </span>
      <span className="text-base font-extrabold leading-tight tracking-tight text-sidebar-foreground">
        Les Frères Mayet
      </span>
    </div>
  );
}

const lienNav = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-sidebar-foreground data-[status=active]:bg-primary data-[status=active]:font-semibold data-[status=active]:text-primary-foreground data-[status=active]:shadow-[0_6px_16px_-6px_hsl(40_44%_60%/0.7)]";

const GROUPES = [
  [
    { to: "/accueil", label: "Accueil", icone: Home },
    { to: "/", label: "Documents", icone: FileText },
    { to: "/clients", label: "Clients", icone: Users },
    { to: "/catalogue", label: "Inventaire", icone: Package },
  ],
  [
    { to: "/planning", label: "Planning", icone: CalendarDays },
    { to: "/rapports", label: "Rapports", icone: ClipboardList },
    { to: "/tresorerie", label: "Trésorerie", icone: Wallet },
    { to: "/marges", label: "Calcul de marge", icone: Calculator },
  ],
  [
    { to: "/entreprise", label: "Entreprise", icone: Building2 },
    { to: "/connaissances", label: "Savoir-faire", icone: BookOpenCheck },
    { to: "/mentions", label: "Mentions", icone: StickyNote },
    { to: "/reglages", label: "Réglages", icone: Settings },
  ],
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {GROUPES.map((g, i) => (
        <div key={i} className={`flex flex-col gap-1 ${i > 0 ? "mt-2 border-t border-sidebar-border pt-3" : ""}`}>
          {g.map((r) => (
            <Link key={r.to} to={r.to} activeOptions={{ exact: r.to === "/" }} onClick={onNavigate} className={lienNav}>
              <r.icone className="size-4 shrink-0" aria-hidden="true" />{r.label}
            </Link>
          ))}
        </div>
      ))}
      <details className="mt-2 border-t border-sidebar-border pt-3">
        <summary className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70">Autres outils</summary>
        <div className="mt-1 flex flex-col gap-1">
          <Link to="/imports" onClick={onNavigate} className="rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground">Exports et imports</Link>
          <Link to="/historique" onClick={onNavigate} className="rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground">Historique Khosmos</Link>
        </div>
      </details>
    </nav>
  );
}

function BadgeDemo() {
  const navigate = useNavigate();
  const { demo } = useEtatDocuments();
  const test = import.meta.env["VITE_SUPABASE_PROJECT_ID"] === "azulrjtrntkophlvdaio";
  const [enCours, setEnCours] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" size="sm" className="justify-start border-white/20 bg-white/5 text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground" disabled={enCours}
        onClick={async () => {
          setEnCours(true);
          await seDeconnecter();
          navigate({ to: "/connexion", replace: true });
        }}>
        <LogOut /> {enCours ? "Déconnexion…" : "Se déconnecter"}
      </Button>
      <span className="inline-flex items-center self-start rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-sidebar-foreground">
        {test ? "Environnement TEST" : demo ? "Exemples fictifs affichés" : "Espace privé"}
      </span>
      <p className="text-xs text-sidebar-foreground/60">Documents et règlements sauvegardés dans votre espace.</p>
    </div>
  );
}

export function AppLayout({ titre, children }: { titre: string; children: ReactNode }) {
  const [menuOuvert, setMenuOuvert] = useState(false);

  // Un panneau fermé par un changement de page peut laisser la page non cliquable : on rétablit.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!document.querySelector("[role=dialog],[role=alertdialog]")) document.body.style.pointerEvents = "";
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="khosmos-ui min-h-screen w-full overflow-x-hidden bg-background" data-page={titre}>
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-[230px] shrink-0 flex-col justify-between gap-4 overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 lg:flex">
          <div className="flex flex-col gap-6">
            <Marque />
            <NavLinks />
          </div>
          <BadgeDemo />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
            <Sheet open={menuOuvert} onOpenChange={setMenuOuvert}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Ouvrir le menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-4">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-full flex-col justify-between">
                  <div className="flex flex-col gap-6">
                    <Marque />
                    <NavLinks onNavigate={() => setMenuOuvert(false)} />
                  </div>
                  <BadgeDemo />
                </div>
              </SheetContent>
            </Sheet>
            <span className="truncate text-base font-semibold text-foreground">{titre}</span>
          </header>

          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 lg:px-8">
            <Link to="/entreprise" className="flex min-w-0 items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold hover:bg-secondary/70"><Building2 className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">Les Frères Mayet</span></Link>
            <Link to="/reglages" aria-label="Réglages" className="shrink-0 rounded-xl bg-secondary p-2.5 text-foreground hover:bg-secondary/70"><Settings className="size-5" /></Link>
          </div>
          {import.meta.env["VITE_SUPABASE_PROJECT_ID"] === "azulrjtrntkophlvdaio" && <div className="border-b border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-900">Environnement TEST — utilisez uniquement des données fictives.</div>}
          <main className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-[30px] lg:py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function PageBientot({ titre }: { titre: string }) {
  return (
    <AppLayout titre={titre}>
      <h1 className="text-2xl font-semibold text-foreground lg:text-3xl">{titre}</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        En développement — cet écran sera disponible à une prochaine étape.
      </p>
    </AppLayout>
  );
}
