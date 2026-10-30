# USA / USD browser demo

This opt-in frontend mode lets reviewers explore the existing orange/green bilingual storefront without Express, MongoDB, SMTP or a payment gateway. It is separate from the original **Express local demo** (`STORE_MODE=demo`). No public deployment, purchase, commit or push is part of the local implementation.

## Run locally (PowerShell)

From the project root, with Node 24 and dependencies installed:

```powershell
Set-Location 'D:\My Projects\Grocery Ecommerce Site'
npm ci
$env:NEXT_PUBLIC_BROWSER_DEMO = 'true'
npm run dev:web
```

Open <http://127.0.0.1:3000>. Use `dev:web`, which runs only Next.js. The existing `dev` command also starts Express and is for the original architecture.

For a production preview, stop the development server and run:

```powershell
$env:NEXT_PUBLIC_BROWSER_DEMO = 'true'
npm run build
npm run start:web
```

No `.env` file, `STORE_MODE`, `API_URL`, MongoDB URI, SMTP settings or gateway credentials are needed for this mode. Local shell variables override `.env` settings. Keep secrets out of public variables.

## Vercel project settings

Configure a separate demo project from this repository; do not replace an existing live store's environment. No deployment has been performed for you.

| Setting                       | Exact value                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Framework Preset              | **Next.js**                                                                      |
| Root Directory                | Repository root (`./`)                                                           |
| Node.js Version               | **24.x**                                                                         |
| Install Command               | `npm ci`                                                                         |
| Build Command                 | `npm run build`                                                                  |
| Output Directory              | Leave the Next.js default; no override                                           |
| Required environment variable | `NEXT_PUBLIC_BROWSER_DEMO=true`                                                  |
| Environment scope             | Production and Preview for demo deployments; Development if using Vercel locally |

Add the variable **before building**, then create a new deployment. Use the standard Next.js integration; no static export, custom start command, Express process, Vercel Services, cron job or persistent filesystem is required. Do not add backend credentials to this demo project. `/api/*` rewrites are empty in a demo build, and the Next.js app defines no backend API handlers. Direct API probes return 404; the Express implementation remains in the buyer source.

Official references: [build configuration](https://vercel.com/docs/builds/configure-a-build), [environment variables](https://vercel.com/docs/environment-variables). A sales/reviewer demo promoting paid source code must use a plan appropriate for commercial usage. Vercel restricts Hobby to personal, non-commercial use; choose a suitable plan under the [fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines). This implementation does not bypass plan restrictions or purchase a plan.

## Build-time flag and boundaries

Only the exact string `true` enables `NEXT_PUBLIC_BROWSER_DEMO`. Missing, `false`, `TRUE` and `1` use the original backend mode. The direct public environment lookup is compiled into both server and client bundles. Changing a runtime variable after building cannot convert the artifact: rebuild when changing modes. URLs, cookies and browser storage never select the mode. Keep the flag consistent in your build/start environment and use separate deployment origins for normal and demo stores.

`STORE_MODE` retains its existing meaning for Express storage, transactions, authentication and production validation. The browser flag does not alter it and does not grant any real backend permission. Frontend demo API reads use an explicit allowlist; unknown reads and all API mutations reject locally, without falling through to the network.

Normal web loaders still require the Express API. An API outage now raises an unavailable error instead of serving the old bundled preview fallback. Normal checkout never reports simulated success. Next.js internal rendering exceptions are rethrown so normal builds can defer live API reads until request time. The manifest also renders at request time.

## Demo-only USA / USD configuration

- `src/lib/browser-demo/config.ts`: flag, versioned storage prefix and supported cities.
- `src/lib/browser-demo/data.ts`: distinct fictional USD prices for every SKU/variant, storefront settings, FAQ/policies, bundled homepage/recipes, synthetic customer.
- `src/lib/browser-demo/adapter.ts`: local read allowlist; no network or server imports.
- `src/lib/browser-demo/orders.ts`: browser receipts, validation, city slot selection and separate static admin fixtures.
- `src/lib/browser-demo/storage.ts`: guarded local storage, in-memory receipt fallback and scoped reset.

The original BD/BDT profile, seeds, zones, Bangladesh phone rules and SSLCOMMERZ adapter remain unchanged. Demo data clones browser-safe sample products/content; it never overwrites the original seeds. Shared currency formatting uses `en-US` for USD even when the interface language is বাংলা. Shared totals preserve cents for USD promotions and totals. Sample prices are **not live prices or currency conversions**.

| Delivery city          | IANA timezone       | Sample fee | Sample local slots                 |
| ---------------------- | ------------------- | ---------- | ---------------------------------- |
| New York, NY (default) | America/New_York    | $4.99      | 10 AM–12 PM, 12 PM–2 PM, 4 PM–6 PM |
| Chicago, IL            | America/Chicago     | $3.99      | 12 PM–2 PM, 4 PM–6 PM              |
| Los Angeles, CA        | America/Los_Angeles | $5.99      | 10 AM–12 PM, 4 PM–6 PM             |

Existing DST-aware delivery functions calculate dates and one-hour booking cutoffs in the selected city's timezone. The header/banner picker, delivery checker and checkout use this city configuration. Changing city updates fees, available slots, sample address and totals. Receipts snapshot their own currency/timezone, so later city changes do not reinterpret earlier orders.

Free delivery starts at a $50 subtotal before discounts. `FRESH10` gives 10% off products, capped at $5. Example: two $3.29 apple packs subtotal $6.58, discount $0.66; total is $10.91 in New York, $9.91 in Chicago, $11.91 in Los Angeles. **Sales tax is not calculated. This is not a tax-compliant checkout.** No tax rates are asserted.

## What works, what is simulated

The existing home, category/product/pack pages, Bengali/English search, filters, sorting, pagination, recipes, favourites, cart quantities, promotions and delivery calculation remain interactive. Checkout is a separate frontend adapter flow that reuses existing product images, totals, progress steps and delivery functions. It starts with fictional Alex Example, `123 Example Lane, Apt 4`, a city/state/ZIP, United States, and `+1 (202) 555-0142`. No real personal information is needed.

Submitting checkout creates a `DEMO-...` receipt in this browser only, clears the purchased cart, and shows **“Demo only — no real payment or delivery.”** No payment is taken, no email is sent, no delivery is arranged, and no inventory is reserved. Receipts reload from this browser's local storage, with a maximum of 50 stored receipts. They are not accessible on another browser/device. Data is editable by the browser owner and has no accounting or payment authority.

Real login/registration/password reset, email, gateways, refunds, returns, support requests, purchase reviews and account shopping lists are disabled. Account/list routes explain the limitation. Demo cart/checkout omit bKash and real payment controls.

`/admin` opens a **Read-only demo** without credentials. Overview, products, orders and inventory use separate static fictional fixtures, not customer/browser orders. There are no edit/save/delete/upload/role/finance mutation controls. Admin print URLs show the same read-only sample order preview. The real admin workspace and server permission checks are used when the flag is off.

## Browser storage and reset

Only keys starting with `freshcart-browser-demo:usa-usd:v1:` belong to this demo: cart, saved favourites, area, promo, receipts, install dismissal and a storage availability probe. The original `freshcart-cart`, `freshcart-addresses`, `freshcart-orders`, checkout attempts and other applications' data are never imported or overwritten. Old BDT values are not treated as USD. The language cookie is an interface preference, not a market switch.

Use **Reset demo data** in the banner to clear this namespace, cart, favourites, promo and receipts and return to New York. It never calls `localStorage.clear()`, changes normal-mode data or touches another app's storage. Malformed storage is rejected safely. If storage is blocked/full, the cart works in React memory and receipts use a session-memory fallback; a visible notice explains that a reload cannot preserve them. A reload recovery promise applies only when storage is available.

No demo state is written to `.data`, `/tmp` or a server database. The PWA worker caches only the public offline shell and icons; customer pages, RSC payloads and API responses are not cached.

## Return to the original backend

Stop the web server, set `NEXT_PUBLIC_BROWSER_DEMO=false` (or remove it from **all** effective environment files/settings), and **rebuild**. Normal cart/orders remain in their original namespace.

For the original credential-free Express local demo:

```powershell
$env:NEXT_PUBLIC_BROWSER_DEMO = 'false'
$env:STORE_MODE = 'demo'
npm run dev
```

For an optimized original local demo, run `npm run build`, then `npm start` with those variables. `npm start` intentionally starts both Express and Next.js.

Buyer source still includes Express, MongoDB, email/password accounts, permissions, inventory, transactions, payment validation, external reconciliation/refund records, returns, order processing and the BD/BDT SSLCOMMERZ adapter. Production requires the original authenticated MongoDB replica set/Atlas, production environment validation, HTTPS origins and checkout identity secret. SMTP and gateway credentials are needed only for their real integrations. Original guides: [quick start](docs/QUICKSTART.md), [deployment](docs/DEPLOYMENT.md), [operations](docs/OPERATIONS.md).

## Verification

```powershell
$env:NEXT_PUBLIC_BROWSER_DEMO = 'false'
npm run typecheck
npm test
npm run build
$env:NEXT_PUBLIC_BROWSER_DEMO = 'true'
npm run typecheck
npm test
npm run build
```

The test suite includes the original backend regressions and `tests/browser-demo.test.ts` covering exact flag selection, no API fallback, disabled mutations, isolated seeds, USD cents, three city schedules/DST, receipt validation, corrupt/blocked storage and reset isolation.

Optional reproducible Chromium QA after a **demo production build**, installing browser tooling outside the project runtime dependencies:

```powershell
npm install --prefix "$env:TEMP/freshcart-browser-tools" --no-save --no-package-lock playwright
& "$env:TEMP/freshcart-browser-tools/node_modules/.bin/playwright.cmd" install chromium
$env:PLAYWRIGHT_MODULE = "$env:TEMP/freshcart-browser-tools/node_modules/playwright/index.mjs"
node scripts/verify-browser-demo.mjs
```

The script starts/stops its own Next.js preview on port 3377 (override `DEMO_QA_PORT` if occupied) and a backend request trap. It checks 1440px/390px, বাংলা/English shopping/receipt reload, three cities, admin, storage failures, reset isolation, browser errors, backend/API traffic, unchanged `.data` and private-cache boundaries. It deliberately tests that the compiled demo mode survives a mismatched runtime flag. Evidence and screenshots are written to `artifacts/browser-demo/`; this is QA output, not app state.

Real MongoDB transactions, real SSLCOMMERZ transactions/refunds, SMTP delivery and a public Vercel deployment remain unverified without those external services. Passing local backend fixture tests is not proof of those integrations. See [measured browser-demo verification](docs/BROWSER-DEMO-VERIFICATION.md).
