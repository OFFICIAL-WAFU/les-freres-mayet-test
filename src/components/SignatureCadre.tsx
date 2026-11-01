import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type SignatureCadreRef = { exporter: () => string | null; effacer: () => void };

/** Zone de signature au doigt ou à la souris. Exporte une image PNG ; renvoie null si rien n'a été tracé. */
export const SignatureCadre = forwardRef<SignatureCadreRef>(function SignatureCadre(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const trace = useRef(false);
  const [vide, setVide] = useState(true);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!, r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const debut = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvas.current?.getContext("2d"); if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    trace.current = true; const p = point(e);
    ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1f2328";
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke(); setVide(false);
  };
  const deplace = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!trace.current) return;
    const ctx = canvas.current?.getContext("2d"); if (!ctx) return;
    const p = point(e); ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const fin = () => { trace.current = false; };
  const effacer = useCallback(() => {
    const c = canvas.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); setVide(true);
  }, []);
  useImperativeHandle(ref, () => ({
    exporter: () => (vide || !canvas.current ? null : canvas.current.toDataURL("image/png")),
    effacer,
  }), [vide, effacer]);

  return <div>
    <canvas ref={canvas} width={720} height={240} aria-label="Zone de signature du client" role="img"
      className="h-40 w-full touch-none rounded-md border bg-white sm:h-48" style={{ touchAction: "none" }}
      onPointerDown={debut} onPointerMove={deplace} onPointerUp={fin} onPointerCancel={fin} onPointerLeave={fin} />
    <div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{vide ? "Le client signe dans le cadre ci-dessus." : "Signature saisie."}</p><Button type="button" size="sm" variant="outline" onClick={effacer} disabled={vide}>Effacer</Button></div>
  </div>;
});
