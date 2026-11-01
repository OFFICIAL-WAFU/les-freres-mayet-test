import { unzip } from "fflate";
import { analyserSourcesKhosmos, type SourceKhosmos } from "./khosmos";

const MAX_FILE = 64 * 1024 * 1024;
const MAX_TOTAL = 750 * 1024 * 1024;
export async function analyserDossierKhosmos(files: File[], progress: (fait: number, total: number, nom: string) => void, signal: AbortSignal) {
  const inputs: { path: string; data: Uint8Array }[] = [];
  let size = 0;
  const aborted = () => { if (signal.aborted) throw new Error("Analyse annulée."); };
  const add = (path: string, data: Uint8Array) => {
    if (data.byteLength > MAX_FILE) throw new Error(`Fichier trop volumineux : ${path} (maximum 64 Mo).`);
    size += data.byteLength;
    if (size > MAX_TOTAL || inputs.length >= 3000) throw new Error("Dossier trop volumineux (maximum 750 Mo décompressés ou 3 000 fichiers).");
    inputs.push({ path, data });
  };
  if (files.reduce((s, f) => s + f.size, 0) > MAX_TOTAL) throw new Error("Sélection trop volumineuse (maximum 750 Mo).");
  for (const file of files) {
    aborted(); progress(0, 0, `Ouverture de ${file.name}`);
    const data = new Uint8Array(await file.arrayBuffer());
    if (/\.zip$/i.test(file.name)) {
      let declared = 0; let count = 0; let rejected = "";
      const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
        const terminate = unzip(data, { filter: info => {
          if (info.name.endsWith("/")) return false;
          declared += info.originalSize; count++;
          if (info.originalSize > MAX_FILE || declared > MAX_TOTAL || count > 3000) { rejected = "Archive trop volumineuse après décompression."; return false; }
          return /\.(pdf|csv)$/i.test(info.name);
        } }, (err, value) => { signal.removeEventListener("abort", stop); if (err) reject(err); else if (rejected) reject(new Error(rejected)); else resolve(value); });
        const stop = () => { terminate(); reject(new Error("Analyse annulée.")); };
        signal.addEventListener("abort", stop, { once: true });
        if (signal.aborted) stop();
      });
      for (const [path, bytes] of Object.entries(entries)) add(path, bytes);
    } else if (/\.(pdf|csv)$/i.test(file.name)) add(file.webkitRelativePath || file.name, data);
    else throw new Error(`Format non pris en charge : ${file.name}. Sélectionnez ZIP, PDF ou CSV.`);
  }
  if (!inputs.length) throw new Error("Aucun PDF ni CSV trouvé dans la sélection.");
  // Load only after a selection, keeping ordinary invoicing pages light.
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const sources: SourceKhosmos[] = [];
  const texts = new Map<string, Pick<SourceKhosmos, "text" | "pages" | "error">>();
  for (let i = 0; i < inputs.length; i++) {
    aborted(); const input = inputs[i]!; progress(i, inputs.length, input.path);
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", input.data as Uint8Array<ArrayBuffer>))].map(x => x.toString(16).padStart(2, "0")).join("");
    const previous = texts.get(hash);
    if (previous) { sources.push({ path: input.path, hash, ...previous }); continue; }
    const source: SourceKhosmos = { path: input.path, hash, text: "" };
    try {
      if (/\.csv$/i.test(input.path)) {
        try { source.text = new TextDecoder("utf-8", { fatal: true }).decode(input.data); }
        catch { source.text = new TextDecoder("windows-1252").decode(input.data); }
      } else {
        const task = pdfjs.getDocument({ data: input.data.slice() });
        const cancelPdf = () => { void task.destroy(); };
        signal.addEventListener("abort", cancelPdf, { once: true });
        try {
          const pdf = await task.promise; source.pages = pdf.numPages;
          if (pdf.numPages > 500) throw new Error("PDF de plus de 500 pages : analyse non prise en charge.");
          const pages: string[] = [];
          for (let n = 1; n <= pdf.numPages; n++) {
            aborted(); const page = await pdf.getPage(n); const content = await page.getTextContent();
            pages.push(content.items.map(item => "str" in item ? item.str : "").join(" "));
            page.cleanup();
          }
          source.text = pages.join("\n");
        } finally { signal.removeEventListener("abort", cancelPdf); await task.destroy(); }
      }
    } catch (e) { aborted(); source.error = e instanceof Error ? e.message : "Fichier illisible"; }
    texts.set(hash, source); sources.push(source);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  aborted(); progress(inputs.length, inputs.length, "Rapprochement des documents");
  return analyserSourcesKhosmos(sources);
}
