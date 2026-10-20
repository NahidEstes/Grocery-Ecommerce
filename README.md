# FreshCart

A responsive grocery storefront built from the selected orange-and-green designs. Four primary pages: homepage, product listing, product details and shopping cart.

## Stack

- Next.js App Router, React, TypeScript and custom responsive CSS
- Express on Node.js, with a same-origin `/api` proxy from Next.js
- MongoDB through Mongoose, with an explicit sample-catalog mode when no database is configured
- Zod request validation and Lucide icons

## Run locally

Requires Node.js 20.19 or newer (this project was tested using Node.js 24).

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. Express runs on http://127.0.0.1:4100. The single dev command starts both services. `npm run build` builds the frontend; `npm start` runs both services in production mode after building.

## Pages and interactions

- `/`: category links, promotions and featured offers
- `/products`: URL-backed search, category and organic filters, price filters, sorting, pagination and saved products
- `/products/apple-fuji`: dynamic product details, photo zoom, pack information, quantity, saved products and related items
- `/cart`: persistent cart, quantity changes, removals, calculated shipping, promo codes and checkout dialog

Cart, favourites and delivery area persist in browser storage. Carts start empty. Add the banana, Fuji apple, milk and bread to reproduce the reference basket: ৳460 subtotal + ৳40 delivery = ৳500 total. Delivery becomes free at ৳1,000. `FRESH10` discounts 10% of the subtotal, capped at ৳100.

The checkout dialog accepts a Bangladesh mobile number, address and cash-on-delivery selection. In demo mode, orders are saved under ignored `.data/orders/`, and the UI clearly states that no payment or delivery is arranged. Prices are recalculated by the API; client-provided totals are never trusted. There is no live payment gateway, authentication, fulfillment integration or admin dashboard in this four-page implementation. Stock quantities limit the basket and order validation; production inventory reservations and payment integrations are future work.

## MongoDB

Copy `.env.example` to `.env`, then configure your own connection string:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/freshcart
API_PORT=4100
API_URL=http://127.0.0.1:4100
WEB_ORIGIN=http://127.0.0.1:3000
```

Run `npm run seed`, then `npm run dev`. The seed operation inserts missing sample products without replacing existing products. With MongoDB connected, catalog reads and order writes use the database. An explicitly configured but unreachable database stops the API instead of silently saving orders elsewhere. Never expose your connection string in `NEXT_PUBLIC_` variables.

To run frontend and API separately: `npm run dev:web` and `npm run dev:api`. The frontend can preview with the bundled catalog if the API is unavailable; checkout requires the API.

## API

- `GET /api/health` — service health and storage mode
- `GET /api/categories`
- `GET /api/products?q=apple&category=fruits&sort=price-asc&page=1&limit=8`
- `GET /api/products/:slug`
- `POST /api/orders` — validated order, server-calculated total and unique reference

Additional product filters: `organic=true`, `offers=true`, `maxPrice=100`. Sort values: `featured`, `price-asc`, `price-desc`, `rating`, `name`.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Tests cover reference totals, promotion caps, free-delivery boundaries, malformed stored carts, search/filter composition, API validation, missing products and duplicate-item stock limits.

## Visual assets

Selected design references and original image prompts are in `design-concepts/`. Custom website photography was generated using built-in ImageGen and is stored locally at `public/images/grocery-hero.png` and `public/images/product-atlas.png`. Prompt descriptions are in `design-concepts/website-assets.md`. The product atlas contains twelve product photos in a four-column, three-row grid, displayed using CSS background positions. All essential page images are local; DM Sans loads from Google Fonts with a system font fallback.

## Deployment

This is a local Next.js + Express application. Deploy the Next.js web app and the Node.js API on compatible hosting and configure `API_URL`, `MONGODB_URI`, and `WEB_ORIGIN`. The demo filesystem order store is intended for local development; use MongoDB for durable hosted storage. Before public commerce launch, add authentication where required, abuse protection, inventory reservations, actual fulfillment processes, and a payment provider if accepting online payments.
