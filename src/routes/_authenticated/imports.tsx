import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { enregistrerHistorique } from "@/data/historique";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { eurosKhosmos, type AnalyseKhosmos } from "@/lib/khosmos";

export const Route = createFileRoute("/_authenticated/imports")({ component: Page });

function Page() {
  const [resultat, setResultat] = useState<AnalyseKhosmos | null>(null);
  const [travail, setTravail] = useState(false);
  const [avance, setAvance] = useState({ fait: 0, total: 0, nom: "" });
  const [erreur, setErreur] = useState(""); const [recherche, setRecherche] = useState("");
  const [exceptions, setExceptions] = useState(true);
  const [sauvegarde, setSauvegarde] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [rapportPret, setRapportPret] = useState<{ url: string; nom: string } | null>(null);
  useEffect(() => () => { if (rapportPret) URL.revokeObjectURL(rapportPret.url); }, [rapportPret]);
  const controle = useRef<AbortController | null>(null);
  useEffect(() => () => controle.current?.abort(), []);
  async function analyser(files: File[]) {
    if (!files.length || travail) return;
    setTravail(true); setErreur(""); setSauvegarde(""); setResultat(null); setRapportPret(null); controle.current = new AbortController();
    try {
      const { analyserDossierKhosmos } = await import("@/lib/khosmos-fichiers");
      const result = await analyserDossierKhosmos(files, (fait, total, nom) => setAvance({ fait, total, nom }), controle.current.signal);
      setResultat(result);
    } catch (e) { setErreur(e instanceof Error ? e.message : "Analyse impossible."); }
    finally { setTravail(false); }
  }
  const documents = resultat?.documents ?? [];
  const attention = documents.filter(d => d.alertes.length > 0);
  const affiches = documents.filter(d => (!exceptions || d.alertes.length) && `${d.ref} ${d.client} ${d.type}`.toLowerCase().includes(recherche.toLowerCase()));
  function rapport(format: "txt" | "json" = "txt") {
    if (!resultat) return;
    const contenu = format === "json" ? JSON.stringify(resultat, null, 2) : [
      "BILAN DU DOSSIER KHOSMOS", `Analyse du ${new Date(resultat.genereLe).toLocaleString("fr-FR")}`,
      `${resultat.fichiers} fichiers : ${resultat.pdf} PDF, ${resultat.csv} CSV. ${documents.length} documents regroupés.`,
      `${documents.length - attention.length} sans anomalie détectée ; ${attention.length} à vérifier ; ${resultat.erreurs.length} fichiers illisibles.`,
      "Analyse locale uniquement : aucun document, client, règlement ou numéro créé.", "",
      ...documents.flatMap(d => [
        `${d.ref} — ${d.type} — ${d.date} — ${d.client}`, `${d.statut}. HT : ${eurosKhosmos(d.ht)} ; TVA : ${eurosKhosmos(d.tva)} ; TTC source : ${eurosKhosmos(d.ttc)}.`,
        `PDF TTC : ${eurosKhosmos(d.pdfTtc)} ; net à payer : ${eurosKhosmos(d.net)}.`,
        ...d.alertes.map(a => `À VÉRIFIER : ${a}`), ...d.infos.map(a => `Information : ${a}`),
        `Liens : ${d.liens.join(", ") || "aucun"}`, ...d.sources.map(s => `Source : ${s}`), "",
      ]), "FICHIERS ILLISIBLES", ...resultat.erreurs.map(e => `${e.path} : ${e.message}`),
      "ANNEXES", ...resultat.annexes, "COPIES IDENTIQUES", ...resultat.copies.map(c => `${c.path} = ${c.original}`),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([contenu], { type: "text/plain;charset=utf-8" }));
    setRapportPret({ url, nom: `Analyse-Khosmos.${format}` });
    const a = document.createElement("a"); a.href = url; a.download = `Analyse-Khosmos.${format}`;
    document.body.appendChild(a); a.click(); a.remove();
  }
  return <AppLayout titre="Reprise Khosmos">
    <h1 className="text-2xl font-semibold lg:text-3xl">Reprise Khosmos</h1>
    <p className="mt-2 text-muted-foreground">Déposez votre export complet. L’application rapproche les CSV et les PDF en une seule analyse.</p>
    <section className="mt-6 rounded-2xl border bg-card p-5 sm:p-6" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void analyser([...e.dataTransfer.files]); }}>
      <h2 className="text-lg font-semibold">Votre dossier PDF + CSV</h2>
      <p className="mt-2 text-sm text-muted-foreground">Choisissez le ZIP complet, plusieurs fichiers ou un dossier. Les fichiers restent sur cet ordinateur ; aucun document, règlement ou numéro n’est créé.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className={`inline-flex cursor-pointer items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${travail ? "pointer-events-none opacity-50" : ""}`}>Choisir le ZIP ou les fichiers
          <input aria-label="Choisir le ZIP ou les fichiers" type="file" accept=".zip,.pdf,.csv" multiple disabled={travail} className="sr-only" onChange={e => { void analyser(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        </label>
        <label className={`inline-flex cursor-pointer items-center rounded-lg border px-4 py-2 text-sm font-medium ${travail ? "pointer-events-none opacity-50" : ""}`}>Choisir un dossier
          <input aria-label="Choisir un dossier" type="file" {...{ webkitdirectory: "" }} multiple disabled={travail} className="sr-only" onChange={e => { void analyser(Array.from(e.target.files ?? []).filter(f => /\.(pdf|csv)$/i.test(f.name))); e.target.value = ""; }} />
        </label>
        {travail && <Button variant="outline" onClick={() => controle.current?.abort()}>Annuler l’analyse</Button>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Analyse en mémoire : quitter cette page efface le résultat. Téléchargez le rapport pour le conserver. Les PDF scannés nécessitant un OCR sont signalés.</p>
      {travail && <div className="mt-4" role="status" aria-live="polite"><p>{avance.total ? `${avance.fait} / ${avance.total} fichiers` : "Ouverture du dossier…"}</p><progress className="mt-2 w-full" max={avance.total || 1} value={avance.fait} /><p className="mt-1 break-all text-xs text-muted-foreground">{avance.nom}</p></div>}
      {erreur && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{erreur}</p>}
    </section>
    {resultat && <>
      <section className="mt-5 rounded-xl border bg-card p-4"><h2 className="font-semibold">Conserver cet historique dans l’application</h2><p className="mt-2 text-sm text-muted-foreground">Enregistrement sur ce navigateur, pour votre compte. Les montants restent inchangés. Aucune facture active, aucun règlement ni numéro créé.</p><Button className="mt-3" disabled={enregistrement} onClick={async () => { setEnregistrement(true); setSauvegarde(""); try { await enregistrerHistorique(resultat); setSauvegarde("Historique enregistré : disponible après rechargement dans Historique Khosmos."); } catch(e) { setSauvegarde(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setEnregistrement(false); } }}>{enregistrement ? "Enregistrement…" : "Enregistrer dans l’historique"}</Button><Button asChild variant="ghost"><Link to="/historique">Consulter l’historique</Link></Button>{sauvegarde && <p role="status" className="mt-3 text-sm">{sauvegarde}</p>}</section>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ["Documents rapprochés", documents.length], ["Sans anomalie détectée", documents.length - attention.length], ["Documents à vérifier", attention.length], ["Fichiers illisibles / refusés", resultat.erreurs.length],
      ].map(([label, valeur]) => <div key={label} className="rounded-xl border bg-card p-4"><p className="text-2xl font-semibold">{valeur}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></div>)}</div>
      <section className="mt-4 rounded-xl border bg-card p-4 text-sm"><p>{resultat.pdf} PDF ({resultat.pages} pages), {resultat.csv} CSV, {resultat.lignesCsv} lignes de synthèse. {resultat.copies.length} copies strictement identiques exclues des calculs. {resultat.annexes.length} annexes identifiées.</p><p className="mt-2">{["Devis", "Facture", "Acompte", "Avoir"].map(type => `${documents.filter(d => d.type === type).length} ${type === "Devis" ? "devis" : type.toLowerCase() + "s"}`).join(" · ")}</p><p className="mt-2 text-muted-foreground">Les variantes acquittées restent rattachées au même document. Les montants source sont conservés ; cette analyse n’enregistre pas encore l’historique dans l’application.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => rapport()}>Télécharger le rapport complet</Button><Button variant="ghost" onClick={() => rapport("json")}>Exporter les données d’analyse</Button></div></section>
      {rapportPret && <p role="status" className="mt-3 text-sm">Rapport préparé. <a className="font-medium text-primary underline" href={rapportPret.url} download={rapportPret.nom}>Enregistrer {rapportPret.nom}</a></p>}
      <div className="mt-6 flex flex-wrap items-center gap-3"><Input className="max-w-sm" placeholder="Client ou référence…" value={recherche} onChange={e => setRecherche(e.target.value)} aria-label="Rechercher dans l’analyse" /><Button variant={exceptions ? "default" : "outline"} onClick={() => setExceptions(!exceptions)}>{exceptions ? "Afficher tous les documents" : "Afficher seulement les anomalies"}</Button></div>
      <p className="mt-3 text-sm text-muted-foreground">{affiches.length} document(s) affiché(s). {exceptions && "Seuls les documents présentant une anomalie sont affichés."}</p>
      <div className="mt-3 space-y-3">{affiches.map(d => <details key={d.ref} className="rounded-xl border bg-card p-4"><summary className="cursor-pointer list-none"><div className="flex flex-wrap justify-between gap-2"><div><span className="font-semibold">{d.ref}</span><span className="ml-2 text-sm text-muted-foreground">{d.type} · {d.date}</span><p className="mt-1">{d.client || "Client non lu"}</p></div><div className="text-right"><p className="font-semibold">{eurosKhosmos(d.ttc)}</p><p className={`text-sm ${d.alertes.length ? "text-orange-700" : "text-emerald-700"}`}>{d.alertes.length ? `${d.alertes.length} point(s) à vérifier` : "Rapproché"}</p></div></div></summary><div className="mt-4 space-y-2 border-t pt-3 text-sm"><p>{d.statut} · HT {eurosKhosmos(d.ht)} · TVA {eurosKhosmos(d.tva)} · TTC source {eurosKhosmos(d.ttc)}</p><p>PDF : total TTC {eurosKhosmos(d.pdfTtc)}{d.net !== null && ` · net à payer ${eurosKhosmos(d.net)}`}{d.echeance && ` · échéance ${d.echeance}`}</p>{d.lignes > 0 && <p>{d.lignes} lignes structurées dans l’archive fiscale.</p>}{d.alertes.map(a => <p className="rounded bg-orange-50 p-2 text-orange-900" key={a}>{a}</p>)}{d.infos.map(a => <p className="rounded bg-blue-50 p-2 text-blue-900" key={a}>{a}</p>)}{d.liens.length > 0 && <p>Documents liés : {d.liens.join(", ")}</p>}<p className="font-medium">Fichiers sources</p>{d.sources.map(s => <p className="break-all text-xs text-muted-foreground" key={s}>{s}</p>)}</div></details>)}{!affiches.length && <p className="rounded-xl border bg-card p-4">Aucun document ne correspond à ce filtre.</p>}</div>
      {(resultat.erreurs.length > 0 || resultat.annexes.length > 0) && <details className="mt-5 rounded-xl border bg-card p-4"><summary className="cursor-pointer">Fichiers non rapprochés et annexes</summary><div className="mt-3 space-y-2 text-sm">{resultat.erreurs.map(e => <p className="break-all text-orange-900" key={e.path}>{e.path} : {e.message}</p>)}{resultat.annexes.map(p => <p className="break-all text-muted-foreground" key={p}>{p} — annexe, hors des totaux des documents.</p>)}</div></details>}
    </>}
  </AppLayout>;
}
