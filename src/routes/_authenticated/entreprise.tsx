import { useState } from "react";
import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

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
  enregistrerEntreprise,
  useEntreprise,
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
  const enregistree = useEntreprise();
  const [saisie, setSaisie] = useState<Entreprise>(enregistree);
  const [erreurs, setErreurs] = useState<ErreursEntreprise>({});
  const [confirme, setConfirme] = useState(false);

  const modifie = (Object.keys(saisie) as Cle[]).some((k) => saisie[k] !== enregistree[k]);
  const blocker = useBlocker({ shouldBlockFn: () => modifie, withResolver: true, enableBeforeUnload: false });

  const maj = (k: Cle, v: string) => {
    setSaisie((s) => ({ ...s, [k]: v }));
    setConfirme(false);
    if (erreurs[k]) setErreurs((e) => ({ ...e, [k]: undefined }));
  };

  const enregistrer = (ev: React.FormEvent) => {
    ev.preventDefault();
    const { erreurs: e, propre } = validerEntreprise(saisie);
    setErreurs(e);
    if (!propre) {
      const premier = Object.keys(e)[0];
      const el = premier ? document.getElementById(`e-${premier}`) : null;
      el?.scrollIntoView({ block: "center" });
      el?.focus();
      return;
    }
    enregistrerEntreprise(propre);
    setSaisie(propre);
    setConfirme(true);
  };

  const annuler = () => {
    setSaisie(enregistree);
    setErreurs({});
    setConfirme(false);
  };

  const champ = (k: Cle, label: string, opts: { requis?: boolean; aide?: string; type?: string; inputMode?: "numeric" | "decimal" | "tel" | "email" | "url"; placeholder?: string } = {}) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={`e-${k}`}>
        {label}
        <span className="ml-1 font-normal text-muted-foreground">{opts.requis ? "(obligatoire)" : "(facultatif)"}</span>
      </Label>
      {k === "immatriculation" ? (
        <Textarea id={`e-${k}`} value={saisie[k]} onChange={(e) => maj(k, e.target.value)} rows={2}
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

  const declare = "Informations déclarées — aucune vérification auprès d'un registre externe.";

  return (
    <AppLayout titre="Entreprise">
      <h1 className="text-2xl font-semibold lg:text-3xl">Entreprise</h1>
      <p className="mt-1 text-sm text-muted-foreground">Les informations reprises dans l'aperçu de vos devis.</p>
      <p className="mt-3 inline-block rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
        Démonstration : les informations sont réinitialisées au rechargement.
      </p>

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

        <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-border bg-background/95 px-4 py-3 sm:static sm:mx-0 sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
          <Button type="submit" variant="action">Enregistrer les informations</Button>
          <Button type="button" variant="outline" onClick={annuler} disabled={!modifie}>Annuler les modifications</Button>
          {confirme && !modifie && (
            <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" /> Informations enregistrées.
            </p>
          )}
        </div>
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
