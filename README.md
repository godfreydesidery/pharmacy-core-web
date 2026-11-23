# pharmacy-core-web

The web console of **Pharmacy Core**, a multi-tenant, multi-branch pharmacy system. Pharmacy staff use it for the point of sale, inventory, purchasing, finance, reports and administration. The root administrator uses it to run the platform.

- **API:** [`pharmacy-core-api`](../pharmacy-core-api)
- **Contract:** [`pharmacy-core-docs/contracts/api-v1.md`](../pharmacy-core-docs/contracts/api-v1.md)
- **Design reference:** [`pharmacy-core-docs/prototype/index.html`](../pharmacy-core-docs/prototype/index.html)

## Stack

- **Angular 21**:
  - standalone components only (no NgModules);
  - signals: `signal`, `computed`, `effect`, `input()`, `output()`, `viewChild()`;
  - the built-in control flow (`@if`, `@for`, `@switch`);
  - `inject()`;
  - functional guards and interceptors;
  - lazy-loaded routes;
  - typed reactive forms.
- **Zoneless** change detection. There is no `zone.js`.
- **Strict TypeScript** and strict templates.
- **No UI kit.** A small in-repo design system: CSS custom-property tokens with light and dark themes, an inline SVG icon set, and in-house SVG charts (line, donut, bar).
- **Vitest** for unit tests (jsdom, headless).

## Run

You need Node 22+ and npm 10+.

```bash
npm ci               # exactly the locked versions (the lock installs on Linux and Windows)
npm start            # http://localhost:4200
```

The dev server proxies `/api`, `/actuator`, `/swagger-ui` and `/v3/api-docs` to `http://localhost:8080` (see `proxy.conf.json`), so start `pharmacy-core-api` first.

These development accounts come from the API's dev seed. The sign-in page offers them as one-click chips in dev mode only.

| Account | Email | Password |
|---|---|---|
| Root administrator | `root@pharmacy.local` | `Root#2026` |
| Afya Pharmacy administrator | `admin@afya.co.tz` | `Afya#2026` |
| Afya Pharmacy cashier | `cashier@afya.co.tz` | `Cashier#2026` |

## Build and test

```bash
npm run build        # production build → dist/pharmacy-core-web/browser
npm test             # unit tests, headless, single run
npm run format       # Prettier
```

## Structure

```text
src/app
├── app.config.ts            zoneless, router (input binding, view transitions), HttpClient + interceptor
├── app.routes.ts            sign-in, workspace, shell → platform/* (root) and tenant pages (guarded)
├── core
│   ├── api                  models.ts (contract DTOs), Api (promise client), apiInterceptor, ApiError
│   ├── data                 pagedList() / loaded() / debounced(): signal-based loaders
│   ├── format               formatters, pipes (money, day, when, label, num), SettingsStore (currency)
│   ├── layout               shell (sidebar, top bar, branch switcher), nav config, logo
│   ├── session              SessionStore (signals + localStorage), guards
│   ├── ui                   icon, modal/drawer, toasts, stat/badge/empty/pager, charts, lookup, forms
│   └── shared.ts            what pages import
└── features
    ├── auth                 sign-in, workspace picker, account (change password)
    ├── platform             overview, tenants (+ register), tenant detail, root administrators
    ├── dashboard
    ├── pos                  POS page, cart maths (pure, tested), receipt
    ├── sales                history, sale detail + returns, returns list
    ├── inventory            stock (+ batches drawer, opening stock), expiry, movements, adjustments, transfers
    ├── purchasing           purchase orders (list/new/detail), goods receipts (list/new/detail)
    ├── catalogue            products (list/form), categories, manufacturers
    ├── partners             customers, suppliers
    ├── finance              expenses, chart of accounts, journal
    ├── reports              sales, products, profit & loss, payments
    └── admin                users, roles & permissions, branches, settings, integrations (webhooks)
```

## How it works

### Session and workspace

`SessionStore` holds the token, the user, the user's memberships, and the chosen workspace (tenant and branch) as signals. It persists them to `localStorage`.

After sign-in, the **workspace picker** lets the user choose a pharmacy and a branch:
- A **member** chooses from their memberships.
- The **root administrator** searches every tenant (`/platform/tenants`) and can also open platform administration.

The branch switcher in the top bar changes the branch. Choosing **All branches** sends no `X-Branch-Id` header, so dashboards and reports cover every branch the user may use. Branch-only pages ask the user to pick a branch.

### HTTP

`apiInterceptor` does four things:
- It adds `Authorization`, `X-Tenant-Id`, `X-Branch-Id` and `X-Correlation-Id` to every `/api/` request.
- It unwraps the `{ success, data }` envelope, so callers get `data` directly.
- It turns RFC 9457 problems into an `ApiError`, which carries `reason`, `field` and `correlationId`.
- On `401` it signs out and returns to sign-in. Other failures show a toast, unless the request is `silent`. Forms use `silent` and `applyApiError()` to put the message on the field the API named.

### Permissions

Navigation items and routes declare a permission code (`data.permission`). The nav hides what the session can't use, and `permissionGuard` redirects to the first page it can open. The root administrator holds every permission.

### Lists

`pagedList()` reloads whenever its request signal, the tenant or the branch changes. It drops stale responses and pages with `nextCursor`.

### Money

Amounts are formatted with `Intl.NumberFormat` in the tenant's currency, which comes from `GET /settings`.

### POS

- The cart maths in `features/pos/cart.ts` previews the API's pricing rules. The API remains authoritative.
- Each sale carries a fresh `idempotencyKey`, also sent as the `Idempotency-Key` header, so a retried sale is never charged twice.
- A cart that holds a `PRESCRIPTION` or `CONTROLLED` item asks for the prescription before checkout.

## Conventions

- One page is one standalone component with `export default`, loaded with `loadComponent`. Its routes sit in the feature's `*.routes.ts`.
- `ChangeDetectionStrategy.OnPush` everywhere; state lives in signals.
- Reusable styles live in `src/styles.scss`. Component styles stay small.
- Format with Prettier (`.prettierrc`, print width 100) and follow `.editorconfig`.

## Production build, end-to-end tests and QA

| Command | What it does |
|---|---|
| `npm run build` | Production build to `dist/pharmacy-core-web/browser` |
| `npm run serve:prod` | Serves that build on http://localhost:4300 and proxies `/api`, `/actuator`, `/v3/api-docs` and `/swagger-ui` to the API (`API_URL`, default http://localhost:8080) |
| `npm run e2e` | Playwright, headed and maximised, against `serve:prod` and a running API (local profile). `CI=1` runs it headless. |

`e2e/routes.spec.ts` signs in as the administrator, the cashier and the root administrator. It opens every route each may use, and fails on console errors, uncaught exceptions and API 404/405/5xx responses.

The `full-test` skill (`.claude/skills/full-test/SKILL.md`) runs the exhaustive QA pass. Its catalog and evidence live in the gitignored `docs/.qa/`.
