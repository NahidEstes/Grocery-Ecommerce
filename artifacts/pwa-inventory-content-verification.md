# PWA, purchasing and bilingual content verification

Verified locally on 25 October 2026 using the production Next.js build and existing Express API.

## Automated checks

- 57 tests passed, including 8 new tests/subtests for merchant translation persistence, source-change fallback, bilingual search, private supplier/cost access, supplier version conflicts, receipt retry safety, concurrent stock additions, FEFO allocations, cancellation restoration, expired-pack exclusion, versioned withdrawal and product/homepage/recipe translation validation.
- The worker test exercises its actual script in a service-worker fixture: only public shell assets are cached; API/RSC requests are untouched; account/checkout navigations use the network or the generic offline shell.
- Production build and TypeScript checking passed. Manifest, worker, offline page, and all installation icons return HTTP 200. Worker cache headers prevent stale script reuse.

## Browser checks

- Existing administrator session opened both new management sections.
- Created local `QA Demo Farm` with no real contact information. Received one banana pack as `QA-20261025-01`, labelled expiry 30 October. Stock rose from 29 to 30 and the batch register showed 1/1 expiring-soon pack at a demo purchase cost of ৳30.
- Withdrew that one QA pack with an explicit verification reason. Register now shows 0/1 depleted and stock returned to 29. No supplier payment or customer order was made. This test receipt and its audit records remain in ignored local demo storage.
- Saved the accurate custom product translation `কলা (দেশি)` through the bilingual editor. The public banana page displayed it in Bangla and retained it after a full reload. English name, URL, pack size and selling price were retained.
- Homepage/banners and recipe ingredient/step bilingual fields rendered in their respective selectors.
- Temporarily stopped the web server, navigated to products, and verified the real registered service worker displayed the bilingual reconnect page. Restarted the server and its Try again link returned to the live homepage.
- New editors checked at mobile width, and the completed local preview is left running for the user.

## Practical limits

- Existing stock has no invented batch/expiry history. Purchasing costs and contacts are private to administrators/managers.
- Real phone installation, iOS Add to Home Screen and app update prompting require testing on their respective devices/browsers. The embedded browser can display install instructions; no native OS installation was performed.
- Production MongoDB and a public HTTPS deployment were not configured in this local run.

Screenshots: `screenshots/bilingual-content-editor.png`, `screenshots/pwa-offline.png` and `screenshots/purchasing-mobile.png`.
