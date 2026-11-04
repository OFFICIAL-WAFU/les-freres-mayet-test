import { useState } from "react";
import { MentionsInserer } from "@/components/MentionsInserer";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { messageAcompte, TableauAcompte, useCalculAcompte } from "@/components/AcompteDialogue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AcompteRefuse, ConflitDevis, chargerDocuments, enregistrerAcompte, type DocumentAvecDevis } from "@/data/documents";

/** Modification d'un acompte brouillon : pourcentage, dates et remarques ; lignes recalculées par le serveur. */
export function AcompteForm({ doc }: { doc: DocumentAvecDevis }) {
  const d = doc.devis!;
  const navigate = useNavigate();
  const [saisie, setSaisie] = useState(String(doc.pourcentage ?? "").replace(".", ","));
  const [date, setDate] = useState(d.date);
  const [echeance, setEcheance] = useState(d.validite);
  const [remarques, setRemarques] = useState(d.remarques);
  const [conditions, setConditions] = useState(d.conditions ?? "");
  const [notes, setNotes] = useState(d.notes);
  const { pct, parts, erreur } = useCalculAcompte(doc.devisSource!.id, saisie);
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const echeanceInvalide = !!echeance && echeance < date;

  async function enregistrer() {
    if (!pct || !date || echeanceInvalide || enCours || doc.version === undefined) return;
    setEnCours(true);
    setEchec(null);
    try {
      await enregistrerAcompte(doc.id, doc.version, { pourcentage: pct, date, echeance, remarques, notes, conditions });
      toast.success("Acompte brouillon enregistré");
      navigate({ to: "/factures/$id", params: { id: doc.id } });
    } catch (e) {
      if (e instanceof ConflitDevis) setEchec("conflit");
      else setEchec(messageAcompte(e instanceof AcompteRefuse ? e.code : "erreur"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold lg:text-3xl">Modifier l'acompte brouillon</h1>
        <p className="mt-1 text-sm text-muted-foreground">{doc.numero} · issu du devis {doc.devisSource?.reference} · client {d.client.nom} (non modifiable)</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="a-pct">Pourcentage (%)</Label>
          <Input id="a-pct" inputMode="decimal" value={saisie} onChange={(e) => setSaisie(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="a-date">Date</Label>
          <Input id="a-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="a-ech">Échéance </Label>
          <Input id="a-ech" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        </div>
      </div>
      {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
      {echeanceInvalide && <p role="alert" className="text-sm text-destructive">L'échéance ne peut pas être antérieure à la date.</p>}
      {parts && <div className="rounded-xl border border-border p-3"><p className="mb-2 text-sm text-muted-foreground">Lignes recalculées à l'enregistrement</p><TableauAcompte parts={parts} /></div>}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="a-cond">Conditions de paiement </Label>
        <Textarea id="a-cond" value={conditions} onChange={(e) => setConditions(e.target.value)} />
        <MentionsInserer usage="acompte" valeur={conditions} onChange={setConditions}/>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="a-rem">Remarques destinées au client</Label>
        <Textarea id="a-rem" value={remarques} onChange={(e) => setRemarques(e.target.value)} />
        <MentionsInserer usage="acompte" valeur={remarques} onChange={setRemarques}/>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="a-notes">Notes internes (jamais sur le document)</Label>
        <Textarea id="a-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {echec === "conflit" ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-3 text-sm">
          <p>Cet acompte a été modifié ailleurs depuis son ouverture. Vos saisies sont conservées ici ; rechargez la dernière version pour continuer.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => void chargerDocuments()}>Recharger la dernière version</Button>
        </div>
      ) : echec && <p role="alert" className="text-sm text-destructive">{echec}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="action" disabled={enCours || !parts || echeanceInvalide || !date} onClick={() => void enregistrer()}>
          {enCours && <Loader2 className="animate-spin" />}{enCours ? "Enregistrement…" : "Enregistrer l'acompte"}
        </Button>
        <Button asChild variant="outline"><Link to="/factures/$id" params={{ id: doc.id }}>Annuler</Link></Button>
      </div>
    </div>
  );
}
