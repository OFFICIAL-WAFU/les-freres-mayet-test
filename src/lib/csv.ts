/** Échappe les séparateurs et neutralise les formules lors d'une ouverture dans Excel. */
export function celluleCsv(texte: string): string {
  const nombreNegatif = /^-\d+,\d{2}$/.test(texte);
  const valeur = !nombreNegatif && /^[\s\uFEFF]*[=+@-]/.test(texte) ? `'${texte}` : texte;
  return `"${valeur.replaceAll('"', '""')}"`;
}

export function telechargerFichier(texte: string, nom: string, type: string): void {
  const url = URL.createObjectURL(new Blob([texte], { type }));
  const lien = document.createElement("a"); lien.href = url; lien.download = nom;
  document.body.appendChild(lien); lien.click(); lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
