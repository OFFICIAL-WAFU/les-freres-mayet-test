import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { AuthCadre, EcranChargement } from "@/components/AuthCadre";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { effacerDonneesSession } from "@/lib/session";

export const Route = createFileRoute("/reinitialiser-mot-de-passe")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Les Frères Mayet" },
      { name: "description", content: "Choisir un nouveau mot de passe." },
      { property: "og:title", content: "Nouveau mot de passe — Les Frères Mayet" },
      { property: "og:description", content: "Choisir un nouveau mot de passe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Reinitialiser,
});

type Etat = "verification" | "invalide" | "formulaire" | "termine";

function Reinitialiser() {
  const [etat, setEtat] = useState<Etat>("verification");
  const [mdp, setMdp] = useState("");
  const [confirm, setConfirm] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    // Retire immédiatement les jetons de l'adresse (ni historique ni journal).
    const lienErrone = hash.has("error") || query.has("error") || hash.has("error_code");
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (lienErrone) return setEtat("invalide");
    let fini = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (fini) return;
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        fini = true;
        setEtat("formulaire");
      }
    });
    const code = query.get("code");
    (async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && !fini) { fini = true; setEtat("invalide"); }
      }
    })();
    const t = setTimeout(async () => {
      if (fini) return;
      const { data } = await supabase.auth.getSession();
      fini = true;
      setEtat(data.session && (hash.get("type") === "recovery" || code) ? "formulaire" : "invalide");
    }, 2500);
    return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enCours) return;
    if (!mdp) return setErreur("Indiquez un nouveau mot de passe.");
    if (mdp !== confirm) return setErreur("Les deux mots de passe ne correspondent pas.");
    setErreur("");
    setEnCours(true);
    const { error } = await supabase.auth.updateUser({ password: mdp });
    setEnCours(false);
    if (error) {
      const code = (error as { code?: string }).code ?? "";
      setErreur(
        code === "weak_password"
          ? "Ce mot de passe est trop faible ou déjà apparu dans des fuites de données. Choisissez-en un plus long et unique."
          : code === "same_password"
            ? "Choisissez un mot de passe différent de l'ancien."
            : code === "session_expired" || code === "session_not_found" || error.status === 401
              ? "Le lien a expiré. Demandez un nouveau lien de réinitialisation."
              : "Le mot de passe n'a pas pu être modifié. Réessayez.",
      );
      return;
    }
    effacerDonneesSession();
    await supabase.auth.signOut();
    setEtat("termine");
  };

  if (etat === "verification") return <EcranChargement />;

  return (
    <AuthCadre titre={etat === "termine" ? "Mot de passe modifié" : "Nouveau mot de passe"}>
      {etat === "invalide" && (
        <div className="flex flex-col gap-4">
          <p role="alert" className="text-sm text-foreground">
            Ce lien de réinitialisation est invalide ou a expiré.
          </p>
          <Button asChild variant="action"><Link to="/mot-de-passe-oublie">Demander un nouveau lien</Link></Button>
        </div>
      )}
      {etat === "termine" && (
        <div className="flex flex-col gap-4">
          <p role="status" className="text-sm text-foreground">
            Votre mot de passe a été modifié. Connectez-vous avec ce nouveau mot de passe.
          </p>
          <Button asChild variant="action"><Link to="/connexion">Se connecter</Link></Button>
        </div>
      )}
      {etat === "formulaire" && (
        <form onSubmit={soumettre} noValidate className="flex flex-col gap-4">
          {erreur && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{erreur}</p>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r-mdp">Nouveau mot de passe</Label>
            <div className="relative">
              <Input id="r-mdp" type={voir ? "text" : "password"} autoComplete="new-password" value={mdp}
                onChange={(e) => setMdp(e.target.value)} className="pr-11" aria-describedby="r-aide" />
              <button type="button" onClick={() => setVoir((v) => !v)} aria-pressed={voir}
                aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground">
                {voir ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p id="r-aide" className="text-xs text-muted-foreground">
              Au moins 6 caractères. Les mots de passe connus pour avoir fuité sont refusés.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r-confirm">Confirmer le mot de passe</Label>
            <Input id="r-confirm" type={voir ? "text" : "password"} autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" variant="action" disabled={enCours} className="w-full">
            {enCours && <Loader2 className="animate-spin" />}
            Enregistrer le mot de passe
          </Button>
        </form>
      )}
    </AuthCadre>
  );
}
