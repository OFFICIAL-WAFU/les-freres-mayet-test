import { useDevisSignes } from "@/data/signature-distante";
import { suivre } from "@/data/reglements";
import { telechargerDocumentsCsv } from "@/lib/export-documents";
import { suiviEcheance } from "@/lib/echeances";
import { formaterCentimes } from "@/data/devis";
import { PeriodeDocumentsSelect } from "@/components/PeriodeDocumentsSelect";
import { dansPeriode, type PeriodeDocuments } from "@/lib/suivi-clients";
import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { StatutDocument } from "@/components/StatutDocument";
import { statutAffiche } from "@/lib/statuts";
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

const TYPES_CREATION: DocumentType[] = ["devis", "facture", "acompte", "avoir"];

function DocumentsPage() {
  const [recherche, setRecherche] = useState("");
  const [type, setType] = useState<DocumentType | "tous">("tous");
  const [statut, setStatut] = useState<DocumentStatut | "tous">("tous");
  const [paiement, setPaiement] = useState("tous");
  const [periode, setPeriode] = useState<PeriodeDocuments>("toutes");
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [documentOuvert, setDocumentOuvert] = useState<DocumentAvecDevis | null>(null);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [typeChoisi, setTypeChoisi] = useState<DocumentType | null>(null);

  const etatDocs = useEtatDocuments();
  const signes = useDevisSignes();
  const documentsListe = etatDocs.liste;
  const documents = documentsListe;
  // Affichage : le filtre de statut suit le statut affiché (signé, refusé, payée, annulée…) ; les données ne changent pas.
  const documentsAffiches = documentsListe;
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
    setPaiement("tous");
    setPeriode("toutes");
  }

  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return documentsAffiches.filter((d) => {
      const correspondRecherche =
        q === "" ||
        d.client.toLowerCase().includes(q) ||
        d.numero.toLowerCase().includes(q) || (d.devis?.objet ?? "").toLowerCase().includes(q);
      const correspondType = type === "tous" || d.type === type;
      const correspondStatut = statut === "tous" || (d.statut === "Brouillon" ? "Brouillon" : statutAffiche(d)) === statut || (d.type === "devis" && statut === "Signé" && !!signes[d.id]);
      const suivi = !d.fictif && d.statut === "Finalisé" && (d.type === "facture" || d.type === "acompte") && d.aRegler !== undefined ? suivre(d.aRegler, d.reglements ?? [], d.credite ?? 0n) : null;
      const echeance = suivi ? suiviEcheance(d.devis?.validite, suivi.reste) : null;
      const correspondPaiement = paiement === "tous" || !!suivi && (paiement === "reste" ? suivi.reste > 0n : paiement === "credit" ? suivi.creditClient > 0n : paiement === "retard" ? echeance?.etat === "retard" : paiement === "sans-date" ? echeance?.etat === "absente" : suivi.reste === 0n);
      return correspondRecherche && correspondType && correspondStatut && correspondPaiement && dansPeriode(d.date, periode);
    });
  }, [documentsAffiches, recherche, type, statut, paiement, periode, signes]);

  return (
    <AppLayout titre="Documents">
      <div className="khosmos-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground lg:text-3xl">Documents</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Retrouvez vos devis, factures, acomptes et avoirs.
          </p>
        </div>
        <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={etatDocs.statut !== "pret" || resultats.length === 0} onClick={() => telechargerDocumentsCsv(resultats)}>Exporter</Button><Button variant="action" size="lg" onClick={() => setCreationOuverte(true)}>
          <Plus /> Créer un doc
        </Button></div>
      </div>

      <div className="khosmos-page-filters mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-3 lg:items-center">
          <div className="relative w-full basis-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Client, N° de doc ou paiement…"
              aria-label="Rechercher un client ou un numéro"
              className="h-12 max-w-sm pl-9"
            />
          </div>
          <Button type="button" variant="outline" className="h-10 lg:hidden" aria-expanded={filtresOuverts} onClick={() => setFiltresOuverts((o) => !o)}>
            {filtresOuverts ? "Masquer les filtres" : "Filtres"}
          </Button>
          <div className={`${filtresOuverts ? "contents" : "hidden"} lg:contents`}>
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
          <PeriodeDocumentsSelect value={periode} onChange={setPeriode} />
          <Button variant="outline" className="h-10" onClick={reinitialiser}>
            Réinitialiser
          </Button>
          </div>
        </div>
        <div className={`mt-3 ${filtresOuverts ? "flex" : "hidden"} flex-wrap items-center gap-3 lg:flex`}>
          <Select value={paiement} onValueChange={setPaiement}>
            <SelectTrigger className="w-full sm:w-64" aria-label="Filtrer par règlement"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="tous">Tous les règlements</SelectItem><SelectItem value="reste">Reste à régler</SelectItem><SelectItem value="retard">En retard</SelectItem><SelectItem value="sans-date">Échéance non renseignée</SelectItem><SelectItem value="solde">Solde à zéro</SelectItem><SelectItem value="credit">Crédit client à traiter</SelectItem></SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground">« Exporter » télécharge la liste affichée (fichier ouvrable dans Excel)</span>
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
          <p className="mt-1 text-sm text-muted-foreground">Créez votre premier devis avec « Créer un doc ».</p>
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
          <div className="khosmos-list mt-6 hidden lg:block">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/60 text-left">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">N° document</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Document</th>
                  <th className="px-4 py-3 text-right font-semibold">Montant TTC</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {resultats.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{d.date}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-medium">{d.numero}{d.fictif && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs">Fictif</span>}</td>
                    <td className="px-4 py-3 font-semibold text-primary">{d.client}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{TYPE_LABELS[d.type]}</td>
                    <td className="px-3 py-3 text-right break-words">
                      {formaterMontant(d.montantTTC)}{d.deduction?.statut === "finalise" && <span className="block text-xs text-muted-foreground">solde, acompte déduit</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatutDocument document={d} />
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
                  <StatutDocument document={d} />
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
                    <dd>{formaterMontant(d.montantTTC)}{d.deduction?.statut === "finalise" && <span className="ml-1 text-xs text-muted-foreground">(solde, acompte déduit)</span>}<SuiviLigne d={d} /></dd>
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
            <DialogTitle>Générer un nouveau document</DialogTitle>
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
            <Button variant="outline" className="justify-between" onClick={() => navigate({to:"/rapports"})}>Rapport d’intervention<span className="text-xs text-muted-foreground">Disponible</span></Button>
            <Button variant="outline" className="justify-between" onClick={() => navigate({to:"/planning"})}>Planning<span className="text-xs text-muted-foreground">Disponible</span></Button>
          </div>
          {typeChoisi && (
            <p className="rounded-xl border border-border bg-secondary/60 p-3 text-sm text-foreground">
              {typeChoisi === "avoir" ? "Ouvrez une facture finalisée sans acompte, puis choisissez Préparer un avoir total ou partiel." : "Ouvrez un devis finalisé, puis choisissez Préparer une facture ou Préparer un acompte."}
            </p>
          )}
          {typeChoisi === "facture" && <Button variant="action" onClick={() => navigate({ to: "/factures/nouveau" })}>Créer une facture sans devis</Button>}
          {typeChoisi && <div className="max-h-64 overflow-y-auto">
            {documents.filter(d => !d.fictif && d.statut === "Finalisé" && (typeChoisi === "avoir" ? d.type === "facture" && !d.deduction : d.type === "devis")).map(d => (
              <Button key={d.id} variant="ghost" className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={() => { setCreationOuverte(false); setTypeChoisi(null); setDocumentOuvert(d); }}>
                {d.numero} · {d.client}
              </Button>
            ))}
            {!documents.some(d => !d.fictif && d.statut === "Finalisé" && (typeChoisi === "avoir" ? d.type === "facture" && !d.deduction : d.type === "devis")) && <p className="py-3 text-sm text-muted-foreground">Aucun document source disponible.</p>}
          </div>}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function SuiviLigne({ d }: { d: DocumentAvecDevis }) {
  if (d.aRegler === undefined) return null;
  const s = suivre(d.aRegler, d.reglements ?? [], d.credite ?? 0n);
  return (
    <span className="block text-xs text-muted-foreground">
      {s.etat}{s.credite > 0n ? ` · crédité ${formaterCentimes(s.credite)}` : ""} · réglé {formaterCentimes(s.regle)} · reste {formaterCentimes(s.reste)}{s.creditClient > 0n ? ` · crédit client à traiter ${formaterCentimes(s.creditClient)}` : ""}
      {s.reste > 0n && <span className={suiviEcheance(d.devis?.validite, s.reste).etat === "retard" ? "block font-medium text-destructive" : "block"}>{suiviEcheance(d.devis?.validite, s.reste).libelle}</span>}
    </span>
  );
}
