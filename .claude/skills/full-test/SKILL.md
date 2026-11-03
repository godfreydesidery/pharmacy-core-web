---
name: full-test
description: "Autonomous frontend QA, headed Playwright validation and release workflow for pharmacy-core-web (Angular 21 SPA against pharmacy-core-api). Builds and serves the production app, discovers every route, exercises every page, dialog, form and CRUD path in one headed maximized browser session, creates at least 15 human-friendly records per entity with pass/fail/incomplete/invalid variants, skips an entity after 3 failures, auto-fixes frontend issues only, documents backend issues, then commits and opens a PR when green. Traverses use cases from a gitignored test catalog and records last-run status per test case. Supports resume (default) or redo of the entire flow. Use when the user asks for full-test, full QA, release validation, exhaustive Playwright, an E2E sweep, a production readiness check, or autonomous frontend testing."
---

# Autonomous Frontend QA, Validation & Release Agent

You are a Senior Staff Frontend Engineer, Senior QA Automation Engineer, Senior UX Engineer and
Release Engineer working on a production-grade web application.

Your goal is to continuously validate the application, find defects, fix frontend issues
automatically where you can, document backend issues, and commit code only when the
application is production-ready.

---

# Project configuration

Every repo-specific value lives here. The rest of this skill refers to these names.

| Key | Value for pharmacy-core-web |
|---|---|
| `APP_DIR` | `.` (`D:\My_Works\PHARM\pharmacy-core-web`) |
| `INSTALL_CMD` | `npm ci` |
| `BUILD_CMD` | `npm run build` (production configuration; output `dist/pharmacy-core-web/browser`) |
| `START_CMD` | `npm run serve:prod`. It serves the production build on `APP_URL` and proxies `/api` and `/actuator` to `http://localhost:8080` (`scripts/serve-prod.mjs`). |
| `APP_URL` | `http://localhost:4300` (production serve; `npm start` dev server uses 4200) |
| `API_URL` | `http://localhost:8080/api/v1`. Start the API from `../pharmacy-core-api` with `mvn -pl application/pharmacy-core -am spring-boot:run -Dspring-boot.run.profiles=local`. Health: `http://localhost:8080/actuator/health` |
| `LOGIN` | Route `/sign-in`, fields email and password. Then pick the workspace (tenant, then branch). Env vars: `E2E_EMAIL` / `E2E_PASSWORD` (default `admin@afya.co.tz` / `Afya#2026`); root admin `E2E_ROOT_EMAIL` / `E2E_ROOT_PASSWORD` (default `root@pharmacy.local` / `Root#2026`); cashier `cashier@afya.co.tz` / `Cashier#2026`. Demo tenant AFYA, branches HQ and MBZ. |
| `TYPECHECK_CMD` | `npx tsc --noEmit -p tsconfig.app.json --incremental false` |
| `LINT_CMD` | `npx prettier --check "src/**/*.{ts,html,scss}"`, plus `npx ng lint` once angular-eslint is added |
| `ROUTE_SOURCES` | `src/app/app.routes.ts`, `src/app/**/**.routes.ts`, the sidebar nav definition under `src/app/layout` |
| `CATALOG` | `docs/.qa/test-catalog.json` |
| `QA_DIR` | `docs/.qa/` (gitignored) |
| `BACKEND_ASKS` | `../pharmacy-core-docs/qa/backend-asks.md`. The API contract is `../pharmacy-core-docs/contracts/api-v1.md`; the live OpenAPI document is `http://localhost:8080/v3/api-docs`. |
| `DEV_BRANCH` / `RELEASE_BRANCH` | `development` / `main` |
| `TEST_DATA_PREFIX` | `SEED ` |
| `PLAYWRIGHT_CONFIG` | `playwright.config.ts` |

Project notes:
- **Multi-tenancy and roles.** Every tenant request sends `X-Tenant-Id`, and branch routes also send `X-Branch-Id`. Test permission states with the cashier, who has HQ only and no admin screens. Test cross-tenant isolation with the root admin and a second tenant created with the `SEED ` prefix.
- **Asynchronous projections.** The dashboard, reports and journal update from events a moment after a sale. Allow a few seconds before you call a missing figure a bug.
- **Branch rules.** Stock and sales are per branch. Switching branch in the top bar must reload the branch-scoped lists.

If a key is unknown, inspect the repo (package.json scripts, angular.json, README) and record
what you found in the catalog `meta` block before starting.

---

# Run modes

## Default: **resume** (incremental)

Use this when the user invokes `/full-test` with no redo flag.

1. Read `CATALOG`.
2. Traverse **use cases → test cases** in catalog order, respecting `priority` and then `order`.
3. **Skip** test cases where `lastResult.status === "passed"`, unless:
   * `lastResult.at` is older than 7 days, or
   * the user asked to re-test a specific area, or
   * related source files changed since `lastResult.at` (check with `git log --since`).
4. **Prioritise** failed cases, then blocked, then not_run, then stale passed.
5. Respect `lastResult.skipUntil`. Do not retry before that timestamp (the 3-strike rule).
6. After each test case, **update the catalog immediately**: status, timestamp, failure reason,
   evidence paths and attempt count.

## **Redo entire flow** (full reset)

Use this when the user says **redo**, **full redo** or **restart full-test**, or sets `FULL_TEST_REDO=1`.

1. Archive the current catalog to `QA_DIR/runs/<ISO-timestamp>.json` before resetting it.
2. Reset every `lastResult` to `{ "status": "not_run" }`, clear the failure fields, and set
   `attemptCount` to 0.
3. Run the **complete** workflow, from [Initial validation](#initial-validation) through
   [Quality standard](#quality-standard).
4. Set `lastRunMode: "redo"` and a new `lastRunId`.

Do not mix a redo with partial fixes mid-run unless the user explicitly stops and restarts.

---

# QA catalog (gitignored)

**Path:** `CATALOG`. The whole `QA_DIR` tree is gitignored, so never commit it. Add it to
`.gitignore` on first run if it is missing.

If the catalog is missing, create it from the schema below and populate it from
[Site discovery](#site-discovery).

The catalog is the **single source of truth** for:
* which use cases and test cases exist;
* what ran last and whether it passed;
* why it failed;
* skip and block windows after repeated failures.

After a full run, set `lastRunAt` and the `summary` counts. Do not write separate standing
report files into the repo. Release notes go in the PR body.

### Catalog schema

```json
{
  "version": 1,
  "meta": { "appUrl": "", "apiUrl": "", "viewportDesktop": null, "configNotes": "" },
  "lastRunId": "2026-01-01T08:00:00Z",
  "lastRunMode": "resume",
  "lastRunAt": "2026-01-01T10:30:00Z",
  "summary": { "passed": 0, "failed": 0, "skipped": 0, "blocked": 0, "not_run": 0 },
  "useCases": [
    {
      "id": "UC-AUTH",
      "title": "Authentication & account",
      "area": "auth",
      "priority": 1,
      "order": 10,
      "testCases": [
        {
          "id": "TC-AUTH-LOGIN",
          "title": "Staff login with password",
          "route": "/sign-in",
          "steps": ["Open /sign-in", "Submit valid credentials", "Pick tenant and branch", "Land on dashboard"],
          "tags": ["smoke", "critical"],
          "lastResult": {
            "status": "not_run",
            "at": null,
            "runId": null,
            "failureReason": null,
            "evidence": [],
            "attemptCount": 0,
            "skipUntil": null
          }
        }
      ]
    }
  ]
}
```

**`lastResult.status` values:** `not_run`, `passed`, `failed`, `skipped`, `blocked`, `warn`.

**On failure**, always set:
* `failureReason`: one paragraph covering the symptom, the layer (frontend, backend or both) and
  the repro steps;
* `evidence`: paths to the screenshot, trace or video;
* `attemptCount`: increment it. At **3** for the same entity flow, set `status: "blocked"` and
  `skipUntil` to now + 24h.

**The next run must read `failureReason`** before re-attempting. Verify the fix or the changed
preconditions; do not blindly repeat the same clicks.

---

# General rules

Behave like an experienced engineer:
* Never make assumptions, and inspect existing code before changing anything.
* Never skip validation, never disable tests to make them pass, and never bypass failing pages.
* Never ignore console errors.
* Never suppress type or lint errors without understanding the cause.
* No hacks. Keep the existing architecture and the project conventions.

Additional rules:
* **Test through the UI.** Every check is done by clicking through the headed browser. Use direct
  API calls only to gather evidence or to seed data that has no screen.
* **Test the production build, never the dev server.**
* **Test data stays in its lane.** Create and modify only records whose names start with
  `TEST_DATA_PREFIX`. Never change real or shared records. If a check needs a global setting, use
  values that cannot disrupt others, and restore the original value straight after the check.
* **Never reset other people's passwords or shared credentials.**
* **Text checks can lie.** `innerText` does not include input values. When a value looks blank,
  read `input.value` or the DOM before calling it a bug.
* **A missing backend door is not a frontend bug.** Confirm a 404 or 405 against the backend's
  OpenAPI document before changing frontend code.

---

# Browser configuration

Always use **headed mode**, never headless.

## Full window (required)

The browser must use the **full available screen**: not a fixed 1920×1080 preset, and not
Playwright's default `devices['Desktop Chrome']`.

### Preferred driver: Playwright

Use `PLAYWRIGHT_CONFIG` with:

```ts
viewport: null,
deviceScaleFactor: undefined,
launchOptions: { args: ['--start-maximized'] },
headless: false,
workers: 1,
fullyParallel: false,
```

For ad-hoc scripts: `chromium.launch({ headless: false, args: ['--start-maximized'] })` with
`browser.newContext({ viewport: null })`. Set `PLAYWRIGHT_SLOW_MO=300` for observable runs.

### Driving the browser through an MCP browser tool

1. Open **one** session for the whole desktop pass.
2. Never close and reopen it between test cases. Switch tabs instead.
3. Verify the size with `window.screen.availWidth/availHeight` and `outerWidth/outerHeight`.
   Store `{availWidth, availHeight}` in `meta.viewportDesktop`.
4. If the outer size is more than 40px below the available size, switch that test case to
   Playwright.

### Additional viewports

Only after the full-screen desktop pass, or for test cases tagged tablet or mobile, run Tablet
768×1024 and Mobile 390×844. Then return to full screen.

For every failure, capture a screenshot, video, trace, console log and network log.

---

# Initial validation

1. `INSTALL_CMD`.
2. Verify the env vars named in `LOGIN`, plus the API base URL.
3. Verify that `API_URL` is reachable (`/actuator/health`). If not, start the API (see `API_URL`).
4. `BUILD_CMD`. Remove `dist/` first, so a stale build is never tested.
5. `START_CMD` on a free port. Confirm there is no chunk-load error on the first page.
6. If startup fails, fix the frontend before going further.
7. Load or create `CATALOG`, and apply the [Run modes](#run-modes).

Log the build and server output under `QA_DIR`.

**Long builds:** run them as a tracked background task, never two at once, and check the build
output's timestamp rather than trusting an old log.

**Windows notes:**
* PowerShell 5.1 has no `&&`/`||`. Use `;` with `if ($?) {}`, or Bash.
* In Git Bash, set `MSYS_NO_PATHCONV=1` when passing `/v1/...`-style arguments.

---

# Site discovery

Discover every reachable route from `ROUTE_SOURCES`, the navigation definitions, breadcrumbs,
buttons, table row links and dynamic links found while crawling. **Merge** newly discovered
routes into the catalog as new test cases. Never delete historical entries without user
approval.

---

# Page validation

Visit every discovered page. For each page, validate:
* it loads, with no blank screen, crash or infinite loading;
* no runtime or console errors;
* no missing text or broken icons, overflow, overlapping components or unreachable controls;
* loading, empty, populated, permission, unauthorized and not-found states;
* light and dark themes;
* responsive layout when tagged tablet or mobile.

Record every API response with status 404, 405 or 5xx, together with the page that triggered it.

---

# Component validation

Validate:
* buttons, menus and dropdowns;
* tabs, dialogs, drawers and toasts;
* forms, pickers and autocompletes;
* tables, pagination, search, filters and sort;
* cards, stats and charts;
* links, tooltips, hover/focus and keyboard navigation.

Open pickers and autocompletes during checks; options often load only when opened.

---

# Form validation

For every form:
* fill every field;
* try required, optional, invalid and valid data, plus lengths and formats;
* check server-side validation messages (problem `reason`/`field`);
* check submit, reset and cancel;
* check the success and failure toasts (one toast per response);
* check the loading, disabled and permission states.

---

# CRUD validation

For every module that supports it, check:
* create, read, update and view;
* search, sort, filter and pagination;
* export and refresh;
* lifecycle transitions:
  * purchase order: ordered → partially received → received / cancelled;
  * transfer: in transit → received;
  * sale: completed → returned;
  * tenant: suspend → reactivate.

Map each workflow to catalog test cases under the entity's use case.

---

# Entity data & volume rules

For every entity that supports create:
* Create at least **15 records**, with human-friendly data prefixed with `TEST_DATA_PREFIX`.
* Test the **variants**: pass, fail, incomplete, invalid and edge cases. For example:
  * a prescription-only sale without a prescription;
  * a sale paid short;
  * stock adjusted below zero;
  * an over-receipt on a purchase order.
* If create or update for an entity **fails 3 times**, mark it `blocked`, set `skipUntil`, attach
  the evidence, and continue.

---

# Navigation validation

Test:
* every sidebar item, breadcrumb, tab and button navigation;
* back and forward;
* deep links, refresh and direct URLs;
* the branch switcher;
* unauthorized access (the cashier on admin routes) and an expired session.

---

# API validation

Monitor every HTTP request. Validate:
* the method, endpoint and payload;
* the response envelope (`success`, `data`) and the problem details (`reason`, `field`);
* the status and the auth headers (`Authorization`, `X-Tenant-Id`, `X-Branch-Id`);
* error codes and loading states.

For backend-origin failures:
* set `failureReason` with the layer `backend`;
* record the ask in `BACKEND_ASKS`;
* do **not** hide it with frontend hacks.

---

# Auto fix policy

Fix ONLY frontend problems automatically. After every fix:
1. `LINT_CMD`;
2. `TYPECHECK_CMD` (check the exit code);
3. `npm test`;
4. `BUILD_CMD`;
5. re-run the **failed catalog test cases** in the headed browser.

Repeat until no fixable frontend issues remain in the current run scope.

---

# Reporting

* **Executive summary:** overall health, pass and fail rates, coverage, build status, the catalog
  `summary` and the run mode.
* **UI report:** the pages and actions tested, with evidence.
* **API report:** the endpoints touched, with their status, latency and failures.
* **Issues:** grouped Critical, High, Medium and Low, each with the description, location, root
  cause, fix and validation result.

Key outcomes go in the PR body. Backend asks go to `BACKEND_ASKS`. Do not create standing
run-report files.

---

# Git workflow

Commit only if the build, lint, type check and all in-scope catalog test cases pass, or the user
accepts the known blocks. Make small Conventional Commits on `DEV_BRANCH`. Never commit `QA_DIR`.
If the checkout is shared with other sessions, never move its working tree; use a separate
worktree instead.

# Pull request

After pushing, open a PR to `RELEASE_BRANCH`. Include:
* the executive summary;
* the coverage;
* the frontend fixes and the backend issues;
* screenshots;
* risk and regression notes;
* the evidence.

# Quality standard

Continue until the ENTIRE application has been exercised, per the catalog and discovery, unless
resume mode legitimately skips fresh passes. Every reachable page, dialog, form, CRUD workflow,
API interaction and navigation path must either be tested, or be marked `blocked` or `skipped`
with a reason in the catalog.
