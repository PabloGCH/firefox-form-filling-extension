/* Validates readiness, scope, visibility, and field bindings before model calls. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { fieldCollector, picker } = globalThis.AIFormFiller;

  // Checks prerequisites without receiving markdown text or API keys.
  const getReadySummary = async () => {
    const summary = await browser.runtime.sendMessage({
      type: "session:get-fill-readiness",
    });
    if (!summary.infoLoaded) {
      throw new Error(
        "No personal information is loaded. Open settings and load a markdown file.",
      );
    }
    if (!summary.modelLoaded) {
      throw new Error(
        "No model is loaded. Open settings and add or import a model.",
      );
    }
    return summary;
  };

  const hasSelectedScope = () => {
    const scopeResult = picker.getScope();
    return scopeResult.selected && !scopeResult.missing;
  };

  // Collects only currently visible fields from the required selected scope.
  const prepare = async (newFieldsOnly, isCanceled) => {
    const scopeResult = picker.getScope();
    if (!scopeResult.selected) {
      throw new Error("Select an area before filling the form.");
    }
    if (scopeResult.missing) {
      throw new Error(
        "The selected area is no longer on the page. Select the area again before filling.",
      );
    }
    const summary = await getReadySummary();
    if (isCanceled()) {
      return null;
    }

    const replaceExisting = newFieldsOnly
      ? false
      : summary.replaceExistingValues;
    const collected = fieldCollector.collect(scopeResult.scope, {
      replaceExisting,
    });

    return { collected, replaceExisting, scopeResult };
  };

  globalThis.AIFormFiller.fillPreparation = Object.freeze({
    hasSelectedScope,
    prepare,
  });
})();
