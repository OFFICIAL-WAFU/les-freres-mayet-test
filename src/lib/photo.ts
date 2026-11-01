/** Réduit une photo de l'appareil en JPEG léger (côté navigateur) pour qu'elle tienne dans les limites du rapport. */
import { MAX_PHOTO } from "@/lib/rapports";

export async function compresserPhoto(fichier: File): Promise<string> {
  if (!fichier.type.startsWith("image/")) throw new Error("Ce fichier n’est pas une image.");
  if (fichier.size > 30_000_000) throw new Error("Image trop volumineuse (30 Mo au plus).");
  const bitmap = await createImageBitmap(fichier, { imageOrientation: "from-image" }).catch(() => { throw new Error("Image illisible. Utilisez une photo JPEG ou PNG."); });
  try {
    for (const [cote, qualite] of [[1000, 0.72], [900, 0.62], [800, 0.55], [700, 0.5], [600, 0.45], [500, 0.4]] as const) {
      const echelle = Math.min(1, cote / Math.max(bitmap.width, bitmap.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bitmap.width * echelle)); c.height = Math.max(1, Math.round(bitmap.height * echelle));
      const ctx = c.getContext("2d"); if (!ctx) throw new Error("Traitement d’image indisponible.");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bitmap, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/jpeg", qualite);
      if (url.startsWith("data:image/jpeg;base64,") && url.length <= MAX_PHOTO) return url;
    }
  } finally { bitmap.close(); }
  throw new Error("Impossible de réduire cette photo assez : essayez une autre image.");
}
