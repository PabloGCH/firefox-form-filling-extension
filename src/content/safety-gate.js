/* Scans form controls and pauses before data can leave the page when any are concealed. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { getInvisibleReason, shouldSkipField } =
    globalThis.AIFormFiller.visibility;

  // Gives each finding a concise plain-text description for user review.
  const describeFinding = (field, reason) => {
    const kind =
      field instanceof HTMLInputElement ? `${field.type} input` : field.localName;
    const identity = field.name || field.id || "without a name";
    return `${kind} named \`${identity}\`, hidden by ${reason}`;
  };

  // Collects unique fields from the selected scope and its enclosing form.
  const collectSafetyFields = (scope) => {
    const fields = new Set(scope.querySelectorAll("input, select, textarea"));
    const form = scope instanceof Element ? scope.closest("form") : null;

    if (scope instanceof Element && scope.matches("input, select, textarea")) {
      fields.add(scope);
    }

    form?.querySelectorAll("input, select, textarea").forEach((field) => {
      fields.add(field);
    });

    return [...fields].filter((field) => !shouldSkipField(field));
  };

  // Scans without side effects so callers can inspect findings safely.
  const scan = (scope) => {
    const findings = [];

    collectSafetyFields(scope).forEach((field) => {
      const reason = getInvisibleReason(field);

      if (reason) {
        findings.push({
          description: describeFinding(field, reason),
          element: field,
          reason,
        });
      }
    });

    return findings;
  };

  // Pauses for every finding and never offers to include concealed fields.
  const check = async (scope) => {
    const findings = scan(scope);

    if (findings.length === 0) {
      return { allowed: true, excludedFields: new Set(), skippedHidden: 0 };
    }

    let notificationError = null;

    try {
      await browser.runtime.sendMessage({ type: "notification:hidden-fields" });
    } catch {
      notificationError = "Desktop notification could not be shown.";
    }

    const shouldContinue = await globalThis.AIFormFiller.panel.showSafetyWarning(
      findings,
      notificationError,
    );
    return {
      allowed: shouldContinue,
      excludedFields: new Set(findings.map((finding) => finding.element)),
      skippedHidden: findings.length,
    };
  };

  globalThis.AIFormFiller.safetyGate = Object.freeze({ check, scan });
})();
