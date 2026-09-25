import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { ClientForm } from "@/components/ClientForm";
import { DocumentSheet } from "@/components/DocumentSheet";
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
  | { mode: "fiche"; id: string }
  | { mode: "edition"; id: string }
  | null;

function ClientsPage() {
  const etat = useEtatClients();
  const clients = etat.clients;
  const [confirmation, setConfirmation] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<ClientType | "tous">("tous");
  const [panneau, setPanneau] = useState<Panneau>(null);
  const [formKey, setFormKey] = useState(0);
  const [docOuvert, setDocOuvert] = useState<DemoDocument | null>(null);

  const reinitialiser = () => {
    setRecherche("");
    setFiltre("tous");
  };

  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const qChiffres = q.replace(/\D/g, "");
    return clients.filter((c) => {
      if (filtre !== "tous" && c.type !== filtre) return false;
      if (!q) return true;
      const textes = [nomClient(c), c.nom, c.prenom, c.raisonSociale, c.email, c.telephone];
      if (textes.some((t) => t.toLowerCase().includes(q))) return true;
      return qChiffres.length >= 2 && c.telephone.replace(/\D/g, "").includes(qChiffres);
    });
  }, [clients, recherche, filtre]);

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground lg:text-3xl">Clients</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Vos fiches clients sont enregistrées dans votre espace privé.
          </p>
        </div>
        <Button variant="action" size="lg" onClick={ouvrirAjout}>
          <Plus /> Ajouter un client
        </Button>
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
          <div className="mt-6 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher un nom, une entreprise, un téléphone ou un e-mail…"
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
              <Button variant="outline" className="h-10" onClick={reinitialiser}>
                Réinitialiser
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {resultats.length} client{resultats.length > 1 ? "s" : ""} affiché
              {resultats.length > 1 ? "s" : ""} sur {clients.length}
            </p>
          </div>

          {resultats.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-sm font-medium">Aucun client ne correspond à votre recherche.</p>
              <Button variant="outline" className="mt-4" onClick={reinitialiser}>
                Réinitialiser les filtres
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-6 hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/60 text-left">
                      <th className="px-4 py-3 font-semibold">Nom du client</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Téléphone</th>
                      <th className="px-4 py-3 font-semibold">E-mail</th>
                      <th className="px-4 py-3 font-semibold">Ville</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultats.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium">{nomClient(c)}</td>
                        <td className="px-4 py-3">{TYPE_CLIENT_LABELS[c.type]}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{c.telephone || "—"}</td>
                        <td className="px-4 py-3 break-all">{c.email || "—"}</td>
                        <td className="px-4 py-3">{c.ville || "—"}</td>
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
              client={clientCourant}
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
}: {
  client: Client;
  confirmation: boolean;
  onModifier: () => void;
  onVoirDocument: (d: DemoDocument) => void;
  onFermer: () => void;
}) {
  const nom = nomClient(c);
  const docs = useDocuments().filter((d) => d.clientId === c.id);
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
        <p role="status" className="mt-4 rounded-lg border border-success/40 bg-success/10 p-3 text-sm font-medium">
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
        <h3 className="text-sm font-semibold">Documents associés</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Les devis sont encore temporaires et seront sauvegardés durablement lors d'une prochaine étape.
        </p>
        {docs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucun document associé à ce client.</p>
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
                  <StatutBadge statut={d.statut} />
                </div>
                {d.client !== nom && (
                  <p className="mt-1 text-xs text-muted-foreground">Établi au nom de : {d.client}</p>
                )}
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
