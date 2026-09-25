import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";

import { seDeconnecter } from "@/lib/session";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const RUBRIQUES = [
  { to: "/accueil", label: "Accueil" },
  { to: "/", label: "Documents" },
  { to: "/clients", label: "Clients" },
  { to: "/catalogue", label: "Catalogue" },
  { to: "/entreprise", label: "Entreprise" },
  { to: "/reglages", label: "Réglages" },
] as const;


function Marque() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
        FM
      </span>
      <span className="text-base font-semibold leading-tight text-foreground">
        Les Frères Mayet
      </span>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {RUBRIQUES.map((r) => (
        <Link
          key={r.to}
          to={r.to}
          activeOptions={{ exact: r.to === "/" }}
          onClick={onNavigate}

          className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
        >
          {r.label}
        </Link>
      ))}
    </nav>
  );
}

function BadgeDemo() {
  const navigate = useNavigate();
  const [enCours, setEnCours] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" size="sm" className="justify-start" disabled={enCours}
        onClick={async () => {
          setEnCours(true);
          await seDeconnecter();
          navigate({ to: "/connexion", replace: true });
        }}>
        <LogOut /> {enCours ? "Déconnexion…" : "Se déconnecter"}
      </Button>
      <span className="inline-flex items-center self-start rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        Version de démonstration
      </span>
      <p className="text-xs text-muted-foreground">Démonstration : les données sont réinitialisées au rechargement.</p>
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
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar p-4 lg:flex">
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

          <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
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
        Cet écran sera construit à une prochaine étape.
      </p>
    </AppLayout>
  );
}
