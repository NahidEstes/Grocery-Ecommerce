# FreshCart upgrade verification — 20 October 2026

Implemented the requested landing/storefront, account and administrator improvements in the existing Next.js + Express application. Phone OTP is excluded.

## Checks

- `npm run typecheck`: passed.
- `npm test`: 20 passed, 0 failed. Isolated temporary file stores are removed after tests.
- `npm run build`: passed after the final mobile layout correction; all storefront/account/admin routes compile.
- `git diff --check`: passed; Git only reports the configured Windows line-ending conversion notices.
- `npm run test:mongo`: one integration case explicitly skipped because `MONGODB_TEST_URI` is unset. No MongoDB integration success is claimed. Attempting to provision a temporary MongoDB server stalled on its binary download; the unused dependency was removed.
- Gateway tests use mocked SSLCOMMERZ responses: amount/currency/transaction mismatches, verified replay, paid-order fulfilment, reservation expiry, late payment and risk review. No merchant sandbox/live payment was made.
- SMTP reset delivery is not configured. Tests verify reset validation, single use and old-session invalidation with an isolated reset-token fixture.

## Browser evidence

- Desktop account registration with a synthetic `example.test` account succeeded and imported the existing guest basket/address. The local CLI promoted that test account for admin UI verification.
- Administrator product editing and unchanged storefront settings saves succeeded; saved settings show confirmation.
- Mobile pack selection changed the apple from 1 kg / ৳225 to 500 g / ৳112.50 and added the correct SKU.
- Mobile filter dialog selected `500 g`, persisted it in the URL and displayed two matching products.
- Signed-in checkout saved demo order `FC-0387B3BB94C8`: five items, subtotal ৳572.50, delivery ৳40, total ৳612.50; the basket cleared.
- Order help submission reached the admin support screen and was marked resolved.
- Buy again rebuilt the order basket at current prices.
- A browser test exposed an initial saved-cart loading race. Cart mutation controls now wait for account basket loading. Adding a breakfast bundle and reloading preserved all four items; the server’s saved account basket also contained four items.
- Mobile product and admin layouts have equal document client/scroll widths (375 px inside the 390 px viewport), with no document horizontal overflow. Admin navigation scrolls within its own row.
- The final browser console error query returned no errors.
- Browser viewport was restored after checks. Storefront and administrator previews are retained for the user.

## Screenshots

- `screenshots/home-updated-desktop.png`: category tiles, coverage checker and itemized bundles.
- `screenshots/account-desktop.png`: email/password account screen.
- `screenshots/admin-desktop.png`: store manager overview.
- `screenshots/admin-mobile.png`: mobile store manager.
- `screenshots/product-mobile-updated.png`: variant pricing and sticky purchase action.
- `screenshots/filters-mobile.png`: mobile pack-size filter dialog.

## Service configuration still required

The current site uses local demo persistence. Actual MongoDB (Atlas/replica set), SMTP and merchant payment credentials/public HTTPS callback URLs must be supplied and verified for hosted operation. `.env.example` and README document these fields and administrator setup. Real business stock, supplier facts, policies and fulfilment procedures must come from the store. Demo/sandbox data is excluded from customer-review eligibility, popularity and revenue.
