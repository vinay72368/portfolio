using demo.shop as db from '../db/schema';

/**
 * OData V4 service exposed at /odata/v4/shop
 * Customers can browse; Admins can also change the catalogue. Orders are created through the placeOrder action.
 */
@path: '/odata/v4/shop'
@requires: 'authenticated-user'
service ShopService {

  @restrict: [ { grant: 'READ', to: 'Customer' }, { grant: '*', to: 'Admin' } ]
  entity Products as projection on db.Products;

  @restrict: [ { grant: 'READ', to: 'Customer' }, { grant: '*', to: 'Admin' } ]
  entity Customers as projection on db.Customers;

  @restrict: [ { grant: 'READ', to: 'Customer' }, { grant: '*', to: 'Admin' } ]
  entity Orders as projection on db.Orders;

  @restrict: [ { grant: 'READ', to: 'Customer' }, { grant: '*', to: 'Admin' } ]
  entity OrderItems as projection on db.OrderItems;

  type OrderItemInput {
    productID : UUID;
    quantity  : Integer;
  }

  /** Checks stock, prices the basket (with volume discount), saves the order and reduces stock. */
  @requires: ['Customer', 'Admin']
  action placeOrder(customerID : UUID, items : many OrderItemInput) returns Orders;

  /** Cancels an order that has not shipped and puts the items back in stock. */
  @requires: ['Customer', 'Admin']
  action cancelOrder(orderID : UUID) returns Orders;

  /** Products with fewer than `threshold` items left. */
  function lowStockProducts(threshold : Integer) returns many Products;

  // ---- Shop operator tools (Admin only) ----

  type SalesSummary {
    orders       : Integer;
    revenue      : Decimal(12,2);
    averageOrder : Decimal(10,2);
  }

  type TopProduct {
    productID : UUID;
    name      : String(100);
    unitsSold : Integer;
  }

  /** Order lifecycle: NEW -> PAID -> SHIPPED. Each step is only allowed from the right status. */
  @requires: 'Admin'
  action markOrderPaid(orderID : UUID) returns Orders;

  @requires: 'Admin'
  action shipOrder(orderID : UUID) returns Orders;

  /** Adds items to a product's stock. */
  @requires: 'Admin'
  action restockProduct(productID : UUID, quantity : Integer) returns Products;

  /** Order count, revenue and average order value, ignoring cancelled orders. */
  @requires: 'Admin'
  function salesSummary() returns SalesSummary;

  /** The best-selling products by units sold, ignoring cancelled orders. */
  @requires: 'Admin'
  function topProducts(limit : Integer) returns many TopProduct;
}
