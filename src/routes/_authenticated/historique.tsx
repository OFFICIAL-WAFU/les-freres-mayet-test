import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { lireEtatHistorique, enregistrerHistorique, transfererHistoriqueTest } from "@/data/historique";
import { lireArchiveLocale, enregistrerArchiveLocale, type ArchiveLocale } from "@/data/historique";
import { PdfHistoriqueBouton } from "@/components/PdfHistoriqueBouton";
import { HistoriqueImporte } from "@/components/HistoriqueImporte";
import { eurosKhosmos, type AnalyseKhosmos } from "@/lib/khosmos";
import { historiqueCsv } from "@/lib/export-historique";
import { telechargerFichier } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/historique")({ component: Page });
function Page() {
  const [analyse, setAnalyse] = useState<AnalyseKhosmos | null>(null);
  const [charge, setCharge] = useState(false); const [erreur, setErreur] = useState("");
  const [recherche, setRecherche] = useState(""); const [type, setType] = useState("Tous");
  const [stockage, setStockage] = useState<"local" | "cloud">("local"); const [disponible, setDisponible] = useState(false);
  const [transfert, setTransfert] = useState(false); const [confirmer, setConfirmer] = useState(false);
  const [archive, setArchive] = useState<ArchiveLocale | null>(null); const [zipTravail, setZipTravail] = useState(false);
  const [cible, setCible] = useState(""); const [avertissement, setAvertissement] = useState("");
  useEffect(() => { let actif = true; lireArchiveLocale().then(a => { if (actif) setArchive(a); }).catch(e => { if (actif) setErreur(e.message); }); return () => { actif = false; }; }, []);
  useEffect(() => { let actif = true; lireEtatHistorique().then(a => { if (actif) { setAnalyse(a.analyse); setStockage(a.stockage); setDisponible(a.disponible); setAvertissement(a.avertissement ?? ""); } }).catch(e => { if (actif) setErreur(e.message); }).finally(() => { if (actif) setCharge(true); }); return () => { actif = false; }; }, []);
  async function importer(f: File | undefined) {
    if (!f) return; setErreur("");
    try { if (f.size > 30 * 1024 * 1024) throw new Error("Fichier trop volumineux (30 Mo maximum)."); const local = await enregistrerHistorique(JSON.parse(await f.text())); if (stockage === "cloud") throw new Error("Copie enregistrée localement. L’historique Cloud actuellement affiché est conservé."); setAnalyse(local); }
    catch (e) { setErreur(e instanceof Error ? e.message : "Import impossible."); }
  }
  const normaliser = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const docs = (analyse?.documents ?? []).filter(d => (type === "Tous" || d.type === type) && normaliser(`${d.ref} ${d.client}`).includes(normaliser(recherche.trim())));
  return <AppLayout titre="Historique Khosmos">
    <h1 className="text-2xl font-semibold">Historique Khosmos</h1>
    <p className="mt-2 text-muted-foreground">Vos anciens documents, avec leurs références et montants d’origine.</p>
    <section className="mt-5 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">Documents repris dans votre espace</h2>
      <p className="mt-1 text-sm text-muted-foreground">Devis, factures, acomptes et avoirs Khosmos avec leur numéro, leurs lignes et leurs montants d’origine. Figés : ils ne comptent pas dans « À encaisser » et ne créent aucun règlement.</p>
      <div className="mt-4"><HistoriqueImporte /></div>
    </section>
    <h2 className="mt-8 text-lg font-semibold">Analyse de la sauvegarde Khosmos (fichiers)</h2>
    <p className="mt-4 rounded-xl border bg-card p-4 text-sm">{stockage === "cloud" ? "Historique enregistré dans la base de cet environnement, accessible avec votre compte." : "Historique conservé sur ce navigateur, pour ce compte et cet environnement. Effacer les données du navigateur l’efface aussi."} Conservez votre sauvegarde complète. Aucun paiement, client ou nouveau numéro n’est créé ; ces documents ne sont pas inclus dans « À encaisser ».</p>
    {charge && stockage === "local" && <section className="mt-4 rounded-xl border p-4 text-sm"><h2 className="font-semibold">Stockage dans Lovable TEST</h2><p className="mt-2">{disponible ? "Le stockage Cloud est disponible. Votre copie locale sera conservée après transfert." : "Installation de la migration requise : le stockage Cloud n’est pas encore disponible. Votre historique local reste consultable."}</p>{analyse && disponible && <><Button className="mt-3" disabled={transfert} onClick={() => setConfirmer(true)}>Préparer le transfert vers TEST</Button>{confirmer && <div className="mt-3"><p>Transférer les {analyse.documents.length} documents, noms de clients et montants vers la base Lovable TEST de votre compte ? Aucun PDF ni nouvelle facture active n’est créé.</p><div className="mt-3 flex flex-wrap gap-2"><Button disabled={transfert} onClick={async () => { setTransfert(true); setErreur(""); try { setAnalyse(await transfererHistoriqueTest(analyse)); setStockage("cloud"); setConfirmer(false); } catch(e) { setErreur(e instanceof Error ? e.message : "Transfert impossible."); } finally { setTransfert(false); } }}>{transfert ? "Transfert…" : "Confirmer le transfert"}</Button><Button variant="outline" disabled={transfert} onClick={() => setConfirmer(false)}>Annuler</Button></div></div>}</>}</section>}
    <div className="mt-4 flex flex-wrap gap-3"><Button asChild variant="outline"><Link to="/imports">Analyser un dossier</Link></Button><label className="cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium">Charger une analyse sauvegardée<input className="sr-only" aria-label="Charger une analyse sauvegardée" type="file" accept=".json" onChange={e => { void importer(e.target.files?.[0]); e.target.value = ""; }} /></label></div>
    {erreur && <p role="alert" className="mt-4 text-sm text-destructive">{erreur}</p>}
    {avertissement && <p role="status" className="mt-4 rounded-lg border p-3 text-sm">{avertissement}</p>}
    {!charge ? <p className="mt-4">Chargement…</p> : !analyse ? <p className="mt-4">Aucun historique enregistré. Chargez l’analyse JSON déjà sauvegardée ou enregistrez le résultat depuis Reprise Khosmos.</p> : <>
      <p className="mt-5 font-medium">{analyse.documents.length} documents conservés · {["Devis", "Facture", "Acompte", "Avoir"].map(t => `${analyse.documents.filter(d => d.type === t).length} ${t}`).join(" · ")}</p>
      <section className="mt-4 rounded-xl border p-4 text-sm"><h2 className="font-semibold">PDF originaux</h2>{archive ? <p className="mt-2">ZIP conservé : {archive.nom} · {archive.fichiers} fichiers · {(archive.taille / 1024 / 1024).toFixed(1)} Mo. Vos PDF sont accessibles depuis chaque document.</p> : <><p className="mt-2">Ajoutez une seule fois le ZIP de sauvegarde pour consulter et télécharger les PDF depuis cette page. Stockage sur ce navigateur uniquement, aucun envoi Cloud.</p><label className={`mt-3 inline-block cursor-pointer rounded-lg border px-4 py-2 ${zipTravail ? "pointer-events-none opacity-50" : ""}`}>{zipTravail ? "Conservation du ZIP…" : "Ajouter le ZIP original"}<input className="sr-only" aria-label="Ajouter le ZIP original" type="file" accept=".zip" disabled={zipTravail} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setZipTravail(true); setErreur(""); try { setArchive(await enregistrerArchiveLocale(f, analyse)); } catch(err) { setErreur(err instanceof Error ? err.message : "ZIP non enregistré."); } finally { setZipTravail(false); } }} /></label></>}</section>
      <div className="mt-4 flex flex-wrap gap-3"><label className="grid min-w-0 flex-1 gap-1 text-sm">Rechercher dans l’historique<input className="rounded-md border p-2" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Client ou référence…" /></label><label className="grid gap-1 text-sm">Type de document<select className="rounded-md border p-2" value={type} onChange={e => setType(e.target.value)}>{["Tous", "Devis", "Facture", "Acompte", "Avoir"].map(t => <option key={t}>{t}</option>)}</select></label></div>
      <p className="mt-3 text-sm" aria-live="polite">{docs.length} document(s) affiché(s)</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={!docs.length} onClick={() => telechargerFichier(historiqueCsv(docs), "Inventaire-Khosmos.csv", "text/csv;charset=utf-8")}>Exporter les {docs.length} documents affichés (CSV)</Button><Button variant="outline" onClick={() => telechargerFichier(JSON.stringify(analyse, null, 2), "Analyse-Khosmos-sauvegardee.json", "application/json;charset=utf-8")}>Sauvegarder l’analyse complète</Button>{(recherche || type !== "Tous") && <Button variant="ghost" onClick={() => { setRecherche(""); setType("Tous"); setCible(""); }}>Afficher tout l’historique</Button>}</div>
      <p className="mt-2 text-xs text-muted-foreground">Le CSV est un inventaire des sources, sans reconstitution de paiements. Le JSON conserve l’analyse ; conservez aussi le ZIP qui contient les fichiers originaux.</p>
      <div className="mt-3 space-y-3">{docs.map(d => <details key={d.ref} open={cible === d.ref ? true : undefined} className="rounded-xl border bg-card p-4"><summary className="cursor-pointer break-words font-medium">{d.ref} · {d.client} · {eurosKhosmos(d.ttc)}</summary><div className="mt-3 space-y-2 text-sm"><p>{d.type} · {d.date} · {d.statut}</p><p>HT {eurosKhosmos(d.ht)} · TVA {eurosKhosmos(d.tva)} · TTC source {eurosKhosmos(d.ttc)}</p><p>Total PDF {eurosKhosmos(d.pdfTtc)} · Net PDF {eurosKhosmos(d.net)}</p>{d.liens.length > 0 && <div className="flex flex-wrap items-center gap-2"><span>Documents liés :</span>{d.liens.map(ref => <Button key={ref} variant="outline" size="sm" onClick={() => { setRecherche(ref); setType("Tous"); setCible(ref); }}>{ref}</Button>)}</div>}{d.alertes.map((a,i) => <p key={i} className="text-orange-800">{a}</p>)}{d.infos.map((a,i) => <p key={i}>{a}</p>)}<p className="font-medium">Fichiers de la sauvegarde</p>{d.sources.map((s,i) => <p key={i} className="break-all text-xs text-muted-foreground">{s}</p>)}<div className="mt-3 flex flex-col gap-3">{d.sources.filter(s => /\.pdf$/i.test(s)).map(s => <PdfHistoriqueBouton key={s} chemin={s} disponible={!!archive} />)}</div>{!archive && <p className="text-xs text-muted-foreground">Ajoutez le ZIP original ci-dessus pour ouvrir ces PDF.</p>}</div></details>)}</div>
    </>}
  </AppLayout>;
}
