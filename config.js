"use strict";

/**
 * Configuration centrale d'ATLAS H-ELIA.
 *
 * Application de contrôle des hydrants :
 * scan du QR code d'un hydrant, saisie du contrôle,
 * enregistrement local puis export vers la liste
 * SharePoint « HEL-Hydrants ».
 */
window.HELIA_CONFIG = Object.freeze({
  application: {
    suiteName: "ATLAS",
    name: "H-ELIA",
    fullName: "ATLAS H-ELIA",
    description: "Contrôle des hydrants",
    version: "1.1.0",
  },

  organisation: {
    name: "HELORA",
  },

  /**
   * Liste SharePoint cible. Les libellés des colonnes
   * sont repris tels quels dans l'export CSV.
   */
  sharePoint: {
    listName: "HEL-Hydrants",
    columns: Object.freeze({
      title: "Titre",
      controlDate: "Date du contrôle",
      status: "Statut",
      hpTest: "Test HP",
      lastHpTestDate: "Date du dernier Test HP",
      comments: "Commentaires",
    }),
  },

  /**
   * Valeurs possibles du champ « Statut ».
   */
  statuses: Object.freeze([
    { value: "OK", label: "OK", hint: "En service", tone: "ok" },
    { value: "HS", label: "HS", hint: "Hors service", tone: "danger" },
    { value: "HSD", label: "HSD", tone: "warning" },
    { value: "HSH", label: "HSH", tone: "warning" },
  ]),

  /**
   * Valeurs possibles du champ « Test HP » (haute pression).
   */
  hpTests: Object.freeze([
    { value: "OK", label: "OK", tone: "ok" },
    { value: "Pas Fait", label: "Pas fait", tone: "neutral" },
    { value: "Nok", label: "Nok", tone: "danger" },
  ]),

  /**
   * Un test haute pression plus ancien que ce délai
   * est signalé comme dépassé.
   */
  hpTestMaxAgeYears: 5,

  /**
   * Délai (en mois) avant l'échéance à partir duquel
   * le test est signalé « à prévoir ».
   */
  hpTestWarningMonths: 6,

  camera: {
    preferredFacingMode: "environment",
    preferredWidth: 1280,
    preferredHeight: 720,
    scanIntervalMs: 160,
  },
});
