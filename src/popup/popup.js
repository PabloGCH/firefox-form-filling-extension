/* Displays safe session status and basic session controls in the toolbar popup. */

(() => {
  "use strict";

  const { CLEAR_CONFIRMATION, CLEAR_SUCCESS } =
    globalThis.AIFormFiller.constants;

  // Shows a readable result without retaining a separate status history.
  const showStatus = (message, isError = false) => {
    const status = document.querySelector("#popup-status");
    status.textContent = message;
    status.classList.toggle("error", isError);
  };

  // Renders the latest safe summary directly into popup controls.
  const render = (summary) => {
    const infoState = document.querySelector("#info-state");
    const modelsState = document.querySelector("#models-state");
    const select = document.querySelector("#active-model");
    const label = document.querySelector("#active-model-label");

    infoState.textContent = summary.infoFile.loaded
      ? `Info loaded: ${summary.infoFile.fileName} (${summary.infoFile.characterCount.toLocaleString()} characters).`
      : "No info file loaded. Open settings to load one.";
    modelsState.textContent =
      summary.models.length > 0
        ? `${summary.models.length} model${summary.models.length === 1 ? "" : "s"} loaded.`
        : "No models loaded. Open settings to add or import one.";
    select.replaceChildren();
    select.hidden = summary.models.length === 0;
    label.hidden = select.hidden;

    summary.models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.name;
      option.textContent = model.name;
      option.selected = model.name === summary.activeModelName;
      select.append(option);
    });
  };

  // Requests a fresh snapshot whenever the popup opens or state changes.
  const refresh = async () => {
    render(await browser.runtime.sendMessage({ type: "session:get-summary" }));
  };

  // Sends a user action to the active page where content scripts own the DOM.
  const sendToActivePage = async (message) => {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (!tab?.id) {
        throw new Error("No active webpage is available.");
      }

      await browser.tabs.sendMessage(tab.id, message);
      window.close();
    } catch {
      showStatus("Open a regular webpage and try again.", true);
    }
  };

  // Selects a loaded model without persisting that choice.
  const changeActiveModel = async (event) => {
    try {
      await browser.runtime.sendMessage({
        type: "settings:set-active-model",
        name: event.currentTarget.value,
      });
      showStatus("Active model updated.");
    } catch (error) {
      showStatus(error.message, true);
      await refresh();
    }
  };

  // Clears all in-memory data after the same approved confirmation as settings.
  const clearData = async () => {
    if (!confirm(CLEAR_CONFIRMATION)) {
      return;
    }

    try {
      await browser.runtime.sendMessage({ type: "session:clear" });
      await refresh();
      showStatus(CLEAR_SUCCESS);
    } catch (error) {
      showStatus(error.message, true);
    }
  };

  // Opens the full settings tab through Firefox's extension API.
  const openSettings = async () => {
    try {
      await browser.runtime.openOptionsPage();
      window.close();
    } catch (error) {
      showStatus(error.message, true);
    }
  };

  // Connects popup controls and handles an unavailable background page.
  const init = async () => {
    document
      .querySelector("#active-model")
      .addEventListener("change", changeActiveModel);
    document.querySelector("#clear-data").addEventListener("click", clearData);
    document.querySelector("#open-settings").addEventListener("click", openSettings);
    document.querySelector("#fill-form").addEventListener("click", () => {
      sendToActivePage({ type: "fill:start", newFieldsOnly: false });
    });
    document.querySelector("#fill-new").addEventListener("click", () => {
      sendToActivePage({ type: "fill:start", newFieldsOnly: true });
    });
    document.querySelector("#select-area").addEventListener("click", () => {
      sendToActivePage({ type: "picker:start" });
    });

    try {
      await refresh();
    } catch (error) {
      showStatus(error.message, true);
    }
  };

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
