import { useState } from "react";
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
  analyserPrix,
  normaliserReference,
  type Article,
  type ArticleSaisie,
  type ArticleType,
  type Metier,
  type Unite,
} from "@/data/catalogue";

interface Valeurs {
  type: ArticleType;
  reference: string;
  designation: string;
  description: string;
  metier: Metier | "";
  unite: Unite | "";
  prix: string;
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
    marque: a.marque,
    referenceFabricant: a.referenceFabricant,
    notes: a.notes,
  };
}

function vide(type: ArticleType): Valeurs {
  return {
    type, reference: "", designation: "", description: "", metier: "general", unite: "",
    prix: "", marque: "", referenceFabricant: "", notes: "",
  };
}

function Champ({ id, label, facultatif, erreur, aide, children }: {
  id: string; label: string; facultatif?: boolean; erreur?: string | undefined; aide?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        <span className="ml-1 font-normal text-muted-foreground">
          {facultatif ? "(facultatif)" : "(obligatoire)"}
        </span>
      </Label>
      {children}
      {aide && <p className="text-xs text-muted-foreground">{aide}</p>}
      {erreur && <p id={`${id}-erreur`} className="text-sm font-medium text-destructive">{erreur}</p>}
    </div>
  );
}

export function ArticleForm({ initial, articles, onCancel, onSave, onVoirExistant }: {
  initial?: Article;
  articles: Article[];
  onCancel: () => void;
  onSave: (s: ArticleSaisie) => void;
  onVoirExistant: (a: Article) => void;
}) {
  const [v, setV] = useState<Valeurs | null>(initial ? versValeurs(initial) : null);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [doublon, setDoublon] = useState<Article | null>(null);

  if (!v) {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <p className="text-sm font-medium">Quel type d'article souhaitez-vous ajouter ?</p>
        {(["materiel", "prestation"] as ArticleType[]).map((t) => (
          <Button key={t} variant="outline" size="lg" className="justify-start" onClick={() => setV(vide(t))}>
            {TYPE_ARTICLE_LABELS[t]}
          </Button>
        ))}
        <Button variant="ghost" className="mt-2" onClick={onCancel}>Annuler</Button>
      </div>
    );
  }

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

  function enregistrer() {
    const e: Erreurs = {};
    if (!val.reference.trim()) e.reference = "Indiquez une référence interne.";
    if (!val.designation.trim()) e.designation = "Indiquez une désignation.";
    if (!val.metier) e.metier = "Choisissez un métier.";
    if (!val.unite) e.unite = "Choisissez une unité.";
    const prix = analyserPrix(val.prix);
    if (typeof prix === "string") e.prix = prix;
    let d: Article | null = null;
    if (val.reference.trim()) {
      const r = normaliserReference(val.reference);
      d = articles.find((x) => x.id !== initial?.id && normaliserReference(x.reference) === r) ?? null;
      if (d) e.reference = `Cette référence est déjà utilisée par « ${d.designation} »${d.archive ? " (article archivé)" : ""}.`;
    }
    setDoublon(d);
    setErreurs(e);
    if (Object.keys(e).length > 0 || typeof prix === "string") return;
    const materiel = val.type === "materiel";
    onSave({
      type: val.type,
      reference: val.reference.trim(),
      designation: val.designation.trim(),
      description: val.description.trim(),
      metier: val.metier as Metier,
      unite: val.unite as Unite,
      prixHT: prix,
      marque: materiel ? val.marque.trim() : "",
      referenceFabricant: materiel ? val.referenceFabricant.trim() : "",
      notes: val.notes.trim(),
    });
  }

  return (
    <form className="mt-6 flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); enregistrer(); }}>
      <p className="text-sm">Type : <span className="font-semibold">{TYPE_ARTICLE_LABELS[val.type]}</span></p>

      <Champ id="a-reference" label="Référence interne" erreur={erreurs.reference}>
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
      <Champ id="a-designation" label="Désignation" erreur={erreurs.designation}>
        {inp("designation")}
      </Champ>
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
      <Champ id="a-prix" label="Prix de vente unitaire HT (€)" erreur={erreurs.prix}>
        {inp("prix", { inputMode: "decimal", placeholder: "Exemple : 60,50" })}
      </Champ>
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
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button type="submit" variant="action">Enregistrer l'article</Button>
      </div>
    </form>
  );
}
