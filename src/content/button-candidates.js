/* Discovers safe page-button candidates while retaining DOM bindings locally. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { CLICK_TEXT_MAX_LENGTH, SKIPPED_BUTTON_PATTERN, SUBMIT_LIKE_PATTERN } =
    globalThis.AIFormFiller.contentConstants;
  const { getInvisibleReason } = globalThis.AIFormFiller.visibility;
  const CANDIDATE_SELECTOR = "button, input[type='button'], [role='button']";

  // Collapses page-derived text and bounds what can be sent to the model or panel.
  const cleanText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, CLICK_TEXT_MAX_LENGTH);

  // Gets a usable visible name without interpreting page text as instructions.
  const getText = (element) =>
    cleanText(
      element.getAttribute("aria-label") ||
        element.value ||
        element.innerText ||
        element.textContent ||
        element.title,
    );

  // Describes the control kind, including the risky form-button default.
  const getControlType = (element) => {
    if (element instanceof HTMLButtonElement && !element.hasAttribute("type")) {
      return element.form ? "button with no type inside a form" : "button";
    }

    if (element instanceof HTMLInputElement) {
      return "input button";
    }

    return element.getAttribute("role") === "button"
      ? "custom button control"
      : "button";
  };

  // Supplies a short structural location derived by extension logic.
  const getLocation = (element) => {
    const fieldset = element.closest("fieldset");
    const legend = cleanText(fieldset?.querySelector(":scope > legend")?.textContent);

    if (legend) {
      return `the “${legend}” section`;
    }

    const form = element.closest("form");
    const formName = cleanText(
      form?.getAttribute("aria-label") || form?.name || form?.id,
    );
    return formName ? `the “${formName}” form` : form ? "the form" : "the selected area";
  };

  // Rejects navigation, disabled, invisible, reset, and submit-like controls.
  const isEligible = (element) => {
    if (
      !(element instanceof HTMLElement) ||
      element instanceof HTMLAnchorElement ||
      element.closest("a[href]") ||
      element.disabled ||
      element.matches(":disabled") ||
      element.closest("[inert]") ||
      element.getAttribute("aria-disabled") === "true" ||
      getComputedStyle(element).pointerEvents === "none" ||
      getInvisibleReason(element)
    ) {
      return false;
    }

    const declaredType = (element.getAttribute("type") || "").toLowerCase();
    if (["submit", "image", "reset"].includes(declaredType)) {
      return false;
    }

    if (
      element instanceof HTMLButtonElement &&
      element.hasAttribute("type") &&
      declaredType !== "button"
    ) {
      return false;
    }

    const text = getText(element);
    return (
      Boolean(text) &&
      !SUBMIT_LIKE_PATTERN.test(text) &&
      !SKIPPED_BUTTON_PATTERN.test(text)
    );
  };

  // Defines the only roots from which click targets may be selected.
  const getRoots = (scope) => {
    const roots = new Set([scope]);
    const form = scope instanceof Element ? scope.closest("form") : null;
    if (form) {
      roots.add(form);
    }
    return [...roots];
  };

  // Verifies that a bound target remains safe and in the currently approved roots.
  const isValidBinding = (binding, scope) => {
    if (!binding?.element?.isConnected || !isEligible(binding.element)) {
      return false;
    }

    return getRoots(scope).some(
      (root) => root === binding.element || root.contains(binding.element),
    );
  };

  // Returns serializable descriptions and a separate local element binding map.
  const collect = (scope) => {
    const elements = new Set();
    getRoots(scope).forEach((root) => {
      if (root instanceof Element && root.matches(CANDIDATE_SELECTOR)) {
        elements.add(root);
      }
      root.querySelectorAll(CANDIDATE_SELECTOR).forEach((element) => elements.add(element));
    });

    const descriptions = [];
    const bindings = new Map();
    [...elements].filter(isEligible).forEach((element, index) => {
      const id = `click-${index + 1}`;
      const description = {
        id,
        text: getText(element),
        controlType: getControlType(element),
        location: getLocation(element),
      };
      descriptions.push(description);
      bindings.set(id, {
        description,
        element,
        requiresSubmitGuard:
          element instanceof HTMLButtonElement &&
          Boolean(element.form) &&
          !element.hasAttribute("type"),
      });
    });
    return { bindings, descriptions };
  };

  globalThis.AIFormFiller.buttonCandidates = Object.freeze({
    collect,
    isValidBinding,
  });
})();
