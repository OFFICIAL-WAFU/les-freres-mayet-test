import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { lireMentions } from "@/data/mentions";
import { insererMentions, USAGES_MENTIONS, type Mention, type UsageMention } from "@/lib/mentions";

export function MentionsInserer({ usage, valeur, onChange }: {usage: UsageMention; valeur: string; onChange: (v: string) => void}) {
  const id = useId();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [ouverte, setOuverte] = useState(false);
  const [choix, setChoix] = useState("");
  const [etat, setEtat] = useState("inactif");
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    if (!ouverte) return;
    let actif = true; setEtat("chargement"); setErreur("");
    void lireMentions().then(b => { if (actif) { setMentions(b.mentions.filter(m => !m.archivee)); setEtat("pret"); } })
      .catch(e => { if (actif) { setErreur(e.message); setEtat("erreur"); } });
    return () => { actif = false; };
  }, [ouverte]);
  function inserer(liste: Mention[]) {
    try { onChange(insererMentions(valeur, liste)); setErreur(""); } catch (e) { setErreur(e instanceof Error ? e.message : "Insertion impossible."); }
  }
  const defaut = mentions.filter(m => m.usages.includes(usage));
  return <div className="text-sm">
    <Button type="button" size="sm" variant="outline" onClick={() => setOuverte(x => !x)}>{ouverte ? "Fermer la bibliothèque" : "Insérer une mention"}</Button>
    {ouverte && <div className="mt-2 rounded-xl border bg-secondary/30 p-3">
      {etat === "chargement" ? <p role="status">Chargement des mentions…</p> : etat === "pret" && !mentions.length ? <p>Votre bibliothèque est vide. Ajoutez vos textes dans la rubrique Mentions.</p> : etat === "pret" && <>
        <label className="block font-medium" htmlFor={id}>Mention à insérer</label>
        <select id={id} className="mt-2 w-full rounded-lg border bg-background p-2" value={choix} onChange={e => setChoix(e.target.value)}>
          <option value="">Choisir une mention…</option>{mentions.map(m => <option key={m.id} value={m.id}>{m.titre}</option>)}
        </select>
        {choix && <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-muted-foreground">{mentions.find(m => m.id === choix)?.texte}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={!mentions.some(m => m.id === choix)} onClick={() => inserer(mentions.filter(m => m.id === choix))}>Ajouter au texte</Button>
          {defaut.length > 0 && <Button type="button" size="sm" variant="outline" className="h-auto max-w-full whitespace-normal py-2" onClick={() => inserer(defaut)}>Insérer les {defaut.length} mentions prévues pour {USAGES_MENTIONS[usage].toLowerCase()}</Button>}
        </div><p className="mt-2 text-xs text-muted-foreground">Les mentions ajoutées sont des copies modifiables. Enregistrez ensuite le document.</p>
      </>}
      {erreur && <p role="alert" className="mt-2 text-destructive">{erreur}</p>}
      {etat === "erreur" && <Button type="button" size="sm" variant="outline" onClick={() => {setOuverte(false);}}>Fermer et réessayer</Button>}
    </div>}
  </div>;
}
