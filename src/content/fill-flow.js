/* Runs one safety-gated model request and applies only returned listed-field values. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const {
    buttonCandidates,
    clickFlow,
    dependentDropdowns,
    fieldCollector,
    fieldFiller,
    fillSummary: summaryTools,
    panel,
    picker,
    safetyGate,
    sections,
    selectHandler,
    visibility,
  } = globalThis.AIFormFiller;
  let fillInProgress = false;
  let sessionVersion = 0;

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
        await summaryTools.notify("failure", "no inputs were found");
        return;
      }

      sections.addHints(collected.descriptions, collected.bindings);
      const alreadyFilled = sections.collectAlreadyFilled(scopeResult.scope);
      const candidates = buttonCandidates.collect(scopeResult.scope);

      panel.setStatus(
        `Asking the model about ${collected.descriptions.length} fields…`,
      );
      const response = await browser.runtime.sendMessage({
        type: "fill:request",
        alreadyFilled,
        clickCandidates: candidates.descriptions,
        fields: collected.descriptions,
        safetyChecked: true,
      });

      if (fillVersion !== sessionVersion) {
        return;
      }

      const values = await selectHandler.resolveValues(
        collected.bindings,
        response.values,
      );
      const initialElements = summaryTools.getBindingElements(collected.bindings);
      let fillSummary = fieldFiller.fill(
        collected.bindings,
        values,
        safetyResult.skippedHidden,
      );
      let dependentFailed = false;
      const clickState = clickFlow.createState(
        fillSummary,
        initialElements,
        safetyResult,
        {
          bindings: candidates.bindings,
          requests: response.clickRequests,
        },
      );

      try {
        const dependentSummary = await dependentDropdowns.fillNewFields(
          scopeResult.scope,
          initialElements,
          safetyResult,
          replaceExisting,
        );

        if (dependentSummary) {
          clickFlow.addDependentResult(clickState, dependentSummary);
        }

        await clickFlow.process(
          scopeResult.scope,
          replaceExisting,
          clickState,
          () => fillVersion !== sessionVersion,
        );
        fillSummary = clickState.summary;
      } catch {
        dependentFailed = true;
      }

      if (fillVersion !== sessionVersion) {
        return;
      }

      panel.setStatus(summaryTools.format(fillSummary));
      const partial =
        dependentFailed ||
        clickState.blocked ||
        clickState.limitReached ||
        fillSummary.deniedClicks > 0 ||
        fillSummary.leftBlank > 0 ||
        fillSummary.skippedHidden > 0 ||
        fillSummary.unmatchedSelects > 0;
      await summaryTools.notify(partial ? "partial" : "success");
    } catch (error) {
      if (fillVersion !== sessionVersion) {
        return;
      }

      panel.setStatus(error.message || "The fill could not be completed.");
      await summaryTools.notify(
        "failure",
        summaryTools.getFailureCategory(error.message || ""),
      );
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
