/* Connects toolbar panel commands to content-script features. */

(() => {
  "use strict";

  const { fieldCollector, fillFlow, fillPreparation, panel, picker } =
    globalThis.AIFormFiller;
  let operationVersion = 0;

  // Starts area selection with keyboard instructions and field-count feedback.
  const selectArea = async () => {
    const selectionVersion = ++operationVersion;
    panel.showBusy(
      "Move over an area and click to select it. ArrowUp widens, ArrowDown narrows, and Esc cancels.",
    );
    const selected = await picker.select();

    if (selectionVersion !== operationVersion || !panel.isOpen()) {
      return;
    }
    if (!selected) {
      panel.show("Area selection canceled.");
      return;
    }

    const count = fieldCollector.countFillable(selected);
    panel.show(`Selected area contains ${count} visible fillable fields.`);
  };

  // Cancels all active work, clears the required scope, and dismisses the UI.
  const cancel = () => {
    operationVersion += 1;
    fillFlow.cancel();
    picker.clear();
    panel.close();
  };

  const openSettings = async () => {
    try {
      await browser.runtime.sendMessage({ type: "settings:open" });
      if (panel.isOpen()) {
        panel.setStatus("Settings opened in a new tab.");
      }
    } catch (error) {
      if (panel.isOpen()) {
        panel.setStatus(error.message || "Settings could not be opened.");
      }
    }
  };

  const selectModel = (name) =>
    browser.runtime.sendMessage({ type: "settings:set-active-model", name });

  // Handles toolbar toggling and session clearing from the background page.
  const handleMessage = (message) => {
    switch (message?.type) {
      case "panel:toggle":
        if (panel.isOpen()) {
          cancel();
        } else {
          panel.show();
        }
        return Promise.resolve();
      case "session:cleared":
        operationVersion += 1;
        fillFlow.clearSession();
        picker.clear();
        panel.close();
        return Promise.resolve();
      default:
        return undefined;
    }
  };

  panel.initialize({
    cancel,
    canFill: fillPreparation.hasSelectedScope,
    fill: fillFlow.run,
    getSummary: () => browser.runtime.sendMessage({ type: "session:get-summary" }),
    openSettings,
    selectArea,
    selectModel,
  });
  browser.runtime.onMessage.addListener(handleMessage);
})();
