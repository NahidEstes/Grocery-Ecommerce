# Language switch verification

Verified on 23 October 2026 at http://127.0.0.1:3001/.

- English / বাংলা selector is available in the shared header, with native keyboard controls and a bilingual accessible name. It becomes interactive after hydration.
- English and Bangla both survive full reloads. The server initializes the HTML `lang` and the provider from the same language cookie.
- Switching with a search query retains the typed query.
- Switching on checkout preserves typed instructions, selected address, delivery slot, cash-on-delivery selection, 10 basket packs and the ৳720 total. Temporary test instructions were cleared. No checkout order was submitted.
- Bangla product sorting updates the URL to `sort=price-asc` and keeps the internal sort value unchanged. Translated option labels retain their original submitted values.
- Verified Bangla homepage, product listing, lists, recipe details and an existing demo order confirmation. The order status is localized without modifying the order.
- At 375px the homepage switch remains visible with no horizontal overflow. Checked listing, checkout, lists, recipe and order layouts at mobile width. Desktop English homepage checked at 1366px with no horizontal overflow. Temporary viewport overrides were reset.
- Browser logs contained Fast Refresh notices from development edits; no application errors were observed during the final checks.
- `npm test`: 49 passed, including locale validation, unknown-content fallback, literal interpolation, dictionary placeholders, bundled-copy coverage and localized date/unit display.
- `npm run typecheck` and `npm run build`: passed.

Screenshots: `screenshots/language-bangla-mobile.png` and `screenshots/language-english-desktop.png`.

The admin editing workspace retains its English interface. New merchant-written content and unknown API messages keep their original copy until translations are added to `src/lib/locales/bn.json`.
