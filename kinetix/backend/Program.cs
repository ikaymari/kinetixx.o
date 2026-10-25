using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using KinetixCart;
using Microsoft.AspNetCore.StaticFiles;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseCors();

var siteRoot = Directory.GetParent(app.Environment.ContentRootPath)?.FullName
    ?? throw new InvalidOperationException("The site root directory could not be determined.");
var pageFiles = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
{
    ["index.html"] = "text/html; charset=utf-8",
    ["admin.html"] = "text/html; charset=utf-8",
    ["timer.html"] = "text/html; charset=utf-8",
    ["kinetix-style.css"] = "text/css; charset=utf-8",
    ["kinetix-script.js"] = "text/javascript; charset=utf-8",
    ["kinetix-admin.css"] = "text/css; charset=utf-8",
    ["kinetix-admin.js"] = "text/javascript; charset=utf-8"
};
var contentTypeProvider = new FileExtensionContentTypeProvider();
contentTypeProvider.Mappings[".heif"] = "image/heif";
contentTypeProvider.Mappings[".mov"] = "video/quicktime";

IResult ServeAsset(string directory, string relativePath)
{
    if (string.IsNullOrWhiteSpace(relativePath)) return Results.NotFound();

    var assetRoot = Path.GetFullPath(Path.Combine(siteRoot, directory));
    var assetPath = Path.GetFullPath(Path.Combine(assetRoot, relativePath));
    if (!assetPath.StartsWith(assetRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) ||
        !File.Exists(assetPath))
    {
        return Results.NotFound();
    }

    if (!contentTypeProvider.TryGetContentType(assetPath, out var contentType))
    {
        contentType = "application/octet-stream";
    }

    return Results.File(assetPath, contentType, enableRangeProcessing: true);
}

app.MapGet("/", () => Results.Redirect("/index.html"));
app.MapGet("/back.mp4", () => ServeAsset(".", "back.mp4"));
app.MapGet("/{fileName}", (string fileName) =>
{
    if (!pageFiles.TryGetValue(fileName, out var contentType)) return (IResult)Results.NotFound();
    var path = Path.Combine(siteRoot, fileName);
    return File.Exists(path) ? Results.File(path, contentType) : Results.NotFound();
});
app.MapGet("/images/{**fileName}", (string fileName) => ServeAsset("images", fileName));
app.MapGet("/videos/{**fileName}", (string fileName) => ServeAsset("videos", fileName));

var cartFile = Path.Combine(app.Environment.ContentRootPath, "cart.json");
var productsFile = Path.Combine(app.Environment.ContentRootPath, "products.json");
var announcementsFile = Path.Combine(app.Environment.ContentRootPath, "announcements.json");
var ordersFile = Path.Combine(app.Environment.ContentRootPath, "orders.json");
var customerOrdersFile = Path.Combine(app.Environment.ContentRootPath, "customer-orders.json");
var registrationsFile = Path.Combine(app.Environment.ContentRootPath, "registrations.json");
var visitorCountFile = Path.Combine(app.Environment.ContentRootPath, "visitors.json");
var cartLock = new SemaphoreSlim(1, 1);
var productLock = new SemaphoreSlim(1, 1);
var announcementLock = new SemaphoreSlim(1, 1);
var visitorCountLock = new SemaphoreSlim(1, 1);
var registrationsLock = new SemaphoreSlim(1, 1);
var products = new List<ProductInventory>
{
    new("soya-pop", "Soya Pop", 40, 0, "Banana"),
    new("soya-pop", "Soya Pop", 40, 0, "Original"),
    new("soya-pop", "Soya Pop", 40, 0, "Cereal"),
    new("nutflix", "Nutflix", 106, 0)
};
var announcements = new List<Announcement>();
long visitorCount = 0;
var cart = new List<CartItem>();
var processedOrderNumbers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
var customerOrders = new List<CustomerOrder>();
var registrations = new List<EventRegistration>();
var adminSessions = new Dictionary<string, DateTimeOffset>(StringComparer.Ordinal);
var adminUsername = builder.Configuration["KINETIX_ADMIN_USERNAME"];
var adminPassword = builder.Configuration["KINETIX_ADMIN_PASSWORD"];

if (File.Exists(cartFile))
{
    try
    {
        cart = JsonSerializer.Deserialize<List<CartItem>>(await File.ReadAllTextAsync(cartFile)) ?? new List<CartItem>();
        cart = cart.Select(item => item.Flavor is null &&
            item.ProductId.Equals("soya-pop", StringComparison.OrdinalIgnoreCase)
                ? item with
                {
                    Flavor = new[] { "Original", "Banana", "Cereal" }
                        .FirstOrDefault(flavor => item.Name.EndsWith(" - " + flavor, StringComparison.OrdinalIgnoreCase)) ?? "Original"
                }
                : item).ToList();
    }
    catch (JsonException)
    {
        cart = new List<CartItem>();
    }
}

if (File.Exists(productsFile))
{
    products = JsonSerializer.Deserialize<List<ProductInventory>>(await File.ReadAllTextAsync(productsFile))
        ?? throw new InvalidDataException("The product inventory file contains invalid data.");
}

if (File.Exists(announcementsFile))
{
    announcements = JsonSerializer.Deserialize<List<Announcement>>(await File.ReadAllTextAsync(announcementsFile))
        ?? throw new InvalidDataException("The announcements file contains invalid data.");
}

if (File.Exists(visitorCountFile))
{
    visitorCount = JsonSerializer.Deserialize<long>(await File.ReadAllTextAsync(visitorCountFile));
    if (visitorCount < 0)
    {
        throw new InvalidDataException("The visitor count file contains an invalid count.");
    }
}

if (File.Exists(ordersFile))
{
    processedOrderNumbers = new HashSet<string>(
        JsonSerializer.Deserialize<List<string>>(await File.ReadAllTextAsync(ordersFile))
            ?? throw new InvalidDataException("The order history file contains invalid data."),
        StringComparer.OrdinalIgnoreCase);
}

if (File.Exists(customerOrdersFile))
{
    customerOrders = JsonSerializer.Deserialize<List<CustomerOrder>>(await File.ReadAllTextAsync(customerOrdersFile))
        ?? throw new InvalidDataException("The customer order history file contains invalid data.");
}

if (File.Exists(registrationsFile))
{
    registrations = JsonSerializer.Deserialize<List<EventRegistration>>(await File.ReadAllTextAsync(registrationsFile))
        ?? throw new InvalidDataException("The event registration file contains invalid data.");
}

CartSnapshot Snapshot() => new(cart.ToArray(), cart.Sum(item => item.Quantity));

async Task SaveAsync<T>(string path, T value)
{
    var temporaryFile = path + ".tmp";
    await File.WriteAllTextAsync(temporaryFile, JsonSerializer.Serialize(value));
    File.Move(temporaryFile, path, true);
}

Task SaveCartAsync() => SaveAsync(cartFile, cart);
Task SaveProductsAsync() => SaveAsync(productsFile, products);
Task SaveAnnouncementsAsync() => SaveAsync(announcementsFile, announcements);
Task SaveVisitorCountAsync(long count) => SaveAsync(visitorCountFile, count);
Task SaveOrdersAsync() => SaveAsync(ordersFile, processedOrderNumbers);
Task SaveCustomerOrdersAsync() => SaveAsync(customerOrdersFile, customerOrders);
Task SaveRegistrationsAsync() => SaveAsync(registrationsFile, registrations);

var legacySoyaInventory = products.Where(item =>
    item.Id.Equals("soya-pop", StringComparison.OrdinalIgnoreCase) && item.Flavor is null).ToArray();
if (legacySoyaInventory.Length > 0)
{
    var legacyStock = legacySoyaInventory.Sum(item => item.Stock);
    var legacyPrice = legacySoyaInventory[0].Price;
    products.RemoveAll(item => item.Id.Equals("soya-pop", StringComparison.OrdinalIgnoreCase) && item.Flavor is null);
    var original = products.FindIndex(item =>
        item.Id.Equals("soya-pop", StringComparison.OrdinalIgnoreCase) && item.Flavor == "Original");
    if (original >= 0)
    {
        products[original] = products[original] with { Stock = products[original].Stock + legacyStock };
    }
    else
    {
        products.Add(new ProductInventory("soya-pop", "Soya Pop", legacyPrice, legacyStock, "Original"));
    }

    foreach (var flavor in new[] { "Banana", "Cereal" })
    {
        if (!products.Any(item => item.Id.Equals("soya-pop", StringComparison.OrdinalIgnoreCase) && item.Flavor == flavor))
        {
            products.Add(new ProductInventory("soya-pop", "Soya Pop", legacyPrice, 0, flavor));
        }
    }
    await SaveProductsAsync();
}

bool TryGetInventoryKey(string? productId, string? flavor, out InventoryKey key)
{
    key = default;
    if (string.Equals(productId, "soya-pop", StringComparison.OrdinalIgnoreCase))
    {
        var canonicalFlavor = new[] { "Original", "Banana", "Cereal" }
            .FirstOrDefault(candidate => string.Equals(candidate, flavor ?? "Original", StringComparison.OrdinalIgnoreCase));
        if (canonicalFlavor is null) return false;
        key = new InventoryKey("soya-pop", canonicalFlavor);
        return true;
    }

    if (string.Equals(productId, "nutflix", StringComparison.OrdinalIgnoreCase) && flavor is null)
    {
        key = new InventoryKey("nutflix", null);
        return true;
    }

    return false;
}

bool IsAdmin(HttpContext context)
{
    var sessionCookie = context.Request.Cookies["kinetix-admin-session"];
    if (string.IsNullOrEmpty(sessionCookie)) return false;

    lock (adminSessions)
    {
        if (!adminSessions.TryGetValue(sessionCookie, out var expiresAt)) return false;
        if (expiresAt > DateTimeOffset.UtcNow) return true;
        adminSessions.Remove(sessionCookie);
        return false;
    }
}

IResult Unauthorized() => Results.Json(new { error = "Admin login required." }, statusCode: StatusCodes.Status401Unauthorized);
IResult InvalidAdminRequest() => Results.BadRequest(new { error = "Invalid request. Include the admin request header." });
bool IsValidAdminRequest(HttpContext context) =>
    string.Equals(context.Request.Headers["X-Kinetix-Admin"], "true", StringComparison.Ordinal);
bool TryGetCartItemKey(string key, out InventoryKey itemKey)
{
    var separator = key.IndexOf(':');
    return separator < 0
        ? TryGetInventoryKey(key, null, out itemKey)
        : TryGetInventoryKey(key[..separator], key[(separator + 1)..], out itemKey);
}

app.MapGet("/api/cart", async () =>
{
    await cartLock.WaitAsync();
    try
    {
        return Results.Ok(Snapshot());
    }
    finally
    {
        cartLock.Release();
    }
});

app.MapPost("/api/cart/items", async (AddItemRequest request) =>
{
    if (!TryGetInventoryKey(request.ProductId, request.Flavor, out var inventoryKey))
    {
        return (IResult)Results.BadRequest(new { error = "Choose a valid product and flavor." });
    }

    await productLock.WaitAsync();
    ProductInventory? product;
    try
    {
        product = products.Find(item =>
            item.Id.Equals(inventoryKey.ProductId, StringComparison.OrdinalIgnoreCase) && item.Flavor == inventoryKey.Flavor);
    }
    finally
    {
        productLock.Release();
    }

    if (product is null)
    {
        return (IResult)Results.BadRequest(new { error = "Choose a valid product." });
    }

    var name = product.Name;
    await cartLock.WaitAsync();
    try
    {
        var index = cart.FindIndex(item =>
            item.ProductId.Equals(inventoryKey.ProductId, StringComparison.OrdinalIgnoreCase) && item.Flavor == inventoryKey.Flavor);
        var itemName = inventoryKey.Flavor is null ? name : name + " - " + inventoryKey.Flavor;

        if (index >= 0)
        {
            cart[index] = cart[index] with { Quantity = cart[index].Quantity + 1 };
        }
        else
        {
            cart.Add(new CartItem(inventoryKey.ProductId, itemName, 1, inventoryKey.Flavor));
        }

        await SaveCartAsync();
        return Results.Ok(Snapshot());
    }
    finally
    {
        cartLock.Release();
    }
});

app.MapPost("/api/cart/items/{productId}/decrement", async (string productId) =>
{
    if (!TryGetCartItemKey(productId, out var itemKey))
    {
        return (IResult)Results.BadRequest(new { error = "Choose a valid cart item." });
    }

    await cartLock.WaitAsync();
    try
    {
        var index = cart.FindIndex(item =>
            item.ProductId.Equals(itemKey.ProductId, StringComparison.OrdinalIgnoreCase) && item.Flavor == itemKey.Flavor);
        if (index >= 0)
        {
            if (cart[index].Quantity > 1)
            {
                cart[index] = cart[index] with { Quantity = cart[index].Quantity - 1 };
            }
            else
            {
                cart.RemoveAt(index);
            }

            await SaveCartAsync();
        }

        return Results.Ok(Snapshot());
    }
    finally
    {
        cartLock.Release();
    }
});

app.MapGet("/api/products", async () =>
{
    await productLock.WaitAsync();
    try
    {
        return Results.Ok(products);
    }
    finally
    {
        productLock.Release();
    }
});

app.MapPost("/api/orders/reserve", async (ReserveOrderRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.OrderNumber) || request.OrderNumber.Length > 100 ||
        request.Items is null || request.Items.Length == 0 || request.Items.Length > 100)
    {
        return (IResult)Results.BadRequest(new { error = "Include an order number and at least one valid product." });
    }
    if (request.Order is null)
    {
        return (IResult)Results.BadRequest(new { error = "Submit the billing details with the order." });
    }

    var requestedQuantities = new Dictionary<InventoryKey, long>();
    foreach (var item in request.Items)
    {
        if (item is null || string.IsNullOrWhiteSpace(item.ProductId) ||
            item.Quantity < 1 || item.Quantity > 1_000_000 ||
            !TryGetInventoryKey(item.ProductId, item.Flavor, out var inventoryKey))
        {
            return (IResult)Results.BadRequest(new { error = "Order items must include a valid product and flavor with quantities between 1 and 1,000,000." });
        }

        requestedQuantities.TryGetValue(inventoryKey, out var existingQuantity);
        var totalQuantity = existingQuantity + item.Quantity;
        if (totalQuantity > 1_000_000)
        {
            return (IResult)Results.BadRequest(new { error = "The requested quantity for a product flavor is too large." });
        }
        requestedQuantities[inventoryKey] = totalQuantity;
    }

    if (request.Order is not null)
    {
        var submittedOrder = request.Order;
        var customer = submittedOrder.Customer;
        if (customer is null ||
            string.IsNullOrWhiteSpace(customer.Name) || customer.Name.Trim().Length > 120 ||
            string.IsNullOrWhiteSpace(customer.Phone) || customer.Phone.Trim().Length > 40 ||
            !System.Text.RegularExpressions.Regex.IsMatch(customer.Phone.Trim(), @"^[0-9+\-\s()]{7,}$") ||
            string.IsNullOrWhiteSpace(customer.Email) || customer.Email.Trim().Length > 254 ||
            !System.Text.RegularExpressions.Regex.IsMatch(customer.Email.Trim(), @"^\S+@\S+\.\S+$") ||
            string.IsNullOrWhiteSpace(customer.Place) || customer.Place.Trim().Length > 300)
        {
            return (IResult)Results.BadRequest(new { error = "Enter a valid name, contact number, email, and pick-up/delivery place." });
        }

        if (submittedOrder.Payment is not ("Cash on pick-up" or "GCash") ||
            submittedOrder.Notes?.Length > 1000 ||
            submittedOrder.Items is null || submittedOrder.Items.Length == 0 || submittedOrder.Items.Length > 100)
        {
            return (IResult)Results.BadRequest(new { error = "The billing details or order items are invalid." });
        }

        var submittedQuantities = new Dictionary<InventoryKey, long>();
        foreach (var line in submittedOrder.Items)
        {
            if (line is null || string.IsNullOrWhiteSpace(line.ProductId) ||
                line.Quantity < 1 || line.Quantity > 1_000_000 ||
                !TryGetInventoryKey(line.ProductId, line.Flavor, out var inventoryKey))
            {
                return (IResult)Results.BadRequest(new { error = "An order contains an invalid item or flavor." });
            }
            submittedQuantities.TryGetValue(inventoryKey, out var existingQuantity);
            submittedQuantities[inventoryKey] = existingQuantity + line.Quantity;
        }

        if (requestedQuantities.Count != submittedQuantities.Count ||
            requestedQuantities.Any(item => !submittedQuantities.TryGetValue(item.Key, out var quantity) || quantity != item.Value))
        {
            return (IResult)Results.BadRequest(new { error = "The order summary does not match the reserved quantities." });
        }
    }

    await productLock.WaitAsync();
    try
    {
        if (processedOrderNumbers.Contains(request.OrderNumber))
        {
            var existingOrder = customerOrders.Find(item => item.OrderNumber.Equals(request.OrderNumber, StringComparison.OrdinalIgnoreCase));
            return Results.Ok(new { reserved = true, alreadyProcessed = true, order = existingOrder });
        }

        var orderLines = new List<CustomerOrderLine>();
        decimal orderTotal = 0;
        foreach (var (inventoryKey, quantity) in requestedQuantities)
        {
            var product = products.Find(item =>
                item.Id.Equals(inventoryKey.ProductId, StringComparison.OrdinalIgnoreCase) && item.Flavor == inventoryKey.Flavor);
            if (product is null)
            {
                return Results.BadRequest(new { error = "An order contains an unknown product." });
            }
            if (product.Stock < quantity)
            {
                return Results.Json(new
                {
                    error = $"Only {product.Stock} {product.Name}{(product.Flavor is null ? string.Empty : " " + product.Flavor)} item(s) are currently available."
                }, statusCode: StatusCodes.Status409Conflict);
            }

            if (request.Order is not null)
            {
                var matchingLines = request.Order.Items!.Where(item =>
                    TryGetInventoryKey(item!.ProductId, item.Flavor, out var lineKey) && lineKey == inventoryKey).ToArray();
                foreach (var line in matchingLines)
                {
                    var flavor = inventoryKey.Flavor;
                    var itemPrice = decimal.Round(product.Price, 2);
                    var itemTotal = itemPrice * line!.Quantity;
                    orderLines.Add(new CustomerOrderLine(
                        product.Id,
                        product.Flavor is not null ? product.Name + " - " + flavor : product.Name,
                        flavor,
                        line.Quantity,
                        itemPrice,
                        itemTotal));
                    orderTotal += itemTotal;
                }
            }
        }

        CustomerOrder? customerOrder = null;
        if (request.Order is not null)
        {
            var submittedOrder = request.Order;
            customerOrder = new CustomerOrder(
                request.OrderNumber!,
                DateTimeOffset.UtcNow,
                new OrderCustomerRequest(
                    submittedOrder.Customer!.Name!.Trim(),
                    submittedOrder.Customer.Phone!.Trim(),
                    submittedOrder.Customer.Email!.Trim(),
                    submittedOrder.Customer.Place!.Trim()),
                submittedOrder.Payment!,
                string.IsNullOrWhiteSpace(submittedOrder.Notes) ? null : submittedOrder.Notes.Trim(),
                orderLines,
                orderTotal);
        }

        var previousProducts = products;
        products = products.Select(product =>
            requestedQuantities.TryGetValue(new InventoryKey(product.Id, product.Flavor), out var quantity)
                ? product with { Stock = product.Stock - (int)quantity }
                : product).ToList();
        if (customerOrder is not null) customerOrders.Add(customerOrder);
        processedOrderNumbers.Add(request.OrderNumber!);
        try
        {
            await SaveProductsAsync();
            await SaveOrdersAsync();
            if (customerOrder is not null) await SaveCustomerOrdersAsync();
        }
        catch
        {
            products = previousProducts;
            processedOrderNumbers.Remove(request.OrderNumber!);
            if (customerOrder is not null) customerOrders.Remove(customerOrder);
            await SaveProductsAsync();
            await SaveOrdersAsync();
            if (customerOrder is not null) await SaveCustomerOrdersAsync();
            throw;
        }
        return Results.Ok(new { reserved = true, alreadyProcessed = false, order = customerOrder });
    }
    finally
    {
        productLock.Release();
    }
});

app.MapGet("/api/announcements", async () =>
{
    await announcementLock.WaitAsync();
    try
    {
        return Results.Ok(announcements.Where(item => item.Published).OrderByDescending(item => item.CreatedAt).ToArray());
    }
    finally
    {
        announcementLock.Release();
    }
});

app.MapPost("/api/visits", async () =>
{
    await visitorCountLock.WaitAsync();
    try
    {
        var nextCount = checked(visitorCount + 1);
        await SaveVisitorCountAsync(nextCount);
        visitorCount = nextCount;
        return Results.NoContent();
    }
    finally
    {
        visitorCountLock.Release();
    }
});

app.MapPost("/api/admin/login", (AdminLoginRequest request, HttpContext context) =>
{
    var username = adminUsername;
    var password = adminPassword;
    if (string.IsNullOrWhiteSpace(username) &&
        string.IsNullOrWhiteSpace(password) &&
        app.Environment.IsDevelopment() &&
        IPAddress.IsLoopback(context.Connection.RemoteIpAddress ?? IPAddress.None))
    {
        username = "Admin";
        password = "kenken";
    }

    if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
    {
        return (IResult)Results.Problem(
            "Admin login is not configured. Set KINETIX_ADMIN_USERNAME and KINETIX_ADMIN_PASSWORD, then restart the backend.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var submittedUsername = SHA256.HashData(Encoding.UTF8.GetBytes(request.Username ?? string.Empty));
    var expectedUsername = SHA256.HashData(Encoding.UTF8.GetBytes(username));
    var submittedPassword = SHA256.HashData(Encoding.UTF8.GetBytes(request.Password ?? string.Empty));
    var expectedPassword = SHA256.HashData(Encoding.UTF8.GetBytes(password));
    if (!CryptographicOperations.FixedTimeEquals(submittedUsername, expectedUsername) ||
        !CryptographicOperations.FixedTimeEquals(submittedPassword, expectedPassword))
    {
        return (IResult)Results.Json(new
        {
            error = app.Environment.IsDevelopment()
                ? "The username or password is incorrect. For local development without configured credentials, use Admin / kenken."
                : "The username or password is incorrect."
        }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
        .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    var expiresAt = DateTimeOffset.UtcNow.AddHours(8);
    lock (adminSessions)
    {
        foreach (var expiredToken in adminSessions.Where(session => session.Value <= DateTimeOffset.UtcNow).Select(session => session.Key).ToArray())
        {
            adminSessions.Remove(expiredToken);
        }
        adminSessions[token] = expiresAt;
    }

    context.Response.Cookies.Append("kinetix-admin-session", token, new CookieOptions
    {
        HttpOnly = true,
        Secure = context.Request.IsHttps,
        SameSite = SameSiteMode.Strict,
        Path = "/",
        Expires = expiresAt
    });
    return Results.Ok(new { authenticated = true });
});

app.MapGet("/api/admin/session", (HttpContext context) =>
    IsAdmin(context) ? Results.Ok(new { authenticated = true }) : Unauthorized());

app.MapGet("/api/admin/visitors", async (HttpContext context) =>
{
    if (!IsAdmin(context)) return Unauthorized();
    await visitorCountLock.WaitAsync();
    try
    {
        return Results.Ok(new { count = visitorCount });
    }
    finally
    {
        visitorCountLock.Release();
    }
});

app.MapGet("/api/admin/orders", async (HttpContext context) =>
{
    if (!IsAdmin(context)) return Unauthorized();
    await productLock.WaitAsync();
    try
    {
        return Results.Ok(customerOrders.OrderByDescending(item => item.CreatedAt).ToArray());
    }
    finally
    {
        productLock.Release();
    }
});

app.MapPost("/api/registrations", async (EventRegistrationRequest request) =>
{
    if (!KinetixValidation.TryValidateRegistration(request, out var error))
    {
        return Results.BadRequest(new { error });
    }

    await registrationsLock.WaitAsync();
    try
    {
        string code;
        do
        {
            code = "KNX-REG-" + RandomNumberGenerator.GetString("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
        } while (registrations.Any(item => item.Code == code));

        var registration = new EventRegistration(
            code,
            DateTimeOffset.UtcNow,
            request.Name!.Trim(),
            request.Email!.Trim(),
            request.Phone!.Trim(),
            request.School?.Trim() ?? string.Empty,
            request.Event!,
            request.Category!);
        registrations.Add(registration);
        await SaveRegistrationsAsync();
        return Results.Json(registration, statusCode: StatusCodes.Status201Created);
    }
    finally
    {
        registrationsLock.Release();
    }
});

app.MapGet("/api/admin/registrations", async (HttpContext context) =>
{
    if (!IsAdmin(context)) return Unauthorized();
    await registrationsLock.WaitAsync();
    try
    {
        return Results.Ok(registrations.OrderByDescending(item => item.CreatedAt).ToArray());
    }
    finally
    {
        registrationsLock.Release();
    }
});

app.MapPost("/api/admin/logout", (HttpContext context) =>
{
    if (!IsValidAdminRequest(context)) return InvalidAdminRequest();
    var token = context.Request.Cookies["kinetix-admin-session"];
    if (!string.IsNullOrEmpty(token))
    {
        lock (adminSessions)
        {
            adminSessions.Remove(token);
        }
    }
    context.Response.Cookies.Delete("kinetix-admin-session", new CookieOptions { Path = "/", SameSite = SameSiteMode.Strict });
    return Results.Ok(new { authenticated = false });
});

app.MapPut("/api/admin/products/{productId}", async (string productId, UpdateProductRequest request, HttpContext context) =>
{
    if (!IsAdmin(context)) return Unauthorized();
    if (!IsValidAdminRequest(context)) return InvalidAdminRequest();
    if (request.Stock < 0 || request.Stock > 1_000_000 ||
        request.Price < 0 || request.Price > 1_000_000)
    {
        return Results.BadRequest(new { error = "Stock and price must be between 0 and 1,000,000." });
    }

    await productLock.WaitAsync();
    try
    {
        if (!TryGetInventoryKey(productId, request.Flavor, out var inventoryKey))
        {
            return Results.BadRequest(new { error = "Choose a valid product and flavor." });
        }
        var index = products.FindIndex(item =>
            item.Id.Equals(inventoryKey.ProductId, StringComparison.OrdinalIgnoreCase) && item.Flavor == inventoryKey.Flavor);
        if (index < 0) return Results.NotFound(new { error = "Product not found." });
        var updatedPrice = decimal.Round(request.Price, 2);
        products = products.Select(item =>
            item.Id.Equals(inventoryKey.ProductId, StringComparison.OrdinalIgnoreCase)
                ? item with
                {
                    Stock = item.Flavor == inventoryKey.Flavor ? request.Stock : item.Stock,
                    Price = updatedPrice
                }
                : item).ToList();
        await SaveProductsAsync();
        return Results.Ok(products.Find(item =>
            item.Id.Equals(inventoryKey.ProductId, StringComparison.OrdinalIgnoreCase) && item.Flavor == inventoryKey.Flavor));
    }
    finally
    {
        productLock.Release();
    }
});

app.MapGet("/api/admin/announcements", async (HttpContext context) =>
{
    if (!IsAdmin(context)) return Unauthorized();
    await announcementLock.WaitAsync();
    try
    {
        return Results.Ok(announcements.OrderByDescending(item => item.CreatedAt).ToArray());
    }
    finally
    {
        announcementLock.Release();
    }
});

app.MapPost("/api/admin/announcements", async (SaveAnnouncementRequest request, HttpContext context) =>
{
    if (!IsAdmin(context)) return Unauthorized();
    if (!IsValidAdminRequest(context)) return InvalidAdminRequest();
    if (!KinetixValidation.TryValidateAnnouncement(request, out var error)) return Results.BadRequest(new { error });

    await announcementLock.WaitAsync();
    try
    {
        var announcement = new Announcement(Guid.NewGuid().ToString("N"), request.Title!.Trim(), request.Body!.Trim(), request.Published, DateTimeOffset.UtcNow);
        announcements.Add(announcement);
        await SaveAnnouncementsAsync();
        return Results.Created($"/api/admin/announcements/{announcement.Id}", announcement);
    }
    finally
    {
        announcementLock.Release();
    }
});

app.MapPut("/api/admin/announcements/{announcementId}", async (string announcementId, SaveAnnouncementRequest request, HttpContext context) =>
{
    if (!IsAdmin(context)) return Unauthorized();
    if (!IsValidAdminRequest(context)) return InvalidAdminRequest();
    if (!KinetixValidation.TryValidateAnnouncement(request, out var error)) return Results.BadRequest(new { error });

    await announcementLock.WaitAsync();
    try
    {
        var index = announcements.FindIndex(item => item.Id == announcementId);
        if (index < 0) return Results.NotFound(new { error = "Announcement not found." });
        announcements[index] = announcements[index] with
        {
            Title = request.Title!.Trim(),
            Body = request.Body!.Trim(),
            Published = request.Published
        };
        await SaveAnnouncementsAsync();
        return Results.Ok(announcements[index]);
    }
    finally
    {
        announcementLock.Release();
    }
});

app.MapDelete("/api/admin/announcements/{announcementId}", async (string announcementId, HttpContext context) =>
{
    if (!IsAdmin(context)) return Unauthorized();
    if (!IsValidAdminRequest(context)) return InvalidAdminRequest();

    await announcementLock.WaitAsync();
    try
    {
        var removed = announcements.RemoveAll(item => item.Id == announcementId);
        if (removed == 0) return Results.NotFound(new { error = "Announcement not found." });
        await SaveAnnouncementsAsync();
        return Results.NoContent();
    }
    finally
    {
        announcementLock.Release();
    }
});

app.MapDelete("/api/cart/items/{productId}", async (string productId) =>
{
    if (!TryGetCartItemKey(productId, out var itemKey))
    {
        return (IResult)Results.BadRequest(new { error = "Choose a valid cart item." });
    }

    await cartLock.WaitAsync();
    try
    {
        cart.RemoveAll(item =>
            item.ProductId.Equals(itemKey.ProductId, StringComparison.OrdinalIgnoreCase) && item.Flavor == itemKey.Flavor);
        await SaveCartAsync();
        return Results.Ok(Snapshot());
    }
    finally
    {
        cartLock.Release();
    }
});

app.MapDelete("/api/cart", async () =>
{
    await cartLock.WaitAsync();
    try
    {
        cart.Clear();
        await SaveCartAsync();
        return Results.Ok(Snapshot());
    }
    finally
    {
        cartLock.Release();
    }
});

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.Run();
