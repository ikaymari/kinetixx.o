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

## Deploy the site and backend together

GitHub Pages cannot run the ASP.NET API. To run the API whenever the public website is open, deploy the complete app as one web service so the site and its API share the same origin.

This repository includes a Render Blueprint in `render.yaml`. In Render, create a Blueprint from this GitHub repository and deploy the `kinetix-org-ikaymari` web service. The Blueprint builds `kinetix/Dockerfile`, attaches a persistent disk for inventory, registrations, orders, announcements, and visitor data, and prompts for `KINETIX_ADMIN_USERNAME` and `KINETIX_ADMIN_PASSWORD`. Set a unique username and a strong password in Render; do not commit credentials. Inventory on a new persistent disk starts at zero and must be set in the Admin dashboard.

The Render service URL serves both the website and API. To make the existing GitHub Pages URL forward visitors to the running service, update the repository-root `index.html` redirect to that Render URL after the service has been created. GitHub Pages itself remains static and cannot start the backend.
