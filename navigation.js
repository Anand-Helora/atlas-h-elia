"use strict";

/**
 * Liste des écrans disponibles dans l'application.
 */
window.HELIA_SCREENS = Object.freeze({
  HOME: "home",
  LOCAL_IDENTIFICATION: "local-identification",
  SCAN: "scan",
  SUMMARY: "summary",
});

/**
 * Gestionnaire de navigation.
 */
window.HeliaNavigation = (() => {
  let currentScreen = window.HELIA_SCREENS.HOME;
  let renderCallback = null;

  /**
   * Initialise le système de navigation.
   *
   * @param {Function} callback Fonction appelée lors d'un changement d'écran.
   */
  function initialize(callback) {
    if (typeof callback !== "function") {
      throw new TypeError(
        "HeliaNavigation.initialize attend une fonction de rendu."
      );
    }

    renderCallback = callback;
    notifyScreenChange();
  }

  /**
   * Change l'écran actif.
   *
   * @param {string} nextScreen Identifiant du nouvel écran.
   */
  function navigateTo(nextScreen) {
    const availableScreens = Object.values(window.HELIA_SCREENS);

    if (!availableScreens.includes(nextScreen)) {
      console.error(`Écran inconnu : ${nextScreen}`);
      return;
    }

    currentScreen = nextScreen;
    notifyScreenChange();
  }

  /**
   * Retourne l'écran actuellement affiché.
   *
   * @returns {string}
   */
  function getCurrentScreen() {
    return currentScreen;
  }

  /**
   * Informe l'interface qu'elle doit être reconstruite.
   */
  function notifyScreenChange() {
    if (typeof renderCallback === "function") {
      renderCallback(currentScreen);
    }
  }

  return Object.freeze({
    initialize,
    navigateTo,
    getCurrentScreen,
  });
})();