/* Coordinates settings modules and refreshes them from background-owned state. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const modules = globalThis.AIFormFiller.options;

  // Sends messages through one boundary and normalizes Firefox error text.
  const send = async (message) => {
    try {
      return await browser.runtime.sendMessage(message);
    } catch (error) {
      throw new Error(error.message || "The extension could not complete the request.");
    }
  };

  // Shows one readable page-level result without exposing sensitive payloads.
  const showStatus = (message, isError = false) => {
    const status = document.querySelector("#page-status");
    status.textContent = message;
    status.classList.toggle("error", isError);
  };

  // Re-requests state instead of retaining a separate page-owned data model.
  const refresh = async () => {
    const [summary, info] = await Promise.all([
      send({ type: "session:get-summary" }),
      send({ type: "settings:get-info" }),
    ]);
    modules.markdownUpload.render(info);
    modules.modelsList.render(summary);
    modules.modelsImportExport.render(summary);
    document.querySelector("#replace-existing").checked =
      summary.settings.replaceExistingValues;
  };

  globalThis.AIFormFiller.optionsApp = Object.freeze({ refresh, send, showStatus });

  // Keeps the replacement preference in background memory only.
  const updateReplacePreference = async (event) => {
    try {
      await send({
        type: "settings:set-replace",
        enabled: event.currentTarget.checked,
      });
      showStatus("Session preference updated.");
    } catch (error) {
      showStatus(error.message, true);
      await refresh();
    }
  };

  // Initializes modules once and then paints the current session state.
  const init = async () => {
    modules.markdownUpload.init();
    modules.modelsForm.init();
    modules.modelsImportExport.init();
    modules.clearData.init();
    document
      .querySelector("#replace-existing")
      .addEventListener("change", updateReplacePreference);

    try {
      await refresh();
    } catch (error) {
      showStatus(error.message, true);
    }
  };

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
