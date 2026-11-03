import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { SignatureCadre, type SignatureCadreRef } from "@/components/SignatureCadre";
import { Button } from "@/components/ui/button";
import { nomClient, useClients } from "@/data/clients";
import { useEtatEntreprise } from "@/data/entreprise";
import { lireRapports, modifierRapports, RAPPORTS_VIDES } from "@/data/rapports";
import { dateParis } from "@/lib/echeances";
import { compresserPhoto } from "@/lib/photo";
import { telechargerRapportPdf } from "@/lib/rapportPdf";
import { analyserHeures, analyserQuantite, creerRapport, formaterDuree, formaterQuantiteRapport, MAX_PHOTOS, modifierRapport, signerRapport, supprimerRapport, type BibliothequeRapports, type Photo, type Rapport } from "@/lib/rapports";

export const Route = createFileRoute("/_authenticated/rapports")({
  head: () => ({ meta: [{ title: "Rapports d’intervention — Les Frères Mayet" }, { name: "description", content: "Comptes rendus d’intervention sur chantier." }] }),
  component: Page,
});

type LigneForm = { designation: string; quantite: string; unite: string };
type Formulaire = { date: string; clientNom: string; clientTel: string; clientAdresse: string; chantier: string; objet: string; travaux: string; observations: string; heures: string; intervenant: string; materiel: LigneForm[]; photos: Photo[] };
const vide = (date: string): Formulaire => ({ date, clientNom: "", clientTel: "", clientAdresse: "", chantier: "", objet: "", travaux: "", observations: "", heures: "", intervenant: "", materiel: [], photos: [] });
const depuisRapport = (r: Rapport): Formulaire => ({ date: r.date, clientNom: r.client.nom, clientTel: r.client.telephone, clientAdresse: r.client.adresse, chantier: r.chantier, objet: r.objet, travaux: r.travaux, observations: r.observations, heures: r.minutes ? String(r.minutes / 60).replace(".", ",") : "", intervenant: r.intervenant, materiel: r.materiel.map(l => ({ designation: l.designation, quantite: formaterQuantiteRapport(l.quantite), unite: l.unite })), photos: r.photos });
const fr = (iso: string) => iso.split("-").reverse().join("/");

/** Convertit le formulaire en saisie ; lève une erreur lisible si une quantité ou une durée est invalide. */
function versSaisie(f: Formulaire) {
  const minutes = analyserHeures(f.heures);
  if (minutes === null) throw new Error("Durée invalide. Exemple : 1,5 pour une heure et demie.");
  return {
    date: f.date, client: { nom: f.clientNom, telephone: f.clientTel, adresse: f.clientAdresse }, chantier: f.chantier, objet: f.objet, travaux: f.travaux, observations: f.observations, intervenant: f.intervenant, minutes, photos: f.photos,
    materiel: f.materiel.map((l, i) => { const q = analyserQuantite(l.quantite); if (q === null) throw new Error(`Matériel, ligne ${i + 1} : quantité invalide (exemple : 2 ou 1,5).`); return { designation: l.designation, quantite: q, unite: l.unite }; }),
  };
}

function Page() {
  const clients = useClients();
  const entreprise = useEtatEntreprise();
  const [bib, setBib] = useState<BibliothequeRapports>(RAPPORTS_VIDES);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const aujourdHui = dateParis();
  const [edition, setEdition] = useState<{ id: string | null; form: Formulaire; signer: boolean } | null>(null);
  const [nomSignataire, setNomSignataire] = useState("");
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const signature = useRef<SignatureCadreRef>(null);

  const recharger = useCallback(() => { lireRapports().then(b => { setBib(b); setErreur(""); }).catch(e => setErreur(e instanceof Error ? e.message : "Rapports indisponibles.")); }, []);
  useEffect(() => { recharger(); }, [recharger]);

  const ouvrir = (id: string | null, signer = false) => {
    const r = id ? bib.rapports.find(x => x.id === id) : undefined;
    setEdition({ id, form: r ? depuisRapport(r) : vide(aujourdHui), signer }); setNomSignataire(r?.client.nom ?? ""); setASupprimer(null);
  };
  const champ = (k: keyof Formulaire) => (e: { target: { value: string } }) => setEdition(ed => ed && { ...ed, form: { ...ed.form, [k]: e.target.value } });
  const choisirClient = (id: string) => {
    const c = clients.find(x => x.id === id); if (!c) return;
    const adresse = [c.adresse, [c.codePostal, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    setEdition(ed => ed && { ...ed, form: { ...ed.form, clientNom: nomClient(c), clientTel: c.telephone, clientAdresse: adresse } }); setNomSignataire(nomClient(c));
  };
  const [traitement, setTraitement] = useState(false);
  const champPhotos = useRef<HTMLInputElement>(null);
  const ajouterPhotos = async (fichiers: FileList | null) => {
    if (!fichiers || !edition) return;
    setTraitement(true);
    try {
      const nouvelles: Photo[] = [];
      const place = MAX_PHOTOS - edition.form.photos.length;
      if (fichiers.length > place) toast.error(`${MAX_PHOTOS} photos au plus par rapport : seules les ${place} premières sont ajoutées.`);
      for (const fichier of Array.from(fichiers).slice(0, Math.max(place, 0))) nouvelles.push({ image: await compresserPhoto(fichier), legende: "" });
      setEdition(ed => ed && { ...ed, form: { ...ed.form, photos: [...ed.form.photos, ...nouvelles].slice(0, MAX_PHOTOS) } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Photo impossible à ajouter."); } finally { setTraitement(false); }
  };
  const majLigne = (i: number, k: keyof LigneForm, v: string) => setEdition(ed => ed && { ...ed, form: { ...ed.form, materiel: ed.form.materiel.map((l, j) => j === i ? { ...l, [k]: v } : l) } });

  const agir = async (appliquer: (b: BibliothequeRapports, j: string) => BibliothequeRapports, message: string): Promise<boolean> => {
    setOccupe(true);
    try { setBib(await modifierRapports(bib.version, appliquer)); toast.success(message); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible."); recharger(); return false; }
    finally { setOccupe(false); }
  };

  const enregistrer = async () => {
    if (!edition) return;
    let saisie; let image: string | null = null;
    try {
      saisie = versSaisie(edition.form);
      if (edition.signer) { image = signature.current?.exporter() ?? null; if (!image) throw new Error("Le client doit signer dans le cadre avant d’enregistrer la signature."); if (!nomSignataire.trim()) throw new Error("Indiquez le nom du signataire."); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Rapport invalide."); return; }
    const id = edition.id ?? crypto.randomUUID();
    const ok = await agir((b, j) => {
      const base = edition.id ? modifierRapport(b, id, saisie, j) : creerRapport(b, saisie, id, j).bibliotheque;
      return image ? signerRapport(base, id, { image, nom: nomSignataire, signeLe: j }, j) : base;
    }, image ? "Rapport enregistré et signé" : "Rapport enregistré");
    if (ok) setEdition(null);
  };

  const pdf = async (r: Rapport) => {
    if (entreprise.statut !== "pret") { toast.error("La fiche entreprise n’est pas disponible : renseignez-la dans Entreprise."); return; }
    try { await telechargerRapportPdf(r, entreprise.fiche); } catch { toast.error("Impossible de générer le PDF."); }
  };

  const liste = [...bib.rapports].sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero));
  const f = edition?.form;
  return <AppLayout titre="Rapports d’intervention">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-semibold lg:text-3xl">Rapports d’intervention</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Le compte rendu de votre passage chez le client : travaux, matériel posé, durée, signature sur place et PDF. Un rapport n’est ni un devis ni une facture. Les rapports sont conservés sur cet appareil.</p></div>
      {!edition && <Button variant="action" onClick={() => ouvrir(null)}>Nouveau rapport</Button>}
    </div>
    {erreur && <p role="alert" className="mt-3 text-sm text-destructive">{erreur}</p>}

    {edition && f && <section className="mt-6 rounded-2xl border bg-card p-5" aria-label="Édition du rapport">
      <h2 className="text-lg font-semibold">{edition.id ? "Modifier le rapport" : "Nouveau rapport"}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm sm:col-span-2">Client enregistré <select className="rounded-md border bg-background p-2" defaultValue="" onChange={e => choisirClient(e.target.value)}><option value="">— Choisir un client pour préremplir —</option>{clients.map(c => <option key={c.id} value={c.id}>{nomClient(c)}</option>)}</select></label>
        <label className="grid gap-1 text-sm">Nom du client *<input className="rounded-md border bg-background p-2" maxLength={120} value={f.clientNom} onChange={champ("clientNom")} /></label>
        <label className="grid gap-1 text-sm">Téléphone<input className="rounded-md border bg-background p-2" maxLength={30} value={f.clientTel} onChange={champ("clientTel")} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Adresse du client<input className="rounded-md border bg-background p-2" maxLength={200} value={f.clientAdresse} onChange={champ("clientAdresse")} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Adresse du chantier (si différente)<input className="rounded-md border bg-background p-2" maxLength={200} value={f.chantier} onChange={champ("chantier")} /></label>
        <label className="grid gap-1 text-sm">Date d’intervention *<input type="date" className="rounded-md border bg-background p-2" max={aujourdHui} value={f.date} onChange={champ("date")} /></label>
        <label className="grid gap-1 text-sm">Durée (heures)<input className="rounded-md border bg-background p-2" inputMode="decimal" placeholder="2,5" value={f.heures} onChange={champ("heures")} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Objet de l’intervention *<input className="rounded-md border bg-background p-2" maxLength={150} placeholder="Dépannage tableau électrique" value={f.objet} onChange={champ("objet")} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Travaux réalisés *<textarea rows={5} className="min-w-0 rounded-md border bg-background p-2" maxLength={4000} value={f.travaux} onChange={champ("travaux")} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Observations et recommandations<textarea rows={3} className="min-w-0 rounded-md border bg-background p-2" maxLength={2000} value={f.observations} onChange={champ("observations")} /></label>
        <label className="grid gap-1 text-sm">Intervenant<input className="rounded-md border bg-background p-2" maxLength={80} value={f.intervenant} onChange={champ("intervenant")} /></label>
      </div>

      <h3 className="mt-6 font-semibold">Matériel posé</h3>
      {!f.materiel.length && <p className="mt-2 text-sm text-muted-foreground">Aucune ligne.</p>}
      <div className="mt-2 grid gap-2">{f.materiel.map((l, i) => <div key={i} className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-0 basis-full gap-1 text-sm sm:flex-1 sm:basis-0">Désignation<input className="rounded-md border bg-background p-2" maxLength={120} value={l.designation} onChange={e => majLigne(i, "designation", e.target.value)} /></label>
        <label className="grid gap-1 text-sm">Quantité<input className="w-24 rounded-md border bg-background p-2" inputMode="decimal" value={l.quantite} onChange={e => majLigne(i, "quantite", e.target.value)} /></label>
        <label className="grid gap-1 text-sm">Unité<input className="w-20 rounded-md border bg-background p-2" maxLength={12} placeholder="u, m…" value={l.unite} onChange={e => majLigne(i, "unite", e.target.value)} /></label>
        <Button type="button" size="sm" variant="outline" aria-label={`Retirer la ligne ${i + 1}`} onClick={() => setEdition(ed => ed && { ...ed, form: { ...ed.form, materiel: ed.form.materiel.filter((_, j) => j !== i) } })}>Retirer</Button>
      </div>)}</div>
      <Button type="button" className="mt-3" variant="outline" disabled={f.materiel.length >= 100} onClick={() => setEdition(ed => ed && { ...ed, form: { ...ed.form, materiel: [...ed.form.materiel, { designation: "", quantite: "1", unite: "" }] } })}>Ajouter une ligne de matériel</Button>

      <h3 className="mt-6 font-semibold">Photos ({f.photos.length}/{MAX_PHOTOS})</h3>
      <p className="mt-1 text-sm text-muted-foreground">Ajoutez-les avant la signature : un rapport signé ne peut plus être modifié. Les photos sont réduites automatiquement.</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">{f.photos.map((ph, i) => <div key={i} className="rounded-xl border p-3">
        <img src={ph.image} alt={ph.legende || `Photo ${i + 1}`} className="max-h-48 w-full rounded-md object-contain" />
        <label className="mt-2 grid gap-1 text-sm">Légende<input className="rounded-md border bg-background p-2" maxLength={100} value={ph.legende} onChange={e => setEdition(ed => ed && { ...ed, form: { ...ed.form, photos: ed.form.photos.map((x, j) => j === i ? { ...x, legende: e.target.value } : x) } })} /></label>
        <Button type="button" size="sm" variant="outline" className="mt-2" aria-label={`Retirer la photo ${i + 1}`} onClick={() => setEdition(ed => ed && { ...ed, form: { ...ed.form, photos: ed.form.photos.filter((_, j) => j !== i) } })}>Retirer</Button>
      </div>)}</div>
      <input ref={champPhotos} type="file" accept="image/*" multiple className="sr-only" aria-label="Ajouter des photos" onChange={e => { void ajouterPhotos(e.target.files); e.target.value = ""; }} />
      <Button type="button" className="mt-3" variant="outline" disabled={traitement || f.photos.length >= MAX_PHOTOS} onClick={() => champPhotos.current?.click()}>Ajouter des photos</Button>
      {traitement && <p role="status" className="mt-2 text-sm text-muted-foreground">Traitement des photos…</p>}

      <div className="mt-6 rounded-xl border p-4">
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={edition.signer} onChange={e => setEdition(ed => ed && { ...ed, signer: e.target.checked })} />Faire signer le client maintenant</label>
        {edition.signer && <div className="mt-3 grid gap-3">
          <p className="text-sm text-muted-foreground">Une fois signé, le rapport ne peut plus être modifié. Relisez-le avec le client avant de signer.</p>
          <label className="grid gap-1 text-sm">Nom du signataire<input className="rounded-md border bg-background p-2" maxLength={80} value={nomSignataire} onChange={e => setNomSignataire(e.target.value)} /></label>
          <SignatureCadre ref={signature} />
        </div>}
      </div>
      <div className="mt-6 flex flex-wrap gap-3"><Button variant="action" disabled={occupe} onClick={() => void enregistrer()}>{edition.signer ? "Enregistrer et signer" : "Enregistrer le rapport"}</Button><Button variant="ghost" disabled={occupe} onClick={() => setEdition(null)}>Annuler</Button></div>
    </section>}

    <section className="mt-6 rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Vos rapports</h2>
      {!liste.length ? <p className="mt-3 text-sm text-muted-foreground">Aucun rapport pour le moment.</p> : <div className="mt-3 divide-y">{liste.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><p className="break-words font-medium">{r.numero} · {r.client.nom}</p><p className="break-words text-sm text-muted-foreground">{r.objet}</p><p className="text-sm text-muted-foreground">Le {fr(r.date)}{r.minutes ? ` · ${formaterDuree(r.minutes)}` : ""}{r.materiel.length ? ` · ${r.materiel.length} ligne${r.materiel.length > 1 ? "s" : ""} de matériel` : ""}{r.photos.length ? ` · ${r.photos.length} photo${r.photos.length > 1 ? "s" : ""}` : ""}</p>
          <p className={`text-sm font-medium ${r.signature ? "" : "text-muted-foreground"}`}>{r.signature ? `Signé par ${r.signature.nom} le ${fr(r.signature.signeLe)}` : "Non signé"}</p></div>
        <div className="flex flex-wrap gap-2">
          {!r.signature && <><Button size="sm" variant="outline" disabled={!!edition} onClick={() => ouvrir(r.id)}>Modifier</Button><Button size="sm" variant="outline" disabled={!!edition} onClick={() => ouvrir(r.id, true)}>Faire signer</Button></>}
          <Button size="sm" variant="outline" onClick={() => void pdf(r)}>PDF</Button>
          {aSupprimer === r.id ? <><Button size="sm" variant="destructive" disabled={occupe} onClick={() => void agir(b => supprimerRapport(b, r.id), "Rapport supprimé").then(() => setASupprimer(null))}>Confirmer la suppression</Button><Button size="sm" variant="ghost" onClick={() => setASupprimer(null)}>Annuler</Button></> : <Button size="sm" variant="ghost" disabled={!!edition} onClick={() => setASupprimer(r.id)}>Supprimer</Button>}
        </div>
      </div>)}</div>}
    </section>
  </AppLayout>;
}
