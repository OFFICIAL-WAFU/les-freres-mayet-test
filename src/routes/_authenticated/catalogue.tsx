import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { ArticleForm } from "@/components/ArticleForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  METIER_LABELS,
  TYPE_ARTICLE_LABELS,
  UNITE_LABELS,
  ajouterArticle,
  chargerCatalogue,
  definirArchive,
  formaterPrix,
  modifierArticle,
  relireArticle,
  useEtatCatalogue,
  type Article,
  type ArticleSaisie,
  type ArticleType,
  type Metier,
} from "@/data/catalogue";

export const Route = createFileRoute("/_authenticated/catalogue")({
  head: () => ({
    meta: [
      { title: "Catalogue — Les Frères Mayet" },
      { name: "description", content: "Matériel et prestations habituelles de Les Frères Mayet." },
      { property: "og:title", content: "Catalogue — Les Frères Mayet" },
      { property: "og:description", content: "Matériel et prestations habituelles de Les Frères Mayet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CataloguePage,
});

type Etat = "actifs" | "archives" | "tous";
const TYPES: { value: ArticleType | "tous"; label: string }[] = [
  { value: "tous", label: "Tous les types" },
  { value: "materiel", label: "Matériel" },
  { value: "prestation", label: "Prestations" },
];
const METIERS: { value: Metier | "tous"; label: string }[] = [
  { value: "tous", label: "Tous les métiers" },
  ...(Object.keys(METIER_LABELS) as Metier[]).map((m) => ({ value: m, label: METIER_LABELS[m] })),
];
const ETATS: { value: Etat; label: string }[] = [
  { value: "actifs", label: "Actifs" },
  { value: "archives", label: "Archivés" },
  { value: "tous", label: "Tous les états" },
];

type Panneau = { mode: "ajout" } | { mode: "fiche"; id: string } | { mode: "edition"; id: string } | null;

function Filtre<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className="h-10 lg:w-44" aria-label={label}>
        <SelectValue>{options.find((o) => o.value === value)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function CataloguePage() {
  const etatCatalogue = useEtatCatalogue();
  const articles = etatCatalogue.articles;
  const [recherche, setRecherche] = useState("");
  const [type, setType] = useState<ArticleType | "tous">("tous");
  const [metier, setMetier] = useState<Metier | "tous">("tous");
  const [etat, setEtat] = useState<Etat>("actifs");
  const [panneau, setPanneau] = useState<Panneau>(null);
  const [formKey, setFormKey] = useState(0);

  const reinitialiser = () => { setRecherche(""); setType("tous"); setMetier("tous"); setEtat("actifs"); };

  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return articles.filter((a) => {
      if (type !== "tous" && a.type !== type) return false;
      if (metier !== "tous" && a.metier !== metier) return false;
      if (etat === "actifs" && a.archive) return false;
      if (etat === "archives" && !a.archive) return false;
      if (!q) return true;
      return [a.reference, a.designation, a.marque].some((t) => t.toLowerCase().includes(q));
    });
  }, [articles, recherche, type, metier, etat]);

  const courant = panneau && panneau.mode !== "ajout" ? articles.find((a) => a.id === panneau.id) : undefined;

  function ouvrirAjout() { setFormKey((k) => k + 1); setPanneau({ mode: "ajout" }); }
  async function sauver(s: ArticleSaisie, idTentative: string) {
    if (panneau?.mode === "edition") {
      const id = panneau.id;
      const version = articles.find((a) => a.id === id)?.majLe ?? "";
      await modifierArticle(id, s, version);
      setPanneau({ mode: "fiche", id });
    } else {
      const a = await ajouterArticle(idTentative, s);
      setPanneau({ mode: "fiche", id: a.id });
    }
    toast.success("Article enregistré");
  }
  async function rechargerArticle(id: string) {
    try {
      await relireArticle(id);
      setFormKey((k) => k + 1);
    } catch {
      toast.error("L'article n'a pas pu être rechargé. Réessayez.");
    }
  }
  const voir = (a: Article) => setPanneau({ mode: "fiche", id: a.id });

  return (
    <AppLayout titre="Catalogue">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground lg:text-3xl">Catalogue</h1>
          <p className="mt-2 text-sm text-muted-foreground">Votre matériel et vos prestations habituelles.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Votre catalogue est enregistré dans votre espace privé.
          </p>
        </div>
        <Button variant="action" size="lg" onClick={ouvrirAjout}><Plus /> Ajouter un article</Button>
      </div>

      {etatCatalogue.statut === "erreur" ? (
        <div role="alert" className="mt-6 rounded-2xl border border-destructive/40 bg-card p-8 text-center">
          <p className="text-sm font-medium text-destructive">Le catalogue n'a pas pu être chargé. Vérifiez votre connexion.</p>
          <Button variant="outline" className="mt-4" onClick={() => void chargerCatalogue()}>Réessayer</Button>
        </div>
      ) : etatCatalogue.statut !== "pret" ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center" aria-busy="true">
          <p className="text-sm text-muted-foreground">Chargement du catalogue…</p>
        </div>
      ) : articles.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium">Ajoutez votre premier article de matériel ou votre première prestation.</p>
          <Button variant="action" className="mt-4" onClick={ouvrirAjout}><Plus /> Ajouter un article</Button>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher une référence, une désignation ou une marque…"
                  aria-label="Rechercher un article"
                  className="h-10 pl-9"
                />
              </div>
              <Filtre value={type} onChange={setType} options={TYPES} label="Filtrer par type" />
              <Filtre value={metier} onChange={setMetier} options={METIERS} label="Filtrer par métier" />
              <Filtre value={etat} onChange={setEtat} options={ETATS} label="Filtrer par état" />
              <Button variant="outline" className="h-10" onClick={reinitialiser}>Réinitialiser</Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {resultats.length} article{resultats.length > 1 ? "s" : ""} affiché{resultats.length > 1 ? "s" : ""} sur {articles.length}
            </p>
          </div>

          {resultats.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-sm font-medium">Aucun article ne correspond à votre recherche.</p>
              <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                <Button variant="outline" onClick={reinitialiser}>Réinitialiser les filtres</Button>
                <Button variant="action" onClick={ouvrirAjout}><Plus /> Ajouter un article</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/60 text-left">
                      <th className="px-4 py-3 font-semibold">Référence interne</th>
                      <th className="px-4 py-3 font-semibold">Désignation</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Métier</th>
                      <th className="px-4 py-3 font-semibold">Unité</th>
                      <th className="px-4 py-3 text-right font-semibold">Prix de vente HT</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultats.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{a.reference}</td>
                        <td className="px-4 py-3">
                          {a.designation}
                          {a.archive && <EtiquetteArchive />}
                        </td>
                        <td className="px-4 py-3">{TYPE_ARTICLE_LABELS[a.type]}</td>
                        <td className="px-4 py-3">{METIER_LABELS[a.metier]}</td>
                        <td className="px-4 py-3">{UNITE_LABELS[a.unite]}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{formaterPrix(a.prixHT, a.unite)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="outline" size="sm" onClick={() => voir(a)}>Voir</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex flex-col gap-3 lg:hidden">
                {resultats.map((a) => (
                  <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-semibold">{a.designation}</p>
                        <p className="text-sm text-muted-foreground">{a.reference}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                        {TYPE_ARTICLE_LABELS[a.type]}
                      </span>
                    </div>
                    {a.archive && <EtiquetteArchive />}
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div><dt className="text-muted-foreground">Métier</dt><dd>{METIER_LABELS[a.metier]}</dd></div>
                      <div><dt className="text-muted-foreground">Unité</dt><dd>{UNITE_LABELS[a.unite]}</dd></div>
                      <div className="col-span-2"><dt className="text-muted-foreground">Prix de vente HT</dt><dd className="font-medium">{formaterPrix(a.prixHT, a.unite)}</dd></div>
                    </dl>
                    <Button variant="outline" className="mt-3 w-full" onClick={() => voir(a)}>Voir</Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <Sheet open={panneau !== null} onOpenChange={(o) => !o && setPanneau(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {panneau?.mode === "ajout" && (
            <>
              <SheetHeader>
                <SheetTitle>Ajouter un article</SheetTitle>
                <SheetDescription>Matériel ou prestation de votre catalogue.</SheetDescription>
              </SheetHeader>
              <ArticleForm key={formKey} articles={articles} onCancel={() => setPanneau(null)} onSave={sauver} onVoirExistant={voir} />
            </>
          )}
          {panneau?.mode === "edition" && courant && (
            <>
              <SheetHeader>
                <SheetTitle>Modifier l'article</SheetTitle>
                <SheetDescription>{courant.reference}</SheetDescription>
              </SheetHeader>
              <ArticleForm key={`${courant.id}-${formKey}`} initial={courant} articles={articles} onCancel={() => voir(courant)} onSave={sauver} onVoirExistant={voir} onRecharger={() => void rechargerArticle(courant.id)} />
            </>
          )}
          {panneau?.mode === "fiche" && courant && (
            <FicheArticle key={courant.id} article={courant} onModifier={() => setPanneau({ mode: "edition", id: courant.id })} onFermer={() => setPanneau(null)} />
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

function EtiquetteArchive() {
  return (
    <span className="ml-2 mt-1 inline-flex rounded-full border border-border bg-neutral-soft px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Archivé
    </span>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap break-words font-medium">{valeur.trim() || "—"}</dd>
    </div>
  );
}

function FicheArticle({ article: a, onModifier, onFermer }: { article: Article; onModifier: () => void; onFermer: () => void }) {
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState(false);
  async function basculer(archive: boolean) {
    if (enCours) return;
    setEnCours(true);
    setEchec(false);
    try {
      await definirArchive(a.id, archive, a.majLe ?? "");
      toast.success(archive ? "Article archivé" : "Article réactivé");
    } catch {
      setEchec(true);
    } finally {
      setEnCours(false);
    }
  }
  return (
    <>
      <SheetHeader>
        <SheetTitle className="break-words pr-6">{a.designation}</SheetTitle>
        <SheetDescription>{a.reference}</SheetDescription>
      </SheetHeader>
      <Button variant="outline" className="mt-4 self-start" onClick={onModifier}>Modifier</Button>
      <dl className="mt-6 grid gap-3 text-sm">
        <Ligne label="État" valeur={a.archive ? "Archivé" : "Actif"} />
        <Ligne label="Type" valeur={TYPE_ARTICLE_LABELS[a.type]} />
        <Ligne label="Métier" valeur={METIER_LABELS[a.metier]} />
        <Ligne label="Description" valeur={a.description} />
        <Ligne label="Unité" valeur={UNITE_LABELS[a.unite]} />
        <Ligne label="Prix de vente HT" valeur={formaterPrix(a.prixHT, a.unite)} />
        {a.type === "materiel" && (
          <>
            <Ligne label="Marque" valeur={a.marque} />
            <Ligne label="Référence fabricant" valeur={a.referenceFabricant} />
          </>
        )}
        <Ligne label="Notes internes (non destinées aux documents clients)" valeur={a.notes} />
      </dl>

      <section className="mt-6 rounded-xl border border-border p-3 text-sm">
        {a.archive ? (
          <>
            <p className="text-muted-foreground">Cet article est archivé : il n'apparaît plus dans le catalogue actif.</p>
            <Button variant="outline" className="mt-3" disabled={enCours} onClick={() => void basculer(false)}>{enCours ? "Enregistrement…" : "Réactiver cet article"}</Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">Cet article sera masqué du catalogue actif. Vous pourrez le réactiver.</p>
            <Button variant="outline" className="mt-3" disabled={enCours} onClick={() => void basculer(true)}>{enCours ? "Enregistrement…" : "Archiver cet article"}</Button>
          </>
        )}
        {echec && (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">
            Le changement n'a pas été enregistré (connexion ou version plus récente ailleurs). L'état précédent est conservé ; réessayez.
          </p>
        )}
      </section>

      <Button variant="outline" className="mt-8 w-full" onClick={onFermer}>Fermer</Button>
    </>
  );
}
