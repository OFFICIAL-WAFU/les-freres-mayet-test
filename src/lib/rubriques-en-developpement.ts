/** Rubriques réservées : aucune action métier ni intégration simulée. */
export const RUBRIQUES_EN_DEVELOPPEMENT = {
  rapports: { titre: "Rapports d’intervention", description: "Le compte rendu de vos interventions.", elements: ["Création d’un rapport d’intervention", "Photos et pièces jointes", "Signature sur place", "PDF du rapport"] },
  messages: { titre: "Messages par défaut", description: "Les textes utilisés lors de l’envoi de documents.", elements: ["Devis non signé et devis signé", "Facture et facture acquittée", "Facture d’avoir", "Rapport d’intervention", "Demande d’avis par SMS"] },
  personnalisation: { titre: "Personnalisation", description: "L’apparence de vos documents commerciaux.", elements: ["Couleur des tableaux et des titres", "Logo de l’entreprise", "Aperçu du gabarit"] },
  mentions: { titre: "Mentions", description: "Les textes de fin de documents et leurs réglages par défaut.", elements: ["Bibliothèque des mentions", "Mentions par défaut sur les devis", "Mentions par défaut sur les factures", "Insertion de la date et de l’heure"] },
  services: { titre: "Services", description: "Les services complémentaires de votre espace de facturation.", elements: ["Signature à distance et preuve de signature", "Envoi de documents par e-mail avec pièces jointes", "Relances automatiques et historique des envois", "Demandes d’avis clients"] },
  equipe: { titre: "Mon équipe", description: "Les collaborateurs et leurs droits dans votre entreprise.", elements: ["Invitation des collaborateurs", "Rôles et permissions", "Accès comptable", "Suivi des documents par auteur"] },
  notifications: { titre: "Notifications", description: "Les événements importants de vos documents.", elements: ["Document consulté par le client", "Signature reçue", "Échéance et rappel", "Centre de notifications"] },
  aide: { titre: "Aide", description: "L’accompagnement pour utiliser votre application.", elements: ["Guide des parcours", "Centre d’aide", "Assistance"] },
  fournisseurs: { titre: "Fournisseurs", description: "Les achats et tarifs fournisseurs.", elements: ["Connexion au catalogue REXEL par API", "Prix d’achat de votre compte fournisseur", "Disponibilités et commandes", "Comparaison des tarifs"] },
  tresorerie: { titre: "Trésorerie", description: "Une vision des entrées et sorties prévues.", elements: ["Charges et dépenses", "Prévision de trésorerie", "Rapprochement bancaire"] },
  facture: { titre: "Facture sans devis", description: "La création directe d’une facture sera disponible après validation et installation du mécanisme de sauvegarde.", elements: ["Création directe depuis un client", "Enregistrement du brouillon sans devis d’origine"] },
} as const;
export type RubriqueEnDeveloppement = keyof typeof RUBRIQUES_EN_DEVELOPPEMENT;
