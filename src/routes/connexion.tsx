import { useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";

import { AuthCadre } from "@/components/AuthCadre";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { destinationSure } from "@/lib/session";

export const Route = createFileRoute("/connexion")({
  ssr: false,
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: destinationSure(search.redirect), replace: true });
  },
  head: () => ({
    meta: [
      { title: "Connexion — Les Frères Mayet" },
      { name: "description", content: "Connexion à l'espace de gestion privé des Frères Mayet." },
      { property: "og:title", content: "Connexion — Les Frères Mayet" },
      { property: "og:description", content: "Connexion à l'espace de gestion privé des Frères Mayet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Connexion,
});

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Connexion() {
  const { redirect: retour } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [voir, setVoir] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurs, setErreurs] = useState<{ email?: string; mdp?: string }>({});
  const [echec, setEchec] = useState("");

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enCours) return;
    const er: typeof erreurs = {};
    if (!email.trim()) er.email = "Indiquez votre adresse e-mail.";
    else if (!EMAIL_RE.test(email.trim())) er.email = "Cette adresse e-mail n'est pas valide.";
    if (!mdp) er.mdp = "Indiquez votre mot de passe.";
    setErreurs(er);
    setEchec("");
    if (er.email || er.mdp) {
      document.getElementById(er.email ? "c-email" : "c-mdp")?.focus();
      return;
    }
    setEnCours(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: mdp });
    setEnCours(false);
    if (error) {
      const code = (error as { code?: string }).code ?? "";
      setEchec(
        code === "over_request_rate_limit" || error.status === 429
          ? "Trop de tentatives. Patientez quelques minutes avant de réessayer."
          : code === "email_not_confirmed"
            ? "Ce compte n'est pas encore activé. Utilisez le lien reçu par e-mail."
            : error.status && error.status >= 500
              ? "Le service de connexion est momentanément indisponible. Réessayez plus tard."
              : "E-mail ou mot de passe incorrect.",
      );
      return;
    }
    navigate({ to: destinationSure(retour), replace: true });
  };

  return (
    <AuthCadre titre="Connexion à votre espace">
      <form onSubmit={soumettre} noValidate className="flex flex-col gap-4">
        {echec && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {echec}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-email">E-mail</Label>
          <Input id="c-email" type="email" autoComplete="email" inputMode="email" value={email}
            onChange={(e) => setEmail(e.target.value)} aria-invalid={!!erreurs.email}
            aria-describedby={erreurs.email ? "c-email-err" : undefined} />
          {erreurs.email && <p id="c-email-err" className="text-sm font-medium text-destructive">{erreurs.email}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-mdp">Mot de passe</Label>
          <div className="relative">
            <Input id="c-mdp" type={voir ? "text" : "password"} autoComplete="current-password" value={mdp}
              onChange={(e) => setMdp(e.target.value)} className="pr-11" aria-invalid={!!erreurs.mdp}
              aria-describedby={erreurs.mdp ? "c-mdp-err" : undefined} />
            <button type="button" onClick={() => setVoir((v) => !v)}
              aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={voir}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
              {voir ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {erreurs.mdp && <p id="c-mdp-err" className="text-sm font-medium text-destructive">{erreurs.mdp}</p>}
        </div>
        <Button type="submit" variant="action" disabled={enCours} aria-busy={enCours} className="mt-1 w-full">
          {enCours && <Loader2 className="animate-spin" />}
          {enCours ? "Connexion…" : "Se connecter"}
        </Button>
        <Link to="/mot-de-passe-oublie" className="self-center text-sm font-medium text-primary underline-offset-4 hover:underline">
          Mot de passe oublié ?
        </Link>
      </form>
    </AuthCadre>
  );
}
