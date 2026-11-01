import { useEffect, useState } from "react";
import { lirePdfHistorique } from "@/data/historique";
import { Button } from "@/components/ui/button";
import { LecteurPdfOriginal } from "@/components/LecteurPdfOriginal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function PdfHistoriqueBouton({ chemin, disponible }: { chemin: string; disponible: boolean }) {
  const [url, setUrl] = useState(""); const [erreur, setErreur] = useState(""); const [travail, setTravail] = useState(false);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const nom = chemin.split(/[\\/]/).pop() || "Document.pdf";
  return <div className="min-w-0"><Button variant="outline" size="sm" className="max-w-full" disabled={!disponible || travail} onClick={async () => { setTravail(true); setErreur(""); try { setUrl(URL.createObjectURL(await lirePdfHistorique(chemin))); } catch(e) { setErreur(e instanceof Error ? e.message : "PDF indisponible."); } finally { setTravail(false); } }}>{travail ? "Ouverture…" : /acquitt/i.test(chemin) ? "Consulter le PDF acquitté" : "Consulter le PDF original"}</Button><p className="mt-1 break-all text-xs text-muted-foreground">{nom}</p>{erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
    <Dialog open={!!url} onOpenChange={ouvert => { if (!ouvert) setUrl(""); }}><DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Document Khosmos original</DialogTitle><DialogDescription className="break-all">{nom} · fichier extrait du ZIP conservé sur ce navigateur.</DialogDescription></DialogHeader><div className="flex flex-wrap gap-3"><Button asChild><a href={url} download={nom}>Télécharger ce PDF</a></Button><Button asChild variant="outline"><a href={url} target="_blank" rel="noopener noreferrer">Ouvrir dans un onglet</a></Button></div>{url && <LecteurPdfOriginal url={url} />}</DialogContent></Dialog>
  </div>;
}
