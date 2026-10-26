/* Coordinates bounded click decisions and fills fields created by approved clicks. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { MAX_CLICK_REQUESTS_PER_FILL } =
    globalThis.AIFormFiller.contentConstants;
  const { clickPermission, dependentDropdowns, fillSummary } =
    globalThis.AIFormFiller;

  // Creates local, per-fill click state without retaining permission history.
  const createState = (summary, knownElements, safetyResult, firstBatch) => ({
    blocked: false,
    clickBatches: firstBatch?.requests.length ? [firstBatch] : [],
    knownElements,
    limitReached: false,
    safetyResult,
    summary,
  });

  // Merges one new-field pass and queues only requests from that exact response.
  const addDependentResult = (state, result) => {
    if (!result) {
      return;
    }

    state.summary = fillSummary.merge(state.summary, result.summary);
    result.newElements.forEach((element) => state.knownElements.add(element));
    state.safetyResult = result.safetyResult;
    state.blocked = state.blocked || result.blocked;
    if (result.clickBatch?.requests.length) {
      state.clickBatches.push(result.clickBatch);
    }
  };

  // Processes requests sequentially and asks again even for a repeated target.
  const process = async (scope, replaceExisting, state, isCanceled) => {
    let considered = 0;

    while (state.clickBatches.length > 0 && !state.blocked) {
      const batch = state.clickBatches.shift();

      for (const request of batch.requests) {
        if (considered >= MAX_CLICK_REQUESTS_PER_FILL || isCanceled()) {
          state.limitReached = considered >= MAX_CLICK_REQUESTS_PER_FILL;
          return;
        }
        considered += 1;
        const binding = batch.bindings.get(request.candidateId);

        if (!binding) {
          continue;
        }

        const outcome = await clickPermission.request(binding, scope, request.reason);
        if (isCanceled()) {
          return;
        }
        if (outcome === "denied") {
          state.summary.deniedClicks += 1;
          continue;
        }
        if (outcome !== "clicked") {
          continue;
        }

        const result = await dependentDropdowns.fillNewFields(
          scope,
          state.knownElements,
          state.safetyResult,
          replaceExisting,
        );
        addDependentResult(state, result);
        if (state.blocked) {
          return;
        }
      }
    }
  };

  globalThis.AIFormFiller.clickFlow = Object.freeze({
    addDependentResult,
    createState,
    process,
  });
})();
