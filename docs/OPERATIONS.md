# Checkout, payments and merchant operations

## Manual financial workflow

Admin → Orders → expand an order → **Payment reconciliation & external refunds** (admin/manager only). This is an **external action ledger**, not a money-transfer button. Never record a refund until it has actually completed outside the site.

1. Verify the provider/bank statement. A verified paid order has its total recorded as received. A payment flagged `review` is unreconciled: record the actual received amount (including zero where evidence shows no charge), method, external reference and evidence note.
2. Record each externally completed partial/full refund. Every entry stores amount, method, reference, staff ID/name and timestamp. Remaining reconciled funds must not become negative. The same method/reference cannot be used twice, including on another order. A request UUID makes retries idempotent; optimistic ledger versions reject conflicting changes. Refresh on conflict and verify the existing entry before retrying.
3. Before-delivery cancellation of paid/review orders requires complete reconciliation and zero remaining received funds. Multiple partial refunds can reach the full amount. Press **Cancel after reconciliation**. After dispatch, confirm goods were physically recovered before stock restoration. Reserved stock is restored once, including batch allocations. A cancelled order cannot be fulfilled again.
4. After delivery, use **Returns & refunds**. Review the customer request, approve, receive inspected goods if applicable, queue refund, complete payment externally and record its method/reference. Direct delivered-order cancellation/refund is blocked. Returned product value accounts for original discount and excludes delivery charges. Batch-tracked goods must be received as a new dated batch after inspection; do not use the generic restock checkbox.

Old refunded return records are included once in the ledger; original staff identity is labeled unavailable rather than invented. A later provider callback changing payment evidence invalidates prior reconciliation and requires review again. Financial events are append-only in this UI; no silent editing/deleting of audit records is offered. Reports show delivered sales **before refunds**, not net settlement, revenue recognition, tax or profit accounting.

## Checkout attempts and safeguards

POST `/api/orders` defaults to 30 attempts per client per 15-minute bucket starting with the first attempt. Responses above the limit include `429` and `Retry-After`. Invalid submissions count too. Buckets persist in MongoDB/shared repository; they use an HMAC identity key, the same secret on all API instances and a TTL index for expiration. Demo file mode uses a process/file lock and prunes expired buckets on later writes; it is not a horizontally scalable production store. The limiter fails with the database rather than silently allowing traffic during an outage.

COD defaults to at most three outstanding (not delivered/cancelled) orders per normalized phone. Shared identity fences force conflicting Mongo transactions to retry. A valid existing attempt is returned before COD capacity checks. A phone is not verified by OTP; a determined attacker can vary phone numbers. Use provider/WAF abuse controls and manual review for a public merchant deployment. Auth and some analytics limits remain per-process; they are not advertised as globally distributed controls.

`CHECKOUT_RATE_MAX` and `MAX_OUTSTANDING_COD` are bounded positive integers; adjust for your business and update published policy text accordingly. A shared NAT may cause multiple legitimate customers to share a rate bucket. Only configured real upstream IP/CIDRs are trusted. Never trust arbitrary `X-Forwarded-For`, `true`, a hop count, or a whole public network. See deployment proxy topology.

The browser saves request UUID, receipt proof and exact payload **before** sending checkout. On reload/retry it first checks `/api/checkout-attempt/:requestId` using that proof. An existing order is recovered and only purchased quantities are removed from the current basket. Even an edited basket keeps the unresolved attempt UUID. If an earlier in-flight POST wins, the conflict is resolved by recovering its actual order. New UUIDs are created after a completed attempt is cleared. On ambiguous/network errors the attempt stays saved; do not clear browser storage or change devices until checked. Disabled browser storage blocks new submission with an explanation. Receipt proofs are private browser data, never URL query parameters. Signing into another account cannot recover someone else's local attempt.

## Reservation and suspicious-order policy

Unpaid online `placed` reservations expire after 30 minutes, returning reserved stock once. They are swept at startup/request operations and every minute by the API. A late verified payment after expiry goes to review rather than silently reallocating already sold stock. Investigate/refund/reconcile externally. Success/fail/cancel browser returns alone never prove payment; provider validation does.

COD orders do **not** expire merely because they are old. Review suspicious orders manually, contact the customer using merchant policy, record a note/reason and cancel only under a documented business rule. Do not accept real COD orders in demo mode. Cancellation does not mean a financial refund happened.

## Practical limits

No automatic refund gateway, OTP, tax engine, multicurrency conversion, warehouse ERP, fraud detection guarantee, privacy-law certification or operational SLA is included. Review/replace all sample policy/support text before selling to an end merchant. PWA installation is browser dependent; offline mode is a fallback screen, not offline ordering or offline access to private accounts/orders.
