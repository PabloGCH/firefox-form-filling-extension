/* Validates readiness, scope, visibility, and field bindings before model calls. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { fieldCollector, picker, safetyGate, visibility } =
    globalThis.AIFormFiller;

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

  // Detects controls that became concealed after their safety decision.
  const hasNewlyHiddenBinding = (bindings) =>
    [...bindings.values()].some((binding) => {
      const elements = binding.elements || [binding.element];
      return elements.some((element) => visibility.getInvisibleReason(element));
    });

  // Rechecks safety around live DOM collection and returns an authorized request.
  const prepare = async (newFieldsOnly, isCanceled) => {
    const summary = await getReadySummary();
    const scopeResult = picker.getScope();
    if (scopeResult.missing) {
      throw new Error(
        "The selected area is no longer on the page. Select the area again before filling.",
      );
    }

    let safetyResult = await safetyGate.check(scopeResult.scope);
    if (!safetyResult.allowed || isCanceled()) {
      return null;
    }
    const latestScope = picker.getScope();
    if (latestScope.missing || latestScope.scope !== scopeResult.scope) {
      throw new Error(
        "The selected area changed during the safety check. Select it again before filling.",
      );
    }

    const newHiddenField = safetyGate
      .scan(scopeResult.scope)
      .some((finding) => !safetyResult.excludedFields.has(finding.element));
    if (newHiddenField) {
      safetyResult = await safetyGate.check(scopeResult.scope);
      if (!safetyResult.allowed || isCanceled()) {
        return null;
      }
    }

    const replaceExisting = newFieldsOnly
      ? false
      : summary.replaceExistingValues;
    let collected = fieldCollector.collect(scopeResult.scope, {
      excludedFields: safetyResult.excludedFields,
      replaceExisting,
    });
    if (hasNewlyHiddenBinding(collected.bindings)) {
      safetyResult = await safetyGate.check(scopeResult.scope);
      if (!safetyResult.allowed || isCanceled()) {
        return null;
      }
      collected = fieldCollector.collect(scopeResult.scope, {
        excludedFields: safetyResult.excludedFields,
        replaceExisting,
      });
    }

    return { collected, replaceExisting, safetyResult, scopeResult };
  };

  globalThis.AIFormFiller.fillPreparation = Object.freeze({ prepare });
})();
