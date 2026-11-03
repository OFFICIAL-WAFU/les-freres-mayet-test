import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { nomClient, useClients } from "@/data/clients";
import { lirePlanning, modifierPlanning, PLANNING_VIDE } from "@/data/planning";
import { dateParis } from "@/lib/echeances";
import { changerStatut, creerIntervention, finIntervention, modifierIntervention, preparerPlanning, supprimerIntervention, trier, versIcs, type BibliothequePlanning, type Intervention, type StatutIntervention } from "@/lib/planning";

export const Route = createFileRoute("/_authenticated/planning")({
  head: () => ({ meta: [{ title: "Planning — Les Frères Mayet" }, { name: "description", content: "Planning des interventions chez les clients." }] }),
  component: Page,
});

type Form = { date: string; debut: string; heures: string; titre: string; client: string; adresse: string; notes: string };
const fr = (iso: string) => iso.split("-").reverse().join("/");
const jourLong = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const vide = (date: string): Form => ({ date, debut: "", heures: "", titre: "", client: "", adresse: "", notes: "" });
const depuis = (i: Intervention): Form => ({ date: i.date, debut: i.debut, heures: i.minutes ? String(i.minutes / 60).replace(".", ",") : "", titre: i.titre, client: i.client, adresse: i.adresse, notes: i.notes });
function minutes(h: string): number {
  const t = h.trim().replace(",", ".");
  if (!t) return 0;
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) throw new Error("Durée invalide. Exemple : 1,5 pour une heure et demie.");
  const m = Math.round(Number(t) * 60); if (m > 1440) throw new Error("Durée invalide (24 h au plus)."); return m;
}
const ETIQUETTE: Record<StatutIntervention, string> = { prevu: "Prévu", fait: "Fait", annule: "Annulé" };

function Page() {
  const clients = useClients();
  const [bib, setBib] = useState<BibliothequePlanning>(PLANNING_VIDE);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const aujourdHui = dateParis();
  const [edition, setEdition] = useState<{ id: string | null; form: Form } | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [voirTout, setVoirTout] = useState(false);

  const recharger = useCallback(() => { lirePlanning().then(b => { setBib(b); setErreur(""); }).catch(e => setErreur(e instanceof Error ? e.message : "Planning indisponible.")); }, []);
  useEffect(() => { recharger(); }, [recharger]);

  const agir = async (appliquer: (b: BibliothequePlanning) => BibliothequePlanning, message: string): Promise<boolean> => {
    setOccupe(true);
    try { setBib(await modifierPlanning(bib.version, appliquer)); toast.success(message); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible."); recharger(); return false; }
    finally { setOccupe(false); }
  };
  const champ = (k: keyof Form) => (e: { target: { value: string } }) => setEdition(ed => ed && { ...ed, form: { ...ed.form, [k]: e.target.value } });
  const choisirClient = (id: string) => {
    const c = clients.find(x => x.id === id); if (!c) return;
    const adresse = [c.adresse, [c.codePostal, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    setEdition(ed => ed && { ...ed, form: { ...ed.form, client: nomClient(c), adresse: ed.form.adresse || adresse } });
  };
  const enregistrer = async () => {
    if (!edition) return;
    const f = edition.form; let saisie;
    try { saisie = { date: f.date, debut: f.debut, minutes: minutes(f.heures), titre: f.titre, client: f.client, adresse: f.adresse, notes: f.notes }; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Saisie invalide."); return; }
    const id = edition.id ?? crypto.randomUUID();
    if (await agir(b => edition.id ? modifierIntervention(b, id, saisie) : creerIntervention(b, saisie, id), edition.id ? "Intervention modifiée" : "Intervention ajoutée")) setEdition(null);
  };
  const exporter = () => {
    const url = URL.createObjectURL(new Blob([versIcs(bib.interventions, new Date().toISOString())], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "Planning_Les_Freres_Mayet.ics"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const p = preparerPlanning(bib.interventions, aujourdHui);
  const passees = trier(bib.interventions.filter(i => i.date < aujourdHui && i.statut !== "prevu")).reverse();
  const f = edition?.form;
  const carte = (i: Intervention) => <div key={i.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
    <div className="min-w-0">
      <p className={`break-words font-medium ${i.statut === "annule" ? "line-through" : ""}`}>{i.debut ? `${i.debut}${finIntervention(i) ? `–${finIntervention(i)}` : ""} · ` : ""}{i.titre}</p>
      {(i.client || i.adresse) && <p className="break-words text-sm text-muted-foreground">{[i.client, i.adresse].filter(Boolean).join(" · ")}</p>}
      {i.notes && <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{i.notes}</p>}
      <p className="text-sm font-medium">{ETIQUETTE[i.statut]}{i.date < aujourdHui ? ` · le ${fr(i.date)}` : ""}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {i.statut === "prevu" && <Button size="sm" variant="outline" disabled={occupe} onClick={() => void agir(b => changerStatut(b, i.id, "fait"), "Marqué comme fait")}>Fait</Button>}
      {i.statut !== "prevu" && <Button size="sm" variant="outline" disabled={occupe} onClick={() => void agir(b => changerStatut(b, i.id, "prevu"), "Remis au planning")}>Remettre au planning</Button>}
      {i.statut === "prevu" && <Button size="sm" variant="ghost" disabled={occupe} onClick={() => void agir(b => changerStatut(b, i.id, "annule"), "Intervention annulée")}>Annuler</Button>}
      <Button size="sm" variant="outline" disabled={!!edition} onClick={() => { setEdition({ id: i.id, form: depuis(i) }); setASupprimer(null); }}>Modifier</Button>
      {aSupprimer === i.id ? <><Button size="sm" variant="destructive" disabled={occupe} onClick={() => void agir(b => supprimerIntervention(b, i.id), "Intervention supprimée").then(() => setASupprimer(null))}>Confirmer</Button><Button size="sm" variant="ghost" onClick={() => setASupprimer(null)}>Non</Button></> : <Button size="sm" variant="ghost" disabled={!!edition} onClick={() => setASupprimer(i.id)}>Supprimer</Button>}
    </div>
  </div>;

  return <AppLayout titre="Planning">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-semibold lg:text-3xl">Planning des interventions</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Vos passages prévus chez les clients, sur les 14 prochains jours. Les données sont conservées sur cet appareil. Le bouton d’export crée un fichier à importer dans Google Agenda : il n’y a pas de synchronisation automatique.</p></div>
      <div className="flex flex-wrap gap-2">{!edition && <Button variant="action" onClick={() => setEdition({ id: null, form: vide(aujourdHui) })}>Nouvelle intervention</Button>}<Button variant="outline" disabled={!bib.interventions.some(i => i.statut !== "annule")} onClick={exporter}>Exporter (.ics)</Button></div>
    </div>
    {erreur && <p role="alert" className="mt-3 text-sm text-destructive">{erreur}</p>}

    {edition && f && <section className="mt-6 rounded-2xl border bg-card p-5" aria-label="Édition de l’intervention">
      <h2 className="text-lg font-semibold">{edition.id ? "Modifier l’intervention" : "Nouvelle intervention"}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm sm:col-span-2">Titre *<input className="rounded-md border bg-background p-2" maxLength={150} placeholder="Pose du tableau électrique" value={f.titre} onChange={champ("titre")} /></label>
        <label className="grid gap-1 text-sm">Date *<input type="date" className="rounded-md border bg-background p-2" value={f.date} onChange={champ("date")} /></label>
        <label className="grid gap-1 text-sm">Heure de début<input type="time" className="rounded-md border bg-background p-2" value={f.debut} onChange={champ("debut")} /></label>
        <label className="grid gap-1 text-sm">Durée (heures)<input className="rounded-md border bg-background p-2" inputMode="decimal" placeholder="2,5" value={f.heures} onChange={champ("heures")} /></label>
        <label className="grid gap-1 text-sm">Client enregistré <select className="rounded-md border bg-background p-2" defaultValue="" onChange={e => choisirClient(e.target.value)}><option value="">— Préremplir —</option>{clients.map(c => <option key={c.id} value={c.id}>{nomClient(c)}</option>)}</select></label>
        <label className="grid gap-1 text-sm">Client<input className="rounded-md border bg-background p-2" maxLength={120} value={f.client} onChange={champ("client")} /></label>
        <label className="grid gap-1 text-sm">Adresse<input className="rounded-md border bg-background p-2" maxLength={200} value={f.adresse} onChange={champ("adresse")} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Notes<textarea rows={3} className="min-w-0 rounded-md border bg-background p-2" maxLength={2000} value={f.notes} onChange={champ("notes")} /></label>
      </div>
      <div className="mt-5 flex flex-wrap gap-3"><Button variant="action" disabled={occupe} onClick={() => void enregistrer()}>Enregistrer</Button><Button variant="ghost" disabled={occupe} onClick={() => setEdition(null)}>Annuler</Button></div>
    </section>}

    {p.retard.length > 0 && <section className="mt-6 rounded-2xl border border-destructive/50 bg-card p-5"><h2 className="text-lg font-semibold text-destructive">À clôturer ({p.retard.length})</h2><p className="mt-1 text-sm text-muted-foreground">Prévues avant aujourd’hui et jamais marquées comme faites ou annulées.</p><div className="mt-2 divide-y">{p.retard.map(carte)}</div></section>}

    <section className="mt-6 rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold">14 prochains jours</h2>
      {!p.jours.length ? <p className="mt-3 text-sm text-muted-foreground">Rien de prévu sur cette période.</p> : p.jours.map(j => <div key={j.date} className="mt-4"><h3 className="text-sm font-semibold capitalize">{j.date === aujourdHui ? "Aujourd’hui · " : ""}{jourLong(j.date)}</h3><div className="divide-y">{j.interventions.map(carte)}</div></div>)}
    </section>

    {p.plusTard.length > 0 && <section className="mt-6 rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">Plus tard ({p.plusTard.length})</h2><div className="mt-2 divide-y">{p.plusTard.map(i => <div key={i.id}>{carte(i)}<p className="-mt-2 mb-2 text-sm text-muted-foreground">Le {fr(i.date)}</p></div>)}</div></section>}

    {passees.length > 0 && <section className="mt-6 rounded-2xl border bg-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Passées ({passees.length})</h2><Button size="sm" variant="ghost" onClick={() => setVoirTout(v => !v)}>{voirTout ? "Masquer" : "Afficher"}</Button></div>{voirTout && <div className="mt-2 divide-y">{passees.map(carte)}</div>}</section>}
  </AppLayout>;
}
