# Local verification

Verified on October 20, 2026.

- `npm run typecheck`: passed.
- `npm test`: six tests passed, including catalog filters, reference cart arithmetic, shipping threshold, promotion caps, saved-cart sanitization, API validation, persisted orders and server-side repricing.
- `npm run build`: passed. Next.js produced routes `/`, `/products`, `/products/[slug]`, `/cart` and the not-found page.
- All four primary pages returned HTTP 200. `/api/health` returned the FreshCart service identifier and `storage: demo`.
- Browser QA: desktop at 1440px, tablet at 768px and mobile at 390px. No horizontal overflow at these breakpoints.
- Browser flows verified: search to product detail, combined fruit filter and price sorting, quantity controls, wishlist persistence, product information tabs, mobile navigation and Escape dismissal, saved basket after reload, promo application, demo checkout and confirmation.
- Reference basket: one banana pack, one Fuji apple pack, one milk carton and one bread loaf; subtotal ৳460, delivery ৳40, total ৳500.
- Successful demo order was saved locally and the cart was cleared. The confirmation explicitly stated that no payment or delivery was arranged.
- After the saved-cart hydration fix, a reload with a non-empty basket completed with no new browser errors.

MongoDB persistence has not been exercised against a live database because no connection string was supplied. Mongoose schemas, connection handling and a non-destructive seed command are included. The API uses port 4100 because port 4000 was already occupied by another local service.

Screenshots are stored in `artifacts/screenshots/`. Generated website photo assets and their prompts are documented in `design-concepts/website-assets.md`.
