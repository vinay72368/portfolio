namespace demo.shop;

using { cuid, managed } from '@sap/cds/common';

type OrderStatus : String enum {
  NEW;
  PAID;
  SHIPPED;
  CANCELLED;
}

/** Something the shop sells. */
entity Products : cuid, managed {
  sku      : String(20);
  name     : String(100) @mandatory;
  category : String(40);
  price    : Decimal(9,2) @mandatory;
  stock    : Integer default 0;
  active   : Boolean default true;
}

entity Customers : cuid {
  name  : String(100) @mandatory;
  email : String(120);
  city  : String(60);
}

/** An order with its lines. Deleting an order deletes its items too (Composition). */
entity Orders : cuid, managed {
  orderNo   : String(12);     // e.g. SO-95DF245E, shown to people instead of the UUID
  customer  : Association to Customers;
  orderedOn : Date;
  status    : OrderStatus default 'NEW';
  subtotal  : Decimal(10,2);
  discount  : Decimal(10,2);
  total     : Decimal(10,2);
  items     : Composition of many OrderItems on items.order = $self;
}

entity OrderItems : cuid {
  order     : Association to Orders;
  product   : Association to Products;
  quantity  : Integer @mandatory;
  unitPrice : Decimal(9,2);   // price at the time of purchase
  lineTotal : Decimal(10,2);
}
