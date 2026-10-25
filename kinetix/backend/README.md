# Kinetix Backend

The deployed GitHub Pages site stores each visitor's cart in that browser's local storage. Cart contents are not shared between browsers or devices, and the static site cannot update shared inventory or submit order requests.

For the API-backed product inventory and admin dashboard, run the ASP.NET backend and serve the website from the same origin. Event registration submissions are saved on the backend and appear in the admin dashboard's Registrations section. Completed checkout orders are saved on the backend and appear in the Orders section, and successful orders reduce shared inventory. The team still needs to contact customers to confirm details. Checkout does not process payments. The static GitHub Pages deployment cannot authenticate administrators, save shared inventory, registrations, and announcements, or keep a shared visitor count.

For local development, the launcher sets `Admin` / `kenken` when credentials are not already set. If running under the Development environment on loopback without configured credentials, the backend also accepts these credentials. It binds the backend to `127.0.0.1`, so it is only reachable from the local computer. From the repository root, in PowerShell:

```powershell
.\kinetix\start-server.bat
```

The script starts the API-backed site and opens it after its health check succeeds. Then open `http://127.0.0.1:5087/admin.html` and sign in with `Admin` / `kenken`. If the backend was already running before you changed credentials, stop and restart it for the new settings to take effect. For any non-local deployment, set strong `KINETIX_ADMIN_USERNAME` and `KINETIX_ADMIN_PASSWORD` values in the server environment, and use HTTPS. Do not use the local development credentials outside your computer. The admin session is held in an HttpOnly, SameSite cookie and expires after eight hours. The admin page supports editing product prices and stock counts, plus creating, editing, publishing, and deleting announcements. Published announcements appear on the home page. Inventory starts at zero until an administrator sets the real stock counts.

## Free Cloudflare deployment

For a no-cost hosted API and persistent shared data, use Cloudflare Pages Functions and D1. Setup instructions are in the repository's [README.md](../../README.md#free-cloudflare-deployment); apply `kinetix/schema.sql`, set the D1 database ID in `kinetix/wrangler.toml`, and configure `KINETIX_ADMIN_USERNAME` and `KINETIX_ADMIN_PASSWORD` as Cloudflare secrets. Do not store production credentials in this repository. The Cloudflare Pages URL hosts both the frontend and same-origin API. The GitHub Pages URL remains static unless redirected to the Cloudflare deployment.

The older Render Blueprint is still present for deployments that need the ASP.NET backend. Render's free tier does not provide persistent disk storage, so it is not suitable for shared durable inventory or order data without a paid disk.

To start the backend and open the admin dashboard automatically, run `.\kinetix\start-admin.bat` from the repository root. This checks the local backend, starts it if needed, waits for its health check, and then opens `http://127.0.0.1:5087/admin.html`. Opening `admin.html` directly from File Explorer will not start the backend. The dashboard's Visitors section shows the number of browser tab sessions that have visited the home page; the count is stored in `backend/visitors.json` and does not include personal information.

For a local API-backed cart without admin credentials, run the backend from the repository root (the admin dashboard will report that it is not configured):

```powershell
dotnet run --project kinetix/backend/KinetixCart.csproj --urls http://127.0.0.1:5087
```

Open `http://127.0.0.1:5087` in the browser. The API stores the cart in `backend/cart.json`, inventory in `backend/products.json`, processed order numbers in `backend/orders.json`, submitted order details in `backend/customer-orders.json`, event registrations in `backend/registrations.json`, and announcements in `backend/announcements.json`. The admin Orders and Registrations sections require signing in. Soya Pop inventory is tracked independently for Original, Banana, and Cereal; Nutflix remains a single inventory item. Legacy inventory that has one shared Soya Pop row is migrated into Original, with Banana and Cereal initialized at zero. Orders reduce stock only for the selected flavor. The cart supports the Soya Pop and Nutflix products, quantity updates, item removal, and clearing the cart. Submitting an order request reserves its stock; the checkout does not process payments.