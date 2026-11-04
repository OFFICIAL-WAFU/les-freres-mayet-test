import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, FilePlus2, RotateCcw, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { changerStatutConnaissance, lireConnaissances, lireModeles, RepriseIndisponible } from "@/data/reprise";
import { CATEGORIES_CONNAISSANCES, METIERS, STATUTS_CONNAISSANCES, type CategorieConnaissance, type Connaissance, type ModeleDevis, type StatutConnaissance } from "@/lib/reprise";

export const Route = createFileRoute("/_authenticated/connaissances")({
  head: () => ({ meta: [{ title: "Savoir-faire — Les Frères Mayet" }, { name: "description", content: "Tarifs, règles, façon de rédiger et modèles de devis de l’entreprise." }] }),
  component: Page,
});

const COULEURS: Record<StatutConnaissance, string> = {
  a_valider: "border-amber-300 bg-amber-50 text-amber-900",
  valide: "border-success/40 bg-success-soft text-foreground",
  rejete: "border-border bg-muted text-muted-foreground",
};

function FicheConnaissance({ c, onChange }: { c: Connaissance; onChange: (c: Connaissance) => void }) {
  const [enCours, setEnCours] = useState(false); const [erreur, setErreur] = useState("");
  async function changer(statut: StatutConnaissance) {
    setEnCours(true); setErreur("");
    try { onChange(await changerStatutConnaissance(c, statut)); } catch (e) { setErreur(e instanceof Error ? e.message : "Modification impossible."); } finally { setEnCours(false); }
  }
  return (
    <article className={`rounded-xl border bg-card p-4 ${c.statut === "rejete" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{c.titre}</h3>
          <p className="text-xs text-muted-foreground">{METIERS[c.metier] ?? c.metier}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${COULEURS[c.statut]}`}>{STATUTS_CONNAISSANCES[c.statut]}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{c.contenu}</p>
      {erreur && <p role="alert" className="mt-2 text-sm text-destructive">{erreur}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {c.statut !== "valide" && <Button size="sm" disabled={enCours} onClick={() => void changer("valide")}><Check /> Valider</Button>}
        {c.statut !== "rejete" && <Button size="sm" variant="outline" disabled={enCours} onClick={() => void changer("rejete")}><X /> Écarter</Button>}
        {c.statut !== "a_valider" && <Button size="sm" variant="ghost" disabled={enCours} onClick={() => void changer("a_valider")}><RotateCcw /> Remettre à valider</Button>}
      </div>
    </article>
  );
}

function CarteModele({ m }: { m: ModeleDevis }) {
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{m.nom}</h3>
          <p className="text-xs text-muted-foreground">{METIERS[m.metier] ?? m.metier} · {m.lignes.length} lignes</p>
        </div>
        <Button asChild size="sm" variant="action"><Link to="/devis/nouveau" search={{ modeleTravaux: m.id }}><FilePlus2 /> Créer un devis</Link></Button>
      </div>
      {m.notes_usage && <p className="mt-3 text-sm text-muted-foreground">{m.notes_usage}</p>}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium">Voir les lignes</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-2 font-medium">Désignation</th><th className="px-2 font-medium">Qté</th><th className="px-2 font-medium">Prix HT</th></tr></thead>
            <tbody>{m.lignes.map((l, i) => (
              <tr key={i} className="border-t border-border align-top">
                <td className="py-1.5 pr-2"><span className="font-medium">{l.designation}</span>{!l.articleId && l.description && <span className="block text-xs text-muted-foreground">{l.description}</span>}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{l.quantite.replace(".", ",")}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{l.prix ? `${l.prix.replace(".", ",")} €` : "à choisir"}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </details>
    </article>
  );
}

function Page() {
  const [liste, setListe] = useState<Connaissance[] | null>(null);
  const [modeles, setModeles] = useState<ModeleDevis[] | null>(null);
  const [erreur, setErreur] = useState(""); const [absent, setAbsent] = useState(false);
  const [filtre, setFiltre] = useState<StatutConnaissance | "tous">("tous");
  useEffect(() => {
    let actif = true;
    Promise.all([lireConnaissances(), lireModeles()]).then(([c, m]) => { if (actif) { setListe(c); setModeles(m); } })
      .catch(e => { if (!actif) return; if (e instanceof RepriseIndisponible) setAbsent(true); else setErreur(e instanceof Error ? e.message : "Lecture impossible."); });
    return () => { actif = false; };
  }, []);
  const aValider = liste?.filter(c => c.statut === "a_valider").length ?? 0;
  const groupes = useMemo(() => {
    const g = new Map<CategorieConnaissance, Connaissance[]>();
    for (const c of liste ?? []) if (filtre === "tous" || c.statut === filtre) g.set(c.categorie, [...(g.get(c.categorie) ?? []), c]);
    return [...g.entries()].sort((a, b) => Object.keys(CATEGORIES_CONNAISSANCES).indexOf(a[0]) - Object.keys(CATEGORIES_CONNAISSANCES).indexOf(b[0]));
  }, [liste, filtre]);
  const remplacer = (c: Connaissance) => setListe(l => l?.map(x => x.id === c.id ? c : x) ?? null);
  return (
    <AppLayout titre="Savoir-faire">
      <h1 className="text-2xl font-semibold">Savoir-faire de l’entreprise</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">Vos tarifs, vos règles, votre façon de rédiger et vos modèles de devis, tirés de vos documents Khosmos. Validez ce qui est juste : l’assistant IA des devis n’utilise que les fiches validées.</p>
      {absent && <p className="mt-6 rounded-xl border p-4 text-sm">La reprise Khosmos n’est pas installée dans cet environnement.</p>}
      {erreur && <p role="alert" className="mt-6 text-sm text-destructive">{erreur}</p>}
      {!absent && !erreur && (!liste || !modeles) && <p role="status" className="mt-6 text-sm">Chargement…</p>}
      {liste && modeles && (
        <Tabs defaultValue="connaissances" className="mt-6">
          <TabsList>
            <TabsTrigger value="connaissances">Connaissances{aValider > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 text-xs text-amber-900">{aValider} à valider</span>}</TabsTrigger>
            <TabsTrigger value="modeles">Modèles de devis ({modeles.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="connaissances">
            <div className="mt-2 flex flex-wrap gap-2">
              {(["tous", "a_valider", "valide", "rejete"] as const).map(f => (
                <Button key={f} size="sm" variant={filtre === f ? "default" : "outline"} onClick={() => setFiltre(f)}>
                  {f === "tous" ? `Toutes (${liste.length})` : `${STATUTS_CONNAISSANCES[f]} (${liste.filter(c => c.statut === f).length})`}
                </Button>
              ))}
            </div>
            {groupes.length === 0 && <p className="mt-6 text-sm text-muted-foreground">Aucune fiche pour ce filtre.</p>}
            {groupes.map(([cat, cs]) => (
              <section key={cat} className="mt-6">
                <h2 className="text-lg font-semibold">{CATEGORIES_CONNAISSANCES[cat]}</h2>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">{cs.map(c => <FicheConnaissance key={c.id} c={c} onChange={remplacer} />)}</div>
              </section>
            ))}
          </TabsContent>
          <TabsContent value="modeles">
            <p className="mt-2 text-sm text-muted-foreground">Construits à partir de vos devis : les lignes habituelles, avec les prix et quantités les plus courants. « Créer un devis » ouvre un brouillon pré-rempli : choisissez le client, complétez les lignes « à choisir », vérifiez les prix et la TVA.</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">{modeles.map(m => <CarteModele key={m.id} m={m} />)}</div>
          </TabsContent>
        </Tabs>
      )}
    </AppLayout>
  );
}
