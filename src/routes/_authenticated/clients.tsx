import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, RefreshCw, UserRound, Building2 } from "lucide-react";
import { PeriodeDocumentsSelect } from "@/components/PeriodeDocumentsSelect";
import { syntheseClient, syntheseDevisClient, acomptesClient, dansPeriode, correspondSuiviClient, suiviDocumentClient, PERIODES_DOCUMENTS, type PeriodeDocuments, type FiltreSuiviClient } from "@/lib/suivi-clients";
import { StatutDocument } from "@/components/StatutDocument";
import { formaterCentimes } from "@/data/devis";

import { AppLayout } from "@/components/AppLayout";
import { ClientForm } from "@/components/ClientForm";
import { DocumentSheet } from "@/components/DocumentSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  TYPE_CLIENT_LABELS,
  chargerClients,
  creerClient,
  modifierClient,
  relireClient,
  useEtatClients,
  nomClient,
  type Client,
  type ClientSaisie,
  type ClientType,
} from "@/data/clients";
import {
  useDocuments,
  useEtatDocuments,
  chargerDocuments,
  TYPE_LABELS,
  formaterMontant,
  type DocumentAvecDevis as DemoDocument,
} from "@/data/documents";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "Clients — Les Frères Mayet" },
      { name: "description", content: "Fiches clients de l'entreprise Les Frères Mayet." },
      { property: "og:title", content: "Clients — Les Frères Mayet" },
      { property: "og:description", content: "Fiches clients de l'entreprise Les Frères Mayet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientsPage,
});

const FILTRES: { value: ClientType | "tous"; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "particulier", label: "Particuliers" },
  { value: "entreprise", label: "Entreprises" },
];

type Panneau =
  | { mode: "ajout" }
  | { mode: "fiche"; id: string; suivi?: FiltreSuiviClient }
  | { mode: "edition"; id: string }
  | null;

function ClientsPage() {
  const etat = useEtatClients();
  const clients = etat.clients;
  const etatDocs = useEtatDocuments();
  const [periode, setPeriode] = useState<PeriodeDocuments>("annee");
  const [confirmation, setConfirmation] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<ClientType | "tous">("tous");
  const [panneau, setPanneau] = useState<Panneau>(null);
  const [formKey, setFormKey] = useState(0);
  const [docOuvert, setDocOuvert] = useState<DemoDocument | null>(null);

  const reinitialiser = () => {
    setRecherche("");
    setFiltre("tous");
    setPeriode("annee");
  };

  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const qChiffres = q.replace(/\D/g, "");
    return clients.filter((c) => {
      if (filtre !== "tous" && c.type !== filtre) return false;
      if (!q) return true;
      const textes = [nomClient(c), c.nom, c.prenom, c.raisonSociale, c.email, c.telephone, c.adresse, c.complement, c.codePostal, c.ville, c.pays];
      if (textes.some((t) => t.toLowerCase().includes(q))) return true;
      return qChiffres.length >= 2 && c.telephone.replace(/\D/g, "").includes(qChiffres);
    });
  }, [clients, recherche, filtre]);

  function montantClient(c: Client, cle: "facture" | "attente" | "retard" | "paye", suivi: FiltreSuiviClient) {
    if (etatDocs.statut !== "pret") return <span className="text-xs text-muted-foreground">{etatDocs.statut === "erreur" ? "Indisponible" : "Chargement…"}</span>;
    const s = syntheseClient(etatDocs.liste, c.id, periode);
    const couleurs = { facture: "text-primary", attente: "text-orange-600", retard: "text-rose-600", paye: "text-teal-600" };
    return <button type="button" className={`rounded px-1 py-1 font-semibold underline-offset-4 hover:underline focus-visible:outline-2 ${couleurs[cle]}`} onClick={() => setPanneau({ mode: "fiche", id: c.id, suivi })} aria-label={`${cle === "facture" ? "Total facturé" : cle === "paye" ? "Payé" : cle === "retard" ? "En retard" : "En attente"} pour ${nomClient(c)}`}>
      {formaterCentimes(cle === "facture" ? s.facture - s.credite : s[cle])}
    </button>;
  }

  const clientCourant =
    panneau && panneau.mode !== "ajout" ? clients.find((c) => c.id === panneau.id) : undefined;

  function ouvrirAjout() {
    setFormKey((k) => k + 1);
    setPanneau({ mode: "ajout" });
  }

  async function sauver(v: ClientSaisie, idTentative: string) {
    if (panneau?.mode === "edition") {
      const courant = clients.find((c) => c.id === panneau.id);
      await modifierClient(panneau.id, v, courant?.majLe ?? "");
      setPanneau({ mode: "fiche", id: panneau.id });
    } else {
      const c = await creerClient(idTentative, v);
      setPanneau({ mode: "fiche", id: c.id });
    }
    setConfirmation(true);
    void chargerClients();
  }

  async function rechargerFiche(id: string) {
    await relireClient(id).catch(() => null);
    setFormKey((k) => k + 1);
  }

  return (
    <AppLayout titre="Clients">
      <div className="khosmos-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground lg:text-3xl">Clients</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Vos fiches clients sont enregistrées dans votre espace privé.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="lg"><Link to="/import-clients">Importer un fichier CSV</Link></Button>
          <Button variant="action" size="lg" onClick={ouvrirAjout}>
            <Plus /> Ajouter un client
          </Button>
        </div>
      </div>

      {etat.statut === "erreur" ? (
        <div role="alert" className="mt-6 rounded-2xl border border-destructive/40 bg-card p-8 text-center">
          <p className="text-sm font-medium">Impossible de charger vos clients pour le moment.</p>
          <p className="mt-1 text-sm text-muted-foreground">Vérifiez votre connexion internet puis réessayez.</p>
          <Button variant="outline" className="mt-4" onClick={() => void chargerClients()}>
            Réessayer
          </Button>
        </div>
      ) : etat.statut !== "pret" && clients.length === 0 ? (
        <div role="status" className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Chargement de vos clients…</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium">Ajoutez votre premier client.</p>
          <Button variant="action" className="mt-4" onClick={ouvrirAjout}>
            <Plus /> Ajouter votre premier client
          </Button>
        </div>
      ) : (
        <>
          <div className="khosmos-page-filters mt-6 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Nom, Tél., E-mail, Adresse"
                  aria-label="Rechercher un client"
                  className="h-10 pl-9"
                />
              </div>
              <Select value={filtre} onValueChange={(v) => setFiltre(v as ClientType | "tous")}>
                <SelectTrigger className="h-10 lg:w-48" aria-label="Filtrer par type de client">
                  <SelectValue>{FILTRES.find((f) => f.value === filtre)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FILTRES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <PeriodeDocumentsSelect value={periode} onChange={setPeriode} />
              <Button variant="outline" className="h-10" onClick={() => { void chargerClients(); void chargerDocuments(); }} disabled={etat.statut === "chargement" || etatDocs.statut === "chargement"}><RefreshCw className="size-4" /> Rafraîchir</Button>
              <Button variant="outline" className="h-10" onClick={reinitialiser}>
                Réinitialiser
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {resultats.length} client{resultats.length > 1 ? "s" : ""} affiché
              {resultats.length > 1 ? "s" : ""} sur {clients.length}
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">TTC des factures et acomptes finalisés émis sur la période, après déduction de l’acompte sur le solde. « En attente » exclut les retards ; « Payé » inclut les règlements partiels actifs. Les avoirs et crédits sont détaillés dans la fiche. Archives Khosmos séparées.</p>
          {etatDocs.statut === "erreur" && <p role="alert" className="mt-3 text-sm text-destructive">Le suivi financier n’a pas pu être chargé. Utilisez « Rafraîchir » pour réessayer.</p>}

          {resultats.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-sm font-medium">Aucun client ne correspond à votre recherche.</p>
              <Button variant="outline" className="mt-4" onClick={reinitialiser}>
                Réinitialiser les filtres
              </Button>
            </div>
          ) : (
            <>
              <div className="khosmos-list mt-6 hidden lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/60 text-left">
                      <th className="px-4 py-3 font-semibold">Nom ou raison sociale</th>
                      <th className="px-4 py-3 font-semibold text-primary">Total facturé</th>
                      <th className="px-4 py-3 font-semibold text-orange-600">En attente</th>
                      <th className="px-4 py-3 font-semibold text-rose-600">En retard</th>
                      <th className="px-4 py-3 font-semibold text-teal-600">Payé</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultats.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium"><button type="button" onClick={() => setPanneau({ mode: "fiche", id: c.id })} className="flex items-center gap-3 text-left text-primary hover:underline">{c.type === "entreprise" ? <Building2 className="size-5 shrink-0" /> : <UserRound className="size-5 shrink-0" />}{nomClient(c)}</button></td>
                        <td className="px-4 py-3 whitespace-nowrap">{montantClient(c, "facture", "tous")}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{montantClient(c, "attente", "attente")}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{montantClient(c, "retard", "retard")}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{montantClient(c, "paye", "paye")}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPanneau({ mode: "fiche", id: c.id })}
                          >
                            Voir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex flex-col gap-3 lg:hidden">
                {resultats.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words font-semibold">{nomClient(c)}</p>
                      <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                        {TYPE_CLIENT_LABELS[c.type]}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">{([ ["Total facturé", "facture", "tous"], ["En attente", "attente", "attente"], ["En retard", "retard", "retard"], ["Payé", "paye", "paye"] ] as const).map(([label, cle, suivi]) => <div key={cle}><dt className="text-xs text-muted-foreground">{label}</dt><dd>{montantClient(c, cle, suivi)}</dd></div>)}</dl>
                    <dl className="mt-3 flex flex-col gap-1 text-sm">
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">Tél. :</dt>
                        <dd>{c.telephone || "—"}</dd>
                      </div>
                      <div className="flex min-w-0 gap-2">
                        <dt className="text-muted-foreground">E-mail :</dt>
                        <dd className="min-w-0 break-all">{c.email || "—"}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">Ville :</dt>
                        <dd>{c.ville || "—"}</dd>
                      </div>
                    </dl>
                    <Button
                      variant="outline"
                      className="mt-3 w-full"
                      onClick={() => setPanneau({ mode: "fiche", id: c.id })}
                    >
                      Voir
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <Sheet
        open={panneau !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPanneau(null);
            setConfirmation(false);
          }
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {panneau?.mode === "ajout" && (
            <>
              <SheetHeader>
                <SheetTitle>Ajouter un client</SheetTitle>
                <SheetDescription>Les champs facultatifs peuvent être complétés plus tard.</SheetDescription>
              </SheetHeader>
              <ClientForm
                key={formKey}
                clients={clients}
                onCancel={() => setPanneau(null)}
                onSave={sauver}
                onVoirExistant={(c) => setPanneau({ mode: "fiche", id: c.id })}
              />
            </>
          )}
          {panneau?.mode === "edition" && clientCourant && (
            <>
              <SheetHeader>
                <SheetTitle>Modifier le client</SheetTitle>
                <SheetDescription>{nomClient(clientCourant)}</SheetDescription>
              </SheetHeader>
              <ClientForm
                key={`${clientCourant.id}-${formKey}`}
                onRecharger={() => void rechargerFiche(clientCourant.id)}
                initial={clientCourant}
                clientId={clientCourant.id}
                clients={clients}
                onCancel={() => setPanneau({ mode: "fiche", id: clientCourant.id })}
                onSave={sauver}
                onVoirExistant={(c) => setPanneau({ mode: "fiche", id: c.id })}
              />
            </>
          )}
          {panneau?.mode === "fiche" && clientCourant && (
            <FicheClient
              key={`${clientCourant.id}-${panneau.suivi ?? "tous"}`}
              client={clientCourant}
              periode={periode}
              filtreInitial={panneau.suivi ?? "tous"}
              confirmation={confirmation}
              onModifier={() => {
                setConfirmation(false);
                setPanneau({ mode: "edition", id: clientCourant.id });
              }}
              onVoirDocument={setDocOuvert}
              onFermer={() => setPanneau(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <DocumentSheet document={docOuvert} onClose={() => setDocOuvert(null)} />
    </AppLayout>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{valeur.trim() || "—"}</dd>
    </div>
  );
}

function FicheClient({
  client: c,
  confirmation,
  onModifier,
  onVoirDocument,
  onFermer,
  periode,
  filtreInitial,
}: {
  client: Client;
  confirmation: boolean;
  onModifier: () => void;
  onVoirDocument: (d: DemoDocument) => void;
  onFermer: () => void;
  periode: PeriodeDocuments;
  filtreInitial: FiltreSuiviClient;
}) {
  const nom = nomClient(c);
  const etatDocs = useEtatDocuments();
  const [filtreSuivi, setFiltreSuivi] = useState<FiltreSuiviClient>(filtreInitial);
  const tousDocs = useDocuments().filter((d) => d.clientId === c.id);
  const docs = tousDocs.filter(d => dansPeriode(d.date, periode) && correspondSuiviClient(d, filtreSuivi));
  const synthese = syntheseClient(tousDocs, c.id, periode);
  const devisClient = syntheseDevisClient(tousDocs, c.id, periode);
  const acomptes = acomptesClient(tousDocs, c.id).filter(a => dansPeriode(a.doc.date, periode));
  const adresse = [c.adresse, c.complement, [c.codePostal, c.ville].filter(Boolean).join(" "), c.pays]
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="break-words pr-6">{nom}</SheetTitle>
        <SheetDescription>{TYPE_CLIENT_LABELS[c.type]}</SheetDescription>
      </SheetHeader>
      {confirmation && (
        <p role="status" className="mt-4 rounded-lg border border-success/40 bg-success-soft p-3 text-sm font-medium">
          Client enregistré
        </p>
      )}
      <Button variant="outline" className="mt-4 self-start" onClick={onModifier}>
        Modifier
      </Button>

      <section className="mt-6">
        <h3 className="text-sm font-semibold">Coordonnées</h3>
        <dl className="mt-2 grid gap-3 text-sm">
          {c.type === "entreprise" && <Ligne label="Nom du contact" valeur={c.nom} />}
          <Ligne label="Téléphone" valeur={c.telephone} />
          <Ligne label="E-mail" valeur={c.email} />
        </dl>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold">Adresse</h3>
        <p className="mt-2 text-sm">
          {adresse.length > 0 ? adresse.map((l, i) => <span key={i} className="block">{l}</span>) : "—"}
        </p>
      </section>

      {c.type === "entreprise" && (c.siret.trim() || c.tva.trim()) && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold">Informations d'entreprise</h3>
          <dl className="mt-2 grid gap-3 text-sm">
            {c.siret.trim() && <Ligne label="SIRET (format contrôlé)" valeur={c.siret} />}
            {c.tva.trim() && <Ligne label="N° de TVA intracommunautaire" valeur={c.tva} />}
          </dl>
        </section>
      )}

      <section className="mt-6">
        <h3 className="text-sm font-semibold">Notes internes</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Ces notes ne sont pas destinées aux documents clients.
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm">{c.notes.trim() || "—"}</p>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold">Suivi financier · {PERIODES_DOCUMENTS[periode]}</h3>
        {etatDocs.statut === "pret" ? <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-secondary p-3 text-sm">{([ ["Facturé TTC (net des avoirs)", synthese.facture - synthese.credite], ["Déjà payé", synthese.paye], ["Reste à payer", synthese.attente + synthese.retard], ["Dont en retard", synthese.retard], ["Annulé par avoir", synthese.credite], ["Crédit client à traiter", synthese.creditClient] ] as const).map(([label, montant]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className={`font-semibold ${label === "Dont en retard" && montant > 0n ? "text-destructive" : ""}`}>{formaterCentimes(montant)}</dd></div>)}</dl> : <p role="status" className="mt-2 text-sm">{etatDocs.statut === "erreur" ? "Suivi indisponible" : "Chargement du suivi…"}</p>}
      </section>
      {etatDocs.statut === "pret" && <section className="mt-6">
        <h3 className="text-sm font-semibold">Devis · {PERIODES_DOCUMENTS[periode]}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-secondary p-3 text-sm">{([
          ["Signés", devisClient.signes, devisClient.signesTTC], ["En attente de signature", devisClient.attente, devisClient.attenteTTC],
          ["Expirés sans réponse", devisClient.expires, devisClient.expiresTTC], ["Refusés", devisClient.refuses, devisClient.refusesTTC],
        ] as const).map(([label, nb, ttc]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-semibold">{nb} · {formaterCentimes(ttc)}</dd></div>)}</dl>
      </section>}
      {etatDocs.statut === "pret" && acomptes.length > 0 && <section className="mt-6">
        <h3 className="text-sm font-semibold">Suivi des acomptes</h3>
        <ul className="mt-2 divide-y rounded-xl border text-sm">{acomptes.map(a => <li key={a.doc.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div><p className="font-medium">Acompte {a.doc.numero} · devis {a.doc.devisSource?.reference ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{a.doc.date} · {formaterCentimes(a.aRegler)} · payé {formaterCentimes(a.regle)}{a.reste > 0n ? ` · reste ${formaterCentimes(a.reste)}` : ""}{a.deduitSur ? ` · déduit sur la facture ${a.deduitSur}` : a.credite > 0n ? "" : " · pas encore déduit"}</p></div>
          <StatutDocument document={a.doc} />
        </li>)}</ul>
      </section>}
      <section className="mt-6">
        <h3 className="text-sm font-semibold">Documents associés</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Documents sauvegardés dans cet espace, sur la période sélectionnée.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">{([ ["tous", "Tous"], ["impaye", "Non payés"], ["retard", "En retard"], ["paye", "Avec règlement"], ["devis-non-signes", "Devis non signés"] ] as const).map(([cle, label]) => <Button key={cle} variant={filtreSuivi === cle ? "default" : "outline"} size="sm" onClick={() => setFiltreSuivi(cle)}>{label}</Button>)}</div>
        {etatDocs.statut !== "pret" ? <p role="status" className="mt-2 text-sm">{etatDocs.statut === "erreur" ? "Documents indisponibles" : "Chargement des documents…"}</p> : docs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucun document pour cette période et ce filtre.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {docs.map((d) => (
              <li key={d.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{d.numero}</p>
                    <p className="text-muted-foreground">
                      {d.date} · {TYPE_LABELS[d.type]}
                      {d.montantTTC !== null && ` · ${formaterMontant(d.montantTTC)}`}
                    </p>
                  </div>
                  <StatutDocument document={d} />
                </div>
                {d.client !== nom && (
                  <p className="mt-1 text-xs text-muted-foreground">Établi au nom de : {d.client}</p>
                )}
                {(() => { const s = suiviDocumentClient(d); return s ? <p className="mt-2 text-xs">{s.etat} · Reste à régler : {formaterCentimes(s.reste)}{s.creditClient > 0n ? ` · Crédit client : ${formaterCentimes(s.creditClient)}` : ""}</p> : null; })()}
                <Button variant="outline" size="sm" className="mt-2" onClick={() => onVoirDocument(d)}>
                  Voir le document
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>


      <Button variant="outline" className="mt-8 w-full" onClick={onFermer}>
        Fermer
      </Button>
    </>
  );
}
