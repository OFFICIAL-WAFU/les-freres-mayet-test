import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { chargerDocuments, useEtatDocuments } from "@/data/documents";
import { formaterCentimes } from "@/data/devis";
import { analyserMontant, suivre } from "@/data/reglements";
import { lireTresorerie, modifierTresorerie } from "@/data/tresorerie";
import { dateParis } from "@/lib/echeances";
import { libelleMois, preparerPrevision, validerCharge, type BibliothequeTresorerie, type Entree, type Repetition } from "@/lib/tresorerie";

export const Route = createFileRoute("/_authenticated/tresorerie")({
  head: () => ({ meta: [{ title: "Trésorerie — Les Frères Mayet" }, { name: "description", content: "Prévision de trésorerie indicative." }] }),
  component: Page,
});

const VIDE: BibliothequeTresorerie = { version: 0, charges: [] };

/** « 12,34 » ou « -12,34 » → centimes entiers (nombre) ; null si invalide. Zéro autorisé pour un solde. */
function centimes(saisie: string, autoriserNegatif: boolean): number | null {
  const s = saisie.trim().replace(/\s/g, "");
  const negatif = s.startsWith("-");
  if (negatif && !autoriserNegatif) return null;
  const texte = negatif ? s.slice(1) : s;
  if (/^0+([.,]0{1,2})?$/.test(texte)) return 0;
  const v = analyserMontant(texte);
  if (v === null || v > 1_000_000_000_000n) return null;
  return negatif ? -Number(v) : Number(v);
}

function Page() {
  const etat = useEtatDocuments();
  const [bib, setBib] = useState<BibliothequeTresorerie>(VIDE);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const aujourdHui = dateParis();
  const [soldeSaisie, setSoldeSaisie] = useState("");
  const [libelle, setLibelle] = useState("");
  const [dateCharge, setDateCharge] = useState(aujourdHui);
  const [montantCharge, setMontantCharge] = useState("");
  const [repetition, setRepetition] = useState<Repetition>("aucune");

  const recharger = useCallback(() => {
    lireTresorerie().then(b => { setBib(b); setErreur(""); }).catch(e => setErreur(e instanceof Error ? e.message : "Trésorerie indisponible."));
  }, []);
  useEffect(() => { recharger(); void chargerDocuments(); }, [recharger]);

  const entrees: Entree[] = useMemo(() => etat.liste
    .filter(d => !d.fictif && (d.type === "facture" || d.type === "acompte") && d.statut === "Finalisé" && d.aRegler !== undefined)
    .map(d => ({ date: d.devis?.validite || undefined, montant: suivre(d.aRegler!, d.reglements ?? [], d.credite ?? 0n).reste }))
    .filter(e => e.montant > 0n), [etat.liste]);
  const prevision = useMemo(() => preparerPrevision({ entrees, charges: bib.charges, solde: bib.solde, aujourdHui }), [entrees, bib, aujourdHui]);

  const agir = async (appliquer: (b: BibliothequeTresorerie) => BibliothequeTresorerie, message: string): Promise<boolean> => {
    setOccupe(true);
    try { setBib(await modifierTresorerie(bib.version, appliquer)); toast.success(message); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible."); recharger(); return false; }
    finally { setOccupe(false); }
  };

  const enregistrerSolde = async () => {
    const m = centimes(soldeSaisie, true);
    if (m === null) { toast.error("Montant invalide. Exemple : 2500,00 ou -300,00"); return; }
    if (await agir(b => ({ ...b, solde: { date: aujourdHui, montant: m } }), "Solde de départ enregistré")) setSoldeSaisie("");
  };
  const ajouterCharge = async () => {
    const m = centimes(montantCharge, false);
    if (m === null || m === 0) { toast.error("Montant invalide. Exemple : 450,00"); return; }
    try {
      const charge = validerCharge({ id: crypto.randomUUID(), libelle, date: dateCharge, montant: m, repetition });
      if (await agir(b => ({ ...b, charges: [...b.charges, charge] }), "Charge ajoutée")) { setLibelle(""); setMontantCharge(""); setRepetition("aucune"); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Charge invalide."); }
  };

  const chargesTriees = [...bib.charges].sort((a, b) => a.date.localeCompare(b.date));
  return <AppLayout titre="Trésorerie">
    <h1 className="text-2xl font-semibold lg:text-3xl">Trésorerie</h1>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Une prévision indicative des six prochains mois : vos factures à encaisser (selon leur échéance) moins les charges que vous saisissez ici. Ce n’est pas votre solde bancaire et aucun rapprochement bancaire n’est fait. Les charges et le solde sont conservés sur cet appareil.</p>
    {erreur && <p role="alert" className="mt-3 text-sm text-destructive">{erreur}</p>}
    {etat.statut === "erreur" && <p role="alert" className="mt-3 text-sm text-destructive">Impossible de charger les factures : la prévision est incomplète.</p>}

    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border bg-card p-5"><h2 className="text-sm text-muted-foreground">Échu, à encaisser dès que possible</h2><p className="mt-2 text-2xl font-semibold">{formaterCentimes(prevision.retard)}</p><p className="mt-2 text-xs text-muted-foreground">Factures dont l’échéance est dépassée. Non compté dans le tableau ci-dessous.</p></section>
      <section className="rounded-2xl border bg-card p-5"><h2 className="text-sm text-muted-foreground">Sans échéance renseignée</h2><p className="mt-2 text-2xl font-semibold">{formaterCentimes(prevision.sansDate)}</p><p className="mt-2 text-xs text-muted-foreground">Renseignez l’échéance des factures pour les voir dans la prévision.</p></section>
    </div>

    <section className="mt-6 rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Solde de départ</h2>
      <p className="mt-2 text-sm text-muted-foreground">{bib.solde ? `Solde noté le ${bib.solde.date.split("-").reverse().join("/")} : ${formaterCentimes(BigInt(bib.solde.montant))}. Les charges antérieures à cette date sont ignorées.` : "Facultatif. Sans solde de départ, le tableau affiche seulement le net de chaque mois."}</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">Solde du compte aujourd’hui (€)<input className="rounded-md border bg-background p-2" inputMode="decimal" placeholder="2500,00" value={soldeSaisie} onChange={e => setSoldeSaisie(e.target.value)} /></label>
        <Button variant="outline" disabled={occupe || !soldeSaisie.trim()} onClick={() => void enregistrerSolde()}>Enregistrer le solde</Button>
        {bib.solde && <Button variant="ghost" disabled={occupe} onClick={() => void agir(({ solde: _s, ...reste }) => reste, "Solde de départ retiré")}>Retirer le solde</Button>}
      </div>
    </section>

    <section className="mt-6 rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Prévision sur six mois</h2>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[32rem] text-sm">
        <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3 font-medium">Mois</th><th className="py-2 pr-3 text-right font-medium">Entrées prévues</th><th className="py-2 pr-3 text-right font-medium">Charges</th><th className="py-2 pr-3 text-right font-medium">Net</th>{bib.solde && <th className="py-2 text-right font-medium">Solde estimé</th>}</tr></thead>
        <tbody>{prevision.mois.map(l => <tr key={l.mois} className="border-b last:border-0"><td className="py-2 pr-3 capitalize">{libelleMois(l.mois)}</td><td className="py-2 pr-3 text-right">{formaterCentimes(l.entrees)}</td><td className="py-2 pr-3 text-right">{formaterCentimes(l.sorties)}</td><td className={`py-2 pr-3 text-right font-medium ${l.net < 0n ? "text-destructive" : ""}`}>{formaterCentimes(l.net)}</td>{bib.solde && <td className={`py-2 text-right font-semibold ${l.cumul !== null && l.cumul < 0n ? "text-destructive" : ""}`}>{l.cumul === null ? "" : formaterCentimes(l.cumul)}</td>}</tr>)}</tbody>
      </table></div>
      <p className="mt-3 text-xs text-muted-foreground">Les entrées supposent que chaque client paie à l’échéance indiquée. Les retards et les factures sans échéance ne sont pas comptés.</p>
    </section>

    <section className="mt-6 rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Charges et dépenses prévues</h2>
      <p className="mt-2 text-sm text-muted-foreground">Loyer, assurance, véhicule, fournisseurs à payer… Une charge mensuelle revient chaque mois au même jour (fin de mois si le jour n’existe pas).</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="grid min-w-0 basis-full gap-1 text-sm sm:flex-1 sm:basis-0">Libellé<input className="w-full rounded-md border bg-background p-2" maxLength={120} placeholder="Assurance décennale" value={libelle} onChange={e => setLibelle(e.target.value)} /></label>
        <label className="grid gap-1 text-sm">Date<input type="date" className="rounded-md border bg-background p-2" value={dateCharge} onChange={e => setDateCharge(e.target.value)} /></label>
        <label className="grid gap-1 text-sm">Montant (€)<input className="w-32 rounded-md border bg-background p-2" inputMode="decimal" placeholder="450,00" value={montantCharge} onChange={e => setMontantCharge(e.target.value)} /></label>
        <label className="grid gap-1 text-sm">Répétition<select className="rounded-md border bg-background p-2" value={repetition} onChange={e => setRepetition(e.target.value as Repetition)}><option value="aucune">Une seule fois</option><option value="mensuelle">Chaque mois</option></select></label>
        <Button disabled={occupe || !libelle.trim() || !montantCharge.trim()} onClick={() => void ajouterCharge()}>Ajouter la charge</Button>
      </div>
      {!chargesTriees.length ? <p className="mt-4 text-sm text-muted-foreground">Aucune charge saisie.</p> : <div className="mt-4 divide-y">{chargesTriees.map(c => <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words font-medium">{c.libelle}</p><p className="text-sm text-muted-foreground">{c.repetition === "mensuelle" ? `Chaque mois, à partir du ${c.date.split("-").reverse().join("/")}` : `Le ${c.date.split("-").reverse().join("/")}`}</p></div><div className="flex items-center gap-3"><span className="font-semibold">{formaterCentimes(BigInt(c.montant))}</span><Button size="sm" variant="outline" disabled={occupe} aria-label={`Supprimer la charge ${c.libelle}`} onClick={() => void agir(b => ({ ...b, charges: b.charges.filter(x => x.id !== c.id) }), "Charge supprimée")}>Supprimer</Button></div></div>)}</div>}
    </section>
  </AppLayout>;
}
