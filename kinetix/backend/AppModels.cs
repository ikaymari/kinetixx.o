namespace KinetixCart;

record CartItem(string ProductId, string Name, int Quantity, string? Flavor = null)
{
    public string Key => Flavor is null ? ProductId : $"{ProductId}:{Flavor}";
}
record CartSnapshot(IReadOnlyList<CartItem> Items, int TotalQuantity);
record AddItemRequest(string? ProductId, string? Name, string? Flavor = null);
record ReserveOrderRequest(string? OrderNumber, OrderLineRequest?[]? Items, CheckoutOrderRequest? Order = null);
record OrderLineRequest(string? ProductId, int Quantity, string? Flavor = null);
record CheckoutOrderRequest(OrderCustomerRequest? Customer, string? Payment, string? Notes, CheckoutOrderLineRequest?[]? Items);
record OrderCustomerRequest(string? Name, string? Phone, string? Email, string? Place);
record CheckoutOrderLineRequest(string? ProductId, string? Flavor, int Quantity);
record CustomerOrder(string OrderNumber, DateTimeOffset CreatedAt, OrderCustomerRequest Customer, string Payment, string? Notes, IReadOnlyList<CustomerOrderLine> Items, decimal Total);
record CustomerOrderLine(string ProductId, string Name, string? Flavor, int Quantity, decimal Price, decimal Total);
record EventRegistrationRequest(string? Name, string? Email, string? Phone, string? School, string? Event, string? Category);
record EventRegistration(string Code, DateTimeOffset CreatedAt, string Name, string Email, string Phone, string School, string Event, string Category);
record ProductInventory(string Id, string Name, decimal Price, int Stock, string? Flavor = null);
record struct InventoryKey(string ProductId, string? Flavor);
record Announcement(string Id, string Title, string Body, bool Published, DateTimeOffset CreatedAt);
record AdminLoginRequest(string? Username, string? Password);
record UpdateProductRequest(int Stock, decimal Price, string? Flavor = null);
record SaveAnnouncementRequest(string? Title, string? Body, bool Published);
