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
