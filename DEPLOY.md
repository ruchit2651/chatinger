# Deploying Chatinger (free)

Three services, all free, all git-push deploys:

| Layer    | Host                       | Why                                              |
|----------|----------------------------|--------------------------------------------------|
| Source   | **GitHub**                 | Required by both Render and Netlify              |
| Backend  | **Render** (free Web Service) | Persistent Node process — Socket.IO works natively |
| Frontend | **Netlify** (free)         | Static-site host with SPA routing                |
| Database | **Supabase** (free)        | You already have this                            |

> **Why not Vercel for the backend?** Vercel runs serverless functions with execution timeouts and no persistent connections, so Socket.IO won't work. Render's free Web Service is the closest equivalent that supports websockets.

> **Render free tier sleep:** the backend spins down after ~15 minutes of inactivity. The first request after a sleep takes 30–60 s while it wakes up. Fine for a portfolio / demo. Pay $7/mo if you want always-on.

---

## 1. Push to GitHub

From the project root (`wp/`):

```bash
git init
git branch -M main
git add .
git commit -m "Initial commit"
# Create a new empty repo on github.com first (no README, no .gitignore).
git remote add origin https://github.com/<your-username>/chatinger.git
git push -u origin main
```

Confirm the push includes both `backend/` and `frontend/`, plus `render.yaml`, `netlify.toml`, and `supabase/schema.sql` + `supabase/migration.sql`. `node_modules/` and `.env` files are ignored by `.gitignore`.

---

## 2. Run the database migration

You should already have a Supabase project. Open the **SQL Editor** and run:

```sql
-- paste the entire contents of supabase/schema.sql
```

If your project already has data and you've just been applying patches over time, run [supabase/migration.sql](supabase/migration.sql) instead — it's idempotent.

Then force a schema-cache refresh:

```sql
notify pgrst, 'reload schema';
```

---

## 3. Deploy backend on Render

1. Sign in at https://render.com with GitHub.
2. **New → Blueprint** → connect your repo → select the `main` branch.
3. Render detects [render.yaml](render.yaml) and shows one service called `chatinger-backend`. Click **Apply**.
4. After the first build finishes (~2 min), open the service → **Environment** → fill in the secret values that were marked `sync: false`:

   | Key | Value |
   |-----|-------|
   | `CLIENT_URL` | Leave empty for now — you'll fill this after Netlify deploys. |
   | `JWT_SECRET` | Anything long & random — e.g. run `openssl rand -hex 32` |
   | `SUPABASE_URL` | From Supabase → Project Settings → API |
   | `SUPABASE_SERVICE_KEY` | The **service_role** key from the same page |
   | `SMTP_USER` | `ruchitsonani2651@gmail.com` |
   | `SMTP_PASS` | Your 16-char Gmail app password (see backend/.env.example for the setup steps) |
   | `EMAIL_FROM` | `Chatinger <ruchitsonani2651@gmail.com>` |

5. Render auto-redeploys when you save env vars. Wait for `Live`. Note the public URL — it looks like `https://chatinger-backend.onrender.com`.
6. Test: `https://chatinger-backend.onrender.com/health` should return `{"ok":true}`.

---

## 4. Deploy frontend on Netlify

1. Sign in at https://netlify.com with GitHub.
2. **Add new site → Import an existing project** → pick your repo.
3. Netlify reads [frontend/netlify.toml](frontend/netlify.toml) and pre-fills:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
   - **Confirm** with "Deploy site".
4. After the first deploy, open **Site settings → Environment variables** and add:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL`    | `https://chatinger-backend.onrender.com/api` |
   | `VITE_SOCKET_URL` | `https://chatinger-backend.onrender.com`     |

5. **Site settings → Site information → Change site name** to something memorable, e.g. `chatinger`. Your site URL becomes `https://chatinger.netlify.app`.
6. Trigger a redeploy: **Deploys → Trigger deploy → Deploy site** (so the new env vars take effect).

---

## 5. Close the loop on the backend

Now that you know the Netlify URL, finish step 3:

1. Back to Render → `chatinger-backend` → **Environment**.
2. Set `CLIENT_URL` = `https://chatinger.netlify.app`
   - If you ever add a custom domain or want localhost to work simultaneously, you can pass a comma-separated list: `https://chatinger.netlify.app,http://localhost:5173`
3. Save — Render redeploys.

---

## 6. Verify end-to-end

1. Open `https://chatinger.netlify.app` in two browser windows (or one + one incognito).
2. Register two accounts with different emails. You should receive OTP codes by email.
3. Verify each OTP, log in, find each other by mobile number, send messages, attach an image. Realtime delivery, typing indicators, and read receipts should all work.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Frontend loads, "Network error" on register | `CLIENT_URL` on Render doesn't include the Netlify URL, or backend is still cold-starting (wait 60s). |
| Socket disconnects every few seconds | The free Render service slept; the first request will wake it. Subsequent connections will be stable. |
| OTP email never arrives | Check Render logs. If you see `SMTP not configured`, the SMTP env vars aren't set. If you see `Invalid login`, the Gmail app password is wrong or 2FA isn't enabled on the Gmail account. |
| Attachment upload fails: "Did you run migration.sql to create the 'attachments' bucket?" | Run [supabase/migration.sql](supabase/migration.sql) again. |
| Profile photo / image doesn't render | The Supabase `attachments` bucket has to be **public** — the migration sets `public: true`. Verify on Supabase → Storage. |
| `CORS: origin … not allowed` in browser console | `CLIENT_URL` on Render is missing your Netlify URL. Add it (comma-separated if multiple) and redeploy. |

---

## Optional: custom domain

- **Netlify**: Site settings → Domain management → Add custom domain (free TLS via Let's Encrypt).
- After it propagates, add the new domain to `CLIENT_URL` on Render so CORS allows it.
