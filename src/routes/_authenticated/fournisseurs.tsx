import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { statutCleRexel } from "@/lib/rexel";

export const Route = createFileRoute("/_authenticated/fournisseurs")({
  head: () => ({ meta: [{ title: "Catalogue REXEL — Les Frères Mayet" }, { name: "description", content: "Connexion au catalogue fournisseur REXEL." }] }),
  component: Page,
});

type Etat = "chargement" | "absente" | "detectee" | "erreur";

const A_VENIR = [
  "Rechercher un produit REXEL par référence ou par nom",
  "Ajouter un produit REXEL directement dans un devis",
  "Voir votre prix d’achat négocié et la disponibilité",
  "Reporter le prix d’achat dans le calcul de marge",
];

function Page() {
  const [etat, setEtat] = useState<Etat>("chargement");
  useEffect(() => {
    let actif = true;
    statutCleRexel()
      .then((r) => { if (actif) setEtat(r.cleDetectee ? "detectee" : "absente"); })
      .catch(() => { if (actif) setEtat("erreur"); });
    return () => { actif = false; };
  }, []);

  return (
    <AppLayout titre="Catalogue REXEL">
      <h1 className="text-2xl font-semibold lg:text-3xl">Catalogue REXEL</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Retrouvez les produits REXEL et vos prix d’achat dans vos devis, sans ressaisie.</p>

      <section className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-5" aria-live="polite">
        <div className="flex items-center gap-3">
          <KeyRound aria-hidden="true" className="size-6 text-muted-foreground" />
          <h2 className="font-semibold">Clé d’accès REXEL</h2>
        </div>
        <p className="mt-3 text-sm">
          {etat === "chargement" && "Vérification en cours…"}
          {etat === "absente" && "Aucune clé enregistrée. La connexion n’est pas active."}
          {etat === "detectee" && "Une clé est enregistrée sur le serveur. La connexion n’a pas encore été testée : cette fonction est en développement."}
          {etat === "erreur" && "Impossible de vérifier l’état de la clé pour le moment. Rechargez la page."}
        </p>
        <span className="mt-3 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">En développement</span>
      </section>

      <section className="mt-4 max-w-2xl rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck aria-hidden="true" className="size-6 text-muted-foreground" />
          <h2 className="font-semibold">Pour la renseigner, en toute sécurité</h2>
        </div>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          <li>Demandez à REXEL votre accès API et notez la clé qui vous est remise.</li>
          <li>Ajoutez-la comme secret nommé <code className="rounded bg-secondary px-1.5 py-0.5">REXEL_API_KEY</code> dans l’espace de configuration sécurisé de Lovable Cloud, pas dans cette page ni dans une conversation.</li>
          <li>Revenez ici : la page indiquera qu’une clé est enregistrée.</li>
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">La clé reste sur le serveur : elle n’est jamais affichée ni envoyée dans votre navigateur.</p>
      </section>

      <section className="mt-4 max-w-2xl rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Ce que vous pourrez faire ensuite</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {A_VENIR.map((t) => <li key={t} className="flex items-start justify-between gap-3"><span>{t}</span><span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">En développement</span></li>)}
        </ul>
      </section>
    </AppLayout>
  );
}
