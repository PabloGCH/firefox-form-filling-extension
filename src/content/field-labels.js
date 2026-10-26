/* Derives length-limited labels from explicit accessibility text and nearby content. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { LABEL_MAX_LENGTH } = globalThis.AIFormFiller.contentConstants;

  // Normalizes visible label text and limits untrusted page content length.
  const clean = (value) =>
    value?.replace(/\s+/g, " ").trim().slice(0, LABEL_MAX_LENGTH) || "";

  // Removes nested controls so select option text does not pollute its label.
  const getLabelText = (label) => {
    const copy = label.cloneNode(true);
    copy.querySelectorAll("input, select, textarea, button").forEach((control) => {
      control.remove();
    });
    return copy.textContent;
  };

  // Reads explicit labels before a conservative nearby-text fallback.
  const get = (field) => {
    const labelText = clean(
      [...field.labels].map(getLabelText).join(" "),
    );

    if (labelText) {
      return labelText;
    }

    const ariaLabel = clean(field.getAttribute("aria-label"));

    if (ariaLabel) {
      return ariaLabel;
    }

    const labelledBy = field.getAttribute("aria-labelledby");

    if (labelledBy) {
      const referencedText = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" ");
      const cleaned = clean(referencedText);

      if (cleaned) {
        return cleaned;
      }
    }

    const previousText = clean(field.previousElementSibling?.textContent);
    return previousText || clean(field.parentElement?.textContent);
  };

  // Provides a group label from fieldset or ARIA context for radio choices.
  const getRadioGroup = (radio) => {
    const fieldset = radio.closest("fieldset");
    const legend = fieldset?.querySelector(":scope > legend");
    const legendText = clean(legend?.textContent);

    if (legendText) {
      return legendText;
    }

    const radioGroup = radio.closest('[role="radiogroup"]');
    return clean(radioGroup?.getAttribute("aria-label")) || get(radio);
  };

  globalThis.AIFormFiller.fieldLabels = Object.freeze({ clean, get, getRadioGroup });
})();
