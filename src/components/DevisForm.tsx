import { DevisApercu, versPublic } from "@/components/DevisApercu";
import { MentionsInserer } from "@/components/MentionsInserer";
import { lireLot, ecrireLot, deplacerLigne, dupliquerLigne } from '@/lib/lots';
import { dateParis } from "@/lib/echeances";
import { useEtatEntreprise } from "@/data/entreprise";
import { DeductionBloc } from "@/components/DeductionBloc";
import type { Deduction } from "@/data/deduction";
import { lireHabitudes } from "@/data/habitudes";
import { appliquerHabitudesDevis, type Habitudes } from "@/lib/habitudes";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { StatutBadge } from "@/components/StatutBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chargerClients, nomClient, useEtatClients, type Client } from "@/data/clients";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TYPE_ARTICLE_LABELS,
  UNITE_LABELS,
  formaterPrix,
  chargerCatalogue,
  useEtatCatalogue,
  type Article,
  type ArticleType,
  type Unite,
} from "@/data/catalogue";
import {
  TAUX_TVA,
  formaterCentimes,
  labelTaux,
  nouvelleCle,
  recapituler,
  validerLigne,
  type CoordonneesClient,
  type DevisBrouillon,
  type LigneSaisie,
  type TauxTVA,
} from "@/data/devis";
import { chargerDocuments, ConflitDevis, enregistrerBrouillon, enregistrerFacture, creerFactureDirecte } from "@/data/documents";

function aujourdhui() {
  return dateParis();
}

export function copierCoordonnees(c: Client): CoordonneesClient {
  return {
    nom: nomClient(c),
    contact: c.type === "entreprise" ? c.nom.trim() : "",
    telephone: c.telephone.trim(),
    email: c.email.trim(),
    adresse: [c.adresse, c.complement, [c.codePostal, c.ville].filter(Boolean).join(" "), c.pays]
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function vide(): DevisBrouillon {
  return {
    clientId: "",
    client: { nom: "", telephone: "", email: "", adresse: [] },
    objet: "",
    date: aujourdhui(),
    validite: "",
    remarques: "",
    notes: "",
    lignes: [],
  };
}

function Erreur({ id, texte }: { id: string; texte?: string | undefined }) {
  if (!texte) return null;
  return <p id={`${id}-erreur`} className="text-sm font-medium text-destructive">{texte}</p>;
}

function Section({ numero, titre, children }: { numero: number; titre: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 lg:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-sm text-secondary-foreground">
          {numero}
        </span>
        {titre}
      </h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function DevisForm(props: Parameters<typeof DevisFormBase>[0]) {
  // Création d'un devis : on attend les habitudes (validité, mentions) pour pré-remplir le brouillon. Rien n'est modifié en édition.
  const creation = !props.documentId && !props.facture;
  const [h, setH] = useState<{ pret: boolean; valeur: Habitudes | null }>({ pret: !creation, valeur: null });
  useEffect(() => { if (!creation) return; let actif = true; lireHabitudes().then(v => { if (actif) setH({ pret: true, valeur: v }); }); return () => { actif = false; }; }, [creation]);
  const initial = useMemo(() => creation ? appliquerHabitudesDevis(props.initial ?? vide(), h.valeur) : props.initial, [creation, props.initial, h.valeur]);
  if (!h.pret) return <p role="status" className="text-sm text-muted-foreground">Préparation du devis…</p>;
  return <DevisFormBase {...props} {...(initial ? { initial } : {})} />;
}

function DevisFormBase({
  initial,
  documentId,
  numero,
  version,
  facture,
  avantEnregistrer,
}: {
  /** Mode facture brouillon : client figé, échéance au lieu de validité. */
  facture?: { sourceRef: string; deduction?: Deduction; directe?: boolean };
  initial?: DevisBrouillon;
  documentId?: string;
  numero?: string;
  version?: number | undefined;
  avantEnregistrer?: (id: string) => Promise<void>;
}) {
  const idTentative = useRef<string>(documentId ?? crypto.randomUUID());
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState<null | "reseau" | "conflit">(null);
  const [detailEchec, setDetailEchec] = useState("");
  const [confirmerRecharge, setConfirmerRecharge] = useState(false);
  const navigate = useNavigate();
  const entrepriseApercu = useEtatEntreprise();
  const etatClients = useEtatClients();
  const clients = etatClients.clients;
  const etatCatalogue = useEtatCatalogue();
  const articles = etatCatalogue.articles;
  const depart = useMemo(() => JSON.stringify(initial ?? vide()), [initial]);
  const [v, setV] = useState<DevisBrouillon>(() => JSON.parse(depart));
  const [tentative, setTentative] = useState(false);
  const [rechercheClient, setRechercheClient] = useState("");
  const [choixClient, setChoixClient] = useState(!initial?.clientId);
  const [catalogueOuvert, setCatalogueOuvert] = useState(false);
  // Taux appliqué par défaut aux nouvelles lignes ; pré-rempli si toutes les lignes existantes ont le même taux.
  const [tauxGlobal, setTauxGlobal] = useState<TauxTVA | null>(() => {
    const l = (JSON.parse(depart) as DevisBrouillon).lignes;
    const premier = l[0]?.taux ?? null;
    return premier !== null && l.every((x) => x.taux === premier) ? premier : null;
  });
  const [selection, setSelection] = useState<string[]>([]);
  const [rechercheArticle, setRechercheArticle] = useState("");
  const [typeArticle, setTypeArticle] = useState<ArticleType | "tous">("tous");
  const enregistre = useRef(false);

  // Un panneau fermé pendant la navigation peut laisser la page non cliquable : on rétablit.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!document.querySelector("[role=dialog],[role=alertdialog]")) document.body.style.pointerEvents = "";
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const modifie = JSON.stringify(v) !== depart;
  const blocker = useBlocker({
    shouldBlockFn: () => modifie && !enregistre.current,
    withResolver: true,
    enableBeforeUnload: modifie && !enregistre.current,
  });

  const maj = (patch: Partial<DevisBrouillon>) => setV((x) => ({ ...x, ...patch }));
  const majLigne = (cle: string, patch: Partial<LigneSaisie>) =>
    setV((x) => ({ ...x, lignes: x.lignes.map((l) => (l.cle === cle ? { ...l, ...patch } : l)) }));

  // --- Validation ---------------------------------------------------------
  const erreurs: Record<string, string> = {};
  if (!v.clientId) erreurs["d-client"] = "Sélectionnez un client.";
  if (!v.objet.trim()) erreurs["d-objet"] = facture ? "Indiquez l'objet de la facture." : "Indiquez l'objet du devis.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) erreurs["d-date"] = "Indiquez une date valide.";
  if (v.validite && !/^\d{4}-\d{2}-\d{2}$/.test(v.validite)) erreurs["d-validite"] = "Date invalide.";
  else if (v.validite && v.date && v.validite < v.date)
    erreurs["d-validite"] = facture
      ? "L'échéance ne peut pas être antérieure à la date de la facture."
      : "La date de validité ne peut pas être antérieure à la date du devis.";
  if (facture && v.prestationDebut && v.prestationFin && v.prestationFin < v.prestationDebut)
    erreurs["d-prest-fin"] = "La fin de la période ne peut pas précéder son début.";
  if (facture && v.prestationFin && !v.prestationDebut) erreurs["d-prest-debut"] = "Indiquez le début de la période (ou seulement une date).";
  const validations = v.lignes.map((l) => ({ l, ...validerLigne(l) }));
  for (const { l, erreurs: e } of validations)
    for (const k of ["designation", "unite", "quantite", "prix", "taux"] as const)
      if (e[k]) erreurs[`l-${l.cle}-${k}`] = e[k]!;
  if (v.lignes.length === 0) erreurs["d-lignes"] = "Ajoutez au moins une ligne.";
  const recap = recapituler(v.lignes);
  const err = (id: string) => (tentative ? erreurs[id] : undefined);

  async function enregistrer() {
    if (enCours) return;
    setTentative(true);
    const premier = Object.keys(erreurs)[0];
    if (premier) {
      const el = document.getElementById(premier);
      el?.scrollIntoView({ behavior: "auto", block: "center" });
      el?.focus();
      return;
    }
    setEnCours(true);
    setEchec(null);
    try {
      if (facture) {
        const doc = facture.directe && !documentId
          ? await creerFactureDirecte(idTentative.current, v)
          : await enregistrerFacture(idTentative.current, v, version!);
        enregistre.current = true;
        toast.success("Facture brouillon enregistrée");
        navigate({ to: "/factures/$id", params: { id: doc.id } });
        return;
      }
      if (avantEnregistrer) await avantEnregistrer(idTentative.current);
      const doc = await enregistrerBrouillon(idTentative.current, v, version ?? null);
      enregistre.current = true;
      toast.success("Brouillon enregistré");
      navigate({ to: "/devis/$id", params: { id: doc.id } });
    } catch (e) {
      setDetailEchec(e instanceof Error ? e.message : "L’enregistrement n’a pas été confirmé.");
      setEchec(e instanceof ConflitDevis ? "conflit" : "reseau");
      setEnCours(false);
    }
  }

  // --- Clients ------------------------------------------------------------
  const q = rechercheClient.trim().toLowerCase();
  const qChiffres = q.replace(/\D/g, "");
  const clientsTrouves = clients.filter((c) => {
    if (!q) return true;
    if ([nomClient(c), c.email, c.telephone].some((t) => t.toLowerCase().includes(q))) return true;
    return qChiffres.length >= 2 && c.telephone.replace(/\D/g, "").includes(qChiffres);
  });

  // --- Catalogue ----------------------------------------------------------
  const qa = rechercheArticle.trim().toLowerCase();
  const articlesTrouves = articles.filter(
    (a) =>
      !a.archive &&
      (typeArticle === "tous" || a.type === typeArticle) &&
      (!qa || [a.reference, a.designation, a.marque].some((t) => t.toLowerCase().includes(qa))),
  );

  function ligneDepuisArticle(a: Article): LigneSaisie {
    return {
      cle: nouvelleCle(),
      articleId: a.id,
      type: a.type,
      reference: a.reference,
      designation: a.designation,
      description: a.description,
      unite: a.unite,
      quantite: "1",
      prix: a.prixHT.toFixed(2).replace(".", ","),
      taux: tauxGlobal,
    };
  }
  function ajouterDepuisCatalogue(a: Article) {
    setV((x) => ({ ...x, lignes: [...x.lignes, ligneDepuisArticle(a)] }));
  }
  function ajouterSelection() {
    const choisis = articlesTrouves.filter((a) => selection.includes(a.id));
    if (choisis.length === 0) return;
    setV((x) => ({ ...x, lignes: [...x.lignes, ...choisis.map(ligneDepuisArticle)] }));
    setSelection([]);
    toast.success(choisis.length === 1 ? "1 ligne ajoutée" : `${choisis.length} lignes ajoutées`);
  }
  function appliquerTauxATous(t: TauxTVA) {
    setTauxGlobal(t);
    setV((x) => ({ ...x, lignes: x.lignes.map((l) => ({ ...l, taux: t })) }));
  }
  function ajouterLibre() {
    maj({
      lignes: [
        ...v.lignes,
        {
          cle: nouvelleCle(),
          articleId: null,
          type: "prestation",
          reference: "",
          designation: "",
          description: "",
          unite: "",
          quantite: "1",
          prix: "",
          taux: tauxGlobal,
        },
      ],
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold lg:text-3xl">
              {facture ? documentId ? "Modifier la facture brouillon" : "Nouvelle facture" : documentId ? "Modifier le brouillon" : "Nouveau devis"}
            </h1>
            <StatutBadge statut="Brouillon" />
          </div>
          {numero && <p className="mt-1 text-sm text-muted-foreground">Référence provisoire : {numero}</p>}
          {facture && <p className="mt-1 text-sm text-muted-foreground">{facture.sourceRef ? `Issue du devis ${facture.sourceRef}` : "Facture sans devis d’origine"} — facture non émise.</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            Les brouillons enregistrés sont conservés dans votre espace privé.
          </p>
        </div>
      </div>

      <form
        noValidate
        className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          enregistrer();
        }}
      >
        <div className="flex min-w-0 flex-col gap-6">
          {/* 1. Client */}
          <Section numero={1} titre="Client">
            {etatClients.statut === "erreur" && clients.length === 0 ? (
              <div role="alert" className="text-sm">
                <p>Impossible de charger vos clients pour le moment.</p>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void chargerClients()}>
                  Réessayer
                </Button>
              </div>
            ) : etatClients.statut !== "pret" && clients.length === 0 ? (
              <p role="status" className="text-sm text-muted-foreground">Chargement de vos clients…</p>
            ) : clients.length === 0 ? (
              <p className="text-sm">
                Aucun client n'existe encore. Créez d'abord un client dans la rubrique Clients.
              </p>
            ) : facture && !(facture.directe && !documentId) ? (
              <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm">
                <p className="font-semibold">{v.client.nom}</p>
                {v.client.contact && <p>Contact : {v.client.contact}</p>}
                {v.client.telephone && <p>{v.client.telephone}</p>}
                {v.client.email && <p className="break-all">{v.client.email}</p>}
                {v.client.adresse.map((l, i) => <p key={i}>{l}</p>)}
                <p className="mt-2 text-xs text-muted-foreground">Coordonnées figées lors de la création{facture.sourceRef ? ` depuis le devis ${facture.sourceRef}` : ""}. Le client ne peut pas être changé.</p>
              </div>
            ) : v.clientId && !choixClient ? (
              <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm">
                <p className="font-semibold">{v.client.nom}</p>
                {v.client.contact && <p>Contact : {v.client.contact}</p>}
                {v.client.telephone && <p>{v.client.telephone}</p>}
                {v.client.email && <p className="break-all">{v.client.email}</p>}
                {v.client.adresse.map((l, i) => <p key={i}>{l}</p>)}
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setChoixClient(true)}>
                  Changer de client
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="d-client">Rechercher un client (nom, raison sociale, e-mail ou téléphone)</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="d-client"
                    className="pl-9"
                    value={rechercheClient}
                    onChange={(e) => setRechercheClient(e.target.value)}
                    aria-invalid={!!err("d-client")}
                  />
                </div>
                <Erreur id="d-client" texte={err("d-client")} />
                <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl border border-border p-1">
                  {clientsTrouves.length === 0 && (
                    <li className="p-2 text-sm text-muted-foreground">Aucun client ne correspond.</li>
                  )}
                  {clientsTrouves.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
                        onClick={() => {
                          maj({ clientId: c.id, client: copierCoordonnees(c) });
                          setChoixClient(false);
                          setRechercheClient("");
                        }}
                      >
                        <span className="font-medium">{nomClient(c)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[c.telephone, c.email].filter(Boolean).join(" · ") || "Coordonnées non renseignées"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {v.clientId && (
                  <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setChoixClient(false)}>
                    Garder {v.client.nom}
                  </Button>
                )}
              </div>
            )}
          </Section>

          {/* 2. Informations */}
          <Section numero={2} titre={facture ? "Informations de la facture" : "Informations du devis"}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-objet">{facture ? "Objet de la facture" : "Objet du devis"} <span className="font-normal text-muted-foreground">(obligatoire)</span></Label>
              <Input id="d-objet" value={v.objet} onChange={(e) => maj({ objet: e.target.value })} aria-invalid={!!err("d-objet")} />
              <Erreur id="d-objet" texte={err("d-objet")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-date">{facture ? "Date de la facture" : "Date du devis"} <span className="font-normal text-muted-foreground">(obligatoire)</span></Label>
                <Input id="d-date" type="date" value={v.date} onChange={(e) => maj({ date: e.target.value })} aria-invalid={!!err("d-date")} />
                <Erreur id="d-date" texte={err("d-date")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-validite">{facture ? "Échéance" : "Date de validité"}</Label>
                <Input id="d-validite" type="date" value={v.validite} onChange={(e) => maj({ validite: e.target.value })} aria-invalid={!!erreurs["d-validite"]} />
                <Erreur id="d-validite" texte={erreurs["d-validite"]} />
              </div>
            </div>
            {facture && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="d-prest-debut">Date de réalisation des prestations <span className="font-normal text-muted-foreground">(ou début de période, facultatif)</span></Label>
                  <Input id="d-prest-debut" type="date" value={v.prestationDebut ?? ""} onChange={(e) => maj({ prestationDebut: e.target.value })} aria-invalid={!!erreurs["d-prest-debut"]} />
                  <Erreur id="d-prest-debut" texte={erreurs["d-prest-debut"]} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="d-prest-fin">Fin de période</Label>
                  <Input id="d-prest-fin" type="date" value={v.prestationFin ?? ""} onChange={(e) => maj({ prestationFin: e.target.value })} aria-invalid={!!erreurs["d-prest-fin"]} />
                  <Erreur id="d-prest-fin" texte={erreurs["d-prest-fin"]} />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-conditions">Conditions de paiement</Label>
              <Textarea id="d-conditions" rows={2} value={v.conditions ?? ""} onChange={(e) => maj({ conditions: e.target.value })} />
              <MentionsInserer usage={facture ? "facture" : "devis"} valeur={v.conditions ?? ""} onChange={conditions => maj({conditions})}/>
              <p className="text-xs text-muted-foreground">Aucune condition n'est ajoutée par défaut.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-remarques">Remarques destinées au client</Label>
              <Textarea id="d-remarques" rows={3} value={v.remarques} onChange={(e) => maj({ remarques: e.target.value })} />
              <MentionsInserer usage={facture ? "facture" : "devis"} valeur={v.remarques} onChange={remarques => maj({remarques})}/>
              <p className="text-xs text-muted-foreground">{facture ? "Visibles par le client sur la facture." : "Visibles par le client sur le devis."}</p>
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border bg-muted p-3">
              <Label htmlFor="d-notes">Notes internes</Label>
              <Textarea id="d-notes" rows={2} className="bg-card" value={v.notes} onChange={(e) => maj({ notes: e.target.value })} />
              <p className="text-xs text-muted-foreground">Ces notes ne sont pas destinées aux documents clients.</p>
            </div>
          </Section>

          {/* 3. Lignes */}
          <Section numero={3} titre={facture ? "Lignes de la facture" : "Lignes du devis"}>
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="d-taux-global" className="whitespace-nowrap">TVA de tout le document</Label>
                <Select value={tauxGlobal === null ? "" : String(tauxGlobal)} onValueChange={(x) => appliquerTauxATous(Number(x) as TauxTVA)}>
                  <SelectTrigger id="d-taux-global" className="w-28 bg-card"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {TAUX_TVA.map((t) => <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                S'applique à toutes les lignes, y compris celles que vous ajoutez ensuite ; chaque ligne peut garder un autre taux. Ce choix ne constitue pas une validation de l'éligibilité fiscale.
              </p>
            </div>
            {v.lignes.length === 0 && (
              <p id="d-lignes" tabIndex={-1} className="text-sm text-muted-foreground">
                Aucune ligne pour l'instant.
              </p>
            )}
            <Erreur id="d-lignes" texte={err("d-lignes")} />
            {validations.map(({ l, calcul, ht }, i) => (
              <LigneBloc
                key={l.cle}
                index={i}
                ligne={l}
                htTexte={ht !== null ? formaterCentimes(ht) : "—"}
                ttcOk={!!calcul}
                err={(k) => err(`l-${l.cle}-${k}`)}
                onChange={(p) => majLigne(l.cle, p)}
                onRetirer={() => maj({ lignes: v.lignes.filter((x) => x.cle !== l.cle) })}
                onDupliquer={() => maj({lignes:dupliquerLigne(v.lignes,l.cle,nouvelleCle())})}
                onMonter={i>0?()=>maj({lignes:deplacerLigne(v.lignes,l.cle,-1)}):undefined}
                onDescendre={i<v.lignes.length-1?()=>maj({lignes:deplacerLigne(v.lignes,l.cle,1)}):undefined}
              />
            ))}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setCatalogueOuvert((o) => !o)} aria-expanded={catalogueOuvert}>
                <Plus /> Ajouter depuis le catalogue
              </Button>
              <Button type="button" variant="outline" onClick={ajouterLibre}>
                <Plus /> Ajouter une ligne libre
              </Button>
            </div>

            {catalogueOuvert && (
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Catalogue (articles actifs)</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCatalogueOuvert(false)}>
                    <X /> Fermer
                  </Button>
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Rechercher une référence, une désignation ou une marque…"
                    aria-label="Rechercher dans le catalogue"
                    value={rechercheArticle}
                    onChange={(e) => setRechercheArticle(e.target.value)}
                    className="bg-card"
                  />
                  <Select value={typeArticle} onValueChange={(x) => setTypeArticle(x as ArticleType | "tous")}>
                    <SelectTrigger className="bg-card sm:w-44" aria-label="Filtrer le catalogue par type">
                      <SelectValue>{typeArticle === "tous" ? "Tous les types" : typeArticle === "materiel" ? "Matériel" : "Prestations"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tous">Tous les types</SelectItem>
                      <SelectItem value="materiel">Matériel</SelectItem>
                      <SelectItem value="prestation">Prestations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {etatCatalogue.statut === "pret" && articlesTrouves.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelection(selection.length === articlesTrouves.length ? [] : articlesTrouves.map((a) => a.id))}
                    >
                      {selection.length === articlesTrouves.length ? "Tout désélectionner" : "Tout sélectionner"}
                    </Button>
                    <Button type="button" size="sm" disabled={selection.length === 0} onClick={ajouterSelection}>
                      <Plus /> Ajouter la sélection{selection.length > 0 ? ` (${selection.length})` : ""}
                    </Button>
                  </div>
                )}
                <ul className="mt-2 flex max-h-96 flex-col gap-1 overflow-y-auto">
                  {etatCatalogue.statut === "erreur" && (
                    <li role="alert" className="flex flex-wrap items-center gap-2 p-2 text-sm text-destructive">
                      Le catalogue n'a pas pu être chargé.
                      <Button type="button" size="sm" variant="outline" onClick={() => void chargerCatalogue()}>Réessayer</Button>
                    </li>
                  )}
                  {(etatCatalogue.statut === "chargement" || etatCatalogue.statut === "inactif") && (
                    <li className="p-2 text-sm text-muted-foreground">Chargement du catalogue…</li>
                  )}
                  {etatCatalogue.statut === "pret" && articlesTrouves.length === 0 && (
                    <li className="p-2 text-sm text-muted-foreground">
                      {articles.some((a) => !a.archive) ? "Aucun article ne correspond." : "Aucun article actif dans votre catalogue."}
                    </li>
                  )}
                  {articlesTrouves.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-card p-2 text-sm">
                      <Checkbox
                        aria-label={`Sélectionner ${a.designation}`}
                        checked={selection.includes(a.id)}
                        onCheckedChange={(c) => setSelection((s2) => (c ? [...s2, a.id] : s2.filter((x) => x !== a.id)))}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium break-words">{a.designation}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.reference} · {TYPE_ARTICLE_LABELS[a.type]} · {formaterPrix(a.prixHT, a.unite)}
                        </p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => ajouterDepuisCatalogue(a)}>
                        Ajouter
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        </div>

        {/* Récapitulatif */}
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-6">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Récapitulatif</h2>
            <Recap recap={recap} vide={v.lignes.length === 0} />
            {facture?.deduction && <DeductionBloc recap={recap} deduction={facture.deduction} />}
          </div>
          <div className="flex flex-col gap-2">
            {tentative && Object.keys(erreurs).length > 0 && (
              <p className="text-sm font-medium text-destructive">Certains champs sont à corriger avant d'enregistrer.</p>
            )}
            <p role="status" className="text-sm text-muted-foreground">
              {enCours ? "Enregistrement…" : modifie
                ? "Modifications non enregistrées — enregistrez-les pour les retrouver dans l'aperçu et le PDF."
                : documentId ? "Version enregistrée." : ""}
            </p>
            {echec && (
              <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-3 text-sm">
                <p>{echec === "conflit"
                  ? "Une version plus récente de ce brouillon a été enregistrée ailleurs. Vos saisies sont conservées ici et n'ont pas été enregistrées."
                  : detailEchec || "L’enregistrement n’a pas été confirmé. Vos saisies sont conservées ; réessayez avec cette même tentative."}</p>
                {echec === "conflit" && (
                  <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setConfirmerRecharge(true)}>
                    Recharger la version enregistrée
                  </Button>
                )}
              </div>
            )}
            <Button type="submit" variant="action" size="lg" disabled={enCours} aria-busy={enCours}>
              {enCours ? "Enregistrement…" : "Enregistrer le brouillon"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                facture && documentId
                  ? navigate({ to: "/factures/$id", params: { id: documentId } })
                  : documentId
                  ? navigate({ to: "/devis/$id", params: { id: documentId }})
                  : navigate({ to: "/" })
              }
            >
              Annuler
            </Button>
          </div>
          <details open className="rounded-2xl border border-border bg-card p-3">
            <summary className="cursor-pointer text-sm font-semibold">Aperçu pendant la saisie</summary>
            <p className="mt-2 text-xs text-muted-foreground">Prévisualisation non enregistrée. Les notes internes restent absentes du document.</p>
            {entrepriseApercu.statut === "pret" ? <div className="saisie-apercu mt-3 max-h-[700px] overflow-y-auto rounded-xl border border-border"><DevisApercu devis={versPublic(v)} numero={numero ?? "À attribuer après enregistrement"} entreprise={entrepriseApercu.fiche} {...(facture ? {facture} : {})} /></div> : <p className="mt-3 text-sm text-muted-foreground">Enregistrez votre fiche entreprise pour afficher cet aperçu.</p>}
          </details>
        </aside>
      </form>

      {confirmerRecharge && (
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recharger la version enregistrée ?</AlertDialogTitle>
            <AlertDialogDescription>Vos saisies non enregistrées sur cette page seront perdues.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmerRecharge(false)}>Garder mes saisies</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmerRecharge(false); void chargerDocuments(); }}>Recharger</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}
      {blocker.status === "blocked" && (
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abandonner les modifications non enregistrées ?</AlertDialogTitle>
            <AlertDialogDescription>Le dernier brouillon enregistré restera inchangé.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Continuer la saisie</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>Abandonner</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}
    </>
  );
}

export function Recap({ recap, vide }: { recap: ReturnType<typeof recapituler>; vide: boolean }) {
  if (vide) return <p className="mt-3 text-sm text-muted-foreground">Ajoutez une ligne pour voir les montants.</p>;
  return (
    <>
      {!recap.complet && (
        <p role="status" className="mt-3 rounded-lg border border-warning bg-warning-soft p-2 text-sm font-medium">
          Calcul incomplet — une ligne contient une valeur invalide ou un taux non choisi.
        </p>
      )}
      <dl className={`mt-3 flex flex-col gap-2 text-sm ${recap.complet ? "" : "opacity-60"}`}>
        <div className="flex justify-between gap-2"><dt>Total HT{!recap.complet && " (partiel)"}</dt><dd className="font-medium">{formaterCentimes(recap.ht)}</dd></div>
        {recap.parTaux.map((t) => (
          <div key={t.taux} className="flex justify-between gap-2 text-muted-foreground">
            <dt>TVA {labelTaux(t.taux)} sur {formaterCentimes(t.base)}</dt>
            <dd>{formaterCentimes(t.tva)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-2"><dt>Total TVA{!recap.complet && " (partiel)"}</dt><dd className="font-medium">{formaterCentimes(recap.tva)}</dd></div>
        <div className="flex justify-between gap-2 border-t border-border pt-2 text-base">
          <dt className="font-semibold">Total TTC{!recap.complet && " (partiel)"}</dt>
          <dd className="font-semibold">{recap.complet ? formaterCentimes(recap.ttc) : "Calcul incomplet"}</dd>
        </div>
      </dl>
    </>
  );
}

function LigneBloc({
  index,
  ligne: l,
  htTexte,
  err,
  onChange,
  onRetirer,
  onDupliquer, onMonter, onDescendre,
}: {
  index: number;
  ligne: LigneSaisie;
  htTexte: string;
  ttcOk: boolean;
  err: (k: string) => string | undefined;
  onChange: (p: Partial<LigneSaisie>) => void;
  onRetirer: () => void;
  onDupliquer: () => void;
  onMonter?: (() => void) | undefined;
  onDescendre?: (() => void) | undefined;
}) {
  const id = (k: string) => `l-${l.cle}-${k}`;
  const lot=lireLot(l.description);
  return (
    <div className="rounded-xl border border-border p-3" data-ligne={index + 1}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          Ligne {index + 1}
          {l.articleId && <span className="ml-2 font-normal text-muted-foreground">Depuis le catalogue · {l.reference}</span>}
        </p>
        <div className="flex flex-wrap gap-1">
          <Button type="button" variant="ghost" size="sm" disabled={!onMonter} onClick={onMonter} aria-label={`Monter la ligne ${index+1}`}>↑</Button>
          <Button type="button" variant="ghost" size="sm" disabled={!onDescendre} onClick={onDescendre} aria-label={`Descendre la ligne ${index+1}`}>↓</Button>
          <Button type="button" variant="outline" size="sm" onClick={onDupliquer} aria-label={`Dupliquer la ligne ${index+1}`}>Dupliquer</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRetirer}>Retirer</Button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-12">
        <div className="col-span-2 flex flex-col gap-1 lg:col-span-3">
          <Label htmlFor={id("type")}>Type</Label>
          <Select value={l.type} onValueChange={(x) => onChange({ type: x as ArticleType })}>
            <SelectTrigger id={id("type")}><SelectValue>{TYPE_ARTICLE_LABELS[l.type]}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="materiel">Matériel</SelectItem>
              <SelectItem value="prestation">Prestation</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex flex-col gap-1 lg:col-span-9">
          <Label htmlFor={id("designation")}>Désignation</Label>
          <Input id={id("designation")} value={l.designation} onChange={(e) => onChange({ designation: e.target.value })} aria-invalid={!!err("designation")} />
          <Erreur id={id("designation")} texte={err("designation")} />
        </div>
        <div className="col-span-2 flex flex-col gap-1 lg:col-span-12">
          <Label htmlFor={id('lot')}>Lot</Label>
          <Input id={id('lot')} maxLength={100} placeholder="Ex. Cuisine, Tableau électrique, VMC" value={lot.lot} onChange={e=>onChange({description:ecrireLot(l.description,e.target.value)})}/>
          <Label htmlFor={id("description")}>Description</Label>
          <Textarea id={id("description")} rows={2} value={lot.description} onChange={(e) => onChange({ description: ecrireLot(e.target.value,lot.lot) })} />
        </div>
        <div className="flex flex-col gap-1 lg:col-span-2">
          <Label htmlFor={id("unite")}>Unité</Label>
          <Select value={l.unite} onValueChange={(x) => onChange({ unite: x as Unite })}>
            <SelectTrigger id={id("unite")} aria-invalid={!!err("unite")}>
              <SelectValue placeholder="Choisir">{l.unite ? UNITE_LABELS[l.unite] : undefined}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(UNITE_LABELS) as Unite[]).map((u) => <SelectItem key={u} value={u}>{UNITE_LABELS[u]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Erreur id={id("unite")} texte={err("unite")} />
        </div>
        <div className="flex flex-col gap-1 lg:col-span-2">
          <Label htmlFor={id("quantite")}>Quantité</Label>
          <Input id={id("quantite")} inputMode="decimal" value={l.quantite} onChange={(e) => onChange({ quantite: e.target.value })} aria-invalid={!!err("quantite")} />
          <Erreur id={id("quantite")} texte={err("quantite")} />
        </div>
        <div className="flex flex-col gap-1 lg:col-span-3">
          <Label htmlFor={id("prix")}>Prix unitaire HT (€)</Label>
          <Input id={id("prix")} inputMode="decimal" value={l.prix} onChange={(e) => onChange({ prix: e.target.value })} aria-invalid={!!err("prix")} />
          <Erreur id={id("prix")} texte={err("prix")} />
        </div>
        <div className="flex flex-col gap-1 lg:col-span-2">
          <Label htmlFor={id("taux")}>TVA</Label>
          <Select value={l.taux === null ? "" : String(l.taux)} onValueChange={(x) => onChange({ taux: Number(x) as TauxTVA })}>
            <SelectTrigger id={id("taux")} aria-invalid={!!err("taux")}>
              <SelectValue placeholder="Choisir">{l.taux !== null ? labelTaux(l.taux) : undefined}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TAUX_TVA.map((t) => <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Erreur id={id("taux")} texte={err("taux")} />
        </div>
        <div className="col-span-2 flex flex-col gap-1 lg:col-span-3">
          <span className="text-sm font-medium">Total HT</span>
          <span className="flex h-9 items-center font-semibold" data-testid="total-ligne">{htTexte}</span>
        </div>
      </div>
    </div>
  );
}
