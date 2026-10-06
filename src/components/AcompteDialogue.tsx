import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formaterCentimes, labelTaux, type TauxTVA } from "@/data/devis";
import { AcompteRefuse, analyserPourcentage, calculerAcompte, preparerAcompte, type PartAcompte } from "@/data/documents";

const MSGS = {
  pourcentage_invalide: "Indiquez un pourcentage supérieur à 0 et inférieur à 100, avec deux décimales au plus.",
  acompte_nul: "Avec ce pourcentage, l'acompte serait nul après arrondi.",
  facture_deja_finalisee: "La facture de ce devis est déjà finalisée : un acompte ne peut plus être préparé.",
  devis_non_finalise: "Le devis doit être finalisé.",
  erreur: "L'acompte n'a pas pu être préparé. Le devis est inchangé ; vous pouvez réessayer sans risque de doublon.",
};
export const messageAcompte = (code: string): string => (MSGS as Record<string, string>)[code] ?? MSGS.erreur;

/** Tableau des parts d'acompte par taux de TVA, tel que calculé par le serveur. */
export function TableauAcompte({ parts }: { parts: PartAcompte[] }) {
  const t = parts.reduce((a, p) => ({ ht: a.ht + p.ht, tva: a.tva + p.tva, ttc: a.ttc + p.ttc }), { ht: 0, tva: 0, ttc: 0 });
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground"><th className="font-normal">TVA</th><th className="text-right font-normal">Base devis</th><th className="text-right font-normal">HT</th><th className="text-right font-normal">TVA</th><th className="text-right font-normal">TTC</th></tr></thead>
      <tbody>
        {parts.map((p) => (
          <tr key={p.taux}><td>{labelTaux(p.taux as TauxTVA)}</td><td className="text-right">{formaterCentimes(BigInt(p.base_devis))}</td><td className="text-right">{formaterCentimes(BigInt(p.ht))}</td><td className="text-right">{formaterCentimes(BigInt(p.tva))}</td><td className="text-right">{formaterCentimes(BigInt(p.ttc))}</td></tr>
        ))}
        <tr className="border-t border-border font-semibold"><td colSpan={2}>Total acompte</td><td className="text-right">{formaterCentimes(BigInt(t.ht))}</td><td className="text-right">{formaterCentimes(BigInt(t.tva))}</td><td className="text-right">{formaterCentimes(BigInt(t.ttc))}</td></tr>
      </tbody>
    </table>
  );
}

/** Calcule (côté serveur) les parts d'un pourcentage saisi, avec un léger délai. */
export function useCalculAcompte(devisId: string, saisie: string) {
  const [parts, setParts] = useState<PartAcompte[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [calcul, setCalcul] = useState(false);
  const pct = analyserPourcentage(saisie);
  useEffect(() => {
    setParts(null);
    if (!pct) { setErreur(saisie.trim() ? MSGS.pourcentage_invalide : null); return; }
    setErreur(null);
    let actif = true;
    setCalcul(true);
    const t = setTimeout(() => {
      calculerAcompte(devisId, pct)
        .then((r) => { if (!actif) return; if (r.reduce((a, p) => a + p.ttc, 0) <= 0) setErreur(MSGS.acompte_nul); else setParts(r); })
        .catch((e) => { if (actif) setErreur(messageAcompte(e instanceof AcompteRefuse ? e.code : "erreur")); })
        .finally(() => { if (actif) setCalcul(false); });
    }, 300);
    return () => { actif = false; clearTimeout(t); };
  }, [devisId, pct, saisie]);
  return { pct, parts, erreur, calcul };
}

export function AcompteDialogue({ devisId, devisRef, onFermer, onCree }: { devisId: string; devisRef: string; onFermer: () => void; onCree: (id: string) => void }) {
  const [saisie, setSaisie] = useState("30");
  const { pct, parts, erreur, calcul } = useCalculAcompte(devisId, saisie);
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);

  async function creer() {
    if (!pct || !parts || enCours) return;
    setEnCours(true);
    setEchec(null);
    try {
      const doc = await preparerAcompte(devisId, pct);
      onCree(doc.id);
    } catch (e) {
      setEchec(messageAcompte(e instanceof AcompteRefuse ? e.code : "erreur"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Préparer un acompte</AlertDialogTitle>
          <AlertDialogDescription>
            Facture d'acompte brouillon sur le devis {devisRef}. Aucun document ne sera émis ni envoyé.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acompte-pct">Pourcentage de l'acompte (%)</Label>
            <Input id="acompte-pct" inputMode="decimal" value={saisie} onChange={(e) => setSaisie(e.target.value)} className="max-w-32" />
          </div>
          {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
          {calcul && !erreur && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Calcul…</p>}
          {parts && (
            <div className="rounded-xl border border-border p-3">
              <p className="mb-2 text-sm">Devis {devisRef} · acompte de {pct?.replace(".", ",")} %</p>
              <TableauAcompte parts={parts} />
            </div>
          )}
          {echec && <p role="alert" className="text-sm text-destructive">{echec}</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enCours} onClick={onFermer}>Annuler</AlertDialogCancel>
          <Button variant="action" disabled={enCours || !parts} aria-busy={enCours} onClick={() => void creer()}>
            {enCours && <Loader2 className="animate-spin" />}{enCours ? "Préparation…" : "Préparer l'acompte brouillon"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
