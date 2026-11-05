import { useSyncExternalStore } from "react";
import type { ModeMontant } from "@/lib/montants";

/** Choix HT / TTC des statistiques, mémorisé sur l'appareil et partagé par tous les écrans ouverts. */
const CLE = "mayet-mode-montants";
const abonnes = new Set<() => void>();
function lire(): ModeMontant {
  try { return localStorage.getItem(CLE) === "ht" ? "ht" : "ttc"; } catch { return "ttc"; }
}
let courant: ModeMontant | null = null;
const obtenir = () => (courant ??= lire());

export function definirModeMontants(mode: ModeMontant) {
  courant = mode;
  try { localStorage.setItem(CLE, mode); } catch { /* stockage indisponible : le choix vaut pour cette visite */ }
  abonnes.forEach((f) => f());
}
export const basculerModeMontants = () => definirModeMontants(obtenir() === "ttc" ? "ht" : "ttc");

export function useModeMontants(): ModeMontant {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      const surStockage = (e: StorageEvent) => { if (e.key === CLE) { courant = null; f(); } };
      window.addEventListener("storage", surStockage);
      return () => { abonnes.delete(f); window.removeEventListener("storage", surStockage); };
    },
    obtenir,
    () => "ttc",
  );
}
