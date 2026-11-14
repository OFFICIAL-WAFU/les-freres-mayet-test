import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { chercherAdresses, type SuggestionAdresse } from "@/lib/adresse";

/**
 * Champ « Adresse » avec suggestions (Base Adresse Nationale). Taper « 12 rue des pins jard » propose les adresses ;
 * en choisir une remplit aussi le code postal et la ville. On peut toujours ignorer les suggestions et taper librement.
 */
export function AdresseAutocomplete({ id, value, onChange, onChoix, ...rest }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onChoix: (s: SuggestionAdresse) => void;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "id">) {
  const [liste, setListe] = useState<SuggestionAdresse[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const tape = useRef(false);
  const idListe = useId();

  useEffect(() => {
    if (!tape.current) return; // pas de recherche à l'ouverture d'une fiche existante
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      void chercherAdresses(value, ctrl.signal).then((s) => { if (!ctrl.signal.aborted) { setListe(s); setActif(-1); setOuvert(s.length > 0); } });
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value]);

  function choisir(s: SuggestionAdresse) {
    tape.current = false;
    onChoix(s);
    setOuvert(false); setListe([]);
  }

  return (
    <div className="relative">
      <Input
        {...rest}
        id={id}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={idListe}
        aria-autocomplete="list"
        aria-activedescendant={ouvert && actif >= 0 ? `${idListe}-${actif}` : undefined}
        onChange={(e) => { tape.current = true; onChange(e.target.value); }}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        onFocus={() => { if (liste.length) setOuvert(true); }}
        onKeyDown={(e) => {
          if (!ouvert || !liste.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActif((a) => (a + 1) % liste.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActif((a) => (a <= 0 ? liste.length - 1 : a - 1)); }
          else if (e.key === "Enter" && actif >= 0) { e.preventDefault(); choisir(liste[actif]!); }
          else if (e.key === "Escape") setOuvert(false);
        }}
      />
      {ouvert && (
        <ul id={idListe} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
          {liste.map((s, i) => (
            <li key={s.libelle} id={`${idListe}-${i}`} role="option" aria-selected={i === actif}>
              <button type="button" className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary ${i === actif ? "bg-secondary" : ""}`}
                onMouseDown={(e) => e.preventDefault()} onClick={() => choisir(s)}>
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span><span className="font-medium">{s.adresse}</span><span className="block text-xs text-muted-foreground">{s.codePostal} {s.ville}{s.contexte ? ` · ${s.contexte}` : ""}</span></span>
              </button>
            </li>
          ))}
          <li className="px-3 pb-1 pt-2 text-[11px] text-muted-foreground">Adresses : Base Adresse Nationale (IGN)</li>
        </ul>
      )}
    </div>
  );
}
