/* Clears all background-owned data after the approved confirmation. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};
globalThis.AIFormFiller.options = globalThis.AIFormFiller.options || {};

(() => {
  "use strict";

  const { CLEAR_CONFIRMATION, CLEAR_SUCCESS } =
    globalThis.AIFormFiller.constants;

  // Clears even an empty session and then resets every settings control.
  const clearData = async () => {
    if (!confirm(CLEAR_CONFIRMATION)) {
      return;
    }

    try {
      await globalThis.AIFormFiller.optionsApp.send({ type: "session:clear" });
      globalThis.AIFormFiller.options.modelsForm.reset();
      document.querySelector("#models-file").value = "";
      await globalThis.AIFormFiller.optionsApp.refresh();
      globalThis.AIFormFiller.optionsApp.showStatus(CLEAR_SUCCESS);
    } catch (error) {
      globalThis.AIFormFiller.optionsApp.showStatus(error.message, true);
    }
  };

  // Registers the clear action independently of current state.
  const init = () => {
    document.querySelector("#clear-data").addEventListener("click", clearData);
  };

  globalThis.AIFormFiller.options.clearData = Object.freeze({ init });
})();
