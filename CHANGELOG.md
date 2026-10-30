# Changelog

## 1.1.0 — buyer starter preparation, 2026-10-28

- Preserve and include the previously uncommitted PWA fallback/install UI, supplier/batch receiving and expiry controls, and guarded Bengali content translations.
- Add an external reconciliation/refund ledger with finance permissions, audit identity/time/evidence, idempotency, excess/conflict checks and a usable cancellation UI. Delivered orders retain the return workflow.
- Persist checkout rate limits; normalize COD identities and fence outstanding order capacity. Add durable browser attempt recovery after reload/lost acknowledgement.
- Explicit demo/production merchant modes, production database/config startup checks and no silent sample catalog during production outages.
- Central merchant identity/market/support/policies and editable delivery areas. Merchant-local delivery/expiry/report dates, two-decimal currency formatting, historical currency protection and BDT/BD gateway restrictions.
- Optimize existing hero/atlas PNG delivery to responsive WebP; self-host English/Bengali fonts; label demo selections and preserve empty-shelf honesty.
- Add buyer guides, license/asset inventory, support/commercial-term drafts, staging Compose recipes and sanitized ZIP packaging with SHA-256 file manifest.
- Add regression coverage. Real MongoDB, provider sandbox, SMTP and container/proxy execution remain unverified where services are absent; see verification report.

- Update transitive body-parser to 2.4.0 for GHSA-27r3-jxmh-p828; final npm audit reports no known vulnerabilities at verification time. This is not a full security certification.

## Previous baseline

Existing responsive storefront/admin, accounts (email/password; no phone OTP), cart/promos, checkout/orders, lists, recipes, reports, stock/audit, moderated reviews/support and external return/refund recording. No previous uncommitted work was reset to make this release.
