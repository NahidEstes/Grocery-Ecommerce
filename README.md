# FreshCart

Responsive Next.js grocery ecommerce site with an Express API and MongoDB/Mongoose storage. The local demo works without external credentials. Phone OTP is intentionally excluded.

## Run

Requires Node.js 20.19+ (tested on Node 24).

```sh
npm install
npm run dev
```

Open [FreshCart](http://127.0.0.1:3000/). Express listens at `127.0.0.1:4100`; Next.js proxies `/api` to it. `npm run build` creates the frontend production build; `npm start` starts both services. Set `NODE_ENV=production` on hosting and serve the web app over HTTPS. Keep Express behind the same-origin proxy. A separately configured but unavailable MongoDB stops startup instead of silently switching storage.

If port 3000 is occupied, run the web app with `npm run dev:web -- --port 3001` and the API with `WEB_ORIGIN=http://127.0.0.1:3001` in its environment. The current local preview uses [port 3001](http://127.0.0.1:3001/).

## What is included

| Page                   | Features                                                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                    | Category photo tiles, delivery coverage checker, itemized breakfast/weekly/family baskets, offers, seasonal and new-arrival shelves, actual completed-purchase popularity, moderated verified reviews, FAQ              |
| `/products`            | URL-backed category, search, organic, price, brand, dietary and pack-size filters; sort, pagination, saved items; mobile filter dialog                                                                                  |
| `/products/apple-fuji` | Independent pack SKUs, prices and stock; unit comparisons; zoom, quantity and favourites; supplier details; verified reviews; sticky mobile purchase button                                                             |
| `/cart`                | Quantities, relevant suggested products, configurable promos, area-based shipping and free-delivery progress                                                                                                            |
| `/checkout`            | Guest/account addresses, five Dhaka delivery dates, configurable slots, instructions, current-price review, COD and configured hosted online checkout                                                                   |
| `/orders`              | Account orders across devices plus guest browser receipts; buy again at current prices and stock                                                                                                                        |
| `/orders/:reference`   | Immutable price snapshots, stored fulfilment timeline, private retrieval, address edits before preparation, payment state and support requests                                                                          |
| `/account`             | Email/password registration and login, profile, up to eight addresses, cross-device basket, guest basket/address/order import and email password reset                                                                  |
| `/admin`               | Overview, product/SKU/image URL/price/stock editing, categories, orders and permitted status transitions, low stock, bundles, promos, homepage sections, coverage, slots, FAQ, review moderation and support resolution |

The site preserves the selected orange/green design. Mobile bottom navigation connects Home, Categories, Cart and Orders. Prices per kg/litre/piece are calculated only when a pack measurement is available. Supplier-specific origin, nutrition, allergen and storage facts remain empty until entered. No customer reviews or sales figures are fabricated. Popularity and revenue exclude demo/sandbox orders; review eligibility requires a real delivered purchase. Empty shelves and reviews show honest empty states.

The starting catalog is sample data with generated illustrative photos, 12 base products and 4 extra pack SKUs. Pack SKUs have independent inventory. Add banana, apple, milk and bread for the reference basket: subtotal ৳460 plus ৳40 delivery = ৳500. Default `FRESH10` discounts 10%, capped at ৳100; the admin can change these rules. Bundle prices sum their component products and do not imply a special discount.

## Accounts and administrator setup

Register your own email/password at `/account`, then promote that existing account from the project terminal:

```sh
npm run admin:promote -- your-email@example.com
```

Refresh `/account` or `/admin`. There is no default administrator password or public role-assignment API. Registration always creates a customer. Passwords use salted scrypt hashes; session tokens are opaque, stored hashed on the server and sent in HttpOnly, SameSite cookies (Secure on HTTPS/production). Logout revokes the session. Resetting a password invalidates existing sessions. Mutation routes check the allowed origin and JSON content type; sign-in/reset endpoints rate-limit attempts. Guest order receipt tokens are hashed and sent in authorization headers, never order URLs.

Signing in merges the current guest basket and addresses into the account and claims guest orders only when the browser supplies their private access receipts. Signing out clears the browser’s cart, addresses and receipts. Favourites and delivery area are local browser preferences. Anonymous users can still check out.

## Storage and MongoDB

Copy `.env.example` to `.env` and configure `MONGODB_URI` for an Atlas database or a MongoDB replica set. Transactions are required for atomic stock/order updates; standalone MongoDB is rejected at startup.

```sh
npm run seed
npm run dev
```

The seed adds missing sample products without replacing existing ones. Commerce entities (catalog overrides, accounts, sessions, settings, orders, reviews, payment mappings and support tickets) persist in the indexed `StoreEntity` Mongoose collection. Existing Product/Order model records remain readable. Entity writes within checkout/status/account operations use MongoDB transactions.

Without MongoDB, data persists in ignored `.data/store.json`. Atomic replacement and an inter-process file lock protect local transactions. Earlier `.data/orders/*.json` demo receipts remain readable and migrate on update. Local demo accounts/orders are deliberately separate from MongoDB; enabling MongoDB does not import local private data automatically. Do not use the demo filesystem as hosted commerce storage.

Checkout checks current stock, prices, coverage, time slots, consent and promos on the server. The UI supplies an expected total solely to detect price changes, never to determine the charge. Changed totals require another review. Idempotent retries reserve stock once. Valid cancellation restores reserved stock once; older demo orders without inventory reservations do not increase stock. Product edits use a version check to prevent overwriting stock changed during editing. Delivered order snapshots keep their original prices.

## Personal shopping and recipe baskets

- The homepage shows the signed-in customer's frequent purchases from their own uncancelled orders, at current catalog prices. Unpaid online orders do not contribute. The active-order banner uses saved fulfilment/payment status and refreshes on focus, navigation and every visible minute; it offers a manual refresh. Demo orders are explicitly labelled.
- The header searches Bengali, English and common transliterations with keyboard-accessible product suggestions, photos, pack sizes and prices. The same matching applies to the catalog results and list editor.
- `/lists` stores named account-owned lists with notes, desired pack quantities, edit, archive/restore and save-current-basket actions. Lists sync through the API on other devices. Version checks reject conflicting edits. List quantities remain intact when stock falls; adding checks current price and remaining stock, reports limitations and preserves the list.
- `/recipes` and `/recipes/[slug]` offer three starter recipes, 2–8 servings, whole-pack conversion, alternate pack sizes and ingredient checkboxes. Pantry seasonings are excluded. Ingredient totals cover purchased packs, with shipping calculated in the basket. Quantities are added to the existing basket, so customers can untick ingredients they already have.
- The header basket opens a modal side drawer with quantity/removal controls, current prices, delivery/promo totals, free-delivery progress, save-as-list and checkout links. Escape restores focus to the basket button.

Personal shopping endpoints: `GET /api/me/shopping`, `POST /api/me/lists`, `PUT /api/me/lists/:id`, `PATCH /api/me/lists/:id/archive`. Authentication and ownership are enforced server-side; summaries exclude addresses and receipt secrets. Each account can keep 20 active lists with up to 50 products and 100 packs per product. Lists use the existing MongoDB/demo repository; no new service credentials are needed.

## Password reset email

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, optionally `SMTP_USER`/`SMTP_PASSWORD`, and `MAIL_FROM`. Set `WEB_ORIGIN` to the actual site origin. Reset links expire in 30 minutes, are single use, and are not returned by the API or printed in application logs. The reset UI is at `/account`. Without SMTP, login/registration work and the reset form explains that email delivery is not configured. Transport uses [Nodemailer SMTP](https://nodemailer.com/smtp).

## bKash and card payments

Integration uses [SSLCOMMERZ hosted checkout](https://developer.sslcommerz.com/doc/v4/), where available bKash/card channels depend on the merchant account. FreshCart does not collect card details.

1. Start with sandbox merchant credentials in `SSLCOMMERZ_STORE_ID` and `SSLCOMMERZ_STORE_PASSWORD`; leave `SSLCOMMERZ_LIVE=false`.
2. Configure the public HTTPS `WEB_ORIGIN` and `PUBLIC_API_URL`. `PUBLIC_API_URL` is the API base without `/api`. The gateway must be able to POST to `/api/payments/ipn` and `/api/payments/return`.
3. Verify sandbox success, decline, cancel, interrupted return and IPN delivery with your merchant account before changing to live credentials. Live mode also requires MongoDB.

Online payment requires an account email. Gateway session creation and validation happen on the server. Amount, currency, transaction ID, validation ID and risk result are checked. Return URLs and caller-supplied status alone cannot mark an order paid. Duplicate validated callbacks are idempotent. A risky or late payment on a cancelled reservation is marked for review and cannot enter fulfilment. Paid/review orders require manual reconciliation/refund before cancellation; automated refunds are not implemented.

An unpaid online order reserves stock for 30 minutes. The API sweeps expired reservations every minute and before new checkout/admin/payment actions. An ambiguous gateway initialization is not retried with a second transaction; refresh the order and reconcile or let its reservation expire. External gateway calls occur outside MongoDB transaction retry callbacks. Missing gateway credentials keep online payment disabled. No real merchant sandbox/live transaction has been performed in this workspace.

## API groups

- Public: `/api/health`, `/api/catalog`, `/api/products`, `/api/products/:slug`, `/api/categories`, `/api/storefront`, `/api/reviews`.
- Authentication: `POST /api/auth/register`, `/login`, `/logout`, `/forgot`, `/reset`; `GET /api/auth/session`.
- Account: `GET/PATCH /api/me`, `GET/PUT /api/me/cart`, `GET /api/me/orders`, `POST /api/me/import`.
- Checkout: `POST /api/orders`; private `GET /api/orders/:reference`, `PATCH .../address`, `POST .../pay`, `POST .../support`.
- Admin: `GET /api/admin/overview`, `PUT /api/admin/products/:id`, `PUT /api/admin/settings`, `PATCH /api/admin/orders/:reference`, `PATCH /api/admin/reviews/:id`, `PATCH /api/admin/support/:id`.
- Gateway: `POST /api/payments/ipn`, `GET/POST /api/payments/return`.

All admin endpoints enforce the role on the server. Private order reads require an owner/admin session or the matching guest receipt. Responses use `private, no-store` and strip secret hashes and gateway validation IDs.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Tests use isolated temporary stores. They cover registration/roles, session privacy, separate-device account access, guest ownership proofs, password reset/revocation, server pricing, concurrent stock limits, duplicate checkout, cancellation, status transitions, settings, verified review moderation, delivery date boundaries and mocked gateway verification/replay/expiry. Browser QA covers desktop/mobile views, registration/import, administrator product/settings saves, variant addition, mobile filter results, account checkout, support submission and reorder.

For a real MongoDB transaction check, set `MONGODB_TEST_URI` to a **test replica-set server** and run `npm run test:mongo`. The check creates a uniquely named `freshcart_test_*` database and drops only that test database afterwards. MongoDB checks remain unverified here because no database service/credentials are configured; a temporary-server download was unavailable.

## Assets and remaining service setup

Design prompts are in `design-concepts/`. Generated site photos are local in `public/images/`; products can use admin-configured HTTPS image URLs. DM Sans has a system-font fallback. Screenshots and verification notes are in `artifacts/`.

Before taking real orders, configure MongoDB, SMTP and the merchant gateway; enter actual supplier facts, prices, stock, delivery coverage, customer policies and business support procedures. Fulfilment status is managed by the admin; there is no courier GPS integration. Support requests are stored in the admin panel and do not send external email/SMS notifications. No deployment was requested; this project remains local.
