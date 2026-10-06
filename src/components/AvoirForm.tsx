import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TotauxAvoir } from "@/components/AvoirDetail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConflitDevis, chargerDocuments, enregistrerAvoir, type DocumentAvecDevis } from "@/data/documents";

/** Modification d'un avoir brouillon : seuls la date, le motif et les remarques changent. */
export function AvoirForm({ doc }: { doc: DocumentAvecDevis }) {
  const d = doc.devis!;
  const navigate = useNavigate();
  const [date, setDate] = useState(d.date);
  const [motif, setMotif] = useState(doc.motif ?? "");
  const [remarques, setRemarques] = useState(d.remarques);
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);

  async function enregistrer() {
    if (enCours || !date || !motif.trim() || doc.version === undefined) return;
    setEnCours(true); setEchec(null);
    try {
      await enregistrerAvoir(doc.id, doc.version, { date, motif, remarques });
      toast.success("Avoir brouillon enregistré");
      navigate({ to: "/avoirs/$id", params: { id: doc.id } });
    } catch (e) {
      setEchec(e instanceof ConflitDevis ? "Cet avoir a été modifié ailleurs. Rechargez la dernière version." : (e as Error).message);
    } finally { setEnCours(false); }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4 text-sm">
      <Button asChild variant="ghost" size="sm" className="self-start"><Link to="/avoirs/$id" params={{ id: doc.id }}>← Retour à l'avoir</Link></Button>
      <h1 className="text-2xl font-semibold">Avoir brouillon {doc.numero}</h1>
      <p className="text-muted-foreground">Sur la facture {doc.factureSource?.reference} · client {d.client.nom}. Les lignes et montants restent ceux de la facture.</p>
      {echec && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-3">
          <p>{echec}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => void chargerDocuments()}>Recharger</Button>
        </div>
      )}
      <label className="flex flex-col gap-1">Date de l'avoir
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
      </label>
      <label className="flex flex-col gap-1">Motif (obligatoire)
        <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={1000} aria-invalid={!motif.trim()} />
        {!motif.trim() && <span className="text-xs text-destructive">Le motif est obligatoire.</span>}
      </label>
      <label className="flex flex-col gap-1">Remarques destinées au client
        <Textarea value={remarques} onChange={(e) => setRemarques(e.target.value)} maxLength={2000} />
      </label>
      <section className="rounded-xl border border-border p-3">
        <h2 className="font-semibold">Total de l'avoir</h2>
        <TotauxAvoir doc={doc} />
      </section>
      <Button variant="action" className="self-start" disabled={enCours || !date || !motif.trim()} onClick={() => void enregistrer()}>
        {enCours && <Loader2 className="animate-spin" />}{enCours ? "Enregistrement…" : "Enregistrer l'avoir brouillon"}
      </Button>
    </div>
  );
}
