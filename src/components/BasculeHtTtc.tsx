import type { ReactNode } from "react";
import { basculerModeMontants, definirModeMontants, useModeMontants } from "@/data/mode-montants";
import { cn } from "@/lib/utils";

/** Interrupteur « TTC | HT » des statistiques. `clair` : version pour fond bleu. */
export function BasculeHtTtc({ clair = false, className }: { clair?: boolean; className?: string }) {
  const mode = useModeMontants();
  return <div role="group" aria-label="Afficher les montants" className={cn("inline-flex rounded-full p-0.5 text-xs font-semibold", clair ? "bg-white/15" : "bg-secondary", className)}>
    {(["ttc", "ht"] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => definirModeMontants(m)}
      className={cn("rounded-full px-3 py-1 transition-colors", mode === m ? (clair ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground") : (clair ? "text-sidebar-foreground/85 hover:text-sidebar-foreground" : "text-muted-foreground hover:text-foreground"))}>
      {m === "ttc" ? "TTC" : "HT"}
    </button>)}
  </div>;
}

/** Montant cliquable : un clic bascule toutes les statistiques entre HT et TTC. */
export function MontantBasculable({ children, className }: { children: ReactNode; className?: string }) {
  const mode = useModeMontants();
  return <button type="button" onClick={basculerModeMontants} title={`Montant ${mode === "ttc" ? "TTC" : "HT"} — cliquer pour afficher en ${mode === "ttc" ? "HT" : "TTC"}`}
    className={cn("cursor-pointer rounded text-left underline-offset-4 hover:underline focus-visible:outline-2", className)}>
    {children} <span className="align-middle text-[0.65em] font-semibold opacity-75">{mode === "ttc" ? "TTC" : "HT"}</span>
  </button>;
}
