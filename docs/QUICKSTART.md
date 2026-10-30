# বাংলা / English Grocery Starter — Quick start

This is a customizable source-code starter with a usable local demo. It is not an operated grocery business or a verified live payment service. Phone OTP is intentionally excluded.

## Local demo, no credentials

Install Node.js 24 LTS and npm (tested: Node 24.20.0). Extract the buyer ZIP into a new folder. In PowerShell:

```powershell
Copy-Item .env.example .env
npm ci
npm run typecheck
npm test
npm run dev
```

Open http://127.0.0.1:3000. The API listens on 4100. `STORE_MODE=demo` persists changes in `.data/store.json`; no payment is collected and no delivery is arranged. Do not enter real customer data into a demo. No account or admin password is shipped.

For the optimized local server, stop dev with Ctrl+C, then:

```powershell
npm run build
npm start
```

Keep `.env` with `STORE_MODE=demo`. `NODE_ENV=production` means optimized Node/Next operation, while `STORE_MODE=production` enables merchant requirements. These are separate settings. If port 3000 is occupied, set `WEB_ORIGIN=http://127.0.0.1:3001` in `.env`, run `npm run start:api` in one terminal and `npm run start:web -- --port 3001` in another. Changes to `API_URL` require a new web build because the rewrite destination is compiled.

## Create the administrator

1. Register your own email/password at `/account` (password minimum 10 characters).
2. From this same project and environment, run `npm run admin:promote -- your-email@example.com`.
3. Sign out and in again, then open `/admin`.
4. Set store identity, market, support and policies in **Storefront settings**. Review delivery areas, fees, slots, promotions and sample products before use.

Only an existing registered account is promoted. The command does not invent credentials. For Docker, run the command inside the API container so it uses that container's MongoDB environment.

## Staff boundaries

Admin controls staff roles. Manager/admin have finance and purchasing permissions. Fulfilment can operate orders but cannot reconcile or record refunds. Editor can edit products/content but cannot access financial records. Administrative editing screens are English; storefront navigation supports বাংলা / English, and merchant product/banner/recipe translations are edited separately in **English / বাংলা content**. Untranslated merchant text/service messages fall back to their source language.

## Next documents

- [Rebranding, market and image replacement](CUSTOMIZATION.md)
- [Manual reconciliation, refunds and checkout limits](OPERATIONS.md)
- [Deployment, persistence and real integration procedures](DEPLOYMENT.md)
- [Asset and dependency inventory](ASSETS-LICENSES.md)
- [Verification evidence and limitations](VERIFICATION.md)
- [Support/update policy draft](SUPPORT-DRAFT.md)
- [Commercial license draft](../COMMERCIAL-LICENSE-DRAFT.md)
