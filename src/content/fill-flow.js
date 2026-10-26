/* Runs one safety-gated model request and applies only returned listed-field values. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { fieldCollector, fieldFiller, panel, picker, safetyGate, visibility } =
    globalThis.AIFormFiller;
  let fillInProgress = false;
  let sessionVersion = 0;

  // Sends one approved final notification and reports notification failure in-panel.
  const notifyResult = async (outcome, category) => {
    try {
      await browser.runtime.sendMessage({
        type: "notification:fill-result",
        outcome,
        category,
      });
    } catch {
      panel.setStatus("The fill finished, but its desktop notification could not be shown.");
    }
  };

  // Reduces detailed errors to an approved general notification category.
  const getFailureCategory = (message) => {
    if (/no personal information|no active model/i.test(message)) {
      return "setup is incomplete";
    }

    if (/reach|timed out|HTTP|canceled/i.test(message)) {
      return "the model was unavailable";
    }

    if (/invalid JSON|model response|response text/i.test(message)) {
      return "the model response was invalid";
    }

    return "the fill could not be completed";
  };

  // Formats all required counts for the on-page result.
  const formatSummary = (summary) =>
    `Done: filled ${summary.filled}, left ${summary.leftBlank} blank, ` +
    `skipped ${summary.skippedHidden} hidden fields, ` +
    `${summary.unmatchedSelects} unmatched selects, and ` +
    `${summary.deniedClicks} denied clicks. Review the form, then submit it yourself.`;

  // Checks prerequisites without receiving markdown text or API keys.
  const getReadySummary = async () => {
    const summary = await browser.runtime.sendMessage({
      type: "session:get-fill-readiness",
    });

    if (!summary.infoLoaded) {
      throw new Error(
        "No personal information is loaded. Open settings and load a markdown file.",
      );
    }

    if (!summary.modelLoaded) {
      throw new Error(
        "No model is loaded. Open settings and add or import a model.",
      );
    }

    return summary;
  };

  // Detects controls that became concealed after their safety decision.
  const hasNewlyHiddenBinding = (bindings) =>
    [...bindings.values()].some((binding) => {
      const elements = binding.elements || [binding.element];
      return elements.some((element) => visibility.getInvisibleReason(element));
    });

  // Performs one fill only after the safety gate returns an explicit decision.
  const run = async (newFieldsOnly = false) => {
    panel.show();

    if (fillInProgress) {
      panel.setStatus("A fill is already in progress.");
      return;
    }

    fillInProgress = true;
    const fillVersion = sessionVersion;

    try {
      const summary = await getReadySummary();
      const scopeResult = picker.getScope();

      if (scopeResult.missing) {
        throw new Error(
          "The selected area is no longer on the page. Select the area again before filling.",
        );
      }

      let safetyResult = await safetyGate.check(scopeResult.scope);

      if (!safetyResult.allowed || fillVersion !== sessionVersion) {
        return;
      }

      const latestScope = picker.getScope();

      if (latestScope.missing || latestScope.scope !== scopeResult.scope) {
        throw new Error(
          "The selected area changed during the safety check. Select it again before filling.",
        );
      }

      const newHiddenField = safetyGate
        .scan(scopeResult.scope)
        .some((finding) => !safetyResult.excludedFields.has(finding.element));

      if (newHiddenField) {
        safetyResult = await safetyGate.check(scopeResult.scope);

        if (!safetyResult.allowed || fillVersion !== sessionVersion) {
          return;
        }
      }

      const replaceExisting = newFieldsOnly
        ? false
        : summary.replaceExistingValues;
      let collected = fieldCollector.collect(scopeResult.scope, {
        excludedFields: safetyResult.excludedFields,
        replaceExisting,
      });

      if (hasNewlyHiddenBinding(collected.bindings)) {
        safetyResult = await safetyGate.check(scopeResult.scope);

        if (!safetyResult.allowed || fillVersion !== sessionVersion) {
          return;
        }

        collected = fieldCollector.collect(scopeResult.scope, {
          excludedFields: safetyResult.excludedFields,
          replaceExisting,
        });
      }

      if (collected.descriptions.length === 0) {
        panel.setStatus("No fillable inputs were found in this area.");
        await notifyResult("failure", "no inputs were found");
        return;
      }

      panel.setStatus(
        `Asking the model about ${collected.descriptions.length} fields…`,
      );
      const values = await browser.runtime.sendMessage({
        type: "fill:request",
        fields: collected.descriptions,
        safetyChecked: true,
      });

      if (fillVersion !== sessionVersion) {
        return;
      }

      const fillSummary = fieldFiller.fill(
        collected.bindings,
        values,
        safetyResult.skippedHidden,
      );
      panel.setStatus(formatSummary(fillSummary));
      const partial =
        fillSummary.leftBlank > 0 ||
        fillSummary.skippedHidden > 0 ||
        fillSummary.unmatchedSelects > 0;
      await notifyResult(partial ? "partial" : "success");
    } catch (error) {
      if (fillVersion !== sessionVersion) {
        return;
      }

      panel.setStatus(error.message || "The fill could not be completed.");
      await notifyResult("failure", getFailureCategory(error.message || ""));
    } finally {
      fillInProgress = false;
    }
  };

  // Invalidates current work so a late model response cannot touch the page.
  const clearSession = () => {
    sessionVersion += 1;
    fillInProgress = false;
  };

  globalThis.AIFormFiller.fillFlow = Object.freeze({ clearSession, run });
})();
