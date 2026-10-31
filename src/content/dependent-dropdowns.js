/* Re-scans once and fills only controls that appeared after the first fill. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { DEPENDENT_RESCAN_DELAY_MS } =
    globalThis.AIFormFiller.contentConstants;
  const {
    buttonCandidates,
    fieldCollector,
    fieldFiller,
    sections,
    selectHandler,
  } = globalThis.AIFormFiller;

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

  // Runs one bounded dependent-field pass under the selected area's approval.
  const fillNewFields = async (
    scope,
    initialElements,
    replaceExisting,
  ) => {
    await waitForRender();

    const collected = keepNewBindings(
      fieldCollector.collect(scope, {
        replaceExisting,
      }),
      initialElements,
    );

    if (collected.descriptions.length === 0) {
      return null;
    }

    sections.addHints(collected.descriptions, collected.bindings);

    const candidates = buttonCandidates.collect(scope);
    const response = await browser.runtime.sendMessage({
      type: "fill:request",
      alreadyFilled: sections.collectAlreadyFilled(scope),
      clickCandidates: candidates.descriptions,
      fields: collected.descriptions,
      visibilityChecked: true,
    });
    const values = await selectHandler.resolveValues(
      collected.bindings,
      response.values,
    );
    return {
      blocked: false,
      clickBatch: {
        bindings: candidates.bindings,
        requests: response.clickRequests,
      },
      newElements: new Set(
        [...collected.bindings.values()].flatMap((binding) =>
          binding.elements || [binding.element],
        ),
      ),
      summary: fieldFiller.fill(collected.bindings, values),
    };
  };

  globalThis.AIFormFiller.dependentDropdowns = Object.freeze({ fillNewFields });
})();
