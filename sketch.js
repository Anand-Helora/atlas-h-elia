"use strict";

/**
 * Fonction p5.js appelée automatiquement au démarrage.
 */
function setup() {
  try {
    noCanvas();

    window.HeliaUI.initialize("app");

    window.HeliaNavigation.initialize((screen) => {
      window.HeliaUI.renderScreen(screen);
    });

    logApplicationInformation();

    /**
     * Le chargement du modèle est lancé sans bloquer
     * l'affichage de l'application.
     */
    void initializeArtificialIntelligence();
  } catch (error) {
    handleFatalError(error);
  }
}

/**
 * Charge le moteur d'intelligence artificielle.
 */
async function initializeArtificialIntelligence() {
  try {
    const aiState =
      await window.HeliaAI.initialize();

    console.info(
      "Intelligence artificielle prête."
    );

    console.info(
      `Nombre de classes : ${aiState.classCount}`
    );

    console.table(
      aiState.classLabels.map(
        (className, index) => ({
          position: index + 1,
          classe: className,
        })
      )
    );
  } catch (error) {
    /**
     * L'application reste utilisable même si le modèle
     * ne parvient pas encore à se charger.
     */
    console.error(
      "Le modèle IA n'est pas disponible :",
      error
    );
  }
}

/**
 * Affiche les informations de démarrage.
 */
function logApplicationInformation() {
  const config = window.HELIA_CONFIG;

  console.info(
    `${config.application.fullName} — version ${config.application.version}`
  );

  console.info(
    "Application initialisée en mode mobile-first."
  );
}

/**
 * Gestion des erreurs empêchant le lancement.
 *
 * @param {Error} error Erreur détectée.
 */
function handleFatalError(error) {
  console.error(
    "Erreur critique au démarrage de H-ELIA :",
    error
  );

  const appElement =
    document.getElementById("app");

  if (!appElement) {
    return;
  }

  appElement.innerHTML = "";

  const errorPanel =
    document.createElement("div");

  errorPanel.className = "error-panel";
  errorPanel.setAttribute("role", "alert");

  const title =
    document.createElement("strong");

  title.textContent =
    "Impossible de démarrer l'application.";

  const message =
    document.createElement("p");

  message.textContent =
    error?.message ||
    "Une erreur technique est survenue.";

  errorPanel.append(title, message);
  appElement.append(errorPanel);
}