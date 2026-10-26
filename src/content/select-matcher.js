/* Matches model answers to native option values through deterministic unique tiers. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  // Removes case, accents, punctuation, and a leading article for comparison.
  const normalize = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/^the\s+/, "");

  // Returns a value only when one candidate uniquely wins the current tier.
  const uniqueValue = (candidates) => {
    const values = [...new Set(candidates.map((option) => option.value))];
    return values.length === 1 ? values[0] : null;
  };

  // Matches one answer in the required strict-to-fuzzy order.
  const matchOne = (options, answer) => {
    const text = String(answer);
    const exactValue = uniqueValue(
      options.filter((option) => option.value === text),
    );

    if (exactValue !== null) {
      return exactValue;
    }

    const exactLabel = uniqueValue(
      options.filter((option) => option.label === text),
    );

    if (exactLabel !== null) {
      return exactLabel;
    }

    const normalizedAnswer = normalize(text);

    if (!normalizedAnswer) {
      return null;
    }

    const normalized = uniqueValue(
      options.filter(
        (option) =>
          normalize(option.value) === normalizedAnswer ||
          normalize(option.label) === normalizedAnswer,
      ),
    );

    if (normalized !== null) {
      return normalized;
    }

    const startsWith = uniqueValue(
      options.filter((option) => {
        const value = normalize(option.value);
        const label = normalize(option.label);
        return (
          (value &&
            (value.startsWith(normalizedAnswer) ||
              normalizedAnswer.startsWith(value))) ||
          (label &&
            (label.startsWith(normalizedAnswer) ||
              normalizedAnswer.startsWith(label)))
        );
      }),
    );

    if (startsWith !== null) {
      return startsWith;
    }

    return uniqueValue(
      options.filter((option) => {
        const value = normalize(option.value);
        const label = normalize(option.label);
        return (
          (value &&
            (value.includes(normalizedAnswer) ||
              normalizedAnswer.includes(value))) ||
          (label &&
            (label.includes(normalizedAnswer) ||
              normalizedAnswer.includes(label)))
        );
      }),
    );
  };

  // Supports multi-select answers only when every item matches uniquely.
  const match = (options, answer, multiple = false) => {
    const answers = multiple && Array.isArray(answer) ? answer : [answer];

    if (multiple && !Array.isArray(answer)) {
      return { matched: false, value: null };
    }

    const values = answers.map((item) => matchOne(options, item));

    if (values.some((value) => value === null)) {
      return { matched: false, value: null };
    }

    return {
      matched: true,
      value: multiple ? [...new Set(values)] : values[0],
    };
  };

  globalThis.AIFormFiller.selectMatcher = Object.freeze({ match, normalize });
})();
