import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { chargerClients, creerClient, lireClientsCharges, nomClient, useEtatClients } from "@/data/clients";
import { analyserImportClients, MAX_OCTETS, type LigneImport, type ResultatLecture } from "@/lib/import-clients";

export const Route = createFileRoute("/_authenticated/import-clients")({
  head: () => ({ meta: [{ title: "Importer des clients — Les Frères Mayet" }, { name: "description", content: "Importer des fiches clients depuis un fichier CSV, avec contrôle des doublons avant enregistrement." }] }),
  component: Page,
});

function Page() {
  useEtatClients();
  const etatActuel = lireClientsCharges;
  const entree = useRef<HTMLInputElement>(null);
  const [nomFichier, setNomFichier] = useState("");
  const [analyse, setAnalyse] = useState<ResultatLecture | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(0);
  const [bilan, setBilan] = useState<{ ok: number; echecs: { nom: string; message: string }[] } | null>(null);
  const [enregistres, setEnregistres] = useState<Set<string>>(new Set());
  // L'analyse (et ses identifiants) est figée à la lecture du fichier : une nouvelle tentative ne crée jamais de doublon.
  const lignes = analyse?.lignes ?? [];
  const n = { nouveau: lignes.filter((l) => l.statut === "nouveau").length, doublon: lignes.filter((l) => l.statut === "doublon").length, invalide: lignes.filter((l) => l.statut === "invalide").length };

  async function choisir(f: File | undefined) {
    if (!f) return;
    setBilan(null); setErreur(null); setEnregistres(new Set());
    if (f.size > MAX_OCTETS) { setErreur("Fichier trop volumineux (2 Mo maximum)."); return; }
    try {
      await chargerClients();
      const t = await f.text();
      const a = analyserImportClients(t, etatActuel());
      setNomFichier(f.name); setAnalyse(a);
      setCoches(new Set(a.lignes.filter((l) => l.statut === "nouveau").map((l) => l.id)));
      if (a.erreur) setErreur(a.erreur);
    } catch { setErreur("Lecture du fichier impossible."); }
  }
  function basculer(l: LigneImport) {
    setCoches((c) => { const x = new Set(c); if (x.has(l.id)) x.delete(l.id); else x.add(l.id); return x; });
  }
  async function importer() {
    const a = lignes.filter((l) => coches.has(l.id) && l.statut !== "invalide" && !enregistres.has(l.id));
    if (!a.length || enCours) return;
    setEnCours(true); setFait(0); setBilan(null);
    const echecs: { nom: string; message: string }[] = []; let ok = 0; const faits = new Set(enregistres);
    for (const l of a) {
      try { await creerClient(l.id, l.client); ok++; faits.add(l.id); }
      catch (e) { echecs.push({ nom: nomClient(l.client), message: e instanceof Error ? e.message : "Échec" }); }
      setFait((x) => x + 1);
    }
    setEnregistres(faits);
    setBilan({ ok, echecs }); setEnCours(false);
    void chargerClients();
  }
  const aImporter = lignes.filter((l) => coches.has(l.id) && l.statut !== "invalide" && !enregistres.has(l.id)).length;
  return (
    <AppLayout titre="Importer des clients">
      <div className="max-w-4xl">
        <Button asChild variant="ghost" size="sm" className="mb-2"><Link to="/clients">← Clients</Link></Button>
        <h1 className="text-2xl font-semibold lg:text-3xl">Importer des clients</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choisissez un fichier CSV (colonnes : type, prenom, nom, raison_sociale, telephone, email, siret, tva, adresse, complement, code_postal, ville, pays, notes).
          Rien n'est enregistré avant votre validation ; les clients qui ressemblent à une fiche existante sont décochés par défaut, et aucune fiche existante n'est modifiée.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input ref={entree} type="file" accept=".csv,text/csv" className="sr-only" id="fichier-clients" onChange={(e) => void choisir(e.target.files?.[0])} />
          <Button variant="action" onClick={() => entree.current?.click()} disabled={enCours}>Choisir un fichier CSV</Button>
          {nomFichier && <span className="text-sm break-all">{nomFichier}</span>}
        </div>
        {erreur && <p role="alert" className="mt-3 text-sm text-destructive">{erreur}</p>}
        {analyse && analyse.colonnesIgnorees.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Colonnes ignorées : {analyse.colonnesIgnorees.join(", ")}.</p>}
        {lignes.length > 0 && (
          <section className="mt-5" aria-label="Aperçu de l'import">
            <p className="text-sm"><strong>{lignes.length}</strong> lignes lues : {n.nouveau} nouveau(x), {n.doublon} doublon(s) probable(s), {n.invalide} invalide(s).</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={enCours} onClick={() => setCoches(new Set(lignes.filter((l) => l.statut === "nouveau").map((l) => l.id)))}>Cocher les nouveaux</Button>
              <Button size="sm" variant="outline" disabled={enCours} onClick={() => setCoches(new Set())}>Tout décocher</Button>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {lignes.map((l) => {
                const fait = enregistres.has(l.id);
                return (
                  <li key={l.id} className="rounded-xl border border-border p-3 text-sm">
                    <label className="flex items-start gap-3">
                      <input type="checkbox" className="mt-1 size-4" checked={coches.has(l.id) || fait} disabled={l.statut === "invalide" || enCours || fait} onChange={() => basculer(l)} aria-label={`Importer ${nomClient(l.client) || `ligne ${l.numero}`}`} />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium break-words">{nomClient(l.client) || `Ligne ${l.numero}`}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{l.client.type === "entreprise" ? "Entreprise" : "Particulier"} · ligne {l.numero}{l.documents ? ` · ${l.documents} document(s) Khosmos` : ""}</span>
                        <span className="block text-xs text-muted-foreground break-words">{[l.client.adresse, l.client.complement, [l.client.codePostal, l.client.ville].filter(Boolean).join(" "), l.client.email, l.client.telephone].filter(Boolean).join(" · ") || "Aucune coordonnée"}</span>
                        {fait && <span className="block text-xs font-medium text-green-700">Enregistré</span>}
                        {l.statut === "invalide" && l.erreurs.map((e, i) => <span key={i} role="alert" className="block text-xs text-destructive">{e}</span>)}
                        {l.statut !== "invalide" && l.avertissements.map((e, i) => <span key={i} className="block text-xs text-amber-700">{e}</span>)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 border-t border-border bg-background py-3">
              <Button variant="action" disabled={enCours || aImporter === 0} onClick={() => void importer()}>
                {enCours && <Loader2 className="animate-spin" />}{enCours ? `Enregistrement ${fait}/${aImporter + fait}…` : `Importer ${aImporter} client(s)`}
              </Button>
            </div>
          </section>
        )}
        {bilan && (
          <section role="status" className="mt-4 rounded-xl border border-border bg-secondary/50 p-3 text-sm">
            <p>{bilan.ok} client(s) enregistré(s).{bilan.echecs.length ? ` ${bilan.echecs.length} échec(s) :` : ""}</p>
            {bilan.echecs.length > 0 && <ul className="mt-1 list-disc pl-5">{bilan.echecs.map((e, i) => <li key={i}>{e.nom} — {e.message}. Relancez l'import : seuls les clients non enregistrés seront retentés.</li>)}</ul>}
            {bilan.echecs.length === 0 && <p className="mt-1"><Link to="/clients" className="underline">Voir la liste des clients</Link></p>}
          </section>
        )}
      </div>
    </AppLayout>
  );
}
