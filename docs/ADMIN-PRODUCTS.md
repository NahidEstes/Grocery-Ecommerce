# Admin Products — phase 2

The normal-mode Products workspace now has a searchable, paginated catalog and a
guided editor. The existing backend and role grants are unchanged.

## Using the editor

Open `/admin?section=products`, then choose **Add product** or **Edit**.

- **Basics:** name, category, pack label, description and visibility. New English
  names suggest a SKU/URL; expand Product identity & search to customize
  them. Existing SKUs remain read-only. Bangla-only names need an English SKU/URL.
- **Pricing:** store-currency prices and an optional comparison amount. For a
  500 g pack, enter `0.5` and select kilograms. No currency conversion occurs.
- **Stock & variants:** whole-pack stock, an optional alert threshold (including
  zero), adjustment reason, and a base product for this pack.
- **Photos & details:** existing PNG/JPEG/WebP upload (2 MB), bundled fallback
  photos and optional supplier information.
- **বাংলা content:** English and Bangla side by side. English edits leave old
  translations awaiting review; each translation requires an explicit review or
  text edit before it applies to the revised source.

Switching sections retains the draft. Validation opens the relevant section and
focuses the first invalid field. Save is blocked during upload; failed saves and
version conflicts keep the current draft. Cancel/navigation retain the existing
unsaved-changes confirmation. Customer preview does not save changes.

On mobile, the catalog uses cards, fields use 16px text, navigation and primary
controls have larger touch targets, sections scroll horizontally, preview is
collapsible, and Save/Cancel stay near the bottom of the viewport with safe-area
spacing. Keyboard arrow keys, Home and End also switch editor tabs.

## Preserved boundaries

- Product saves still use `PUT /api/admin/products/:id` with the original version.
- Uploads still use `POST /api/admin/media`; inventory events and audits remain
  server-generated. No new endpoints, migrations or dependencies were added.
- Existing `products` permission checks, staff roles and finance restrictions
  remain authoritative. Browser-demo mode retains its separate read-only admin.
- Settings editor and all server source files match the pre-phase-2 baseline.

## Verification

- `npm test`: 83 passing tests, including API/permissions/checkout regressions and
  draft serialization, duplicate/price/pack validation and bilingual filtering.
- `npm run typecheck`.
- Production builds passed with browser-demo both enabled and disabled. The
  browser-demo regression script also passed; the running preview is normal mode.
- `scripts/verify-admin-products.mjs`: real create/update/upload/stock audit,
  zero threshold, variants, Bangla source review, stale version conflict, unsaved
  changes, search/filter/pagination and permission checks. Desktop 1440px and
  mobile 390px full flows; 320px and 768px section/navigation/Orders layout checks.
- `scripts/verify-admin-workspace.mjs`: previous overview/Orders/navigation and
  manager/editor/fulfilment/customer permission regressions.

Browser scripts require Playwright separately (no runtime dependency):

```powershell
$env:PLAYWRIGHT_MODULE = 'absolute/path/to/playwright/index.mjs'
$env:ADMIN_QA_URL = 'http://127.0.0.1:3000'
node --import tsx scripts/verify-admin-products.mjs
node --import tsx scripts/verify-admin-workspace.mjs
```

The scripts start the original Express app with temporary fixture data and
redirect only their own browser API requests. They never write products, accounts
or orders to the user's running store. Evidence is in
`artifacts/admin-products/verification.json` and the adjacent screenshots.
