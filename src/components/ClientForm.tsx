import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TYPE_CLIENT_LABELS,
  clientVide,
  nomClient,
  normaliserNom,
  type Client,
  type ClientSaisie,
  type ClientType,
} from "@/data/clients";

type Erreurs = Partial<Record<keyof ClientSaisie, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function valider(v: ClientSaisie): Erreurs {
  const e: Erreurs = {};
  if (v.type === "particulier" && !v.nom.trim()) e.nom = "Indiquez le nom du client.";
  if (v.type === "entreprise" && !v.raisonSociale.trim())
    e.raisonSociale = "Indiquez la raison sociale de l'entreprise.";
  if (v.email.trim() && !EMAIL_RE.test(v.email.trim()))
    e.email = "Cette adresse e-mail n'est pas valide (exemple : nom@example.com).";
  if (v.type === "entreprise" && v.siret.trim()) {
    const s = v.siret.replace(/\s/g, "");
    if (!/^\d{14}$/.test(s))
      e.siret = `Le SIRET doit contenir 14 chiffres (actuellement ${s.replace(/\D/g, "").length === s.length ? s.length + " chiffres" : "caractères non numériques"}).`;
  }
  return e;
}

function Champ({
  id,
  label,
  facultatif,
  erreur,
  aide,
  children,
}: {
  id: string;
  label: string;
  facultatif?: boolean | undefined;
  erreur?: string | undefined;
  aide?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {facultatif ? (
          <span className="ml-1 font-normal text-muted-foreground">(facultatif)</span>
        ) : (
          <span className="ml-1 font-normal text-muted-foreground">(obligatoire)</span>
        )}
      </Label>
      {children}
      {aide && <p className="text-xs text-muted-foreground">{aide}</p>}
      {erreur && (
        <p id={`${id}-erreur`} className="text-sm font-medium text-destructive">
          {erreur}
        </p>
      )}
    </div>
  );
}

export function ClientForm({
  initial,
  clientId,
  clients,
  onCancel,
  onSave,
  onVoirExistant,
}: {
  initial?: ClientSaisie;
  clientId?: string;
  clients: Client[];
  onCancel: () => void;
  onSave: (v: ClientSaisie) => void;
  onVoirExistant: (c: Client) => void;
}) {
  const [valeurs, setValeurs] = useState<ClientSaisie | null>(initial ?? null);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [homonyme, setHomonyme] = useState<Client | null>(null);

  if (!valeurs) {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <p className="text-sm font-medium">Quel type de client souhaitez-vous ajouter ?</p>
        {(["particulier", "entreprise"] as ClientType[]).map((t) => (
          <Button
            key={t}
            variant="outline"
            size="lg"
            className="justify-start"
            onClick={() => setValeurs(clientVide(t))}
          >
            {TYPE_CLIENT_LABELS[t]}
          </Button>
        ))}
        <Button variant="ghost" className="mt-2" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    );
  }

  const v = valeurs;
  const maj = (k: keyof ClientSaisie) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValeurs({ ...v, [k]: ev.target.value });
    if (erreurs[k]) setErreurs({ ...erreurs, [k]: undefined });
    setHomonyme(null);
  };
  const inp = (k: keyof ClientSaisie, extra?: React.ComponentProps<typeof Input>) => (
    <Input
      id={`f-${k}`}
      value={v[k] as string}
      onChange={maj(k)}
      aria-invalid={!!erreurs[k]}
      aria-describedby={erreurs[k] ? `f-${k}-erreur` : undefined}
      {...extra}
    />
  );

  function enregistrer(forcer = false) {
    const e = valider(v);
    setErreurs(e);
    if (Object.keys(e).length > 0) return;
    if (!forcer) {
      const n = normaliserNom(nomClient(v));
      const doublon = clients.find(
        (c) => c.id !== clientId && c.type === v.type && normaliserNom(nomClient(c)) === n,
      );
      if (doublon) {
        setHomonyme(doublon);
        return;
      }
    }
    onSave({
      ...v,
      email: v.email.trim(),
      siret: v.siret.trim(),
    });
  }

  return (
    <form
      className="mt-6 flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        enregistrer();
      }}
    >
      <p className="text-sm">
        Type : <span className="font-semibold">{TYPE_CLIENT_LABELS[v.type]}</span>
      </p>

      {v.type === "particulier" ? (
        <>
          <Champ id="f-prenom" label="Prénom" facultatif>
            {inp("prenom", { autoComplete: "off" })}
          </Champ>
          <Champ id="f-nom" label="Nom" erreur={erreurs.nom}>
            {inp("nom", { autoComplete: "off" })}
          </Champ>
        </>
      ) : (
        <>
          <Champ id="f-raisonSociale" label="Raison sociale" erreur={erreurs.raisonSociale}>
            {inp("raisonSociale")}
          </Champ>
          <Champ id="f-nom" label="Nom du contact" facultatif>
            {inp("nom")}
          </Champ>
        </>
      )}
      <Champ id="f-telephone" label="Téléphone" facultatif>
        {inp("telephone", { type: "tel", inputMode: "tel" })}
      </Champ>
      <Champ id="f-email" label="E-mail" facultatif erreur={erreurs.email}>
        {inp("email", { type: "email", inputMode: "email" })}
      </Champ>
      {v.type === "entreprise" && (
        <>
          <Champ
            id="f-siret"
            label="SIRET"
            facultatif
            erreur={erreurs.siret}
            aide="Seul le format (14 chiffres) est contrôlé, pas l'existence de l'entreprise."
          >
            {inp("siret", { inputMode: "numeric" })}
          </Champ>
          <Champ id="f-tva" label="Numéro de TVA intracommunautaire" facultatif>
            {inp("tva")}
          </Champ>
        </>
      )}
      <Champ id="f-adresse" label="Adresse" facultatif>
        {inp("adresse")}
      </Champ>
      <Champ id="f-complement" label="Complément d'adresse" facultatif>
        {inp("complement")}
      </Champ>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ id="f-codePostal" label="Code postal" facultatif>
          {inp("codePostal", { inputMode: "numeric" })}
        </Champ>
        <Champ id="f-ville" label="Ville" facultatif>
          {inp("ville")}
        </Champ>
      </div>
      <Champ id="f-pays" label="Pays" facultatif>
        {inp("pays")}
      </Champ>
      <Champ
        id="f-notes"
        label="Notes internes"
        facultatif
        aide="Ces notes ne sont pas destinées aux documents clients."
      >
        <Textarea id="f-notes" value={v.notes} onChange={maj("notes")} rows={3} />
      </Champ>

      {homonyme && (
        <div
          role="alert"
          className="rounded-xl border border-warning bg-warning/10 p-3 text-sm text-foreground"
        >
          <p className="flex gap-2 font-medium">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Un client portant ce nom existe déjà. Vérifiez qu'il ne s'agit pas de la même
            personne ou entreprise.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" size="sm" onClick={() => onVoirExistant(homonyme)}>
              Voir la fiche existante
            </Button>
            <Button type="button" size="sm" onClick={() => enregistrer(true)}>
              Enregistrer quand même
            </Button>
          </div>
        </div>
      )}

      {Object.values(erreurs).some(Boolean) && (
        <p className="text-sm font-medium text-destructive">
          Certains champs sont à corriger avant d'enregistrer.
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" variant="action">
          Enregistrer le client
        </Button>
      </div>
    </form>
  );
}
