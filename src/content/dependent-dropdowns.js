/* Re-scans once and fills only controls that appeared after the first fill. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { DEPENDENT_RESCAN_DELAY_MS } =
    globalThis.AIFormFiller.contentConstants;
  const { fieldCollector, fieldFiller, safetyGate, selectHandler } =
    globalThis.AIFormFiller;

  // Waits briefly for synchronous framework changes to render dependent controls.
  const waitForRender = () =>
    new Promise((resolve) => {
      setTimeout(resolve, DEPENDENT_RESCAN_DELAY_MS);
    });

  // Returns every DOM element represented by one local field binding.
  const getElements = (binding) => binding.elements || [binding.element];

  // Keeps only bindings composed entirely of controls absent from the first pass.
  const keepNewBindings = (collected, initialElements) => {
    const bindings = new Map();
    const descriptions = [];

    collected.bindings.forEach((binding, id) => {
      const isNew = getElements(binding).every(
        (element) => !initialElements.has(element),
      );

      if (isNew) {
        bindings.set(id, binding);
        descriptions.push(binding.description);
      }
    });

    return { bindings, descriptions };
  };

  // Runs one bounded dependent-field pass with a fresh visibility scan.
  const fillNewFields = async (
    scope,
    initialElements,
    previousSafety,
    replaceExisting,
  ) => {
    await waitForRender();
    let safetyResult = previousSafety;
    const hasNewFinding = safetyGate
      .scan(scope)
      .some((finding) => !previousSafety.excludedFields.has(finding.element));

    if (hasNewFinding) {
      safetyResult = await safetyGate.check(scope);

      if (!safetyResult.allowed) {
        const newlySkipped = [...safetyResult.excludedFields].filter(
          (field) => !previousSafety.excludedFields.has(field),
        ).length;
        return {
          deniedClicks: 0,
          filled: 0,
          leftBlank: 0,
          skippedHidden: newlySkipped,
          unmatchedSelectDetails: [],
          unmatchedSelects: 0,
        };
      }
    }

    const collected = keepNewBindings(
      fieldCollector.collect(scope, {
        excludedFields: safetyResult.excludedFields,
        replaceExisting,
      }),
      initialElements,
    );

    if (collected.descriptions.length === 0) {
      return null;
    }

    const rawValues = await browser.runtime.sendMessage({
      type: "fill:request",
      fields: collected.descriptions,
      safetyChecked: true,
    });
    const values = await selectHandler.resolveValues(
      collected.bindings,
      rawValues,
    );
    const newlySkipped = [...safetyResult.excludedFields].filter(
      (field) => !previousSafety.excludedFields.has(field),
    ).length;
    return fieldFiller.fill(
      collected.bindings,
      values,
      newlySkipped,
    );
  };

  globalThis.AIFormFiller.dependentDropdowns = Object.freeze({ fillNewFields });
})();
