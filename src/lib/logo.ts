// Logo de l'entreprise : redimensionné dans le navigateur (700 px de large au plus), PNG (transparence conservée) ou JPEG.
import { logoValide } from "@/data/entreprise";

export const LARGEUR_LOGO = 700;
export async function logoDepuisFichier(f: File): Promise<string> {
  if (!/^image\/(png|jpeg)$/.test(f.type)) throw new Error("Choisissez une image PNG ou JPEG.");
  if (f.size > 8_000_000) throw new Error("Image trop volumineuse (8 Mo au plus).");
  const bmp = await createImageBitmap(f).catch(() => null);
  if (!bmp) throw new Error("Image illisible.");
  const k = Math.min(1, LARGEUR_LOGO / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Redimensionnement impossible sur cet appareil.");
  const png = f.type === "image/png";
  if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  let url = c.toDataURL(png ? "image/png" : "image/jpeg", 0.9);
  // Un PNG trop lourd est converti en JPEG sur fond blanc plutôt que refusé.
  if (url.length > 200_000 && png) { ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); url = c.toDataURL("image/jpeg", 0.85); }
  if (url.length > 200_000) url = c.toDataURL("image/jpeg", 0.6);
  if (!logoValide(url) || url.length > 200_000) throw new Error("Logo trop lourd même après réduction : choisissez une image plus simple.");
  return url;
}
