# Admin workspace — phase 1

Implemented locally on 2026-10-30. The normal admin workspace keeps the existing orange/green identity with a dedicated layout, grouped navigation, an operational overview and a focused Orders page.

## Using the workspace

Open `/admin` while signed in with an existing staff account. The default page remains permission-based: overview for report-capable staff, products for editors, and orders for fulfilment staff. Customers and unauthenticated visitors cannot open the workspace.

- The desktop sidebar groups tools into Daily operations, Catalog, Content, Customers, and Business & settings. It supports menu search, collapsible groups and an icon-only view.
- Mobile uses a dialog drawer with keyboard/focus handling. The desktop collapse preference does not hide mobile navigation labels.
- The top bar offers workspace refresh, a work-queue shortcut, account access and a return to the storefront. Storefront search/cart/footer/PWA prompts and shopping navigation are omitted on admin routes.
- Overview shows existing all-time metrics with clear definitions, then tasks for new orders, today's open deliveries, low stock, returns and batch expiry. Extra data loads only through existing endpoints and only with the corresponding permissions. Failed/loading task counts display a dash, not a fabricated zero.
- Orders has fulfilment tabs/counts, search, payment/area/date filters, chronological delivery sorting, pagination and separate payment/fulfilment badges. On narrow screens each order becomes a readable card.
- Open an order to see its customer, delivery schedule, items and totals. Status changes require a review step and still call the existing backend transition endpoint. Existing batch picking, notes/history, printing and finance tools remain available inside the detail drawer; finance tools retain their permission check.
- Older orders without a delivery selection display **Not scheduled**, stay out of dated delivery queues and sort after scheduled orders. Existing records are not rewritten or assigned an invented date. Calendar identities use `formatToParts`, independent of browser display-date conventions.
- Existing unsaved-change protection remains active for product/content/settings editors.

The browser-demo's separate read-only admin remains available under its original flag. No real API authentication is bypassed by the new layout.

## Source boundaries

| File                                | Responsibility                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `src/components/store-frame.tsx`    | Route-aware storefront/admin chrome, with the shared providers retained      |
| `src/components/admin-shell.tsx`    | Grouped sidebar, top bar, collapse/mobile drawer and focus handling          |
| `src/components/admin-overview.tsx` | Metrics, permission-gated work queue, recent orders and stock watch          |
| `src/components/admin-orders.tsx`   | Order filters/list/pagination, details and existing operations/finance tools |
| `src/lib/admin-workspace.ts`        | Tool metadata, existing permission mapping, date/filter/sort helpers         |
| `src/app/admin-workspace.css`       | Workspace styles and responsive layouts                                      |

`server/` files are byte-for-byte unchanged from the start of this phase, checked against SHA-256 hashes. The role grants in `src/lib/management.ts` are unchanged. The existing ProductEditor and SettingsEditor function bodies are unchanged. Previous browser-demo changes remain present. No new package dependency, public deployment, commit or push was introduced.

## Verification

- `npm run typecheck`: passed.
- `npm test`: **80 passed, 0 failed, 0 skipped**, including original backend regressions and five new workspace tests.
- Normal-mode production build: passed.
- Browser-demo production build and the existing desktop/mobile demo regression flow: passed after the route-aware layout change.
- Chromium at 1440px and 390px: overview → new-order task → Orders → search/filter/pagination → details → status update → history note → unsaved product draft navigation. No page-level horizontal overflow.
- The order mutation/history flow used the **original Express API with temporary isolated fixture data**, reached through a test-browser-only API proxy. Test staff roles, orders, notes and stock did not alter the user's running store data. The fixture is removed after the run.
- Role checks covered admin, manager, editor, fulfilment and customer, including rejected direct finance requests and absence of unauthorized menu/finance controls. No unauthorized endpoint requests or browser errors occurred in the completed automated run.
- Fixtures include a legacy order with no delivery selection and a batch with an upcoming expiry.
- The user's running normal-mode workspace was also checked read-only in the in-app browser: overview, order list and the existing legacy-order detail load correctly after the compatibility fix.
- `git diff --check`: passed.

Raw normal-mode browser evidence: [verification.json](../artifacts/admin-workspace/verification.json). Screenshots in `artifacts/admin-workspace/`: `overview-1440.png`, `overview-390.png`, `orders-1440.png`, `orders-390.png`, `order-detail-1440.png`, `order-detail-390.png`.

## Reproduce browser QA

Start the normal-mode web/API locally as documented in the quick start. With Playwright installed separately (the project runtime dependency list remains unchanged):

```powershell
$env:PLAYWRIGHT_MODULE = "$env:TEMP/freshcart-browser-tools/node_modules/playwright/index.mjs"
node --import tsx scripts/verify-admin-workspace.mjs
```

`ADMIN_QA_URL` optionally selects a different normal-mode web URL. The harness starts a disposable original Express API on an ephemeral port and routes only its own browser's API requests there. It creates staff fixtures only in its generated temporary directory, never by promoting accounts in the user's store.

The work does not establish verification of live MongoDB, SMTP or payment-provider integrations; the backend's existing setup requirements still apply.
