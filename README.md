# বাংলা/English Grocery Ecommerce Starter with Admin

Version 1.1.0. A customizable Next.js / Express / MongoDB source-code starter with a credential-free local demo. Existing orange/green design and বাংলা / English storefront are preserved. Phone OTP is intentionally excluded.

Start with [Buyer quick start](docs/QUICKSTART.md). Copy .env.example to .env, then run npm ci and npm run dev. Default demo URLs are http://127.0.0.1:3000 and internal API 4100. For an optimized demo run npm run build then npm start, retaining explicit STORE_MODE=demo.

## Included

- Responsive catalog/search/filter/variants, favorites, cart/promo/delivery totals, checkout and guest/account orders.
- Durable checkout attempt recovery; persisted checkout rate limits and normalized-phone COD outstanding caps.
- Email/password accounts, saved addresses, regular purchases and personal shopping lists; hosted payment adapter when configured.
- Homepage/recipe/product management and guarded Bengali/English merchant content editing.
- Permission-scoped admin, order operations/print, stock audit, suppliers/batches/expiry, reports, support and moderated purchase reviews.
- External reconciliation/refund ledger and a complete before-delivery cancellation workflow; delivered goods use returns. No money-transfer/refund API is included.
- Central store identity, market/phone/timezone/currency, support, policy text and editable delivery areas.
- PWA install help/offline fallback (no offline checkout/private-data cache), responsive WebP assets and locally hosted Bengali/English fonts.

## Buyer guides

- [Setup and admin creation](docs/QUICKSTART.md)
- [Rebrand, language, market and product image replacement](docs/CUSTOMIZATION.md)
- [Reconciliation/refunds, cancellation and reservation policy](docs/OPERATIONS.md)
- [Deployment, environment, integrations, backup/restore and troubleshooting](docs/DEPLOYMENT.md)
- [Verification evidence and unverified integrations](docs/VERIFICATION.md)
- [Asset/license inventory](docs/ASSETS-LICENSES.md), [dependency inventory](docs/dependency-inventory.json)
- [Commercial license draft](COMMERCIAL-LICENSE-DRAFT.md), [support/update draft](docs/SUPPORT-DRAFT.md), [changelog](CHANGELOG.md)

## Commands

Node 24 LTS recommended (tested locally on 24.20.0). npm ci uses the supplied lockfile. npm run typecheck, npm test and npm run build are the release checks. npm run test:mongo is optional and **skips** without MONGODB_TEST_URI; a skip is not verification. npm run images:optimize rebuilds WebP assets from the existing PNGs. npm run licenses:inventory refreshes dependency notices. In PowerShell, ./scripts/package-release.ps1 creates a source-only sanitized ZIP under artifacts/releases with a SHA-256 file manifest.

## Important boundaries

Explicit STORE_MODE=production requires an authenticated MongoDB replica set/Atlas, HTTPS origins and a shared random checkout identity secret; the API fails startup without prerequisites and cannot fall back to local data during an outage. All storefront routes render dynamically; production API failure does not silently serve the sample catalog. Demo file storage is for local demonstration.

The included SSLCOMMERZ adapter is restricted to BDT/BD; other markets may use COD until a suitable adapter is implemented. Only two-decimal currencies are accepted, and currency is locked after the first order to protect historical reports. Reports show delivered sales before refunds, not settlement/profit. Admin UI remains English; untranslated merchant/service content falls back to its source language.

Real MongoDB transactions/restart/multiple-instance behavior, provider sandbox transactions, SMTP delivery and Docker/HTTPS deployment are **unverified** where services or credentials are unavailable. See the measured verification report before making sales claims. No public deployment is included. Image/code ownership review and commercial/support terms must be finalized by the seller; the supplied license is explicitly a draft.
