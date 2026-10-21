# Personal shopping verification — 21 October 2026

Implemented six features: account-based regular purchases, bilingual smart search, personal shopping lists, recipe ingredient baskets, an active-order homepage banner and a modal mini cart.

Validation completed:

- `npm test`: 31 passed, 0 failed. Isolated test stores cover Bengali/English/transliteration matching, filter composition, account isolation, stale list versions, archive/restore, current pricing, actual order status summaries, stock-aware basket planning and whole-pack recipe calculations.
- `npm run typecheck`: passed. Final `npm run build`: passed, including `/lists`, `/recipes` and `/recipes/[slug]`.
- `git diff --check`: passed.
- Browser: Bengali আলু suggestions and arrow/Enter navigation opened Potato (Local). Bengali ডিম matched eggs at mobile width.
- Created a synthetic QA account's “সাপ্তাহিক বাজার” list using Bengali search; saved two milk packs and potatoes. Reload preserved the list. Archived/restored, edited potato quantity, and added available products to the existing cart.
- A second browser tab loaded the saved list and quantities through the account API.
- Recipe: six salad servings require 750 g cucumber, converted to two 500 g packs. Selected the 1 kg tomato pack, excluded carrots and pantry seasoning, and added only the selected three packs at ৳150.
- Mini cart: updated quantities and totals, confirmed checkout/full-cart links, and opened save-as-list with all seven basket products prefilled. Escape closed the drawer and returned focus to the basket button without changing the recipe page.
- The homepage displayed the existing QA order's actual status, its explicit demo label, regular purchases and the saved list shortcut; manual refresh worked.
- Responsive browser checks at 390×844: no horizontal overflow on homepage, recipe, list editor or mini cart. Viewport override reset afterwards.
- Browser error logs were empty on home, lists and recipes at completion.

Local preview: http://127.0.0.1:3001/ (port 3000 is occupied by another project). API: 4100 with WEB_ORIGIN set to port 3001 in its process environment. No deployment or Git commit performed.

Screenshots are in `artifacts/screenshots/`: `home-shopping-desktop.png`, `regular-shopping-desktop.png`, `smart-search-bengali.png`, `shopping-lists.png`, `shopping-lists-mobile.png`, `recipe-shopping.png`, `recipes-desktop.png`, `home-shopping-mobile.png`, `mini-cart-mobile.png`.

These checks use local demo storage and synthetic QA data. MongoDB, SMTP and merchant gateway service validation retain the setup requirements documented in README.md.
