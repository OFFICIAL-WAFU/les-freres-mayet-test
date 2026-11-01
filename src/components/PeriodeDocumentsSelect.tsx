import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIODES_DOCUMENTS, type PeriodeDocuments } from "@/lib/suivi-clients";

export function PeriodeDocumentsSelect({ value, onChange }: { value: PeriodeDocuments; onChange: (p: PeriodeDocuments) => void }) {
  return <Select value={value} onValueChange={v => onChange(v as PeriodeDocuments)}>
    <SelectTrigger className="h-10 w-full sm:w-48" aria-label="Période des documents"><SelectValue>{PERIODES_DOCUMENTS[value]}</SelectValue></SelectTrigger>
    <SelectContent>{Object.entries(PERIODES_DOCUMENTS).map(([cle, label]) => <SelectItem key={cle} value={cle}>{label}</SelectItem>)}</SelectContent>
  </Select>;
}
