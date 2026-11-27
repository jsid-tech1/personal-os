# Personal OS on Vercel

[Production site](https://personal-os-lcex.vercel.app) · [Vercel project](https://vercel.com/personal-os-2beb/personal-os-lcex)

The project builds from the repository root on Node 24. Vercel serves `dist/` and runs `/api/plan` and `/api/live` as Node functions. Firebase continues to handle Google sign-in and Firestore. App routes use URL fragments (`/#/today`), so no catch-all rewrite is needed.

## Configure production

1. In [Firebase Authentication → Authorized domains](https://console.firebase.google.com/project/personal-os-12b89/authentication/settings), add `personal-os-lcex.vercel.app`. If you use a custom domain, add its exact hostname too. Google sign-in must be enabled in this Firebase project.
2. In [Vercel → Environment Variables](https://vercel.com/personal-os-2beb/personal-os-lcex/settings/environment-variables), set `DEEPSEEK_API_KEY` for AI planning and project conversations, and `OPENAI_API_KEY` for live voice. Use **Production** and mark the keys **Sensitive**. Local `.env` files are not deployed. Firebase ID token verification uses the public Firebase project ID and does not need a service-account key.
3. Keep Vercel's **Automatically expose System Environment Variables** enabled so functions recognize the assigned project URLs. For an additional custom domain, or when system variables are disabled, set `APP_ORIGIN` to the exact HTTPS origin (no trailing slash).
4. Push to the connected `main` branch to deploy. Redeploy after changing Vercel environment variables. Firebase authorized-domain changes take effect independently.

To deploy this checkout directly to the same project:

```sh
npx vercel login
npx vercel link --project personal-os-lcex --scope personal-os-2beb
npm run deploy:vercel
```

## Verify

- Open the production site and sign in with Google. Refresh `/#/today` to verify the session is restored.
- A signed-out `POST /api/plan` or `POST /api/live` from the production origin must return **401 JSON**. A **404** means the function was not deployed; a **403** means the origin was not recognized.
- To check the configured providers, generate a draft plan and start a live voice session while signed in. Manual task creation does not need either provider key.
- For cloud backup, use the [Firestore setup instructions](FIRESTORE_DISABLED_RECOVERY.md). The Vercel deploy does not change database rules.
