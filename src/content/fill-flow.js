/* Requests values for visible fields and applies only returned listed-field values. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const {
    buttonCandidates,
    clickFlow,
    dependentDropdowns,
    fieldFiller,
    fillPreparation,
    fillSummary: summaryTools,
    panel,
    sections,
    selectHandler,
  } = globalThis.AIFormFiller;
  let fillInProgress = false;
  let sessionVersion = 0;

  // Performs one fill using only visible fields in the selected area.
  const run = async (newFieldsOnly = false) => {
    if (fillInProgress) {
      panel.setStatus("A fill is already in progress.");
      return;
    }

    fillInProgress = true;
    const fillVersion = sessionVersion;
    panel.showBusy("Collecting visible fields from the selected area…");

    try {
      const prepared = await fillPreparation.prepare(
        newFieldsOnly,
        () => fillVersion !== sessionVersion,
      );
      if (!prepared) {
        return;
      }
      const { collected, replaceExisting, scopeResult } = prepared;

      if (collected.descriptions.length === 0) {
        await summaryTools.notify("failure", "no inputs were found");
        panel.show("No fillable inputs were found in this area.");
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
        visibilityChecked: true,
      });

      if (fillVersion !== sessionVersion) {
        return;
      }

      const values = await selectHandler.resolveValues(
        collected.bindings,
        response.values,
      );
      const initialElements = summaryTools.getBindingElements(collected.bindings);
      let fillSummary = fieldFiller.fill(collected.bindings, values);
      let dependentError = null;
      const clickState = clickFlow.createState(
        fillSummary,
        initialElements,
        {
          bindings: candidates.bindings,
          requests: response.clickRequests,
        },
      );

      try {
        const dependentSummary = await dependentDropdowns.fillNewFields(
          scopeResult.scope,
          initialElements,
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
      } catch (error) {
        dependentError = error.message || "Additional fields could not be filled.";
      }

      if (fillVersion !== sessionVersion) {
        return;
      }

      const finalStatus = summaryTools.format(fillSummary);
      const resultStatus = dependentError
        ? `${finalStatus} Additional fields could not be filled: ${dependentError}`
        : finalStatus;
      const partial =
        Boolean(dependentError) ||
        clickState.blocked ||
        clickState.limitReached ||
        fillSummary.deniedClicks > 0 ||
        fillSummary.leftBlank > 0 ||
        fillSummary.unmatchedSelects > 0;
      await summaryTools.notify(partial ? "partial" : "success");
      panel.show(resultStatus);
    } catch (error) {
      if (fillVersion !== sessionVersion) {
        return;
      }

      const errorMessage = error.message || "The fill could not be completed.";
      await summaryTools.notify(
        "failure",
        summaryTools.getFailureCategory(errorMessage),
      );
      panel.show(errorMessage);
    } finally {
      fillInProgress = false;
    }
  };

  // Invalidates current work so a late model response cannot touch the page.
  const clearSession = () => {
    sessionVersion += 1;
    fillInProgress = false;
  };

  // Invalidates page work and asks the background page to abort its model request.
  const cancel = () => {
    sessionVersion += 1;
    fillInProgress = false;
    browser.runtime.sendMessage({ type: "fill:cancel" }).catch(() => {});
  };

  globalThis.AIFormFiller.fillFlow = Object.freeze({ cancel, clearSession, run });
})();
