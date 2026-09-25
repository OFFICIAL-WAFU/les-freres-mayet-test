import { Link } from "@tanstack/react-router";

import { Recap } from "@/components/DevisForm";
import { StatutBadge } from "@/components/StatutBadge";
import { Button } from "@/components/ui/button";
import { TYPE_ARTICLE_LABELS, UNITE_LABELS } from "@/data/catalogue";
import { formaterCentimes, labelTaux, recapituler, validerLigne } from "@/data/devis";
import type { DocumentAvecDevis } from "@/data/documents";

const fr = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");

/** Détail d'un brouillon de devis créé avec le formulaire. */
export function DevisDetail({ doc, onNavigate }: { doc: DocumentAvecDevis; onNavigate?: () => void }) {
  const d = doc.devis!;
  const recap = recapituler(d.lignes);
  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatutBadge statut="Brouillon" />
        <span className="text-muted-foreground">Référence provisoire {doc.numero} — brouillon non émis</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="action">
          <Link to="/devis/$id/modifier" params={{ id: doc.id }} onClick={onNavigate}>
            Modifier le brouillon
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/devis/$id/apercu" params={{ id: doc.id }} onClick={onNavigate}>
            Aperçu du devis
          </Link>
        </Button>
      </div>

      <section>
        <h3 className="font-semibold">Informations du devis</h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-3"><dt className="text-muted-foreground">Objet</dt><dd className="font-medium break-words">{d.objet}</dd></div>
          <div><dt className="text-muted-foreground">Date</dt><dd className="font-medium">{fr(d.date)}</dd></div>
          <div><dt className="text-muted-foreground">Validité</dt><dd className="font-medium">{fr(d.validite)}</dd></div>
        </dl>
      </section>

      <section>
        <h3 className="font-semibold">Client (coordonnées enregistrées avec le brouillon)</h3>
        <div className="mt-2">
          <p className="font-medium">{d.client.nom}</p>
          {d.client.contact && <p>Contact : {d.client.contact}</p>}
          {d.client.telephone && <p>{d.client.telephone}</p>}
          {d.client.email && <p className="break-all">{d.client.email}</p>}
          {d.client.adresse.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      </section>

      <section>
        <h3 className="font-semibold">Lignes</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {d.lignes.map((l, i) => {
            const c = validerLigne(l).calcul;
            return (
              <li key={l.cle} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium break-words">{i + 1}. {l.designation}</p>
                  <p className="font-semibold">{c ? formaterCentimes(c.ht) : "—"} HT</p>
                </div>
                {l.description && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{l.description}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {TYPE_ARTICLE_LABELS[l.type]} · {l.quantite} {l.unite ? UNITE_LABELS[l.unite] : ""} × {l.prix} € HT · TVA {l.taux !== null ? labelTaux(l.taux) : "—"}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-border p-3">
        <h3 className="font-semibold">Totaux</h3>
        <Recap recap={recap} vide={d.lignes.length === 0} />
      </section>

      <section>
        <h3 className="font-semibold">Remarques destinées au client</h3>
        <p className="mt-1 whitespace-pre-wrap">{d.remarques.trim() || "—"}</p>
      </section>

      <section className="rounded-xl border border-dashed border-border bg-muted p-3">
        <h3 className="font-semibold">Notes internes</h3>
        <p className="text-xs text-muted-foreground">Ces notes ne sont pas destinées aux documents clients.</p>
        <p className="mt-1 whitespace-pre-wrap">{d.notes.trim() || "—"}</p>
      </section>
    </div>
  );
}
