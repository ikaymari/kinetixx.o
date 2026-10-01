# Kinetix Cart

The deployed GitHub Pages site stores each visitor's cart in that browser's local storage. Cart contents are not shared between browsers or devices, and the static site does not process payments or orders.

For a local API-backed cart, start the backend from the workspace root with the provided VS Code task:

- Run Task: `Start Kinetix Cart Backend`

Or run it manually:

```powershell
dotnet run --project backend/KinetixCart.csproj --urls http://127.0.0.1:5087
```

Then open `http://127.0.0.1:5087` in the browser. The API stores the cart in `backend/cart.json`; it supports the Soya Pop and Nutflix products, quantity updates, item removal, and clearing the cart. This local cart does not process payments or orders.