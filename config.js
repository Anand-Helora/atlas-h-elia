"use strict";

/**
 * Configuration centrale de l'application ATLAS H-ELIA.
 */
window.HELIA_CONFIG = Object.freeze({
  application: {
    suiteName: "ATLAS",
    prefix: "H",
    moduleName: "ELIA",
    fullName: "ATLAS H-ELIA",
    description: "Évaluation des locaux par intelligence artificielle",
    version: "0.4.0",
  },

  organisation: {
    name: "HELORA",
    logoPath: "",
  },

  theme: {
    brand: {
      darkGreen: "#044550",
      turquoise: "#009E99",
      turquoise50: "#80CFCC",
      turquoise20: "#CCECEB",
      turquoise10: "#E6F5F5",
      orange: "#E16021",
      white: "#FFFFFF",
    },

    colors: {
      primary: "#044550",
      primaryDark: "#033740",
      primaryLight: "#E6F5F5",

      secondary: "#009E99",
      secondaryDark: "#007D79",

      background: "#FFFFFF",
      surface: "#FFFFFF",
      surfaceMuted: "#E6F5F5",

      text: "#044550",
      textMuted: "rgba(4, 69, 80, 0.72)",
      textOnPrimary: "#FFFFFF",

      success: "#287A5A",
      warning: "#E16021",
      danger: "#B3261E",

      border: "#CCECEB",
      focus: "#009E99",
    },
  },

  camera: {
    preferredFacingMode: "environment",
    preferredWidth: 1280,
    preferredHeight: 720,
    preferredFrameRate: 30,
  },

  artificialIntelligence: {
    provider: "teachable-machine",
    modelType: "image",

    modelBaseUrl:
      "https://teachablemachine.withgoogle.com/models/8aRgVfdIA/",

    /**
     * Nombre maximal de propositions affichées.
     */
    displayedPredictions: 3,

    /**
     * Seuil minimal pour considérer une proposition comme exploitable.
     * 0.60 correspond à 60 %.
     */
    minimumConfidence: 0.6,

    /**
     * Temps entre deux analyses.
     * Cela évite de solliciter inutilement le téléphone.
     */
    predictionIntervalMs: 450,

    /**
     * La même classe doit arriver plusieurs fois de suite
     * avant d'être présentée comme résultat stable.
     */
    stablePredictionsRequired: 3,

    /**
     * Ces classes ne seront jamais proposées comme objets.
     * La comparaison ne tient pas compte des majuscules
     * ni des accents.
     */
    ignoredClasses: [
      "Aucun objet",
      "Arrière-plan",
      "Background",
      "Autre",
    ],

    /**
     * Paramètres de la zone réellement transmise à l'IA.
     *
     * Le modèle n'analysera pas toute la caméra :
     * uniquement le centre du cadre.
     */
    crop: {
      outputSize: 224,
      guideWidthRatio: 0.72,
      guideMaxHeightRatio: 0.58,
      aspectRatio: 1,
    },
  },

  interface: {
    minimumTouchSize: 48,
    showVersion: true,
  },

  development: {
    debugMode: true,
  },
});