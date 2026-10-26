/* Adds repeated-section hints and gathers safe already-filled form context. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { MAX_CONTEXT_VALUE_LENGTH, SKIPPED_INPUT_TYPES } =
    globalThis.AIFormFiller.contentConstants;
  const { fieldLabels, visibility } = globalThis.AIFormFiller;

  // Converts machine-like name prefixes to a short readable section label.
  const humanize = (value) => {
    const words = value.replace(/[_-]+/g, " ").trim();
    return words ? `${words[0].toUpperCase()}${words.slice(1)}` : "Repeated section";
  };

  // Extracts common jobs[1] or education.1 style indices from field names.
  const getIndexedName = (name) => {
    const match = name.match(/^([^.[\]]+)(?:\[(\d+)\]|\.(\d+))/);

    if (!match) {
      return null;
    }

    return { index: Number(match[2] ?? match[3]), prefix: match[1] };
  };

  // Creates a structural signature that ignores numeric name indices.
  const getBlockSignature = (element) => {
    const names = [...element.querySelectorAll("input, select, textarea")]
      .map((field) => field.name.replace(/\d+/g, "#"))
      .filter(Boolean)
      .sort();
    if (names.length === 0) {
      return null;
    }

    return `${element.localName}|${element.className}|${names.join(",")}`;
  };

  // Finds a nearby repeated sibling block when indexed names are unavailable.
  const getSiblingSection = (element) => {
    let block = element.parentElement;

    for (let depth = 0; block?.parentElement && depth < 4; depth += 1) {
      const signature = getBlockSignature(block);
      const siblings = [...block.parentElement.children].filter(
        (candidate) => getBlockSignature(candidate) === signature,
      );

      if (signature && siblings.length > 1) {
        const heading = block.querySelector(
          "legend, h1, h2, h3, h4, [aria-label]",
        );
        const label =
          fieldLabels.clean(
            heading?.getAttribute("aria-label") || heading?.textContent,
          ) || "Repeated section";
        return {
          index: siblings.indexOf(block),
          label,
          total: siblings.length,
        };
      }

      block = block.parentElement;
    }

    return null;
  };

  // Tags model descriptions with stable indexed-name or sibling-order hints.
  const addHints = (descriptions, bindings) => {
    descriptions.forEach((description) => {
      const nameSection = getIndexedName(description.name);

      if (nameSection) {
        const binding = bindings.get(description.id);
        const element = binding?.element || binding?.elements?.[0];
        const context = element?.closest("form") || document.body;
        const indices = new Set(
          [...context.querySelectorAll("input, select, textarea")]
            .map((field) => getIndexedName(field.name))
            .filter((item) => item?.prefix === nameSection.prefix)
            .map((item) => item.index),
        );
        description.section = `${humanize(nameSection.prefix)}, entry ${
          nameSection.index + 1
        } of ${indices.size}`;
        return;
      }

      const binding = bindings.get(description.id);
      const element = binding?.element || binding?.elements?.[0];
      const siblingSection = element ? getSiblingSection(element) : null;

      if (siblingSection) {
        description.section = `${siblingSection.label}, entry ${
          siblingSection.index + 1
        } of ${siblingSection.total}`;
      }
    });
  };

  // Excludes sensitive, concealed, empty, and oversized values from context.
  const shouldIncludeContext = (field) => {
    if (field.disabled || field.readOnly || visibility.getInvisibleReason(field)) {
      return false;
    }

    if ((field.autocomplete || "").toLowerCase().startsWith("cc-")) {
      return false;
    }

    if (field instanceof HTMLInputElement) {
      if (SKIPPED_INPUT_TYPES.includes(field.type)) {
        return false;
      }

      if (["checkbox", "radio"].includes(field.type) && !field.checked) {
        return false;
      }
    }

    return field.value.length > 0 && field.value.length <= MAX_CONTEXT_VALUE_LENGTH;
  };

  // Reads visible existing values from the enclosing form or page.
  const collectAlreadyFilled = (scope) => {
    const widerScope =
      scope instanceof Element && scope.closest("form")
        ? scope.closest("form")
        : document.body;
    return [...widerScope.querySelectorAll("input, select, textarea")]
      .filter(shouldIncludeContext)
      .map((field) => ({
        label: fieldLabels.get(field),
        name: field.name || "",
        value: field.value,
      }));
  };

  globalThis.AIFormFiller.sections = Object.freeze({
    addHints,
    collectAlreadyFilled,
  });
})();
