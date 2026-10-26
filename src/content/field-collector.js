/* Collects safe, labeled field descriptions and local-only element bindings. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { SKIPPED_INPUT_TYPES } = globalThis.AIFormFiller.contentConstants;
  const fieldLabels = globalThis.AIFormFiller.fieldLabels;

  // Excludes controls that must never be sent to or changed by the model.
  const isEligibleField = (field) => {
    if (field.disabled || field.readOnly) {
      return false;
    }

    return !(
      field instanceof HTMLInputElement &&
      SKIPPED_INPUT_TYPES.includes(field.type)
    );
  };

  // Detects whether a field already contains a meaningful value.
  const hasExistingValue = (field) => {
    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      return field.checked;
    }

    if (field instanceof HTMLSelectElement && field.multiple) {
      return field.selectedOptions.length > 0;
    }

    return Boolean(field.value);
  };

  // Includes a directly selected control as well as controls inside containers.
  const getScopeFields = (scope) => {
    const fields = [...scope.querySelectorAll("input, select, textarea")];

    if (scope instanceof Element && scope.matches("input, select, textarea")) {
      fields.unshift(scope);
    }

    return fields;
  };

  // Adds common model metadata without sharing element references.
  const describeCommon = (field, id, kind, replaceExisting) => {
    const autocomplete = field.getAttribute("autocomplete") || "";
    const description = {
      id,
      kind,
      inputType: field instanceof HTMLInputElement ? field.type : kind,
      label: fieldLabels.get(field),
      name: field.name || "",
      domId: field.id || "",
      placeholder: field.getAttribute("placeholder") || "",
      autocomplete: ["", "on", "off"].includes(autocomplete)
        ? null
        : autocomplete,
      required: field.required,
      maxLength: field.maxLength >= 0 ? field.maxLength : null,
    };

    if (replaceExisting) {
      if (field instanceof HTMLInputElement && field.type === "checkbox") {
        description.currentValue = field.checked;
      } else if (field instanceof HTMLSelectElement && field.multiple) {
        description.currentValue = [...field.selectedOptions].map(
          (option) => option.value,
        );
      } else {
        description.currentValue = field.value;
      }
    }

    return description;
  };

  // Describes one radio name/form group as a single model field.
  const createRadioBinding = (radios, id, replaceExisting) => {
    const selected = radios.find((radio) => radio.checked);
    const description = describeCommon(
      radios[0],
      id,
      "radio-group",
      replaceExisting,
    );
    description.label = fieldLabels.getRadioGroup(radios[0]);
    description.options = radios.map((radio) => ({
      label: fieldLabels.get(radio) || radio.value,
      value: radio.value,
    }));

    if (replaceExisting) {
      description.currentValue = selected?.value || "";
    }

    return { description, elements: radios, id, kind: "radio-group" };
  };

  // Collects descriptions plus bindings that remain only in this content script.
  const collect = (scope, options = {}) => {
    const replaceExisting = options.replaceExisting !== false;
    const excludedFields = options.excludedFields || new Set();
    const allFields = getScopeFields(scope);
    const fields = allFields.filter(
      (field) => isEligibleField(field) && !excludedFields.has(field),
    );
    const descriptions = [];
    const bindings = new Map();
    const handledRadios = new Set();
    let sequence = 1;

    fields.forEach((field) => {
      if (field instanceof HTMLInputElement && field.type === "radio") {
        if (handledRadios.has(field)) {
          return;
        }

        const radios = fields.filter(
          (candidate) =>
            candidate instanceof HTMLInputElement &&
            candidate.type === "radio" &&
            (field.name ? candidate.name === field.name : candidate === field) &&
            candidate.form === field.form,
        );
        radios.forEach((radio) => handledRadios.add(radio));

        if (!replaceExisting && radios.some((radio) => radio.checked)) {
          return;
        }

        const id = `field-${sequence}`;
        sequence += 1;
        const binding = createRadioBinding(radios, id, replaceExisting);
        descriptions.push(binding.description);
        bindings.set(id, binding);
        return;
      }

      if (!replaceExisting && hasExistingValue(field)) {
        return;
      }

      const id = `field-${sequence}`;
      sequence += 1;
      let kind = "input";

      if (field instanceof HTMLSelectElement) {
        kind = "select";
      } else if (field instanceof HTMLTextAreaElement) {
        kind = "textarea";
      } else if (field.type === "checkbox") {
        kind = "checkbox";
      }
      const description = describeCommon(field, id, kind, replaceExisting);

      if (field instanceof HTMLSelectElement) {
        description.multiple = field.multiple;
        description.options = [...field.options].map((option) => ({
          label: fieldLabels.clean(option.label || option.textContent),
          value: option.value,
        }));
      }

      descriptions.push(description);
      bindings.set(id, { description, element: field, id, kind });
    });

    return { bindings, descriptions };
  };

  // Counts currently visible eligible controls for picker feedback.
  const countFillable = (scope) => {
    const excludedFields = new Set(
      getScopeFields(scope).filter((field) =>
        globalThis.AIFormFiller.visibility.getInvisibleReason(field),
      ),
    );
    return collect(scope, { excludedFields, replaceExisting: true }).descriptions
      .length;
  };

  globalThis.AIFormFiller.fieldCollector = Object.freeze({ collect, countFillable });
})();
