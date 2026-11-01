import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { enregistrerMention, importerMentions, lireMentions } from "@/data/mentions";
import { dateHeureMention, fusionnerMentions, lireSauvegarde, preparerSauvegarde, USAGES_MENTIONS, type BibliothequeMentions, type Mention, type UsageMention } from "@/lib/mentions";

export const Route = createFileRoute("/_authenticated/mentions")({ component: Page });
function Page() {
  const [b, setB] = useState<BibliothequeMentions | null>(null);
  const [v, setV] = useState<Mention | null>(null);
  const [origine, setOrigine] = useState("");
  const [recherche, setRecherche] = useState("");
  const [archives, setArchives] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [importation, setImportation] = useState<Mention[] | null>(null);
  const action = useRef<(() => void) | null>(null);
  const zone = useRef<HTMLTextAreaElement>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const modifie = !!v && JSON.stringify(v) !== origine;
  const blocker = useBlocker({shouldBlockFn: () => modifie, withResolver: true, enableBeforeUnload: modifie});
  useEffect(() => { let actif = true; void lireMentions().then(x => { if (actif) setB(x); }).catch(e => {if (actif) setErreur(e.message);}); return () => {actif = false;}; }, []);
  function choisir(m: Mention) { setV(structuredClone(m)); setOrigine(JSON.stringify(m)); setErreur(""); }
  function demander(fn: () => void) { if (modifie) {action.current = fn; setConfirmer(true);} else fn(); }
  function nouveau() { demander(() => choisir({id: crypto.randomUUID(), titre: "", texte: "", usages: [], archivee: false})); }
  async function recharger() {
    setEnCours(true);
    try { const x = await lireMentions(); setB(x); const actuel = x.mentions.find(m => m.id === v?.id); if (actuel) choisir(actuel); else {setV(null);setOrigine("");} setErreur(""); }
    catch (e) {setErreur(e instanceof Error ? e.message : "Lecture impossible.");}
    finally {setEnCours(false);}
  }
  async function sauver() {
    if (!v || !b || enCours) return;
    setEnCours(true);setErreur("");
    try {const x = await enregistrerMention(v, b.version);setB(x);choisir(x.mentions.find(m => m.id === v.id)!);toast.success("Mention enregistrée dans ce navigateur");}
    catch(e) {setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");}
    finally {setEnCours(false);}
  }
  function insererDate(type: "date" | "heure") {
    if (!v) return;
    const debut = zone.current?.selectionStart ?? v.texte.length, fin = zone.current?.selectionEnd ?? debut;
    const texte = dateHeureMention(type);
    if (v.texte.length - (fin - debut) + texte.length > 2000) {setErreur("Le texte dépasserait 2 000 caractères.");return;}
    setV({...v,texte:v.texte.slice(0,debut)+texte+v.texte.slice(fin)});
    requestAnimationFrame(() => {zone.current?.focus();zone.current?.setSelectionRange(debut+texte.length,debut+texte.length);});
  }
  function exporter() {
    if (!b) return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(preparerSauvegarde(b),null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="Mentions-Les-Freres-Mayet.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function lireFichier(f: File | undefined) {
    if (!f || !b) return;
    try {if(f.size>1024*1024)throw new Error("La sauvegarde doit faire moins de 1 Mo.");const liste=lireSauvegarde(JSON.parse(await f.text()));fusionnerMentions(b,liste);setImportation(liste);setErreur("");}
    catch(e) {setErreur(e instanceof Error ? e.message : "Sauvegarde illisible.");}
  }
  async function importer() {
    if (!b || !importation) return;
    setEnCours(true);setErreur("");
    try {const x=await importerMentions(importation,b.version);setB(x);setImportation(null);toast.success("Bibliothèque importée, textes existants conservés");}
    catch(e) {setErreur(e instanceof Error ? e.message : "Importation impossible.");}
    finally {setEnCours(false);}
  }
  const resultats=b?.mentions.filter(m => (archives || !m.archivee) && (m.titre+" "+m.texte).toLowerCase().includes(recherche.trim().toLowerCase())) ?? [];
  return <AppLayout titre="Mentions">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold">Mentions</h1><Button variant="action" onClick={nouveau} disabled={!b || enCours}>Nouvelle mention</Button></div>
    <p className="mt-3 text-sm">Vos textes de fin de documents et vos conditions réutilisables.</p>
    <div className="mt-4 rounded-xl border bg-card p-4 text-sm"><p className="font-medium">Bibliothèque locale — ce navigateur et ce compte uniquement.</p><p className="mt-1 text-muted-foreground">Exportez une sauvegarde pour conserver vos textes et les retrouver sur un autre appareil. Les mentions insérées dans un document sont sauvegardées avec ce document après son enregistrement.</p><div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={!b || enCours} onClick={exporter}>Exporter la bibliothèque enregistrée</Button>
      <Button size="sm" variant="outline" disabled={!b || enCours} onClick={() => fichier.current?.click()}>Importer une sauvegarde</Button>
      <Button size="sm" variant="outline" disabled={enCours} onClick={() => demander(() => void recharger())}>Recharger la bibliothèque</Button>
      <input ref={fichier} className="hidden" type="file" accept=".json,application/json" aria-label="Sauvegarde de mentions" onChange={e=>{void lireFichier(e.target.files?.[0]);e.target.value="";}} />
    </div>{modifie && <p className="mt-2 text-xs">La sauvegarde exportée contient les textes enregistrés. Enregistrez d’abord vos modifications.</p>}</div>
    {erreur && <p role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-card p-3 text-sm text-destructive">{erreur}</p>}
    {!b && !erreur && <p role="status" className="mt-4">Chargement des mentions…</p>}
    {b && <div className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <section className="min-w-0 rounded-2xl border bg-card p-4"><Label htmlFor="mentions-recherche">Rechercher une mention</Label><Input id="mentions-recherche" className="mt-2" value={recherche} onChange={e=>setRecherche(e.target.value)} /><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={archives} onChange={e=>setArchives(e.target.checked)}/>Afficher les mentions archivées</label>
        <div className="mt-4 flex flex-col gap-2">{resultats.map(m=><button disabled={enCours} key={m.id} onClick={()=>demander(()=>choisir(m))} className={`rounded-xl border p-3 text-left ${v?.id===m.id?"border-primary bg-secondary":"hover:bg-secondary/50"}`}><span className="block break-words font-medium">{m.titre}</span><span className="mt-1 block text-xs text-muted-foreground">{m.archivee?"Archivée":m.usages.length ? m.usages.map(u=>USAGES_MENTIONS[u]).join(" · "):"Insertion au choix"}</span></button>)}{!resultats.length&&<p className="text-sm text-muted-foreground">{b.mentions.length?"Aucune mention pour cette recherche.":"Aucune mention. Ajoutez vos propres textes avec Nouvelle mention."}</p>}</div>
      </section>
      <section className="min-w-0 rounded-2xl border bg-card p-5">
        {!v ? <p>Sélectionnez une mention ou créez votre premier texte.</p> : <form onSubmit={e=>{e.preventDefault();void sauver();}} className="flex flex-col gap-4">
          <div><Label htmlFor="mention-titre">Titre de la mention</Label><Input id="mention-titre" maxLength={120} value={v.titre} onChange={e=>setV({...v,titre:e.target.value})} disabled={enCours}/></div>
          <div><Label htmlFor="mention-texte">Texte destiné au client</Label><Textarea ref={zone} id="mention-texte" className="mt-2 min-h-56" maxLength={2000} value={v.texte} onChange={e=>setV({...v,texte:e.target.value})} disabled={enCours}/><p className="mt-1 text-xs text-muted-foreground">{v.texte.length} / 2 000 caractères</p><div className="mt-2 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={enCours} onClick={()=>insererDate("date")}>Insérer la date du jour</Button><Button type="button" size="sm" variant="outline" disabled={enCours} onClick={()=>insererDate("heure")}>Insérer l’heure</Button></div><p className="mt-2 text-xs text-muted-foreground">Date et heure de Paris, insérées comme texte fixe.</p></div>
          <fieldset className="rounded-xl border p-3"><legend className="px-1 text-sm font-medium">Proposer cette mention pour</legend><div className="flex flex-wrap gap-4">{Object.entries(USAGES_MENTIONS).map(([u,label])=><label key={u} className="flex items-center gap-2 text-sm"><input disabled={enCours} type="checkbox" checked={v.usages.includes(u as UsageMention)} onChange={e=>setV({...v,usages:e.target.checked?[...v.usages,u as UsageMention]:v.usages.filter(x=>x!==u)})}/>{label}</label>)}</div><p className="mt-2 text-xs text-muted-foreground">Vous choisissez quand insérer les mentions proposées. Aucun brouillon n’est modifié automatiquement.</p></fieldset>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={enCours} checked={v.archivee} onChange={e=>setV({...v,archivee:e.target.checked})}/>Archiver cette mention (réversible)</label>
          <p role="status" className="text-sm text-muted-foreground">{modifie?"Modifications non enregistrées.":"Aucune modification en attente."}</p>
          <Button type="submit" variant="action" className="self-start" disabled={enCours || !modifie}>{enCours?"Enregistrement…":"Enregistrer la mention"}</Button>
        </form>}
      </section>
    </div>}
    <AlertDialog open={confirmer || blocker.status==="blocked"}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Abandonner les modifications non enregistrées ?</AlertDialogTitle><AlertDialogDescription>La dernière mention enregistrée restera inchangée.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={()=>{setConfirmer(false);action.current=null;blocker.reset?.();}}>Garder ma saisie</AlertDialogCancel><AlertDialogAction onClick={()=>{setConfirmer(false);if(blocker.status==="blocked")blocker.proceed?.();else action.current?.();action.current=null;}}>Abandonner les modifications</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={!!importation}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Importer la bibliothèque ?</AlertDialogTitle><AlertDialogDescription>{importation?.length} mentions dans le fichier. Les copies identiques seront ignorées ; les textes existants ne seront pas remplacés.</AlertDialogDescription></AlertDialogHeader>{erreur&&<p role="alert" className="text-sm text-destructive">{erreur}</p>}<AlertDialogFooter><AlertDialogCancel disabled={enCours} onClick={()=>setImportation(null)}>Annuler</AlertDialogCancel><AlertDialogAction disabled={enCours} onClick={e=>{e.preventDefault();void importer();}}>Importer</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </AppLayout>;
}
