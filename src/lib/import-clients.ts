// Import de clients depuis un CSV (export préparé depuis Khosmos, ou modèle maison). Pur, testable, sans écriture :
// il lit, valide, et classe chaque ligne (nouveau / doublon probable / invalide). L'écran n'enregistre que ce que l'utilisateur coche.
import type { ClientSaisie, ClientType } from "@/data/clients";

export const MAX_LIGNES = 2000;
export const MAX_OCTETS = 2_000_000;
const MAXLEN = { prenom: 100, nom: 100, raisonSociale: 200, telephone: 40, email: 255, tva: 40, adresse: 200, complement: 200, codePostal: 20, ville: 100, pays: 100, notes: 5000 } as const;

/** CSV (séparateur « ; » ou « , » détecté, guillemets, BOM, retours à la ligne Windows). */
export function lireCsv(texte: string): string[][] {
  const t = texte.replace(/^﻿/, "");
  const entete = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = (entete.match(/;/g)?.length ?? 0) >= (entete.match(/,/g)?.length ?? 0) ? ";" : ",";
  const lignes: string[][] = []; let champ = "", ligne: string[] = [], guillemets = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (guillemets) {
      if (c === '"') { if (t[i + 1] === '"') { champ += '"'; i++; } else guillemets = false; } else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) { ligne.push(champ); champ = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; ligne.push(champ); champ = ""; if (ligne.some((x) => x.trim() !== "")) lignes.push(ligne); ligne = []; }
    else champ += c;
  }
  if (champ !== "" || ligne.length) { ligne.push(champ); if (ligne.some((x) => x.trim() !== "")) lignes.push(ligne); }
  return lignes;
}

export type StatutLigne = "nouveau" | "doublon" | "invalide";
export interface LigneImport {
  numero: number; id: string; client: ClientSaisie; statut: StatutLigne; erreurs: string[]; avertissements: string[]; doublonDe?: string; documents: number;
}
export interface ExistantClient { id: string; type: ClientType; prenom: string; nom: string; raisonSociale: string; email: string; telephone: string }

const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const chiffres = (s: string) => s.replace(/\D/g, "").replace(/^33/, "0");
const cleNom = (c: { type: ClientType; prenom: string; nom: string; raisonSociale: string }) =>
  sansAccent(c.type === "entreprise" ? c.raisonSociale : [...(c.prenom + " " + c.nom).split(/\s+/)].filter(Boolean).sort().join(" "));

const ALIAS: Record<string, string> = {
  type: "type", prenom: "prenom", prénom: "prenom", nom: "nom", raison_sociale: "raisonSociale", "raison sociale": "raisonSociale", societe: "raisonSociale", société: "raisonSociale",
  telephone: "telephone", téléphone: "telephone", tel: "telephone", email: "email", "e-mail": "email", mail: "email", siret: "siret", tva: "tva", "n° tva": "tva",
  adresse: "adresse", complement: "complement", complément: "complement", code_postal: "codePostal", "code postal": "codePostal", cp: "codePostal", ville: "ville", pays: "pays",
  notes: "notes", documents: "documents",
};

export interface ResultatLecture { lignes: LigneImport[]; colonnesIgnorees: string[]; erreur?: string }

export function analyserImportClients(texte: string, existants: ExistantClient[], nouvelId: () => string = () => crypto.randomUUID()): ResultatLecture {
  if (texte.length > MAX_OCTETS) return { lignes: [], colonnesIgnorees: [], erreur: "Fichier trop volumineux (2 Mo maximum)." };
  const l = lireCsv(texte);
  if (l.length < 2) return { lignes: [], colonnesIgnorees: [], erreur: "Le fichier ne contient aucune ligne de client." };
  if (l.length - 1 > MAX_LIGNES) return { lignes: [], colonnesIgnorees: [], erreur: `Trop de lignes (${MAX_LIGNES} maximum).` };
  const cols = l[0]!.map((h) => ALIAS[h.trim().toLowerCase()] ?? "");
  const ignorees = l[0]!.filter((_, i) => !cols[i]).map((h) => h.trim()).filter(Boolean);
  if (!cols.includes("type") && !cols.includes("nom") && !cols.includes("raisonSociale")) return { lignes: [], colonnesIgnorees: ignorees, erreur: "Colonnes non reconnues : le fichier doit contenir au moins « type » et « nom » (ou « raison_sociale »)." };
  const parEmail = new Map(existants.filter((e) => e.email).map((e) => [e.email.trim().toLowerCase(), e.id]));
  const parTel = new Map(existants.filter((e) => chiffres(e.telephone).length >= 9).map((e) => [chiffres(e.telephone), e.id]));
  const parNom = new Map(existants.map((e) => [cleNom(e), e.id]));
  const dansFichier = { email: new Map<string, number>(), nom: new Map<string, number>() };
  const lignes: LigneImport[] = [];
  for (let i = 1; i < l.length; i++) {
    const brut: Record<string, string> = {};
    l[i]!.forEach((v, k) => { const c = cols[k]; if (c) brut[c] = v.trim(); });
    const erreurs: string[] = [], avert: string[] = [];
    const type: ClientType = (brut["type"] ?? "").toLowerCase().startsWith("entr") ? "entreprise" : "particulier";
    if (brut["type"] && !/^(particulier|entreprise)$/i.test(brut["type"])) erreurs.push(`Type « ${brut["type"]} » inconnu (particulier ou entreprise).`);
    const c: ClientSaisie = {
      type, prenom: type === "particulier" ? brut["prenom"] ?? "" : "", nom: brut["nom"] ?? "", raisonSociale: type === "entreprise" ? brut["raisonSociale"] ?? "" : "",
      telephone: brut["telephone"] ?? "", email: (brut["email"] ?? "").toLowerCase(), siret: type === "entreprise" ? (brut["siret"] ?? "").replace(/\s/g, "") : "", tva: type === "entreprise" ? brut["tva"] ?? "" : "",
      adresse: brut["adresse"] ?? "", complement: brut["complement"] ?? "", codePostal: brut["codePostal"] ?? "", ville: brut["ville"] ?? "", pays: brut["pays"] || "France", notes: brut["notes"] ?? "",
    };
    if (type === "particulier" && !c.nom) erreurs.push("Nom manquant.");
    if (type === "entreprise" && !c.raisonSociale) erreurs.push("Raison sociale manquante.");
    if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) erreurs.push("E-mail invalide.");
    if (c.siret && !/^\d{14}$/.test(c.siret)) erreurs.push("SIRET invalide (14 chiffres).");
    for (const [k, max] of Object.entries(MAXLEN)) if ((c[k as keyof ClientSaisie] as string).length > max) erreurs.push(`Champ « ${k} » trop long (${max} caractères maximum).`);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(Object.values(c).join(""))) erreurs.push("Caractères de contrôle interdits.");
    if (c.codePostal && !/^\d{5}$/.test(c.codePostal)) avert.push("Code postal inhabituel.");
    if (!c.email) avert.push("E-mail absent.");
    let statut: StatutLigne = erreurs.length ? "invalide" : "nouveau"; let doublonDe: string | undefined;
    if (!erreurs.length) {
      const nom = cleNom(c);
      doublonDe = (c.email && parEmail.get(c.email)) || (chiffres(c.telephone).length >= 9 ? parTel.get(chiffres(c.telephone)) : undefined) || parNom.get(nom);
      if (doublonDe) { statut = "doublon"; avert.push("Ressemble à un client déjà enregistré (e-mail, téléphone ou nom identique)."); }
      const e = c.email && dansFichier.email.get(c.email), n = dansFichier.nom.get(nom);
      if (e || n) { avert.push(`Apparaît déjà à la ligne ${(e || n)! + 1} du fichier.`); if (statut === "nouveau") statut = "doublon"; }
      if (c.email) dansFichier.email.set(c.email, dansFichier.email.get(c.email) ?? i);
      dansFichier.nom.set(nom, dansFichier.nom.get(nom) ?? i);
    }
    lignes.push({ numero: i + 1, id: nouvelId(), client: c, statut, erreurs, avertissements: avert, ...(doublonDe ? { doublonDe } : {}), documents: Number(brut["documents"]) || 0 });
  }
  return { lignes, colonnesIgnorees: ignorees };
}
