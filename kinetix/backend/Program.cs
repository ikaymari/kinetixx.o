using System.Text.Json;

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
    ["timer.html"] = "text/html; charset=utf-8",
    ["templatemo-631-kinetic-style.css"] = "text/css; charset=utf-8",
    ["templatemo-631-kinetic-script.js"] = "text/javascript; charset=utf-8"
};
var imageTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
{
    ["cca-seal.webp"] = "image/webp",
    ["kinetix-logo.svg"] = "image/svg+xml",
    ["kinetic-10.jpg"] = "image/jpeg",
    ["kinetic-11.jpg"] = "image/jpeg",
    ["project-01.jpg"] = "image/jpeg",
    ["project-02.jpg"] = "image/jpeg",
    ["project-03.jpg"] = "image/jpeg",
    ["project-04.jpg"] = "image/jpeg",
    ["project-05.jpg"] = "image/jpeg",
    ["project-06.jpg"] = "image/jpeg",
    ["project-07.jpg"] = "image/jpeg",
    ["project-08.jpg"] = "image/jpeg",
    ["project-09.jpg"] = "image/jpeg"
};

app.MapGet("/", () => Results.Redirect("/index.html"));
app.MapGet("/{fileName}", (string fileName) =>
{
    if (!pageFiles.TryGetValue(fileName, out var contentType)) return (IResult)Results.NotFound();
    var path = Path.Combine(siteRoot, fileName);
    return File.Exists(path) ? Results.File(path, contentType) : Results.NotFound();
});
app.MapGet("/images/{fileName}", (string fileName) =>
{
    if (!imageTypes.TryGetValue(fileName, out var contentType)) return (IResult)Results.NotFound();
    var path = Path.Combine(siteRoot, "images", fileName);
    return File.Exists(path) ? Results.File(path, contentType) : Results.NotFound();
});

var cartFile = Path.Combine(app.Environment.ContentRootPath, "cart.json");
var cartLock = new SemaphoreSlim(1, 1);
var products = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
{
    ["soya-pop"] = "Soya Pop",
    ["nutflix"] = "Nutflix"
};
var cart = new List<CartItem>();

if (File.Exists(cartFile))
{
    try
    {
        cart = JsonSerializer.Deserialize<List<CartItem>>(await File.ReadAllTextAsync(cartFile)) ?? new List<CartItem>();
    }
    catch (JsonException)
    {
        cart = new List<CartItem>();
    }
}

CartSnapshot Snapshot() => new(cart.ToArray(), cart.Sum(item => item.Quantity));

async Task SaveCartAsync()
{
    var temporaryFile = cartFile + ".tmp";
    await File.WriteAllTextAsync(temporaryFile, JsonSerializer.Serialize(cart));
    File.Move(temporaryFile, cartFile, true);
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
    if (!products.TryGetValue(request.ProductId ?? string.Empty, out var name))
    {
        return (IResult)Results.BadRequest(new { error = "Choose a valid product." });
    }

    await cartLock.WaitAsync();
    try
    {
        var index = cart.FindIndex(item => item.ProductId == request.ProductId);
        var itemName = name;
        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            itemName = request.Name;
        }
        else if (index >= 0)
        {
            itemName = cart[index].Name;
        }

        if (index >= 0)
        {
            cart[index] = cart[index] with { Quantity = cart[index].Quantity + 1, Name = itemName };
        }
        else
        {
            cart.Add(new CartItem(request.ProductId!, itemName, 1));
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
    await cartLock.WaitAsync();
    try
    {
        var index = cart.FindIndex(item => item.ProductId.Equals(productId, StringComparison.OrdinalIgnoreCase));
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

app.MapDelete("/api/cart/items/{productId}", async (string productId) =>
{
    await cartLock.WaitAsync();
    try
    {
        cart.RemoveAll(item => item.ProductId.Equals(productId, StringComparison.OrdinalIgnoreCase));
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

record CartItem(string ProductId, string Name, int Quantity);
record CartSnapshot(IReadOnlyList<CartItem> Items, int TotalQuantity);
record AddItemRequest(string? ProductId, string? Name);