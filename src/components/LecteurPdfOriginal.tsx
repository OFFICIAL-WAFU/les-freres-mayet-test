import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";

export function LecteurPdfOriginal({ url }: { url: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1); const [erreur, setErreur] = useState("");
  const [largeur, setLargeur] = useState(640); const [rendu, setRendu] = useState(false);
  const cadre = useRef<HTMLDivElement>(null); const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let actif = true; let task: PDFDocumentLoadingTask | null = null;
    setDocument(null); setPage(1); setErreur("");
    (async () => {
      const moteur = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      moteur.GlobalWorkerOptions.workerSrc = worker.default;
      const donnees = new Uint8Array(await (await fetch(url)).arrayBuffer());
      if (!actif) return;
      task = moteur.getDocument({ data: donnees });
      const pdf = await task.promise;
      if (actif) setDocument(pdf); else await task.destroy();
    })().catch(e => { if (actif) setErreur(e instanceof Error ? e.message : "Aperçu indisponible. Téléchargez le PDF original."); });
    return () => { actif = false; if (task) void task.destroy(); };
  }, [url]);
  useEffect(() => {
    if (!cadre.current) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setLargeur(Math.max(200, entry.contentRect.width)); });
    observer.observe(cadre.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document || !canvas.current) return;
    let actif = true; let annuler: (() => void) | undefined;
    setRendu(true); setErreur("");
    (async () => {
      const p = await document.getPage(page); if (!actif || !canvas.current) return;
      const normal = p.getViewport({ scale: 1 });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = p.getViewport({ scale: largeur / normal.width * ratio });
      const surface = canvas.current; surface.width = Math.ceil(viewport.width); surface.height = Math.ceil(viewport.height);
      surface.style.width = "100%"; surface.style.height = "auto";
      const task = p.render({ canvas: surface, viewport }); annuler = () => task.cancel();
      await task.promise; if (actif) setRendu(false);
    })().catch(e => { if (actif) { setRendu(false); setErreur(e instanceof Error ? e.message : "Lecture impossible."); } });
    return () => { actif = false; annuler?.(); };
  }, [document, page, largeur]);
  return <div className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><Button variant="outline" size="sm" disabled={!document || page <= 1} onClick={() => setPage(p => p - 1)}>Page précédente</Button><span className="text-sm" aria-live="polite">{document ? `Page ${page} sur ${document.numPages}` : "Chargement du PDF…"}</span><Button variant="outline" size="sm" disabled={!document || page >= document.numPages} onClick={() => setPage(p => p + 1)}>Page suivante</Button></div>
    {erreur && <p role="alert" className="mb-2 text-sm text-destructive">{erreur}</p>}
    <div ref={cadre} className="relative min-h-40 overflow-hidden rounded border bg-white">{rendu && <p className="absolute left-2 top-2 rounded bg-white p-2 text-sm">Lecture de la page…</p>}<canvas ref={canvas} role="img" aria-label={`Page ${page} du PDF original`} className="block w-full" /></div>
  </div>;
}
