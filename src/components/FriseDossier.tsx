import { Check, Circle, Clock } from "lucide-react";
import { useDevisSignes } from "@/data/signature-distante";
import { acompteDuDevis, factureDuDevis, useEtatDocuments, type DocumentAvecDevis } from "@/data/documents";
import { suivre } from "@/data/reglements";
import { cn } from "@/lib/utils";

type Ton = "fait" | "cours" | "vide";
type Etape = { titre: string; detail: string; ton: Ton };

function etatPaiement(d: DocumentAvecDevis | undefined, nom: string): Etape {
  if (!d) return { titre: nom, detail: "Pas encore créé", ton: "vide" };
  if (d.statut !== "Finalisé") return { titre: nom, detail: "Brouillon", ton: "cours" };
  if (d.aRegler === undefined) return { titre: nom, detail: "Finalisé", ton: "cours" };
  const s = suivre(d.aRegler, d.reglements ?? [], d.credite ?? 0n);
  if (s.reste === 0n) return { titre: nom, detail: "Payé", ton: "fait" };
  return { titre: nom, detail: s.regle > 0n ? "Partiellement réglé" : "À encaisser", ton: "cours" };
}

const frDate = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

/** Où en est le dossier : devis finalisé → signé → acompte → solde. Lecture seule. */
export function FriseDossier({ doc }: { doc: DocumentAvecDevis }) {
  const { brouillons } = useEtatDocuments();
  const signes = useDevisSignes();
  const sig = signes[doc.id];
  const etapes: Etape[] = [
    { titre: "Devis", detail: "Finalisé", ton: "fait" },
    { titre: "Signature", detail: sig ? `Signé le ${frDate(sig.signeLe)}` : "En attente", ton: sig ? "fait" : "cours" },
    etatPaiement(acompteDuDevis(brouillons, doc.id), "Acompte"),
    etatPaiement(factureDuDevis(brouillons, doc.id), "Facture de solde"),
  ];
  return (
    <ol aria-label="Avancement du dossier" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {etapes.map((e) => (
        <li
          key={e.titre}
          className={cn(
            "flex items-start gap-2 rounded-xl border p-3 text-sm",
            e.ton === "fait" && "border-success/30 bg-success-soft",
            e.ton === "cours" && "border-accent/30 bg-warning-soft",
            e.ton === "vide" && "border-border bg-neutral-soft text-muted-foreground",
          )}
        >
          {e.ton === "fait" ? <Check className="mt-0.5 size-4 text-success" aria-hidden /> : e.ton === "cours" ? <Clock className="mt-0.5 size-4 text-accent" aria-hidden /> : <Circle className="mt-0.5 size-4" aria-hidden />}
          <span><span className="block font-medium">{e.titre}</span><span className="text-xs">{e.detail}</span></span>
        </li>
      ))}
    </ol>
  );
}
