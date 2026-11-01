export function dateParis(instant = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const lire = (type: string) => parts.find(p => p.type === type)!.value;
  return `${lire("year")}-${lire("month")}-${lire("day")}`;
}

export function suiviEcheance(echeance: string | undefined, reste: bigint, aujourdHui = dateParis()) {
  if (reste <= 0n) return { etat: "solde", jours: 0, libelle: "Solde à zéro" };
  if (!echeance) return { etat: "absente", jours: 0, libelle: "Échéance non renseignée" };
  const debut = Date.parse(`${echeance}T00:00:00Z`);
  const fin = Date.parse(`${aujourdHui}T00:00:00Z`);
  if (!Number.isFinite(debut) || new Date(debut).toISOString().slice(0,10) !== echeance) return { etat: "absente", jours: 0, libelle: "Échéance à vérifier" };
  const jours = Math.round((fin - debut) / 86400000);
  return jours > 0 ? { etat: "retard", jours, libelle: `En retard de ${jours} jour${jours > 1 ? "s" : ""}` }
    : jours === 0 ? { etat: "aujourdhui", jours: 0, libelle: "À régler aujourd'hui" }
    : { etat: "avenir", jours, libelle: `Échéance le ${echeance.split("-").reverse().join("/")}` };
}
