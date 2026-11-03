import { useEffect, useState } from "react";
import { createFileRoute, useBlocker, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  chargerEntreprise,
  ConflitEntreprise,
  ENTREPRISE_DEPART,
  enregistrerEntreprise,
  useEtatEntreprise,
  validerEntreprise,
  type Entreprise,
  type ErreursEntreprise,
} from "@/data/entreprise";

export const Route = createFileRoute("/_authenticated/entreprise")({
  head: () => ({
    meta: [
      { title: "Entreprise — Les Frères Mayet" },
      { name: "description", content: "Coordonnées et informations administratives de Les Frères Mayet." },
      { property: "og:title", content: "Entreprise — Les Frères Mayet" },
      { property: "og:description", content: "Coordonnées et informations administratives de Les Frères Mayet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EntreprisePage,
});

type Cle = keyof Entreprise;

function EntreprisePage() {
  const etat = useEtatEntreprise();
  if (etat.statut === "inactif" || etat.statut === "chargement")
    return <AppLayout titre="Entreprise"><p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement des informations de l'entreprise…</p></AppLayout>;
  if (etat.statut === "erreur")
    return (
      <AppLayout titre="Entreprise">
        <h1 className="text-2xl font-semibold lg:text-3xl">Entreprise</h1>
        <div role="alert" className="mt-4 flex max-w-3xl flex-col gap-3 rounded-xl border border-destructive/40 bg-card p-4 text-sm sm:flex-row sm:items-center">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <p className="flex-1">Les informations de l'entreprise n'ont pas pu être chargées. Vérifiez votre connexion puis réessayez.</p>
          <Button variant="outline" size="sm" onClick={() => void chargerEntreprise()}>Réessayer</Button>
        </div>
      </AppLayout>
    );
  return <Formulaire
    key={etat.statut === "pret" ? etat.majLe : "absente"}
    enregistree={etat.statut === "pret" ? etat.fiche : ENTREPRISE_DEPART}
    version={etat.statut === "pret" ? etat.majLe : null} />;
}

function Formulaire({ enregistree, version }: { enregistree: Entreprise; version: string | null }) {
  const [saisie, setSaisie] = useState<Entreprise>(enregistree);
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState<null | "reseau" | "conflit">(null);

  const [erreurs, setErreurs] = useState<ErreursEntreprise>({});
  const [confirme, setConfirme] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem("entreprise-confirmee")) { sessionStorage.removeItem("entreprise-confirmee"); setConfirme(true); }
  }, []);

  const modifie = (Object.keys(saisie) as Cle[]).some((k) => saisie[k] !== enregistree[k]);
  const blocker = useBlocker({ shouldBlockFn: () => modifie, withResolver: true, enableBeforeUnload: false });

  const maj = (k: Cle, v: string) => {
    setSaisie((s) => ({ ...s, [k]: v }));
    setConfirme(false);
    if (erreurs[k]) setErreurs((e) => ({ ...e, [k]: undefined }));
  };

  const enregistrer = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (enCours) return;
    const { erreurs: e, propre } = validerEntreprise(saisie);
    setErreurs(e);
    if (!propre) {
      const premier = Object.keys(e)[0];
      const el = premier ? document.getElementById(`e-${premier}`) : null;
      el?.scrollIntoView({ block: "center" });
      el?.focus();
      return;
    }
    setEnCours(true);
    setEchec(null);
    try {
      // Marqueur relu par le formulaire remonté avec la nouvelle version.
      sessionStorage.setItem("entreprise-confirmee", "1");
      await enregistrerEntreprise(propre, version);
    } catch (err) {
      sessionStorage.removeItem("entreprise-confirmee");
      setEchec(err instanceof ConflitEntreprise ? "conflit" : "reseau");
      setEnCours(false);
    }
  };

  const annuler = () => {
    setEchec(null);
    setSaisie(enregistree);
    setErreurs({});
    setConfirme(false);
  };

  const champ = (k: Cle, label: string, opts: { requis?: boolean; aide?: string; type?: string; inputMode?: "numeric" | "decimal" | "tel" | "email" | "url"; placeholder?: string } = {}) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={`e-${k}`}>
        {label}
        <span className="ml-1 font-normal text-muted-foreground">{opts.requis ? "(obligatoire)" : ""}</span>
      </Label>
      {k === "immatriculation" || k === "cgv" ? (
        <Textarea id={`e-${k}`} value={saisie[k]} onChange={(e) => maj(k, e.target.value)} rows={k === "cgv" ? 14 : 2}
          placeholder={opts.placeholder} aria-invalid={!!erreurs[k]} />
      ) : (
        <Input id={`e-${k}`} type={opts.type ?? "text"} inputMode={opts.inputMode} value={saisie[k]}
          onChange={(e) => maj(k, e.target.value)} placeholder={opts.placeholder}
          aria-invalid={!!erreurs[k]} aria-describedby={erreurs[k] ? `e-${k}-err` : undefined} />
      )}
      {opts.aide && <p className="text-xs text-muted-foreground">{opts.aide}</p>}
      {erreurs[k] && <p id={`e-${k}-err`} className="text-sm font-medium text-destructive">{erreurs[k]}</p>}
    </div>
  );

  const section = (titre: string, children: React.ReactNode) => (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold">{titre}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );

  const chargerLogo = async (f: File) => {
    try {
      const { logoDepuisFichier } = await import("@/lib/logo");
      maj("logo", await logoDepuisFichier(f));
      setErreurs((e) => ({ ...e, logo: "" }));
    } catch (e) { setErreurs((x) => ({ ...x, logo: e instanceof Error ? e.message : "Logo illisible." })); }
  };

  const declare = "Informations déclarées — aucune vérification auprès d'un registre externe.";

  return (
    <AppLayout titre="Entreprise">
      <div className="mb-5 flex flex-wrap gap-2 rounded-xl bg-card p-2 w-fit"><span className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">Entreprise</span><Link to="/messages" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary">Messages par défaut</Link></div>
      <h1 className="text-2xl font-semibold lg:text-3xl">Entreprise</h1>
      <p className="mt-1 text-sm text-muted-foreground">Les informations reprises dans l'aperçu de vos devis.</p>
      <p className="mt-3 inline-block rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
        Les informations enregistrées sont conservées dans votre espace privé.
      </p>
      {version === null && (
        <p className="mt-3 max-w-3xl rounded-xl border border-border bg-card p-3 text-sm">Complétez puis enregistrez les informations de votre entreprise.</p>
      )}

      <form onSubmit={enregistrer} noValidate className="mt-6 flex max-w-3xl flex-col gap-5">
        {section("Identité", <>
          <div className="sm:col-span-2">{champ("raisonSociale", "Raison sociale", { requis: true })}</div>
          {champ("nomCommercial", "Nom commercial")}
          {champ("activite", "Activité")}
        </>)}
        {section("Coordonnées", <>
          <div className="sm:col-span-2">{champ("adresse", "Adresse")}</div>
          <div className="sm:col-span-2">{champ("complement", "Complément d'adresse")}</div>
          {champ("codePostal", "Code postal", { inputMode: "numeric" })}
          {champ("ville", "Ville")}
          {champ("pays", "Pays")}
          {champ("telephone", "Téléphone", { type: "tel", inputMode: "tel" })}
          {champ("email", "E-mail", { type: "email", inputMode: "email" })}
          {champ("site", "Site internet", { inputMode: "url", placeholder: "www.example.com" })}
        </>)}
        {section("Informations administratives", <>
          {champ("formeJuridique", "Forme juridique")}
          {champ("capital", "Capital social en euros", { inputMode: "decimal", placeholder: "Ex. 10 000" })}
          {champ("siret", "SIRET", { inputMode: "numeric", aide: declare })}
          {champ("tva", "Numéro de TVA intracommunautaire", { aide: declare })}
          <div className="sm:col-span-2">{champ("immatriculation", "Mention d'immatriculation", { placeholder: "Ex. RCS … / RM …" })}</div>
        </>)}

        {section("En-tête et logo", <>
          <div className="sm:col-span-2">{champ("bandeau", "Ligne libre en haut des documents", { placeholder: "Ex. URGENCE 7J/7", aide: "Facultatif : affichée en haut de chaque devis, facture et acompte." })}</div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="e-logo-fichier">Logo</Label>
            {saisie.logo && <img src={saisie.logo} alt="Aperçu du logo" className="max-h-20 w-auto max-w-full self-start rounded border border-border bg-white p-2" />}
            <input id="e-logo-fichier" type="file" accept="image/png,image/jpeg" className="sr-only"
              onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ""; if (f) void chargerLogo(f); }} />
            <label htmlFor="e-logo-fichier" className="inline-flex h-9 w-fit cursor-pointer items-center rounded-md border border-input bg-card px-4 text-sm font-medium shadow-sm hover:bg-secondary focus-within:ring-1">{saisie.logo ? "Changer le logo" : "Choisir une image"}</label>
            <div className="flex gap-2">{saisie.logo && <Button type="button" size="sm" variant="outline" onClick={() => maj("logo", "")}>Retirer le logo</Button>}</div>
            <p className="text-xs text-muted-foreground">PNG ou JPEG, redimensionné automatiquement (700 pixels de large au plus, 200 Ko au plus).</p>
            {erreurs.logo && <p role="alert" className="text-sm font-medium text-destructive">{erreurs.logo}</p>}
          </div>
        </>)}
        {section("Coordonnées bancaires, assurance et régime fiscal", <>
          {champ("iban", "IBAN", { placeholder: "FR76 …", aide: "Affiché sur les devis, factures et acomptes pour le paiement par virement." })}
          {champ("bic", "BIC")}
          {champ("assureur", "Assureur (garantie décennale / RC Pro)", { placeholder: "Ex. SMA BTP" })}
          {champ("contratAssurance", "Numéro de contrat d'assurance")}
          {champ("codeNaf", "Code NAF / APE", { placeholder: "Ex. 4322A" })}
          {champ("regimeTva", "Régime de TVA", { placeholder: "Ex. TVA sur les débits" })}
        </>)}
        {section("Conditions générales de vente", <>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <p className="text-sm text-muted-foreground">Ajoutées à la fin de vos devis, factures et acomptes (nouvelles pages). Séparez les paragraphes par une ligne vide ; une ligne commençant par « Article » devient un titre. Laissez vide pour ne rien ajouter.</p>
            <input id="e-cgv-fichier" type="file" accept=".txt,text/plain" className="sr-only"
              onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ""; if (f) void f.text().then((t) => maj("cgv", t.replace(/\r\n/g, "\n"))); }} />
            <label htmlFor="e-cgv-fichier" className="inline-flex h-9 w-fit cursor-pointer items-center rounded-md border border-input bg-card px-4 text-sm font-medium shadow-sm hover:bg-secondary">Charger un fichier .txt</label>
          </div>
          <div className="sm:col-span-2">{champ("cgv", "Texte des CGV")}</div>
        </>)}

        <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-border bg-background/95 px-4 py-3 sm:static sm:mx-0 sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
          <Button type="submit" variant="action" disabled={enCours} aria-busy={enCours}>
            {enCours && <Loader2 className="animate-spin" />}{enCours ? "Enregistrement…" : "Enregistrer les informations"}
          </Button>
          <Button type="button" variant="outline" onClick={annuler} disabled={!modifie || enCours}>Annuler les modifications</Button>
          {confirme && !modifie && (
            <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" /> Informations de l'entreprise enregistrées.
            </p>
          )}
        </div>
        {echec && (
          <div role="alert" className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-card p-3 text-sm sm:flex-row sm:items-center">
            <AlertTriangle className="size-4 shrink-0 text-destructive" />
            <p className="flex-1">{echec === "conflit"
              ? "Une version plus récente de la fiche a été enregistrée ailleurs. Vos saisies sont conservées ici ; rechargez la fiche pour consulter la version enregistrée (vos saisies seront alors remplacées)."
              : "L'enregistrement a échoué. Vos saisies sont conservées ; vous pouvez réessayer."}</p>
            {echec === "conflit" && <Button type="button" size="sm" variant="outline" onClick={() => void chargerEntreprise()}>Recharger la fiche</Button>}
          </div>
        )}
      </form>

      {blocker.status === "blocked" && (
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Abandonner les modifications non enregistrées ?</AlertDialogTitle>
              <AlertDialogDescription>Les dernières informations enregistrées resteront inchangées.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => blocker.reset?.()}>Continuer la saisie</AlertDialogCancel>
              <AlertDialogAction onClick={() => blocker.proceed?.()}>Abandonner les modifications</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </AppLayout>
  );
}
