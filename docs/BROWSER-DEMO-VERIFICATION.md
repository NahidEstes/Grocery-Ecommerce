# Browser demo verification — 2026-10-30

Story: a reviewer opens the USA/USD bilingual storefront, searches/selects a pack, shops in a browser-only cart, simulates checkout, reloads the local receipt and previews read-only administration. No Express/DB/payment/email dependency participates in this path.

## Measured checks

| Check                                                           | Result / evidence                                                                                                                                                                |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_BROWSER_DEMO=false` typecheck and production build | Passed on Next.js 16.4.2, Node 24.20.0                                                                                                                                           |
| `NEXT_PUBLIC_BROWSER_DEMO=true` typecheck and production build  | Passed                                                                                                                                                                           |
| Full regression suite, flag OFF and ON                          | 75 tests passed, 0 failed, 0 skipped; includes original backend/core regressions and 6 new browser-demo tests                                                                    |
| Exact opt-in flag                                               | Missing, `false`, `TRUE`, `1` retain backend mode; only `true` uses bundled reads; tested in isolated child processes                                                            |
| Normal production runtime outage                                | An OFF-built app with unreachable `API_URL` returned HTTP 500, retained `/api/:path*` routing and did not show the interactive demo; a URL query could not enable it             |
| Build-time consistency                                          | A true-built artifact started with runtime flag false still rendered demo SSR and client consistently; demo routes manifest had no API rewrite                                   |
| Desktop and mobile                                              | Chromium at 1440×1000 and 390×844; screenshots visually inspected; no page-level horizontal overflow                                                                             |
| Shopping flow                                                   | বাংলা search → product → 500 g variant → favourite → add/remove/quantity → cart reload → FRESH10 → city pickers → simulated checkout → confirmation → receipt reload             |
| City totals                                                     | Two $3.29 apple packs: $6.58 subtotal, $0.66 promo discount; New York $10.91, Chicago $9.91, Los Angeles $11.91                                                                  |
| City/timezone and slots                                         | All three city/state/ZIP settings and IANA zones checked; city-specific slots and one-hour cutoff tested; New York summer/winter offsets verified                                |
| Historic receipt                                                | USD and America/Los_Angeles snapshot retained after reload; fictional customer/address and $11.91 total confirmed                                                                |
| Additional routes                                               | Recipes/detail, price sorting/filter route, pagination, unmatched search, account/list explanations and admin print preview loaded successfully                                  |
| Admin                                                           | Overview/products/orders/inventory previews work without credentials; no editing/upload/form controls; separate static sample orders                                             |
| Storage isolation                                               | Normal BDT cart/orders/addresses and another app's sentinel keys survived browsing and reset; normal cart was not imported                                                       |
| Corrupt/blocked storage                                         | Shopping, checkout, memory receipt and reset completed without a crash; unavailable-storage notice appeared                                                                      |
| Full storage / exhausted quota                                  | Unit regression verified a new in-memory receipt remains readable when older durable orders exist and writes fail                                                                |
| Visible legacy market copy                                      | No ৳, +880, Dhaka, Dhanmondi, Mirpur, Uttara, Gulshan, Bangladesh, GMT+6, bKash or Bengali equivalents in the exercised demo views                                               |
| Network                                                         | Zero client backend/API/other-origin requests; a backend trap also received zero requests                                                                                        |
| Errors                                                          | Zero browser console errors, uncaught exceptions, hydration errors or unexpected failed requests                                                                                 |
| Filesystem                                                      | `.data` file sizes/mtimes unchanged during browser QA; demo runtime imports contain no filesystem persistence                                                                    |
| Bundles                                                         | Next server dependency traces contained no Express backend repository/auth modules, mongoose, MongoDB driver or nodemailer; demo browser modules use browser-safe data/functions |
| PWA                                                             | Active service worker Cache Storage contained only offline shell/icons; no customer/demo page, RSC or private API response cache                                                 |
| Backend endpoint exposure                                       | Direct `/api/health`, `/api/admin/orders`, `/api/orders` probes returned 404 without the Express service header                                                                  |
| Source boundaries                                               | `server/`, original catalog, order helpers, BD/BDT settings/seeds, package dependencies and lockfile unchanged; `git diff --check` passed                                        |

Raw browser results: [verification.json](../artifacts/browser-demo/verification.json). Reproduce with `scripts/verify-browser-demo.mjs` after a demo production build, using the commands in [DEMO-VERCEL.md](../DEMO-VERCEL.md). The script starts and stops its own preview and request trap. QA output is local evidence, not demo state.

Screenshots under `artifacts/browser-demo/`: home, checkout, receipt and admin at both widths. The demo retains the original orange/green storefront styling. The mobile admin table scrolls inside its own container.

## Fixes established during verification

- Removed the old frontend sample fallback from normal-mode API failures. Errors cannot silently switch the deployment to simulated behavior.
- Preserved Next.js internal dynamic-rendering exceptions with `unstable_rethrow`; the manifest loads live normal-mode identity at request time, allowing both production builds to complete without a build-time backend.
- Kept USD promotion fractions and totals in cents; original BDT regression expectations still pass.
- Added a mobile-accessible city picker, guarded storage failures and a quota-aware receipt fallback with a visible reload limitation.

## Explicit limits

Real MongoDB/Atlas transactions, SSLCOMMERZ sandbox/live transactions, SMTP delivery and a public Vercel deployment were **not performed or verified**. Local backend tests use their existing isolated fixture storage and gateway stubs; they do not establish real integration success.

Checkout, fees, availability, prices, orders and inventory previews are fictional simulations. No real payment/email/delivery/refund request is made. Sales tax is not calculated and no tax-compliant checkout claim is made. With browser storage blocked or full, new session data cannot be guaranteed after reload. Only 50 local receipts are retained.

No public deployment, paid plan purchase, Git commit or push was performed. Public hosting is intentionally left for the owner using the documented Vercel project settings and an appropriate commercial-use plan.
