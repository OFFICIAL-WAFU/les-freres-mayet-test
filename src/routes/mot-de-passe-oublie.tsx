import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { AuthCadre } from "@/components/AuthCadre";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { EMAIL_RE } from "@/routes/connexion";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — Les Frères Mayet" },
      { name: "description", content: "Recevoir un lien de réinitialisation du mot de passe." },
      { property: "og:title", content: "Mot de passe oublié — Les Frères Mayet" },
      { property: "og:description", content: "Recevoir un lien de réinitialisation du mot de passe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MotDePasseOublie,
});

function MotDePasseOublie() {
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enCours) return;
    if (!email.trim()) return setErreur("Indiquez votre adresse e-mail.");
    if (!EMAIL_RE.test(email.trim())) return setErreur("Cette adresse e-mail n'est pas valide.");
    setErreur("");
    setEnCours(true);
    // Réponse neutre quel que soit le résultat : on ne révèle pas si le compte existe.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
    });
    setEnCours(false);
    setEnvoye(true);
  };

  return (
    <AuthCadre titre="Mot de passe oublié">
      {envoye ? (
        <p role="status" className="text-sm text-foreground">
          Si un compte correspond à cette adresse, vous recevrez un lien de réinitialisation.
        </p>
      ) : (
        <form onSubmit={soumettre} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="o-email">E-mail</Label>
            <Input id="o-email" type="email" autoComplete="email" inputMode="email" value={email}
              onChange={(e) => setEmail(e.target.value)} aria-invalid={!!erreur}
              aria-describedby={erreur ? "o-email-err" : undefined} />
            {erreur && <p id="o-email-err" className="text-sm font-medium text-destructive">{erreur}</p>}
          </div>
          <Button type="submit" variant="action" disabled={enCours} className="w-full">
            {enCours && <Loader2 className="animate-spin" />}
            Recevoir un lien de réinitialisation
          </Button>
        </form>
      )}
      <Link to="/connexion" className="mt-5 block text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
        Retour à la connexion
      </Link>
    </AuthCadre>
  );
}
