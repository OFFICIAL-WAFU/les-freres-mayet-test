import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculerMarge, eurosMarge, type SaisieMarge } from "@/lib/marges";
import { telechargerFichier } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/marges")({ component: Page, head: () => ({ meta: [{ title: "Calcul de marge — Les Frères Mayet" }] }) });
const VIDE: SaisieMarge = { achatMateriel: "0", venteMateriel: "0", heures: "0", coutHoraire: "0", venteHoraire: "0", autresCouts: "0" };
const CHAMPS = [
  ["achatMateriel", "Coût d’achat du matériel HT (€)", "Vos prix d’achat réels, transport compris si nécessaire."],
  ["venteMateriel", "Prix de vente du matériel HT (€)", "Le montant du matériel que vous facturez au client."],
  ["heures", "Temps de travail prévu (heures)", "Exemple : 2,50 pour deux heures et demie."],
  ["coutHoraire", "Coût de revient par heure (€)", "Votre coût complet : rémunération et charges à votre charge."],
  ["venteHoraire", "Tarif de vente par heure HT (€)", "Le tarif horaire facturé au client."],
  ["autresCouts", "Autres coûts du chantier HT (€)", "Déplacement, location, sous-traitance ou charges à répartir."],
] as const;
function Page() {
  const [v, setV] = useState<SaisieMarge>(VIDE);
  let resultat: ReturnType<typeof calculerMarge> | null = null; let erreur = "";
  try { resultat = calculerMarge(v); } catch(e) { erreur = e instanceof Error ? e.message : "Vérifiez les valeurs."; }
  return <AppLayout titre="Calcul de marge"><h1 className="text-2xl font-semibold">Calcul de marge d’un chantier</h1><p className="mt-2 text-muted-foreground">Matériel et main-d’œuvre, sans TVA. Les calculs restent séparés des documents facturés.</p>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Vos hypothèses</h2>{CHAMPS.map(([cle, titre, aide]) => <label key={cle} className="grid gap-1 text-sm" htmlFor={`m-${cle}`}><span className="font-medium">{titre}</span><Input id={`m-${cle}`} inputMode="decimal" value={v[cle]} onChange={e => setV(x => ({ ...x, [cle]: e.target.value }))} /><span className="text-xs text-muted-foreground">{aide}</span></label>)}<Button variant="outline" onClick={() => setV({ ...VIDE })}>Effacer les hypothèses</Button></section>
    <section className="rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Résultat estimé</h2>{erreur ? <p role="alert" className="mt-4 text-destructive">{erreur}</p> : resultat && <><dl className="mt-4 space-y-3">{[["Vente matériel", resultat.venteMateriel], ["Vente main-d’œuvre", resultat.venteMainOeuvre], ["Total vendu HT", resultat.vente], ["Coût matériel", resultat.achatMateriel], ["Coût main-d’œuvre", resultat.coutMainOeuvre], ["Autres coûts", resultat.autresCouts], ["Total des coûts", resultat.cout]].map(([label, montant]) => <div key={String(label)} className="flex justify-between gap-3"><dt>{String(label)}</dt><dd className="shrink-0 font-medium">{eurosMarge(montant as bigint)}</dd></div>)}</dl><div className={`mt-5 rounded-lg p-4 ${resultat.marge < 0n ? "bg-destructive/10 text-destructive" : "bg-secondary"}`}><p className="font-medium">Marge après les coûts saisis</p><p className="mt-1 text-3xl font-semibold" aria-live="polite">{eurosMarge(resultat.marge)}</p>{resultat.marge < 0n && <p className="mt-2 text-sm">Les coûts dépassent le prix de vente.</p>}</div><dl className="mt-4 space-y-2"><div><dt>Taux de marque — marge / vente HT</dt><dd className="font-semibold">{resultat.tauxMarque === null ? "Non calculable (vente nulle)" : `${resultat.tauxMarque.toLocaleString("fr-FR")} %`}</dd></div><div><dt>Taux de marge — marge / coût</dt><dd className="font-semibold">{resultat.tauxMarge === null ? "Non calculable (coût nul)" : `${resultat.tauxMarge.toLocaleString("fr-FR")} %`}</dd></div></dl><Button className="mt-5" variant="outline" onClick={() => { if (!resultat) return; telechargerFichier(["Estimation de marge Les Frères Mayet", ...CHAMPS.map(([cle,titre]) => `${titre} : ${v[cle]}`), `Total vendu HT : ${eurosMarge(resultat.vente)}`, `Total des coûts : ${eurosMarge(resultat.cout)}`, `Marge : ${eurosMarge(resultat.marge)}`, "Estimation selon les seuls coûts saisis, hors TVA. Aucun document ni écriture comptable créé."].join("\n"), "Estimation-marge-chantier.txt", "text/plain;charset=utf-8"); }}>Télécharger cette estimation</Button></>}<p className="mt-5 text-sm text-muted-foreground">Les hypothèses ne sont pas enregistrées : téléchargez l’estimation pour la conserver. Ce résultat dépend des coûts saisis ; ce n’est pas le bénéfice net de l’entreprise.</p></section></div>
  </AppLayout>;
}
