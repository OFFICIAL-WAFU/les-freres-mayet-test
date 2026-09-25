import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function EcranChargement() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-live="polite">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

/** Cadre commun des écrans de connexion et de récupération. */
export function AuthCadre({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-10 sm:items-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            FM
          </span>
          <span className="text-lg font-semibold text-foreground">Les Frères Mayet</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">{titre}</h1>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
