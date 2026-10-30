# Release verification — 2026-10-28

Baseline before this request: 57 tests passed; typecheck passed; no pre-existing failures observed. Existing uncommitted PWA, batch/supplier and Bengali content-editor changes were preserved.

## Automated checks

- Final source regression suite: **69 passed, 0 failed**. Covers permissions, normalized COD capacity/concurrency, persisted rate limits and Retry-After, receipt-proof recovery, stale/duplicate/excess external refund records, paid/review cancellation, once-only stock restoration, delivered-return boundaries, custom USD/US market checkout, DST delivery cutoffs, password-reset expiry/single-use and legacy settings. Payment HTTP is mocked in the payment suite; it is not real gateway evidence.
- Typecheck: passed, including route type generation before tsc so a clean extraction needs no shipped .next folder.
- Optimized Next production build: passed; all storefront/manifest routes render dynamically.
- Initial fresh ZIP extraction: npm ci, typecheck, tests and production build passed. Its install audit exposed a body-parser advisory; the transitive package was patched to **2.4.0**, the release lockfile/notices regenerated and a malformed-compressed-request regression added. Final fresh extraction then passed npm ci (0 audit findings), route type generation/typecheck, all 69 tests, optimized build and npm start on ports 3000/4100. A blank proxy-setting startup bug found during extraction was fixed and covered; project-root configuration also prevents accidental parent-lockfile selection.
- Final source npm audit: **0 known vulnerabilities at check time**. This does not establish absence of vulnerabilities or replace an independent security review. Advisory: https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828.
- Optional Mongo test: **1 skipped**, no service URI configured. Not counted as a passing integration.
- Dependency inventory: 229 lockfile entries, 146 copied installed-package notice files; no unresolved package license identifiers in the generated inventory. Platform packages not installed on this host still require target-platform notice review.

## Browser → API → data → UI

Local optimized web server and Express, isolated synthetic QA data, Windows/Node 24.20.0:

| Story                                                                  | Observed result                                                                                                                                                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Desktop 1440 × 1000 product → cart → FRESH10 → checkout → confirmation | Passed. A 905 subtotal, 40 delivery and 91 discount produced the same 854 total on checkout and saved order; purchased quantities left the basket                                                      |
| Mobile 390 × 844 বাংলা search → cart → checkout → order                | Passed. Search কলা resolved banana; 70 + 40 − 7 = 103 on the saved demo order. No real delivery/payment                                                                                                |
| Language switching                                                     | English/বাংলা navigation, product, checkout and confirmation changed without losing cart state; custom text uses documented source-language fallback                                                   |
| Desktop/mobile layout                                                  | No horizontal overflow in checked views. Fixed a font-variable scope issue discovered visually; English uses DM Sans, Bengali Noto Sans Bengali. Raised small order/supporting text and controls       |
| Admin finance                                                          | Simulated review order reconciled 110, recorded external refund 110, cancelled; persisted ledger held two staff/time/evidence events and remaining 0; banana stock restored once; no money transferred |
| Settings                                                               | UI saved a custom brand/support email and fifth delivery area; storefront title/logo text/area picker reflected the settings                                                                           |
| Permissions                                                            | Logged-out admin page blocked; fulfilment finance access rejected with 403 by API regression tests                                                                                                     |
| Production missing DB                                                  | API exited 1 with a clear MONGODB_URI requirement                                                                                                                                                      |
| Production API outage                                                  | Browser displayed Store temporarily unavailable in English/Bengali; no bundled sample catalog                                                                                                          |
| Empty shelves                                                          | Popularity/review headings hidden without data. Seasonal/new arrivals remain clearly labeled demo selections                                                                                           |
| Browser logs                                                           | No application console errors in the checked normal flows; deliberate outage produced expected server error logs                                                                                       |

Existing PNGs total **4,281,730 bytes**. Largest delivered WebPs total **339,350 bytes** (92.1% reduction); 640px mobile hero is 39,466 bytes, 800px atlas 66,060 bytes. Original PNGs remain editable sources. Browser delivery/readability was inspected; no universal performance score is claimed.

QA accounts/orders, browser receipt proofs, screenshots and local data are excluded from the buyer ZIP. The allowlist archive includes a per-file SHA-256 manifest and only .env.example, never .env, .git, node_modules, .next, .data or test output. Inspect the final archive hash and fresh-install evidence supplied alongside delivery.

## Still unverified

- Actual MongoDB replica-set persistence/reconnect, cross-process transactions and stock contention: no MongoDB service/test URI supplied. Runnable tests include separate worker processes; they have not been executed against a real replica set here.
- SSLCOMMERZ success/fail/cancel, public/delayed/duplicate callback transport and sandbox reconciliation: no merchant sandbox credentials/public HTTPS callback service supplied.
- SMTP inbox delivery/expiry by real email: no SMTP/inbox configuration supplied. Automated token logic does not prove delivery.
- Docker/Compose, Caddy certificates/proxy client-IP propagation and backup/restore execution: Docker/mongod/mongosh absent on this host. Recipes are staging procedures, not tested container deployment claims.
- Live payments, load/penetration testing, legal/commercial asset clearance, jurisdiction-specific policy compliance and operational support/SLA.

No public deployment, Git commit or push was performed. Suitable claim: customizable বাংলা/English grocery ecommerce **source-code starter with admin and a tested local demo**, documented manual financial workflow and integration adapters. Do not claim fully production-ready/live-payment verified, automatically refunding, audited secure, legally cleared assets, or complete worldwide currency/phone/tax support. Seller identity, image/code rights, final license scope/price/jurisdiction and support/update commitments remain seller decisions.
