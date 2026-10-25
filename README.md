# Kinetix Organization

This project contains the public Kinetix website and its local ASP.NET backend.

## Structure

- `index.html` – top-level redirect page that sends visitors into the app.
- `kinetix/` – full site frontend and static assets.
  - `index.html` – public home page.
  - `admin.html` – admin dashboard.
  - `kinetix-style.css` and `kinetix-script.js` – homepage styling and behavior.
  - `kinetix-admin.css` and `kinetix-admin.js` – admin dashboard styling and behavior.
  - `images/`, `videos/`, `models/` – site media assets.
  - `backend/` – ASP.NET Core API that serves the site and stores cart, stock, and admin state.
  - `functions/` – Cloudflare Pages API for the hosted deployment.
  - `schema.sql` and `wrangler.toml` – D1 database schema and Cloudflare Pages configuration.

## Startup

From the repository root, run:

```powershell
./kinetix/start-server.bat
```

This starts the backend on `http://127.0.0.1:5087` and opens the site. To open the admin dashboard directly instead, use:

```powershell
./kinetix/start-admin.bat
```

## Backend notes

- Default local admin credentials: `Admin` / `kenken`
- Storage files live in `kinetix/backend/`
- Real deployments should set `KINETIX_ADMIN_USERNAME` and `KINETIX_ADMIN_PASSWORD` in the server environment and serve over HTTPS

## Free Cloudflare deployment

GitHub Pages can only serve the static site; it cannot run the API or persist shared inventory. The Cloudflare Pages Function in `functions/api/[[path]].js` provides the same-origin API, and D1 stores inventory, carts, orders, registrations, announcements, admin sessions, and the visitor count. New databases start with zero inventory. Checkout only reserves stock; it does not process payments.

1. Create a free Cloudflare account and a D1 database named `kinetix-db`.
2. In the D1 database's SQL Console, run the complete contents of `kinetix/schema.sql` from this repository.
3. Copy that database's ID into `kinetix/wrangler.toml`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
4. Create a Cloudflare Pages project connected to this GitHub repository. Set the root directory to `kinetix`, leave the build command empty, and use `.` as the build output directory. The Pages configuration discovers the API Function and D1 binding.
5. In Pages **Settings → Variables and Secrets**, add `KINETIX_ADMIN_USERNAME` and `KINETIX_ADMIN_PASSWORD` as secrets. Use unique credentials; never put them in this repository or send them in chat.
6. Open the Cloudflare Pages URL and set the actual inventory and prices in its Admin dashboard.

Use the Cloudflare Pages URL for the API-backed site. The existing `github.io` URL continues to serve a static copy and cannot use the Cloudflare API on a different origin. Once Cloudflare has assigned the Pages URL, visitors can be redirected to it by updating the repository's top-level `index.html` redirect and publishing that change. A custom domain can instead be attached in Cloudflare if you own one and configure its DNS there.

Cloudflare's free plan has daily request, execution, and database quotas. If those limits are exceeded, API requests can be delayed or fail until quota resets or the plan changes. The large model and video files that exceed Pages asset limits are excluded from deployment; the remaining site assets are published normally. The older Render deployment files remain available, but a persistent Render disk is not included in its free tier.
