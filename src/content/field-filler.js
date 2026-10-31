/* Applies validated model values to listed controls without submitting or clicking buttons. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { FILLED_HIGHLIGHT, STATUS_VALUE_MAX_LENGTH } =
    globalThis.AIFormFiller.contentConstants;
  const visibility = globalThis.AIFormFiller.visibility;
  const highlightedFields = new WeakMap();

  // Uses the native setter so controlled frameworks observe the new value.
  const setNativeValue = (field, value) => {
    const prototype =
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    if (setter) {
      setter.call(field, value);
    } else {
      field.value = value;
    }
  };

  // Sends the bubbling events expected by native pages and common frameworks.
  const dispatchValueEvents = (field) => {
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  };

  // Highlights a changed field until the user focuses it for review.
  const highlight = (field) => {
    if (highlightedFields.has(field)) {
      return;
    }

    const original = field.style.getPropertyValue("box-shadow");
    const priority = field.style.getPropertyPriority("box-shadow");

    // Restores once even if repeated fills occurred before user review.
    const clearHighlight = () => {
      field.style.setProperty("box-shadow", original, priority);
      field.removeEventListener("focus", clearHighlight);
      field.removeEventListener("pointerdown", clearHighlight);
      highlightedFields.delete(field);
    };

    highlightedFields.set(field, clearHighlight);
    field.style.setProperty("box-shadow", FILLED_HIGHLIGHT, "important");
    field.addEventListener("focus", clearHighlight);
    field.addEventListener("pointerdown", clearHighlight);
  };

  // Applies text-like values while respecting length and browser validation.
  const fillText = (binding, value) => {
    const field = binding.element;
    let text = String(value);
    const previous = field.value;

    if (field.maxLength >= 0) {
      text = text.slice(0, field.maxLength);
    }

    if (field instanceof HTMLInputElement && field.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return false;
      }

      setNativeValue(field, text);

      if (field.value !== text || !field.validity.valid) {
        setNativeValue(field, previous);
        return false;
      }
    } else {
      setNativeValue(field, text);

      if (field.value !== text || !field.validity.valid) {
        setNativeValue(field, previous);
        return false;
      }
    }

    dispatchValueEvents(field);
    highlight(field);
    return true;
  };

  // Applies only option values already resolved by the tiered select matcher.
  const fillSelect = (binding, value) => {
    const field = binding.element;
    let requested = [String(value)];

    if (field.multiple) {
      requested = Array.isArray(value) ? value.map(String) : [];
    }
    const available = new Set([...field.options].map((option) => option.value));

    if (requested.length === 0 || requested.some((item) => !available.has(item))) {
      return false;
    }

    if (field.multiple) {
      [...field.options].forEach((option) => {
        option.selected = requested.includes(option.value);
      });
    } else {
      field.value = requested[0];
    }

    dispatchValueEvents(field);
    highlight(field);
    return true;
  };

  // Changes a checkbox with click only when the requested boolean differs.
  const fillCheckbox = (binding, value) => {
    if (typeof value !== "boolean") {
      return false;
    }

    if (binding.element.checked !== value) {
      binding.element.click();
    }

    highlight(binding.element);
    return true;
  };

  // Selects only a radio value the extension previously listed.
  const fillRadio = (binding, value) => {
    const requested = String(value);
    const radio = binding.elements.find((element) => element.value === requested);

    if (!radio) {
      return false;
    }

    if (!radio.checked) {
      radio.click();
    }

    highlight(radio);
    return true;
  };

  // Applies values only through their local binding and reports basic counts.
  const fill = (bindings, values) => {
    const summary = {
      deniedClicks: 0,
      filled: 0,
      leftBlank: 0,
      unmatchedSelectDetails: [],
      unmatchedSelects: 0,
    };
    globalThis.AIFormFiller.submitGuard.start();

    bindings.forEach((binding, id) => {
      const elements = binding.elements || [binding.element];
      if (
        elements.some(
          (element) =>
            element.disabled ||
            element.readOnly ||
            visibility.getInvisibleReason(element),
        )
      ) {
        return;
      }
      const value = values[id];

      if (value === undefined || value === null) {
        summary.leftBlank += 1;
        return;
      }

      let didFill = false;

      if (binding.kind === "select") {
        didFill = fillSelect(binding, value);

        if (!didFill) {
          summary.unmatchedSelects += 1;
          const answer = Array.isArray(value) ? value.join(", ") : String(value);
          summary.unmatchedSelectDetails.push(
            `left “${binding.description.label || binding.description.name}” blank: ` +
              `no option matched “${answer.slice(0, STATUS_VALUE_MAX_LENGTH)}”`,
          );
        }
      } else if (binding.kind === "checkbox") {
        didFill = fillCheckbox(binding, value);
      } else if (binding.kind === "radio-group") {
        didFill = fillRadio(binding, value);
      } else {
        didFill = fillText(binding, value);
      }

      if (didFill) {
        summary.filled += 1;
      } else {
        summary.leftBlank += 1;
      }
    });

    return summary;
  };

  globalThis.AIFormFiller.fieldFiller = Object.freeze({ fill });
})();
