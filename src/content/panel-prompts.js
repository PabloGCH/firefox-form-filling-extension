/* Builds safety and click decisions as plain-text views for the closed panel. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { CLICK_REASON_MAX_LENGTH, SAFETY_WARNING_TEXT } =
    globalThis.AIFormFiller.contentConstants;
  const { panel } = globalThis.AIFormFiller;

  // Builds a plain-text list so page-derived findings cannot become markup.
  const createFindingsList = (findings) => {
    const list = document.createElement("ul");
    findings.forEach((finding) => {
      const item = document.createElement("li");
      item.textContent = finding.description;
      list.append(item);
    });
    return list;
  };

  // Pauses filling for the mandatory invisible-field decision.
  const showSafetyWarning = (findings, notificationError = null) => {
    const section = document.createElement("section");
    const heading = document.createElement("h2");
    const message = document.createElement("p");
    const actions = document.createElement("div");
    const cancelButton = panel.createButton("Cancel", () => finish(false));
    const continueButton = panel.createButton(
      "Continue anyway",
      () => finish(true),
      "danger",
    );
    section.className = "panel warning";
    section.setAttribute("role", "alertdialog");
    section.setAttribute("aria-modal", "true");
    heading.textContent = "Invisible fields found";
    message.textContent = SAFETY_WARNING_TEXT;
    actions.className = "actions";
    actions.append(cancelButton, continueButton);
    section.append(heading, message, createFindingsList(findings));

    if (notificationError) {
      const error = document.createElement("p");
      error.textContent = notificationError;
      section.append(error);
    }
    section.append(actions);
    let resolvePrompt;

    // Resolves once, removes keyboard handling, and restores normal controls.
    const finish = (shouldContinue) => {
      document.removeEventListener("keydown", handleKeydown, true);
      panel.finishPrompt();
      panel.show(shouldContinue ? "Continuing with visible fields only." : "Fill canceled.");
      resolvePrompt(shouldContinue);
    };

    // Treats Escape as Cancel even when focus moves outside the panel.
    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }
    };

    document.addEventListener("keydown", handleKeydown, true);
    panel.showPrompt(section, () => finish(false));
    cancelButton.focus();
    return new Promise((resolve) => {
      resolvePrompt = resolve;
    });
  };

  // Shows one Allow/Deny decision and accepts Allow only from real input.
  const showClickPermission = (details) => {
    const section = document.createElement("section");
    const heading = document.createElement("h2");
    const message = document.createElement("p");
    const metadata = document.createElement("p");
    const actions = document.createElement("div");
    const denyButton = panel.createButton("Deny", () => finish(false));
    const allowButton = panel.createButton(
      "Allow",
      (event) => {
        if (event.isTrusted) {
          finish(true);
        }
      },
      "primary",
    );
    heading.textContent = "Permission to click";
    message.textContent = `Click “${details.text}” to ${details.extensionReason}.`;
    metadata.textContent = `Control: ${details.controlType}; location: ${details.location}.`;
    actions.className = "actions";
    actions.append(denyButton, allowButton);
    section.className = "panel warning";
    section.setAttribute("role", "alertdialog");
    section.setAttribute("aria-modal", "true");
    section.append(heading, message, metadata);

    if (details.modelReason) {
      const reason = document.createElement("p");
      reason.textContent = `Model-provided reason: ${String(details.modelReason).slice(
        0,
        CLICK_REASON_MAX_LENGTH,
      )}`;
      section.append(reason);
    }
    if (details.riskyUntypedButton) {
      const warning = document.createElement("p");
      warning.textContent =
        "This button may submit by default. Submission will be blocked during and after the click.";
      section.append(warning);
    }
    section.append(actions);
    let resolvePrompt;

    // Resolves once and returns to the normal view after this one decision.
    const finish = (allowed) => {
      document.removeEventListener("keydown", handleKeydown, true);
      panel.finishPrompt();
      panel.show(allowed ? "Click allowed." : "Click denied. Continuing without it.");
      resolvePrompt(allowed);
    };

    // Makes Escape equivalent to the safe Deny action.
    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }
    };

    document.addEventListener("keydown", handleKeydown, true);
    panel.showPrompt(section, () => finish(false));
    denyButton.focus();
    return new Promise((resolve) => {
      resolvePrompt = resolve;
    });
  };

  globalThis.AIFormFiller.panelPrompts = Object.freeze({
    showClickPermission,
    showSafetyWarning,
  });
})();
