import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { SignatureCadre, type SignatureCadreRef } from "@/components/SignatureCadre";
import { Button } from "@/components/ui/button";
import { uniteAccordee } from "@/data/catalogue";
import { lireDevisPourSignature, signerDevisDistant } from "@/data/signature-distante";
import { euros, jetonValide, messageErreurSignature, quantite, type LectureSignature } from "@/lib/signature-distante";

export const Route = createFileRoute("/signer/$jeton")({
  head: () => ({ meta: [{ title: "Signature de votre devis" }, { name: "robots", content: "noindex,nofollow" }, { name: "referrer", content: "no-referrer" }] }),
  component: Page,
});

const fr = (iso: string) => iso.split("-").reverse().join("/");
const frHeure = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });

function Coque({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background"><main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">{children}</main></div>;
}
function Message({ titre, texte }: { titre: string; texte: string }) {
  return <Coque><div className="rounded-2xl border bg-card p-6" role="status"><h1 className="text-xl font-semibold">{titre}</h1><p className="mt-2 text-sm text-muted-foreground">{texte}</p></div></Coque>;
}

function Page() {
  const { jeton } = Route.useParams();
  const [lecture, setLecture] = useState<LectureSignature | null>(null);
  const [erreurChargement, setErreurChargement] = useState("");
  const [nom, setNom] = useState("");
  const [accord, setAccord] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState<{ empreinte: string; signeLe: string } | null>(null);
  const cadre = useRef<SignatureCadreRef>(null);

  useEffect(() => {
    if (!jetonValide(jeton)) { setLecture({ etat: "introuvable" }); return; }
    let actif = true;
    lireDevisPourSignature(jeton).then(l => { if (actif) setLecture(l); }).catch(e => { if (actif) setErreurChargement(e instanceof Error ? e.message : "Chargement impossible."); });
    return () => { actif = false; };
  }, [jeton]);

  if (erreurChargement) return <Message titre="Chargement impossible" texte={erreurChargement} />;
  if (!lecture) return <Coque><div className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-5 animate-spin" aria-hidden />Chargement du devis…</div></Coque>;
  if (!("devis" in lecture)) {
    if (lecture.etat === "revoque") return <Message titre="Lien désactivé" texte="Ce lien a été désactivé par l’entreprise. Contactez-la pour en obtenir un nouveau." />;
    if (lecture.etat === "expire") return <Message titre="Lien expiré" texte="Ce lien n’est plus valable. Contactez l’entreprise pour en obtenir un nouveau." />;
    return <Message titre="Lien non valide" texte="Ce lien n’est pas valide. Vérifiez que vous avez copié l’adresse en entier, ou contactez l’entreprise." />;
  }
  const d = lecture.devis, e = d.entreprise;
  const signe = lecture.etat === "signe" || !!fait;
  const signer = async () => {
    setErreur("");
    const image = cadre.current?.exporter() ?? null;
    if (!accord) { setErreur(messageErreurSignature("accord_requis")); return; }
    if (nom.trim().length < 2) { setErreur(messageErreurSignature("nom_invalide")); return; }
    if (!image) { setErreur(messageErreurSignature("image_invalide")); return; }
    setEnvoi(true);
    try { setFait(await signerDevisDistant(jeton, nom.trim(), image, true)); }
    catch (er) { setErreur(messageErreurSignature(er instanceof Error ? er.message : "")); } finally { setEnvoi(false); }
  };

  return <Coque>
    <header className="rounded-2xl border bg-card p-5">
      <p className="text-sm font-semibold">{e.nom_commercial || e.raison_sociale}</p>
      <p className="text-xs text-muted-foreground">{[e.adresse, [e.code_postal, e.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ")}{e.telephone ? ` · ${e.telephone}` : ""}{e.email ? ` · ${e.email}` : ""}</p>
      <h1 className="mt-4 text-2xl font-semibold">Devis {d.reference}</h1>
      <p className="text-sm text-muted-foreground">{d.objet}</p>
      <p className="mt-2 text-sm">Pour : <span className="font-medium">{d.client.nom}</span>{d.client.adresse.length ? ` · ${d.client.adresse.join(", ")}` : ""}</p>
      <p className="text-sm text-muted-foreground">Émis le {fr(d.date_devis)}{d.date_validite ? ` · valable jusqu’au ${fr(d.date_validite)}` : ""}</p>
    </header>

    <section className="mt-4 rounded-2xl border bg-card p-5" aria-label="Détail du devis">
      <h2 className="font-semibold">Détail</h2>
      <ul className="mt-2 divide-y">{d.lignes.map(l => <li key={l.position} className="py-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><span className="min-w-0 break-words font-medium">{l.designation}</span><span className="shrink-0 font-medium">{euros(l.ttc_centimes)} TTC</span></div>
        {l.description && <p className="whitespace-pre-line break-words text-muted-foreground">{l.description}</p>}
        <p className="text-xs text-muted-foreground">{quantite(l.quantite_milliemes)}{l.unite ? ` ${uniteAccordee(l.unite, l.quantite_milliemes / 1000)}` : ""} × {euros(l.prix_ht_centimes)} HT · TVA {(l.taux_tva_milliemes / 10).toString().replace(".", ",")} %</p>
      </li>)}</ul>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t pt-3 text-sm"><dt>Total HT</dt><dd className="text-right">{euros(d.total_ht_centimes)}</dd><dt>TVA</dt><dd className="text-right">{euros(d.total_tva_centimes)}</dd><dt className="font-semibold">Total TTC</dt><dd className="text-right text-base font-semibold">{euros(d.total_ttc_centimes)}</dd></dl>
      {d.conditions_paiement.trim() && <><h3 className="mt-4 text-sm font-semibold">Conditions de paiement</h3><p className="whitespace-pre-line break-words text-sm">{d.conditions_paiement}</p></>}
      {d.remarques.trim() && <><h3 className="mt-4 text-sm font-semibold">Remarques</h3><p className="whitespace-pre-line break-words text-sm">{d.remarques}</p></>}
    </section>

    {signe ? <section className="mt-4 rounded-2xl border border-emerald-600/40 bg-card p-5" role="status">
      <h2 className="text-lg font-semibold">Devis signé, merci</h2>
      <p className="mt-1 text-sm">{fait ? `Votre signature a été enregistrée le ${frHeure(fait.signeLe)}.` : `Signé par ${lecture.signataire_nom ?? "le client"}${lecture.signe_le ? ` le ${frHeure(lecture.signe_le)}` : ""}.`} L’entreprise en est informée dès qu’elle consulte son espace. Conservez cette page ou une capture d’écran.</p>
      <p className="mt-2 break-all text-xs text-muted-foreground">Empreinte du devis signé (SHA-256) : {fait?.empreinte ?? lecture.empreinte}</p>
    </section> : <section className="mt-4 rounded-2xl border bg-card p-5" aria-label="Signer le devis">
      <h2 className="font-semibold">Signer ce devis</h2>
      <label className="mt-3 grid gap-1 text-sm">Votre nom et prénom<input className="rounded-md border bg-background p-2" maxLength={80} autoComplete="name" value={nom} onChange={ev => setNom(ev.target.value)} /></label>
      <p className="mt-3 text-sm">Votre signature (au doigt ou à la souris)</p>
      <div className="mt-1"><SignatureCadre ref={cadre} /></div>
      <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={accord} onChange={ev => setAccord(ev.target.checked)} /><span><strong>Bon pour accord.</strong> J’ai lu le devis ci-dessus ({euros(d.total_ttc_centimes)} TTC) et je l’accepte.</span></label>
      {erreur && <p role="alert" className="mt-3 text-sm text-destructive">{erreur}</p>}
      <Button className="mt-4 w-full sm:w-auto" variant="action" disabled={envoi} onClick={() => void signer()}>{envoi ? "Enregistrement…" : "Signer le devis"}</Button>
      <p className="mt-3 text-xs text-muted-foreground">Signature électronique simple : votre nom, votre tracé, la date et l’heure ainsi que l’empreinte numérique de ce devis sont enregistrés comme preuve. Le devis lui-même ne peut plus être modifié.</p>
    </section>}
    <p className="mt-4 text-center text-xs text-muted-foreground">Empreinte du devis affiché : <span className="break-all">{lecture.empreinte}</span></p>
  </Coque>;
}
