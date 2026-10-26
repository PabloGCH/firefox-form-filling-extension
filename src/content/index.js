/* Connects popup and panel commands to content-script features. */

(() => {
  "use strict";

  const { fieldCollector, fillFlow, panel, picker } = globalThis.AIFormFiller;

  // Starts area selection with keyboard instructions and field-count feedback.
  const selectArea = async () => {
    panel.show(
      "Move over an area and click to select it. ArrowUp widens, ArrowDown narrows, and Esc cancels.",
    );
    const selected = await picker.select();

    if (!selected) {
      panel.setStatus("Area selection canceled.");
      return;
    }

    const count = fieldCollector.countFillable(selected);
    panel.setStatus(`Selected area contains ${count} fillable fields.`);
  };

  // Handles popup commands and session clearing from the background page.
  const handleMessage = (message) => {
    switch (message?.type) {
      case "panel:show":
        panel.show();
        return Promise.resolve();
      case "fill:start":
        fillFlow.run(Boolean(message.newFieldsOnly));
        return Promise.resolve();
      case "picker:start":
        selectArea();
        return Promise.resolve();
      case "selection:clear":
        picker.clear();
        panel.setStatus("Selected area cleared. The whole page will be used.");
        return Promise.resolve();
      case "session:cleared":
        fillFlow.clearSession();
        picker.clear();
        panel.close();
        return Promise.resolve();
      default:
        return undefined;
    }
  };

  panel.initialize({ fill: fillFlow.run, selectArea });
  browser.runtime.onMessage.addListener(handleMessage);
})();
