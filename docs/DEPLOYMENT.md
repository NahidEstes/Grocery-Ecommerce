# Deployment and integration verification

## Verification boundary

Windows/Node local demo, typechecking, automated regression tests and optimized Next build are exercised in this release. **Real MongoDB replica-set execution, SSLCOMMERZ sandbox transactions, SMTP delivery, Docker containers and public HTTPS proxy deployment are unverified here:** no services/credentials or Docker runtime were supplied. The recipes below are reproducible staging procedures, not evidence those integrations have passed. See `VERIFICATION.md` for measured results. No public deployment was performed.

## Configuration and startup

Copy `.env.example` to `.env`. Production must explicitly set `STORE_MODE=production`, an authenticated TLS replica-set/Atlas `MONGODB_URI`, HTTPS `WEB_ORIGIN` and `PUBLIC_API_URL`, plus `CHECKOUT_IDENTITY_SECRET` with at least 32 random characters. Generate it locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; use the same secret on all API instances. Never paste it into a support ticket.

The API refuses startup if required configuration is missing or MongoDB cannot connect/support transactions. Runtime disconnection returns an error; it cannot switch to filesystem data. The web server in production merchant mode throws a store-unavailable error when the API fails rather than serving bundled sample groceries. Credential-free operation is an explicit `STORE_MODE=demo` choice. `API_URL` is internal server-to-server origin; `PUBLIC_API_URL` is the externally reachable HTTPS origin without `/api`. Rebuild after changing `API_URL` because Next rewrites compile it. SMTP and online payments are optional; blank configuration disables the respective features, not the database requirement.

Node 24.20.0 is the local test baseline. `npm ci` uses the supplied lockfile. Docker base images use major tags; pin validated image digests for your own deployment to reproduce OS binaries exactly.

## Docker local stack (requires Docker Compose)

From repository root:

```sh
docker compose -f deploy/compose.local.yaml up --build -d
docker compose -f deploy/compose.local.yaml exec api npm run seed
```

The API image includes the seed script and dependencies; it talks to a persistent single-member MongoDB replica set. The app is at http://127.0.0.1:3000 in **demo mode**, even though storage is MongoDB. DB and API ports are not published to the host. Register at `/account`, then:

```sh
docker compose -f deploy/compose.local.yaml exec api npm run admin:promote -- your-email@example.com
docker compose -f deploy/compose.local.yaml restart api
docker compose -f deploy/compose.local.yaml down
```

`down` preserves the named Mongo volume. This unauthenticated database configuration is only for an isolated local demonstration; do not expose it publicly. The replica-set hostname `mongo` is resolvable inside the Compose network. For tests against a local replica set outside Docker, use a URI whose advertised members resolve from the test process. Docker Desktop/replica-set DNS differences are a common connection problem.

## HTTPS merchant staging recipe (not executed here)

Use an authenticated TLS MongoDB replica set/Atlas with network access restricted to the deployment. Add `STORE_DOMAIN=your-real-domain` and production environment values to root `.env`. DNS must point to this machine; ports 80/443 must be reachable for certificates. Run:

```sh
docker compose --env-file .env -f deploy/compose.production.yaml config --quiet
docker compose --env-file .env -f deploy/compose.production.yaml up --build -d
```

Caddy routes `/api/*` directly to Express and all other paths to Next. Neither API nor Mongo is host-published. Only Caddy's fixed private address `172.29.0.10/32` is trusted for forwarded client IPs. Caddy's default sanitization must remain enabled; do not enable trust of arbitrary incoming forwarded headers. If changing the subnet/proxy, update both the network address and `TRUSTED_PROXY_CIDRS`; verify client IPs in staging without logging customer payloads. This recipe avoids depending on undocumented Next rewrite forwarding behavior for public client identification. The internal API origin remains `http://api:4100`; outside traffic uses HTTPS.

The build uses demo mode only while compiling dynamic routes without a running API. Runtime web/API environment is explicitly production. All storefront routes and the manifest render dynamically. Replacing a deployment's config never converts old catalog amounts. Keep currency BD/BDT for this SSLCOMMERZ adapter. Do not run sample seed automatically on an established merchant database. Native media uploads are stored as database entities, not ephemeral container files.

## Real MongoDB integration procedure — unverified

Use a separate disposable replica-set service, not the merchant DB. Set `MONGODB_TEST_URI` in local `.env` and run `npm run test:mongo`. The test creates a random `freshcart_test_*` database and deletes only that generated database after the test. It checks persisted users/catalog/orders, repeated attempt IDs, stock exhaustion/restoration, disconnect/reconnect and two separate worker processes racing for one pack. Run it on a supported replica set and record actual results before claiming Mongo verification. A skipped test is not a pass.

After staging startup also place an order, restart the API/container, confirm the same receipt/order/stock, run concurrent checkouts through two API instances connected to the same DB and shared identity secret, and verify one remaining pack is never sold twice. A one-node replica set enables transactions but provides no high availability. Plan backups and failover separately.

## SSLCOMMERZ sandbox procedure — unverified

Configure sandbox store ID/password, `SSLCOMMERZ_LIVE=false`, public HTTPS callback origin, and BDT/BD profile. Sign into a test customer account. From checkout exercise success, fail, cancel and timeout. Confirm success is validated server-side (amount/currency/transaction/order), never by trusting the return screen. Replay the same provider notification twice; ensure one paid order, no extra stock debit. Keep a reservation beyond 30 minutes, then deliver a delayed successful callback: the order must enter review, with no automatic new stock reservation. Reconcile externally through the ledger, complete/refund through the provider portal, record its receipt and cancel. Test partial/full refunds and duplicates with sandbox-supported controls; the site does not call a refund endpoint.

Current `npm test` payment cases mock provider HTTP responses and test matching/replay/expiry logic only. They are **not real provider transactions**. Do not enable live processing until merchant credentials, public callback delivery and real sandbox evidence have been checked. The adapter intentionally restricts currency even though the provider may offer other settlement/conversion products; a separate FX implementation is needed to support those.

## SMTP reset procedure — unverified

Configure `SMTP_HOST`, port, secure flag, user/password if required and `MAIL_FROM`; use an authorized sender/domain. Register a disposable inbox, request reset, verify actual inbox delivery and the HTTPS link origin. Reset once, check the old password/session no longer works, and verify the same token is rejected a second time. Request another reset and let it expire (30 minutes); confirm rejection. Request twice and confirm only the newest token works. Exercise undeliverable/transport errors without leaking tokens or credentials into logs/support reports. Automated tests cover token expiry/single-use/session revocation logic; they do not prove email delivery. Provider SPF/DKIM/DMARC and deliverability are merchant operations work.

## Persistence, backup and restore

Demo file mode stores accounts, password hashes, receipt hashes, stock, media and orders in `.data/store.json`; never distribute this file. Stop local writers before copying it to a protected backup. Restore to a separate demo directory first. In Mongo mode back up the whole database, including store entities, products and orders; use provider snapshots or authenticated `mongodump` from a secured environment. Keep database URI/credentials outside shell histories and ticket output. Restore with the provider tools/`mongorestore` into a separate staging database, start the API against that URI and verify catalog, staff, media, an order and financial history before any cutover. A restore can roll back recorded events; reconcile external provider payments against restored data before accepting new orders. Encrypt backups, restrict access and choose a retention/deletion policy for your jurisdiction. Retain Caddy certificate volumes when recreating containers. Backup/restore execution is unverified here.

## Troubleshooting

| Symptom                                      | Check                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Startup says mode missing                    | Keep explicit STORE_MODE in runtime environment; copy .env.example for demo                                   |
| Store unavailable                            | API running, matching API_URL/build target, DB replica set/credentials/DNS and service marker                 |
| Registration works, sign-in does not persist | HTTPS secure cookie settings, same-origin WEB_ORIGIN, proxy path and browser host (127.0.0.1 vs localhost)    |
| 429 checkout                                 | Retry-After, outstanding COD cap, real proxy source address, shared secret across instances                   |
| Refund/cancel conflict                       | Refresh ledger; inspect receipt, provider statement and current reconciliation before recording another entry |
| Payment is review                            | Late/changed provider evidence; reconcile actual funds and external refund, do not force status in DB         |
| Gateway hidden                               | Credentials, HTTPS URLs, signed-in account, BDT/BD restriction and live mode requirements                     |
| Reset unavailable                            | SMTP_HOST and MAIL_FROM; check actual transport delivery separately                                           |
| Port conflict                                | Change web port and WEB_ORIGIN together; rebuild if API_URL changes                                           |
| Currency edit blocked                        | Any order locks currency; use fresh DB for another currency, never reinterpret old amounts                    |
| Old PWA assets                               | Use Update & reload; dynamic accounts/orders are never service-worker cached                                  |

Primary references: [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/), [MongoDB replica-set authentication](https://www.mongodb.com/docs/manual/tutorial/deploy-replica-set-with-keyfile-access-control/), [SSLCOMMERZ integration](https://developer.sslcommerz.com/doc/v4/). Installed Next.js documentation under `node_modules/next/dist/docs/` is authoritative for this version.
