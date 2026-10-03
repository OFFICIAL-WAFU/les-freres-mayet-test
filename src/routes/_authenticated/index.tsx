import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { StatutBadge } from "@/components/StatutBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentSheet } from "@/components/DocumentSheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  chargerDocuments,
  useEtatDocuments,
  STATUTS_PAR_TYPE,
  TOUS_LES_STATUTS,
  TYPE_FILTERS,
  TYPE_LABELS,
  formaterMontant,
  type DocumentAvecDevis,
  type DocumentStatut,
  type DocumentType,
} from "@/data/documents";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Documents — Les Frères Mayet" },
      {
        name: "description",
        content: "Retrouvez vos devis, factures, acomptes et avoirs en un seul endroit.",
      },
      { property: "og:title", content: "Documents — Les Frères Mayet" },
      {
        property: "og:description",
        content: "Retrouvez vos devis, factures, acomptes et avoirs en un seul endroit.",
      },
    ],
  }),
  component: DocumentsPage,
});

const TYPES_CREATION: DocumentType[] = ["devis", "facture", "acompte", "avoir", "rapport"];

function DocumentsPage() {
  const [recherche, setRecherche] = useState("");
  const [type, setType] = useState<DocumentType | "tous">("tous");
  const [statut, setStatut] = useState<DocumentStatut | "tous">("tous");
  const [documentOuvert, setDocumentOuvert] = useState<DocumentAvecDevis | null>(null);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [typeChoisi, setTypeChoisi] = useState<DocumentType | null>(null);

  const etatDocs = useEtatDocuments();
  const documents = etatDocs.liste;
  const navigate = useNavigate();
  const statutsDisponibles = type === "tous" ? TOUS_LES_STATUTS : STATUTS_PAR_TYPE[type];

  function changerType(nouveauType: DocumentType | "tous") {
    setType(nouveauType);
    const permis = nouveauType === "tous" ? TOUS_LES_STATUTS : STATUTS_PAR_TYPE[nouveauType];
    if (statut !== "tous" && !permis.includes(statut)) setStatut("tous");
  }

  function reinitialiser() {
    setRecherche("");
    setType("tous");
    setStatut("tous");
  }

  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return documents.filter((d) => {
      const correspondRecherche =
        q === "" ||
        d.client.toLowerCase().includes(q) ||
        d.numero.toLowerCase().includes(q);
      const correspondType = type === "tous" || d.type === type;
      const correspondStatut = statut === "tous" || d.statut === statut;
      return correspondRecherche && correspondType && correspondStatut;
    });
  }, [documents, recherche, type, statut]);

  return (
    <AppLayout titre="Documents">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground lg:text-3xl">Documents</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Retrouvez vos devis, factures, acomptes et avoirs.
          </p>
        </div>
        <Button variant="action" size="lg" onClick={() => setCreationOuverte(true)}>
          <Plus /> Créer un document
        </Button>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un client ou un numéro…"
              aria-label="Rechercher un client ou un numéro"
              className="h-10 pl-9"
            />
          </div>
          <Select value={type} onValueChange={(v) => changerType(v as DocumentType | "tous")}>
            <SelectTrigger className="h-10 lg:w-56" aria-label="Filtrer par type">
              <SelectValue>
                {TYPE_FILTERS.find((t) => t.value === type)?.label ?? "Tous"}
              </SelectValue>

            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTERS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statut} onValueChange={(v) => setStatut(v as DocumentStatut | "tous")}>
            <SelectTrigger className="h-10 lg:w-56" aria-label="Filtrer par statut">
              <SelectValue>{statut === "tous" ? "Tous les statuts" : statut}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les statuts</SelectItem>
              {statutsDisponibles.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-10" onClick={reinitialiser}>
            Réinitialiser
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {resultats.length} document{resultats.length > 1 ? "s" : ""} affiché
          {resultats.length > 1 ? "s" : ""} sur {documents.length}
        </p>
      </div>

      {etatDocs.demo && (
        <p className="mt-4 rounded-xl border border-border bg-card p-3 text-sm">Mode démonstration activé : les documents marqués « Fictif » ne sont pas enregistrés. Désactivez-le dans Réglages.</p>
      )}
      {(etatDocs.statut === "inactif" || etatDocs.statut === "chargement") && documents.length === 0 ? (
        <p role="status" className="mt-6 text-sm text-muted-foreground">Chargement de vos documents…</p>
      ) : etatDocs.statut === "erreur" ? (
        <div role="alert" className="mt-6 rounded-2xl border border-destructive/40 bg-card p-8 text-center">
          <p className="text-sm font-medium">Vos documents n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez.</p>
          <Button variant="outline" className="mt-4" onClick={() => void chargerDocuments()}>Réessayer</Button>
        </div>
      ) : documents.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium">Aucun document enregistré pour le moment.</p>
          <p className="mt-1 text-sm text-muted-foreground">Créez votre premier devis avec « Créer un document ».</p>
        </div>
      ) : resultats.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            Aucun document ne correspond à votre recherche.
          </p>
          <Button variant="outline" className="mt-4" onClick={reinitialiser}>
            Réinitialiser les filtres
          </Button>
        </div>
      ) : (
        <>
          {/* Tableau (ordinateur) */}
          <div className="mt-6 hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/60 text-left">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Numéro</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 text-right font-semibold">Montant TTC</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {resultats.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{d.date}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{d.numero}{d.fictif && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs">Fictif</span>}</td>
                    <td className="px-4 py-3">{d.client}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{TYPE_LABELS[d.type]}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {formaterMontant(d.montantTTC)}
                    </td>
                    <td className="px-4 py-3">
                      <StatutBadge statut={d.statut} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => setDocumentOuvert(d)}>
                        Voir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartes (mobile) */}
          <div className="mt-6 flex flex-col gap-3 lg:hidden">
            {resultats.map((d) => (
              <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{d.numero}{d.fictif && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-normal">Fictif</span>}</p>
                    <p className="truncate text-sm text-muted-foreground">{d.client}</p>
                  </div>
                  <StatutBadge statut={d.statut} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Date</dt>
                    <dd>{d.date}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Type</dt>
                    <dd>{TYPE_LABELS[d.type]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Montant TTC</dt>
                    <dd>{formaterMontant(d.montantTTC)}</dd>
                  </div>
                </dl>
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => setDocumentOuvert(d)}
                >
                  Voir
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Panneau de consultation */}
      <DocumentSheet document={documentOuvert} onClose={() => setDocumentOuvert(null)} />


      {/* Fenêtre de création */}
      <Dialog
        open={creationOuverte}
        onOpenChange={(o) => {
          setCreationOuverte(o);
          if (!o) setTypeChoisi(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un document</DialogTitle>
            <DialogDescription>Choisissez le type de document à créer.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {TYPES_CREATION.map((t) => (
              <Button
                key={t}
                variant={typeChoisi === t ? "default" : "outline"}
                className="justify-start"
                onClick={() => (t === "devis" ? navigate({ to: "/devis/nouveau" }) : setTypeChoisi(t))}
              >
                {TYPE_LABELS[t]}
              </Button>
            ))}
          </div>
          {typeChoisi && (
            <p className="rounded-xl border border-border bg-secondary/60 p-3 text-sm text-foreground">
              La création de ce type de document sera ajoutée à une prochaine étape.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
