/* Scrolls to one safe target and performs it only after trusted per-click approval. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { CLICK_OUTLINE } = globalThis.AIFormFiller.contentConstants;
  const { buttonCandidates, panel, panelPrompts, submitGuard } =
    globalThis.AIFormFiller;

  // Writes the extension-owned purpose rather than trusting model prose as the purpose.
  const getExtensionReason = (binding) => {
    const text = binding.description.text;
    if (/\b(add|another|new|more|create)\b/i.test(text)) {
      return "add another form section so I can fill newly created fields";
    }
    if (/\b(open|choose|select|dropdown|menu)\b/i.test(text)) {
      return "open a form control so I can continue filling";
    }
    return "reveal additional form fields so I can continue filling";
  };

  // Temporarily outlines the exact target while the isolated prompt is active.
  const outline = (element) => {
    const previousOutline = element.style.getPropertyValue("outline");
    const previousPriority = element.style.getPropertyPriority("outline");
    const previousOffset = element.style.getPropertyValue("outline-offset");
    element.style.setProperty("outline", CLICK_OUTLINE, "important");
    element.style.setProperty("outline-offset", "3px", "important");
    return () => {
      element.style.setProperty("outline", previousOutline, previousPriority);
      element.style.setProperty("outline-offset", previousOffset);
    };
  };

  // Requests one decision and revalidates the target immediately before clicking.
  const request = async (binding, scope, modelReason = "") => {
    if (!buttonCandidates.isValidBinding(binding, scope)) {
      return "unavailable";
    }

    binding.element.scrollIntoView({ block: "center", behavior: "smooth" });
    const restoreOutline = outline(binding.element);
    const allowed = await panelPrompts.showClickPermission({
      ...binding.description,
      extensionReason: getExtensionReason(binding),
      modelReason,
      riskyUntypedButton: binding.requiresSubmitGuard,
    });
    restoreOutline();

    if (!allowed) {
      return "denied";
    }

    if (!buttonCandidates.isValidBinding(binding, scope)) {
      panel.show("The approved button changed or became unavailable, so it was not clicked.");
      return "unavailable";
    }

    if (binding.requiresSubmitGuard) {
      submitGuard.start();
    }
    binding.element.click();
    return "clicked";
  };

  globalThis.AIFormFiller.clickPermission = Object.freeze({ request });
})();
