/* Resolves native select answers and requests one focused retry when needed. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { selectMatcher } = globalThis.AIFormFiller;

  // Resolves all native selects while leaving non-select values unchanged.
  const resolveValues = async (bindings, originalValues) => {
    const values = { ...originalValues };

    for (const [id, binding] of bindings) {
      if (binding.kind !== "select") {
        continue;
      }

      const answer = values[id];

      if (answer === undefined || answer === null) {
        continue;
      }

      const options = binding.description.options;
      let result = selectMatcher.match(
        options,
        answer,
        binding.element.multiple,
      );

      if (!result.matched) {
        try {
          const retryAnswer = await browser.runtime.sendMessage({
            type: "fill:retry-select",
            field: binding.description,
            previousAnswer: answer,
            safetyChecked: true,
          });
          result = selectMatcher.match(
            options,
            retryAnswer,
            binding.element.multiple,
          );
        } catch {
          result = { matched: false, value: null };
        }
      }

      if (result.matched) {
        values[id] = result.value;
      }
    }

    return values;
  };

  globalThis.AIFormFiller.selectHandler = Object.freeze({ resolveValues });
})();
