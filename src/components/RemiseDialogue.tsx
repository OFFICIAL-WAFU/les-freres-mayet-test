import { Fragment, useState } from "react";
import { BadgePercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { estLigneRemise, formaterCentimes, labelTaux, nouvelleCle, type LigneSaisie } from "@/data/devis";
import { analyserValeurRemise, appliquerRemise, calculerRemise, retirerRemise, type ModeRemise } from "@/lib/remise";

const MODES: { v: ModeRemise; label: string; aide: string }[] = [
  { v: "pourcent", label: "%", aide: "Pourcentage" },
  { v: "ht", label: "€ HT", aide: "Montant hors taxes" },
  { v: "ttc", label: "€ TTC", aide: "Montant TTC (ce que le client paie en moins)" },
];

/** Bouton + fenêtre « Remise » de l'éditeur de facture : ajoute, remplace ou retire les lignes « REMISE ». */
export function RemiseDialogue({ lignes, onChange }: { lignes: LigneSaisie[]; onChange: (l: LigneSaisie[]) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<ModeRemise>("pourcent");
  const [texte, setTexte] = useState("");
  const [motif, setMotif] = useState("");
  const existe = lignes.some(estLigneRemise);
  const valeur = analyserValeurRemise(texte);
  const calcul = valeur === null ? null : calculerRemise(lignes, mode, valeur);

  function valider() {
    if (valeur === null || !calcul || typeof calcul === "string") return;
    onChange(appliquerRemise(lignes, calcul, mode, valeur, motif, nouvelleCle));
    setOuvert(false);
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOuvert(true)}>
        <BadgePercent /> {existe ? "Modifier la remise" : "Ajouter une remise"}
      </Button>
      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remise sur la facture</DialogTitle>
            <DialogDescription>Elle s’ajoute en bas de la facture sous forme de ligne « REMISE », TVA répartie automatiquement.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div role="radiogroup" aria-label="Type de remise" className="grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <Button key={m.v} type="button" role="radio" aria-checked={mode === m.v} title={m.aide}
                  variant={mode === m.v ? "default" : "outline"} onClick={() => setMode(m.v)}>{m.label}</Button>
              ))}
            </div>
            <div>
              <Label htmlFor="remise-valeur">{mode === "pourcent" ? "Pourcentage de remise" : mode === "ht" ? "Montant de la remise (HT)" : "Montant de la remise (TTC)"}</Label>
              <Input id="remise-valeur" inputMode="decimal" autoFocus value={texte} placeholder={mode === "pourcent" ? "10" : "50,00"}
                onChange={(e) => setTexte(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); valider(); } }} />
            </div>
            <div>
              <Label htmlFor="remise-motif">Motif (facultatif, visible par le client)</Label>
              <Input id="remise-motif" value={motif} maxLength={200} placeholder="Geste commercial" onChange={(e) => setMotif(e.target.value)} />
            </div>
            {texte.trim() && valeur === null && <p role="alert" className="text-sm text-destructive">Saisissez un nombre (deux décimales au plus).</p>}
            {typeof calcul === "string" && <p role="alert" className="text-sm text-destructive">{calcul}</p>}
            {calcul && typeof calcul !== "string" && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-border bg-secondary/30 p-3 text-sm" aria-live="polite">
                <dt>Total avant remise</dt><dd className="text-right">{formaterCentimes(calcul.baseHt)} HT</dd>
                <dt>Remise</dt><dd className="text-right">{formaterCentimes(-calcul.remiseHt)} HT</dd>
                {calcul.parts.length > 1 && calcul.parts.map((p) => (
                  <Fragment key={p.taux}><dt className="pl-3 text-muted-foreground">dont TVA {labelTaux(p.taux)}</dt><dd className="text-right text-muted-foreground">{formaterCentimes(-p.remiseHt)} HT</dd></Fragment>
                ))}
                <dt className="font-semibold">Net à payer</dt><dd className="text-right font-semibold">{formaterCentimes(calcul.netHt)} HT · {formaterCentimes(calcul.netTtc)} TTC</dd>
                <dt className="text-muted-foreground">Le client économise</dt><dd className="text-right text-muted-foreground">{formaterCentimes(calcul.remiseTtc)} TTC</dd>
              </dl>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {existe ? <Button type="button" variant="ghost" onClick={() => { onChange(retirerRemise(lignes)); setOuvert(false); }}>Retirer la remise</Button> : <span />}
            <Button type="button" onClick={valider} disabled={!calcul || typeof calcul === "string"}>{existe ? "Remplacer la remise" : "Ajouter la remise"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
