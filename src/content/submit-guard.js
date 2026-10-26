/* Temporarily blocks submit events while field changes can trigger site code. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { SUBMIT_BLOCK_MS } = globalThis.AIFormFiller.contentConstants;

  // Prevents submission in capture phase and removes itself after the cooldown.
  const start = () => {
    const blockSubmit = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    document.addEventListener("submit", blockSubmit, true);
    setTimeout(() => {
      document.removeEventListener("submit", blockSubmit, true);
    }, SUBMIT_BLOCK_MS);
  };

  globalThis.AIFormFiller.submitGuard = Object.freeze({ start });
})();
