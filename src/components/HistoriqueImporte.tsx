import { useEffect, useMemo, useState } from "react";
import { formaterCentimes } from "@/data/devis";
import { lireDocumentsImportes, RepriseIndisponible } from "@/data/reprise";
import { dateFr, filtrerImportes, netAPayer, nombreFr, quantiteFr, statutKhosmos, titreImporte, TYPES_IMPORTES, type DocumentImporte, type TypeImporte } from "@/lib/reprise";

const euros = (c: number) => formaterCentimes(BigInt(c));

function Detail({ d }: { d: DocumentImporte }) {
  const net = netAPayer(d);
  const remise = typeof d.source["remise"] === "number" ? (d.source["remise"] as number) : null;
  return (
    <div className="mt-3 space-y-3 text-sm">
      <dl className="grid grid-cols-2 gap-2 rounded-lg bg-secondary p-3 sm:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Total HT</dt><dd className="font-semibold">{euros(d.total_ht_centimes)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">TVA</dt><dd className="font-semibold">{euros(d.total_tva_centimes)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Total TTC</dt><dd className="font-semibold">{euros(d.total_ttc_centimes)}</dd></div>
        {net !== d.total_ttc_centimes
          ? <div><dt className="text-xs text-muted-foreground">Net à payer (acomptes déduits)</dt><dd className="font-semibold">{euros(net)}</dd></div>
          : d.deja_regle_centimes !== null && <div><dt className="text-xs text-muted-foreground">Réglé</dt><dd className="font-semibold">{euros(d.deja_regle_centimes)}</dd></div>}
      </dl>
      {(d.reference_liee || d.date_echeance || remise) && (
        <p className="text-muted-foreground">
          {d.reference_liee && <>Lié à : {d.type === "avoir" ? "facture" : "devis"} n°{d.reference_liee}. </>}
          {d.date_echeance && <>{d.type === "devis" ? "Valable jusqu’au" : "Échéance"} : {dateFr(d.date_echeance)}. </>}
          {remise && <>Remise : {nombreFr(remise)} €.</>}
        </p>
      )}
      {d.lignes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="text-muted-foreground"><tr><th className="py-1 pr-2 font-medium">Désignation</th><th className="px-2 font-medium">Qté</th><th className="px-2 font-medium">PU HT</th><th className="px-2 font-medium">TVA</th></tr></thead>
            <tbody>
              {d.lignes.map((l, i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="py-1.5 pr-2"><span className="font-medium">{l.designation}</span>{l.description && <span className="block text-muted-foreground">{l.description}</span>}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{quantiteFr(l.quantite)} {l.unite ?? ""}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{l.prix_affiche === false ? "inclus" : `${nombreFr(l.prix_ht)} €`}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{typeof l.tva === "number" ? `${quantiteFr(l.tva)} %` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-muted-foreground">Pas de ligne détaillée dans Khosmos pour ce document.</p>}
      <p className="text-xs text-muted-foreground">Document figé, repris de Khosmos avec son numéro et ses montants d’origine. Le PDF original reste dans votre sauvegarde Khosmos.</p>
    </div>
  );
}

/** Historique Khosmos repris dans la base. Avec clientId : celui d'un client ; sinon tout l'historique avec recherche. */
export function HistoriqueImporte({ clientId }: { clientId?: string }) {
  const [docs, setDocs] = useState<DocumentImporte[] | null>(null);
  const [erreur, setErreur] = useState(""); const [absent, setAbsent] = useState(false);
  const [recherche, setRecherche] = useState(""); const [type, setType] = useState<TypeImporte | "tous">("tous");
  const [limite, setLimite] = useState(50);
  useEffect(() => {
    let actif = true; setDocs(null); setErreur("");
    lireDocumentsImportes(clientId).then(d => { if (actif) setDocs(d); })
      .catch(e => { if (!actif) return; if (e instanceof RepriseIndisponible) setAbsent(true); else setErreur(e instanceof Error ? e.message : "Lecture impossible."); });
    return () => { actif = false; };
  }, [clientId]);
  const visibles = useMemo(() => docs ? filtrerImportes(docs, recherche, type) : [], [docs, recherche, type]);
  if (absent) return clientId ? null : <p className="text-sm text-muted-foreground">La reprise Khosmos n’est pas installée dans cet environnement.</p>;
  if (erreur) return <p role="alert" className="text-sm text-destructive">{erreur}</p>;
  if (!docs) return <p role="status" className="text-sm text-muted-foreground">Chargement de l’historique…</p>;
  if (clientId && docs.length === 0) return <p className="text-sm text-muted-foreground">Aucun document Khosmos pour ce client.</p>;
  return (
    <div>
      {!clientId && (
        <div className="flex flex-wrap gap-3">
          <label className="grid min-w-0 flex-1 gap-1 text-sm">Rechercher<input className="rounded-md border border-input bg-background p-2" value={recherche} onChange={e => { setRecherche(e.target.value); setLimite(50); }} placeholder="Client, numéro…" /></label>
          <label className="grid gap-1 text-sm">Type<select className="rounded-md border border-input bg-background p-2" value={type} onChange={e => { setType(e.target.value as TypeImporte | "tous"); setLimite(50); }}><option value="tous">Tous</option>{Object.entries(TYPES_IMPORTES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
      )}
      {!clientId && <p className="mt-3 text-sm" aria-live="polite">{visibles.length} document(s)</p>}
      <ul className="mt-2 flex flex-col gap-2">
        {visibles.slice(0, limite).map(d => (
          <li key={d.id}>
            <details className="rounded-xl border border-border bg-card p-3">
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-semibold">{titreImporte(d)}{!clientId && <span className="font-normal text-muted-foreground"> · {d.client_nom}</span>}</span>
                <span className="text-sm text-muted-foreground">{dateFr(d.date_document)} · <span className="font-medium text-foreground">{euros(d.total_ttc_centimes)}</span> · {statutKhosmos(d.statut_source)}</span>
              </summary>
              <Detail d={d} />
            </details>
          </li>
        ))}
      </ul>
      {visibles.length > limite && <button type="button" className="mt-3 text-sm font-medium underline" onClick={() => setLimite(l => l + 100)}>Afficher plus ({visibles.length - limite} restants)</button>}
    </div>
  );
}
