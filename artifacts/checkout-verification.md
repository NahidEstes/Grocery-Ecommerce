# Checkout and order pages

Implemented October 20, 2026, from the two supplied page references.

## Automated checks

- TypeScript check passes.
- Nine test cases pass. The API test exercises server-side pricing, slot validation, consent validation, rejection of unavailable payment methods, persistent order snapshots, private order access, address updates, status-based address restrictions and concurrent request deduplication.
- Production build includes `/checkout`, `/orders` and `/orders/[reference]`.

## Browser verification

- Tested at 1440px desktop and 390px mobile widths, without horizontal overflow.
- Added a sample home address, edited it, chose a delivery date and afternoon slot, changed product quantities and entered delivery instructions.
- Verified that checkout selection and instructions survive reload while the review checkbox resets.
- Verified that submission without review is blocked and the delivery/privacy dialogs open.
- Placed a demo basket: subtotal ৳460, delivery ৳40, total ৳500.
- Confirmed redirect to a persisted order, cart clearing, selected slot, item snapshots and instructions.
- Changed the order address, reloaded, and verified the new address remained.
- Opened the saved orders list and its order link.
- Verified the cart-to-checkout route, a ৳46 FRESH10 discount (৳454 total), retention when returning to the cart and a return to ৳500 after removing the promotion.

Demo orders never collect money or schedule delivery. Online payment methods remain disabled. MongoDB integration has not been tested against a live database because no connection string is configured.

Screenshots: `screenshots/checkout-desktop.png`, `screenshots/order-confirmation-desktop.png`, and `screenshots/order-confirmation-mobile.png`.
