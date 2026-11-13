// Dictée vocale du navigateur (Chrome, Edge, Safari) — 13/11/2026.
// Le texte reconnu s'ajoute à la zone de saisie ; rien n'est envoyé tant que l'utilisateur ne clique pas.
// Corrige la première version : erreurs affichées (micro refusé, pas de micro, pas de réseau, aperçu Lovable),
// texte provisoire visible pendant qu'on parle, redémarrage automatique après un silence (Chrome coupe au bout de quelques secondes).
import { useEffect, useRef, useState } from "react";

type Resultat = { isFinal: boolean; 0: { transcript: string } };
type Reco = {
  lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Resultat> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null;
};

export const MESSAGES_DICTEE: Record<string, string> = {
  "not-allowed": "Le micro est refusé pour ce site. Autorisez-le (icône du cadenas ou réglages du navigateur), ou utilisez le micro du clavier de votre téléphone.",
  "service-not-allowed": "La dictée est bloquée par le navigateur. Utilisez le micro du clavier de votre téléphone.",
  "audio-capture": "Aucun micro n'a été trouvé sur cet appareil.",
  "network": "La dictée du navigateur a besoin d'une connexion internet. Réessayez, ou utilisez le micro du clavier.",
  "language-not-supported": "La dictée en français n'est pas disponible sur ce navigateur. Utilisez le micro du clavier.",
  "iframe": "La dictée ne fonctionne pas dans l'aperçu de Lovable : ouvrez le logiciel directement dans le navigateur (ou l'application installée).",
  "indisponible": "Ce navigateur ne propose pas la dictée. Utilisez le micro du clavier de votre téléphone (touche micro à côté de la barre d'espace).",
  "silence": "Je n'ai rien entendu. Appuyez sur « Dicter » puis parlez normalement.",
};

/** Traduit le code d'erreur du navigateur ; « no-speech » et « aborted » ne sont pas des pannes. */
export function messageErreurDictee(code: string | undefined): string | null {
  if (!code || code === "aborted") return null;
  if (code === "no-speech") return MESSAGES_DICTEE["silence"]!;
  return MESSAGES_DICTEE[code] ?? "La dictée s'est arrêtée. Réessayez, ou utilisez le micro du clavier.";
}

export function useDictee(ajouter: (texte: string) => void) {
  const [actif, setActif] = useState(false);
  const [possible, setPossible] = useState<boolean | null>(null);
  const [provisoire, setProvisoire] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const reco = useRef<Reco | null>(null);
  const voulu = useRef(false), relances = useRef(0), entendu = useRef(false);
  const ajouterRef = useRef(ajouter);
  ajouterRef.current = ajouter;

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setPossible(Boolean(w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]));
    return () => { voulu.current = false; reco.current?.abort(); };
  }, []);

  function lancer() {
    const w = window as unknown as Record<string, new () => Reco>;
    const C = w["SpeechRecognition"] ?? w["webkitSpeechRecognition"];
    if (!C) { setErreur(MESSAGES_DICTEE["indisponible"]!); return; }
    const r = new C();
    r.lang = "fr-FR"; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      let prov = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const x = e.results[i]!;
        const t = x[0].transcript.trim();
        if (!t) continue;
        if (x.isFinal) { entendu.current = true; relances.current = 0; ajouterRef.current(t); } else prov += `${t} `;
      }
      setProvisoire(prov.trim());
    };
    r.onerror = (e) => {
      const m = messageErreurDictee(e.error);
      if (e.error === "no-speech" && voulu.current && relances.current < 3) return; // simple silence : on relance dans onend
      if (m) { voulu.current = false; setErreur(m); }
    };
    r.onend = () => {
      setProvisoire("");
      // Chrome s'arrête seul après un silence : on reprend tant que l'utilisateur n'a pas cliqué sur « Arrêter ».
      if (voulu.current && relances.current < 3) { relances.current++; try { r.start(); return; } catch { /* déjà relancée */ } }
      if (voulu.current && !entendu.current) setErreur(MESSAGES_DICTEE["silence"]!);
      voulu.current = false; setActif(false);
    };
    reco.current = r;
    try { r.start(); } catch { setErreur("Impossible de démarrer la dictée. Réessayez."); voulu.current = false; setActif(false); }
  }

  function demarrer() {
    setErreur(null); setProvisoire("");
    if (window.self !== window.top) { setErreur(MESSAGES_DICTEE["iframe"]!); return; }
    voulu.current = true; relances.current = 0; entendu.current = false; setActif(true);
    lancer();
  }
  function arreter() { voulu.current = false; reco.current?.stop(); setActif(false); setProvisoire(""); }

  return { possible, actif, provisoire, erreur, demarrer, arreter };
}
