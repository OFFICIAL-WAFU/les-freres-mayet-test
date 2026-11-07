import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  METIER_LABELS,
  TYPE_ARTICLE_LABELS,
  UNITE_LABELS,
  ConflitVersionArticle,
  ReferenceDejaUtilisee,
  analyserPrix,
  analyserPrixAchat,
  normaliserReference,
  type Article,
  type ArticleSaisie,
  type ArticleType,
  type Metier,
  type Unite,
} from "@/data/catalogue";
import { lireReglagesChiffrage } from "@/data/habitudes";
import { REGLAGES_DEFAUT, formaterDecimal, type ReglagesChiffrage } from "@/lib/rentabilite";

interface Valeurs {
  type: ArticleType;
  reference: string;
  designation: string;
  description: string;
  metier: Metier | "";
  unite: Unite | "";
  prix: string;
  prixAchat: string;
  marque: string;
  referenceFabricant: string;
  notes: string;
}
type Cle = keyof Valeurs;
type Erreurs = Partial<Record<Cle, string>>;

function versValeurs(a: Article): Valeurs {
  return {
    type: a.type,
    reference: a.reference,
    designation: a.designation,
    description: a.description,
    metier: a.metier,
    unite: a.unite,
    prix: String(a.prixHT).replace(".", ","),
    prixAchat: a.prixAchat === null ? "" : a.prixAchat.toFixed(2).replace(".", ","),
    marque: a.marque,
    referenceFabricant: a.referenceFabricant,
    notes: a.notes,
  };
}

const UNITE_PAR_DEFAUT: Record<ArticleType, Unite> = { materiel: "piece", prestation: "forfait" };

/** Référence interne proposée à partir de la désignation (sans accents, majuscules), unique dans le catalogue. */
export function genererReference(designation: string, articles: Article[]): string {
  const base = designation
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 14).replace(/-+$/g, "") || "ART";
  const pris = new Set(articles.map((a) => normaliserReference(a.reference)));
  if (!pris.has(normaliserReference(base))) return base;
  for (let i = 2; i < 1000; i++) if (!pris.has(normaliserReference(`${base}-${i}`))) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}

function vide(type: ArticleType): Valeurs {
  return {
    type, reference: "", designation: "", description: "", metier: "general", unite: UNITE_PAR_DEFAUT[type],
    prix: "", prixAchat: "", marque: "", referenceFabricant: "", notes: "",
  };
}

function Champ({ id, label, facultatif, erreur, aide, children }: {
  id: string; label: string; facultatif?: boolean; erreur?: string | undefined; aide?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        <span className="ml-1 font-normal text-muted-foreground">
          {!facultatif && "(obligatoire)"}
        </span>
      </Label>
      {children}
      {aide && <p className="text-xs text-muted-foreground">{aide}</p>}
      {erreur && <p id={`${id}-erreur`} className="text-sm font-medium text-destructive">{erreur}</p>}
    </div>
  );
}

export type ModeSauvegarde = "fermer" | "suivant";

export function ArticleForm({ initial, typeInitial = "materiel", articles, onCancel, onSave, onVoirExistant, onRecharger }: {
  initial?: Article;
  /** Type proposé à la création (le formulaire s'ouvre directement, sans écran de choix). */
  typeInitial?: ArticleType;
  articles: Article[];
  onCancel: () => void;
  /** Résout après confirmation du serveur ; rejette en cas d'échec. */
  onSave: (s: ArticleSaisie, idTentative: string, mode: ModeSauvegarde) => Promise<unknown>;
  onVoirExistant: (a: Article) => void;
  onRecharger?: () => void;
}) {
  const [v, setV] = useState<Valeurs>(initial ? versValeurs(initial) : vide(typeInitial));
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [doublon, setDoublon] = useState<Article | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState<"reseau" | "conflit" | null>(null);
  const idTentative = useRef<string>(crypto.randomUUID());
  const [reglages, setReglages] = useState<ReglagesChiffrage>(REGLAGES_DEFAUT);
  useEffect(() => { let actif = true; lireReglagesChiffrage().then((r) => { if (actif) setReglages(r); }).catch(() => {}); return () => { actif = false; }; }, []);

  const val = v;
  const set = (k: Cle, valeur: string) => {
    setV({ ...val, [k]: valeur });
    if (erreurs[k]) setErreurs({ ...erreurs, [k]: undefined });
    if (k === "reference") setDoublon(null);
  };
  const inp = (k: Cle, extra?: React.ComponentProps<typeof Input>) => (
    <Input
      id={`a-${k}`}
      value={val[k] as string}
      onChange={(e) => set(k, e.target.value)}
      aria-invalid={!!erreurs[k]}
      aria-describedby={erreurs[k] ? `a-${k}-erreur` : undefined}
      {...extra}
    />
  );

  function changerType(t: ArticleType) {
    if (t === val.type) return;
    const unitePrecedente = UNITE_PAR_DEFAUT[val.type];
    setV({ ...val, type: t, unite: val.unite === unitePrecedente ? UNITE_PAR_DEFAUT[t] : val.unite });
  }

  function enregistrer(mode: ModeSauvegarde = "fermer") {
    const e: Erreurs = {};
    // À la création, une référence vide est remplie automatiquement ; en modification elle reste obligatoire.
    if (!val.reference.trim() && initial) e.reference = "Indiquez une référence interne.";
    if (!val.designation.trim()) e.designation = "Indiquez une désignation.";
    if (!val.metier) e.metier = "Choisissez un métier.";
    if (!val.unite) e.unite = "Choisissez une unité.";
    const prix = analyserPrix(val.prix);
    if (typeof prix === "string") e.prix = prix;
    const prixAchat = analyserPrixAchat(val.prixAchat);
    if (typeof prixAchat === "string") e.prixAchat = prixAchat;
    let d: Article | null = null;
    if (val.reference.trim()) {
      const r = normaliserReference(val.reference);
      d = articles.find((x) => x.id !== initial?.id && normaliserReference(x.reference) === r) ?? null;
      if (d) e.reference = `Cette référence est déjà utilisée par « ${d.designation} »${d.archive ? " (article archivé)" : ""}.`;
    }
    setDoublon(d);
    setErreurs(e);
    if (Object.keys(e).length > 0 || typeof prix === "string" || typeof prixAchat === "string") return;
    if (enCours) return;
    const materiel = val.type === "materiel";
    const reference = val.reference.trim() || genererReference(val.designation, articles);
    setEnCours(true);
    setEchec(null);
    onSave({
      type: val.type,
      reference,
      designation: val.designation.trim(),
      description: val.description.trim(),
      metier: val.metier as Metier,
      unite: val.unite as Unite,
      prixHT: prix,
      prixAchat,
      marque: materiel ? val.marque.trim() : "",
      referenceFabricant: materiel ? val.referenceFabricant.trim() : "",
      notes: val.notes.trim(),
    }, idTentative.current, mode)
      .catch((err: unknown) => {
        if (err instanceof ReferenceDejaUtilisee) {
          const x = err.existant;
          setDoublon(x);
          setErreurs((prev) => ({
            ...prev,
            reference: x
              ? `Cette référence est déjà utilisée par « ${x.designation} »${x.archive ? " (article archivé)" : ""}.`
              : "Cette référence est déjà utilisée par un autre article.",
          }));
        } else {
          setEchec(err instanceof ConflitVersionArticle ? "conflit" : "reseau");
        }
      })
      .finally(() => setEnCours(false));
  }

  return (
    <form className="mt-6 flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); enregistrer("fermer"); }}>
      {initial ? (
        <p className="text-sm">Type : <span className="font-semibold">{TYPE_ARTICLE_LABELS[val.type]}</span></p>
      ) : (
        <div role="group" aria-label="Type d'article" className="flex w-fit gap-1 rounded-xl bg-secondary p-1">
          {(["materiel", "prestation"] as ArticleType[]).map((t) => (
            <Button key={t} type="button" size="sm" variant={val.type === t ? "action" : "ghost"} aria-pressed={val.type === t} onClick={() => changerType(t)}>
              {TYPE_ARTICLE_LABELS[t]}
            </Button>
          ))}
        </div>
      )}

      <Champ id="a-designation" label="Désignation" erreur={erreurs.designation}>
        {inp("designation", { autoFocus: !initial })}
      </Champ>
      <Champ id="a-reference" label="Référence interne" facultatif={!initial} aide={initial ? undefined : "Laissez vide : elle sera créée à partir de la désignation."} erreur={erreurs.reference}>
        {inp("reference", { autoComplete: "off" })}
      </Champ>
      {doublon && (
        <div role="alert" className="rounded-xl border border-warning bg-warning-soft p-3 text-sm">
          <p className="flex gap-2 font-medium">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Chaque article doit avoir sa propre référence interne. Modifiez la référence ou consultez l'article existant.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onVoirExistant(doublon)}>
            Ouvrir la fiche correspondante
          </Button>
        </div>
      )}
      <Champ id="a-description" label="Description" facultatif aide="Cette description pourra être reprise dans vos futurs devis.">
        <Textarea id="a-description" rows={3} value={val.description} onChange={(e) => set("description", e.target.value)} />
      </Champ>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ id="a-metier" label="Métier" erreur={erreurs.metier}>
          <Select value={val.metier} onValueChange={(x) => set("metier", x)}>
            <SelectTrigger id="a-metier" aria-invalid={!!erreurs.metier}>
              <SelectValue placeholder="Choisir…">{val.metier ? METIER_LABELS[val.metier] : undefined}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(METIER_LABELS) as Metier[]).map((m) => (
                <SelectItem key={m} value={m}>{METIER_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Champ>
        <Champ id="a-unite" label="Unité" erreur={erreurs.unite}>
          <Select value={val.unite} onValueChange={(x) => set("unite", x)}>
            <SelectTrigger id="a-unite" aria-invalid={!!erreurs.unite}>
              <SelectValue placeholder="Choisir…">{val.unite ? UNITE_LABELS[val.unite] : undefined}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(UNITE_LABELS) as Unite[]).map((u) => (
                <SelectItem key={u} value={u}>{UNITE_LABELS[u]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Champ>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ id="a-prixAchat" label="Prix d'achat unitaire HT (€)" facultatif erreur={erreurs.prixAchat}
          aide="Ce qu'il vous coûte. Interne : jamais visible par le client.">
          {inp("prixAchat", { inputMode: "decimal", placeholder: "Exemple : 47,12" })}
        </Champ>
        <Champ id="a-prix" label="Prix de vente unitaire HT (€)" erreur={erreurs.prix}>
          {inp("prix", { inputMode: "decimal", placeholder: "Exemple : 60,50" })}
        </Champ>
      </div>
      {(() => {
        const achat = analyserPrixAchat(val.prixAchat);
        if (typeof achat !== "number") return null;
        const conseille = Math.floor((Math.round(achat * 100) * reglages.coefMilliemes + 500) / 1000);
        const texte = formaterDecimal(BigInt(conseille), 2, 2);
        const actuel = analyserPrix(val.prix);
        const identique = typeof actuel === "number" && Math.round(actuel * 100) === conseille;
        return (
          <div className="-mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Avec votre coefficient {formaterDecimal(reglages.coefMilliemes, 3, 1)} : prix de vente conseillé {texte} € HT.</span>
            {!identique && (
              <Button type="button" size="sm" variant="outline" onClick={() => set("prix", texte)}>Appliquer ce prix</Button>
            )}
          </div>
        );
      })()}
      {val.type === "materiel" && (
        <>
          <Champ id="a-marque" label="Marque" facultatif>{inp("marque")}</Champ>
          <Champ id="a-referenceFabricant" label="Référence fabricant" facultatif>{inp("referenceFabricant")}</Champ>
        </>
      )}
      <Champ id="a-notes" label="Notes internes" facultatif aide="Ces notes ne sont pas destinées aux documents clients.">
        <Textarea id="a-notes" rows={3} value={val.notes} onChange={(e) => set("notes", e.target.value)} />
      </Champ>

      {Object.values(erreurs).some(Boolean) && (
        <p className="text-sm font-medium text-destructive">Certains champs sont à corriger avant d'enregistrer.</p>
      )}
      {echec === "reseau" && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          L'article n'a pas pu être enregistré. Vos saisies sont conservées : vérifiez votre connexion puis réessayez.
        </p>
      )}
      {echec === "conflit" && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border border-warning/50 bg-warning-soft p-3 text-sm">
          <p>Une version plus récente de cet article a été enregistrée ailleurs (par exemple dans un autre onglet). Vos saisies n'ont pas été enregistrées et restent affichées.</p>
          {onRecharger && (
            <Button type="button" size="sm" variant="outline" className="self-start" onClick={onRecharger}>
              Recharger l'article
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={enCours}>Annuler</Button>
        {!initial && (
          <Button type="button" variant="outline" disabled={enCours} onClick={() => enregistrer("suivant")}>
            Enregistrer et ajouter un autre
          </Button>
        )}
        <Button type="submit" variant="action" disabled={enCours} aria-busy={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer l'article"}
        </Button>
      </div>
    </form>
  );
}
