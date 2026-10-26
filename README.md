# AI Form Filler

A Firefox desktop extension that will use a cloud or local language model to fill forms from personal information loaded for the current browser session.

## Progress

- **Last completed task:** Task 1 — Project skeleton, manifest, in-memory session state, README.
- **Next task:** Task 2 — Settings page: markdown upload, model management, import/export, copy example, and Clear all data.
- **What works:** The Manifest V2 extension skeleton loads a persistent background page. Session state starts empty, keeps data only in background-page memory, defaults replacement of existing values to on, exposes a safe summary, and can clear or cancel all session data.
- **Known limitations:** There is no popup, settings page, model client, or content script yet. Only the background skeleton in `src/background/` is implemented.
- **Verification:** Node syntax checks and background message/state runtime checks passed; forbidden persistence/submission API scans and `git diff --check` passed. `web-ext lint` reported zero errors and two forward-looking warnings: no add-on ID and no data-collection declaration. Firefox UI loading was not exercised in this environment.
- **Decisions:**
  - Content scripts will be separate plain JavaScript files listed in dependency order and will share the `AIFormFiller` namespace, avoiding a bundler and runtime libraries.
  - At the user's request, lint/format tooling is omitted. The user granted a one-time edit to remove those mandates from `GUIDELINES.md` and `TODO.md`; verification uses syntax and Firefox manifest checks instead.
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

Temporary add-ons are removed when Firefox closes. Current Task 1 provides background infrastructure only; user-facing controls arrive in later tasks.

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
- `src/content/`: planned ordered content scripts sharing the `AIFormFiller` namespace.
- `src/options/`: planned settings page.
- `src/popup/`: planned toolbar popup.
- `src/shared/`: planned constants and validation shared by extension pages.

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
