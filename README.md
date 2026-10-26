# AI Form Filler

A Firefox desktop extension that will use a cloud or local language model to fill forms from personal information loaded for the current browser session.

## Progress

- **Last completed task:** Task 6 — Select matching improvements.
- **Next task:** Task 7 — Dynamic and repeated sections.
- **What works:** All Task 4 form flow remains available. Native selects now use strict-to-fuzzy unique matching, including accent/punctuation/article normalization and multi-select lists. Unmatched selects receive one focused model retry and a specific panel report. Long option lists are reduced only when reference-backed candidates exist. One delayed, safety-checked rescan fills only newly appeared dependent fields.
- **Known limitations:** Candidate filtering and repeated-section detection are heuristic. Repeated-entry context, section hints, and fuller re-render/new-field behavior are Task 7. Custom non-native dropdowns remain skipped until Task 8 adds per-click permission. Live model behavior and the README manual checks are unverified.
- **Verification:** Deterministic tests covered every matching tier, ambiguity rejection, multi-selects, focused retries, long-list candidate reduction/full fallback, and no unnecessary retry. A browser DOM exercise verified a newly added dependent select was the only field rescanned and filled. Syntax and forbidden API scans passed; `web-ext lint` had zero errors and Firefox 158 loaded the extension temporarily.
- **Decisions:**
  - Content scripts will be separate plain JavaScript files listed in dependency order and will share the `AIFormFiller` namespace, avoiding a bundler and runtime libraries.
  - At the user's request, lint/format tooling is omitted. The user granted a one-time edit to remove those mandates from `GUIDELINES.md` and `TODO.md`; verification uses syntax and Firefox manifest checks instead.
  - Approved export warning: “This file includes API keys in plain text. Anyone with the file can read them. Store it securely. Export models now?”
  - Approved clear warning: “Clear all in-memory data? This cancels any fill in progress. Files you previously exported to disk will not be deleted.”
  - Approved the 50 KB markdown warning now used in settings.
  - Cross-task requirements may remain unticked until their later component exists; Task 2 is complete in its settings/popup scope, while panel reset stays deferred to Task 4.
  - Task 5 was moved before Task 4 at the user's direction so its pre-call check exists before the first form-data model call; Task 4 will integrate its remaining trigger and summary requirements.
  - Approved safety warning and notification wording is used by the hidden-field gate.
  - Final fill notifications use only total success, partial success, or failure with a general category; detailed counts stay in the panel. The separate hidden-field safety notification remains allowed.
- **Open questions:** None.

## Privacy and session lifetime

Nothing is saved between sessions. Personal information, model configurations, API keys, URLs, active-model choice, settings, field data, and pending actions live only in the persistent Manifest V2 background page's memory. Closing Firefox, disabling or reloading the extension, or using **Clear all data** removes them.

The planned **Export models (JSON)** button is the only way the extension will save model configuration. Exported files can contain API keys in plain text and must be stored carefully. The extension will have no telemetry or analytics, and network requests will go only to model endpoints the user loads.

The extension never submits forms. It will not click page buttons without explicit permission for each click.

## Install temporarily in Firefox

1. Use Firefox desktop 119 or newer.
2. Open `about:debugging`.
3. Select **This Firefox**.
4. Select **Load Temporary Add-on**.
5. Choose this repository's `manifest.json`.

Temporary add-ons are removed when Firefox closes. Use the toolbar popup to open the settings page.

## Using the current settings

1. Open **AI Form Filler** from the toolbar, then select **Open settings**.
2. Load one UTF-8 `.md` file. Its editable preview changes only the session copy.
3. Add models manually or import a models JSON file. Select the active model in settings or the popup.
4. Use **Test connection** to make a small real request to that model endpoint.
5. Use **Export models (JSON)** if you want to keep model configuration for another session. The confirmed export includes API keys in plain text.
6. Use **Clear all data** to remove all in-memory information and restore session defaults.

## Filling a form

1. Load information and at least one model in settings, then open a normal webpage containing a form.
2. Optionally choose **Select area** in the popup or page panel. Hover and click a container; use **ArrowUp** or **ArrowDown** to adjust, or **Esc** to cancel.
3. Choose **Fill form** to follow the session replacement preference, or **Fill new fields only** to preserve every non-empty control.
4. If invisible fields are reported, review the list. **Cancel** sends nothing; **Continue anyway** excludes every reported field from both the request and filling.
5. Review highlighted values and submit the form yourself. The extension never submits it.

Native selects use tiered unique matching and one model retry. Custom dropdowns that require opening a page control remain untouched until the permission flow is implemented.

## Personal information markdown

The settings page will accept one UTF-8 `.md` file containing the information used to answer form fields. It can contain prose and distinct repeated entries under headings, such as separate jobs or education records. Instructions such as declining marketing emails belong in that file.

The full text will remain in memory and be sent to the active model on every fill. With a cloud model, it leaves the computer. There will be no personal-information export or parsing into profile rows.

## Models JSON format

Model configuration import and export will use this shape:

```json
{
  "activeModel": "Local Ollama",
  "models": [
    {
      "name": "Local Ollama",
      "provider": "openai",
      "baseUrl": "http://localhost:11434/v1",
      "model": "llama3.1"
    },
    {
      "name": "Anthropic",
      "provider": "anthropic",
      "baseUrl": "https://api.anthropic.com",
      "model": "your-model-name",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

`provider` is `openai` for OpenAI-compatible `/chat/completions` servers or `anthropic` for `/v1/messages`. `apiKey` is optional. Names must be unique, and `activeModel` may name one loaded model; otherwise the first model is active.

## Ollama setup

1. Install and start Ollama.
2. Pull a model, for example `ollama pull llama3.1`.
3. Later, add an OpenAI-compatible configuration using `http://localhost:11434/v1` and the pulled model name.
4. If Ollama returns HTTP 403, start it with an origin configuration that permits Firefox extensions: `OLLAMA_ORIGINS="moz-extension://*"`.

## Folder overview

- `manifest.json`: Firefox 119+ Manifest V2 declaration and minimum permissions.
- `src/background/session-state.js`: the only owner of session user data.
- `src/background/index.js`: background message routing.
- `src/background/prompt-builder.js`: fixed instructions plus serialized reference and field data.
- `src/background/model-client.js`: provider requests, timeout, cancellation, and response handling.
- `src/background/model-response.js`: JSON extraction and field-ID/value-shape validation.
- `src/content/`: ordered content scripts for isolated panel UI and hidden-control detection; picker and filling modules are next.
- `src/options/`: settings page modules and styles.
- `src/popup/`: toolbar popup status and session controls.
- `src/shared/`: constants and model validation shared by extension pages and background scripts.

## Manual checklist

Run this checklist on real forms as the corresponding features are implemented; the project intentionally has no test pages or `tests/` folder.

- [ ] After restarting Firefox, no data is loaded; the popup and settings show empty states until info and models are loaded.
- [ ] Uploading markdown works; non-text files give clear errors and change nothing.
- [ ] Adding a model manually works; invalid input adds nothing with inline errors; editing and removing work.
- [ ] Valid model JSON imports; invalid files give precise errors and change nothing; replacement asks for confirmation.
- [ ] Export warns about plain-text keys, downloads a file, and re-import restores identical models and active model.
- [ ] **Copy example** copies the example JSON, which is not otherwise visible on the page.
- [ ] **Clear all data** removes markdown, models, keys, selection, and UI state, preventing fills until data is reloaded.
- [ ] **Replace values in fields that already have something** is on by default in a new session.
- [ ] Password fields remain untouched, unknown data preserves existing values, and forms are never submitted.
- [ ] No page button is clicked without a permission prompt; **Deny** leaves the page untouched.
- [ ] The hidden-field warning appears; **Cancel** and **Continue anyway** behave as described.
- [ ] Switching models works; a wrong URL or stopped Ollama produces a readable error.
