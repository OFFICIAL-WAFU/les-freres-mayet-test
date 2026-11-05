import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatutDocument } from "@/components/StatutDocument";
import { TYPE_LABELS, type DocumentAvecDevis } from "@/data/documents";
import { formaterCentimes } from "@/data/devis";
import { dateDocumentIso } from "@/lib/suivi-clients";
import type { ModeMontant } from "@/lib/montants";

export interface ElementListe { doc: DocumentAvecDevis; montant?: bigint }

const lien = (d: DocumentAvecDevis) =>
  d.type === "devis" ? { to: "/devis/$id" as const } : d.type === "avoir" ? { to: "/avoirs/$id" as const } : { to: "/factures/$id" as const };

/** Liste des documents derrière un chiffre de l'accueil : montant de chaque document, total identique au chiffre cliqué. */
export function ListeDocumentsDialog({ ouvert, onFermer, titre, description, elements, mode, encaisser }: {
  ouvert: boolean; onFermer: () => void; titre: string; description?: string | undefined; elements: ElementListe[]; mode: ModeMontant; encaisser?: boolean | undefined;
}) {
  const [recherche, setRecherche] = useState("");
  const tries = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return [...elements]
      .filter((e) => !q || `${e.doc.client} ${e.doc.numero}`.toLowerCase().includes(q))
      .sort((a, b) => (dateDocumentIso(b.doc.date) ?? "").localeCompare(dateDocumentIso(a.doc.date) ?? ""));
  }, [elements, recherche]);
  const total = tries.reduce((s, e) => s + (e.montant ?? 0n), 0n);
  const avecMontant = elements.some((e) => e.montant !== undefined);
  const tx = mode === "ttc" ? "TTC" : "HT";

  return (
    <Dialog open={ouvert} onOpenChange={(o) => { if (!o) { setRecherche(""); onFermer(); } }}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
          <DialogDescription>
            {elements.length} document{elements.length > 1 ? "s" : ""}{avecMontant && <> · total <strong className="text-foreground">{formaterCentimes(elements.reduce((s, e) => s + (e.montant ?? 0n), 0n))} {tx}</strong></>}
            {description && <span className="mt-1 block">{description}</span>}
          </DialogDescription>
        </DialogHeader>
        {elements.length > 6 && (
          <label className="relative block">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Rechercher un client ou un numéro" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </label>
        )}
        <ul className="-mx-2 min-h-0 flex-1 divide-y overflow-y-auto px-2">
          {tries.length === 0 && <li className="py-6 text-center text-muted-foreground">Aucun document.</li>}
          {tries.map(({ doc, montant }) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="break-words font-medium">{doc.client}</p>
                <p className="text-sm text-muted-foreground">{TYPE_LABELS[doc.type]} n°{doc.numero} · {doc.date}{doc.type === "devis" && doc.devis?.objet ? ` · ${doc.devis.objet}` : ""}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {montant !== undefined && <span className="font-semibold tabular-nums">{formaterCentimes(montant)} <span className="text-xs font-normal text-muted-foreground">{tx}</span></span>}
                <StatutDocument document={doc} />
                {encaisser && (doc.type === "facture" || doc.type === "acompte") && (
                  <Button asChild size="sm" variant="action"><Link to="/factures/$id" params={{ id: doc.id }} search={{ encaisser: true }} onClick={onFermer}>Encaisser</Link></Button>
                )}
                <Button asChild size="sm" variant="outline"><Link {...lien(doc)} params={{ id: doc.id }} onClick={onFermer}>Ouvrir</Link></Button>
              </div>
            </li>
          ))}
        </ul>
        {avecMontant && recherche && <p className="text-sm text-muted-foreground">Total des documents affichés : {formaterCentimes(total)} {tx}</p>}
      </DialogContent>
    </Dialog>
  );
}
