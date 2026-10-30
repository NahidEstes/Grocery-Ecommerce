# Customize the store

## Central store settings

Open Admin → Storefront settings → Store identity & market. Set name, tagline, a local logo asset path or HTTPS URL, support email/phone, ISO currency/country, IANA timezone, city/postal code and phone rules. The same persisted profile feeds server validation, storefront prices/unit comparisons, delivery cutoffs, inventory expiry dates, reports, emails, policies and metadata/manifest names. A profile absent from older data receives `defaultProfile` in `src/lib/store-profile.ts`; existing content/products/orders are preserved. This is a read-compatible default merge, not a destructive migration.

The old market defaults are FreshCart, BDT, BD, Asia/Dhaka and Bangladesh mobile rules. Default `callingCode=880`, `nationalPrefix=0`, `nationalLengths=[10]`, `nationalStarts=[13,14,15,16,17,18,19]`. Store national starts as strings. For US-style ten-digit numbers: calling code `1`, trunk prefix `1`, lengths `10`, starts blank, country US. Check your actual market rules; this simple rule set is not a worldwide phone-number intelligence service. Formatted local/international representations normalize to the same COD identifier. No OTP verification is provided.

Only currencies with two decimal places are accepted. Changing currency does not convert product prices. Currency becomes locked after the first order to avoid mixing historic sales/report amounts; use a fresh store database for a different currency. Original orders carry currency/timezone snapshots; legacy orders default to BDT/Dhaka. Do not change the meaning of a currency by editing the database manually.

The included SSLCOMMERZ adapter supports **BDT / BD only** and does not implement foreign exchange. When its credentials are configured, unsupported market edits are rejected. Other markets can use COD; integrating a suitable hosted gateway is separate development work.

## Delivery areas and dates

Add/edit/remove arbitrary area names, enabled flags, fees and estimates in the same settings form. Names must be unique (use consistent spelling). Removing/disabling an area prevents new checkout there; existing orders keep their address. Previously saved addresses are still visible but must pass current coverage and phone rules on checkout. Five booking dates use the merchant timezone; slots close one hour before their start. IANA offsets handle seasonal DST at the configured daytime slots. Slot labels/times currently use the three defined standard slots; editing slot hours requires changing `src/lib/orders.ts`, not just translating a label.

Country/calling code are individually validated; the merchant must supply a correct combination. The currency lock is deliberately stricter than the area/timezone edits.

## Content and language

Use Homepage editor for hero, banners, section titles/order and active-order panel visibility; Recipe management for recipes. Use English / বাংলা content to maintain product, homepage and recipe text. Translations are tied to their English source and stale translations are ignored after a source edit. Enter your own store policy content; the shipped text is sample copy. Brand names are used verbatim. Dynamic custom policy text needs your own Bengali content/translation if required. UI dictionary: `src/lib/locales/bn.json`.

Seasonal/new arrivals in the fresh demo are sample catalog selections with a fixed sample creation date. Demo mode labels the store visibly. Popularity requires actual non-sandbox delivered order data and customer reviews require moderated purchases. Empty popularity/review shelves are hidden. Do not advertise illustrative organic/seasonal/supplier claims as verified merchant facts; replace sample descriptions with your own substantiated data.

## Replace product photos

Admin → Products & stock → edit → image upload (PNG/JPEG/WebP, up to 2 MB) or HTTPS image URL. Uploads persist in the repository/database as media entities; include them in backups. Transparent or plain backgrounds and consistent square crops work well. Upload an optimized WebP when possible. Atlas index 0–11 is only the bundled illustrative fallback; variants may have separate images.

Source PNGs are kept in `public/images/` for editing. `npm run images:optimize` creates quality-85 WebP hero widths 640/1280/1920 and atlas widths 800/1600 from those same PNGs. `sharp` is included transitively by Next in the lockfile. Hero CSS chooses smaller mobile assets and higher-density alternatives. The homepage editor recognizes the legacy hero path and uses the optimized default; a custom uploaded hero is used directly. Pre-optimize custom banners/uploads yourself; arbitrary remote URLs are not automatically resized by this starter. Keep important subjects on the right of hero artwork because copy sits left.

Bundled fonts are local DM Sans and Noto Sans Bengali, loaded with `next/font/local` and `display:swap`; retain their OFL notices. Use the existing font variables when changing styles.

## App icons and other branding

Replace `public/icon.svg` and the PNGs under `public/icons/` for your own install icon, Apple icon and maskable icon. The generic basket icon is retained until replaced. Manifest/store title uses the central profile; installed app icons may require reinstall/update. `public/offline.html` is a static offline fallback; replace its sample brand wording if desired. Internal cookie/storage keys and API service marker contain `freshcart` for backward compatibility and are not user-facing brand configuration. Source filenames are not renamed automatically.
