# CAP Store: sample SAP CAP (Java) project

A small e-commerce app built to show the usual building blocks of a **CAP Java** application on **SAP BTP**, end to end:
a UI5 storefront, an OData V4 service, custom Java logic and a data model that deploys to SAP HANA Cloud.

Shoppers browse products, fill a basket and place an order. The backend checks stock, applies a **volume discount** (5% from 100, 10% from 200, 15% from 500), saves the order and reduces stock. Orders that have not shipped can be cancelled, which puts the items back in stock.

Operators (the `admin` role) also get an order lifecycle (**NEW → PAID → SHIPPED**, each step only allowed from the right status), a restock tool and two sales reports.

This is a generic demo. Feel free to copy and reuse any of it.

## Actions and functions

In CAP an **action** changes data (it is called with POST) and a **function** only reads it (GET).

| Operation | Kind | Who | What it does |
|---|---|---|---|
| `placeOrder(customerID, items)` | action | Customer, Admin | Checks stock (409 if short), prices the basket with the volume discount, saves the order, reduces stock |
| `cancelOrder(orderID)` | action | Customer, Admin | Cancels a NEW or PAID order and puts the items back in stock (409 if shipped) |
| `markOrderPaid(orderID)` | action | Admin | NEW → PAID (409 from any other status) |
| `shipOrder(orderID)` | action | Admin | PAID → SHIPPED (409 from any other status) |
| `restockProduct(productID, quantity)` | action | Admin | Adds to a product's stock |
| `lowStockProducts(threshold)` | function | Customer, Admin | Products with fewer than `threshold` items left |
| `salesSummary()` | function | Admin | Order count, revenue and average order value, ignoring cancelled orders |
| `topProducts(limit)` | function | Admin | Best sellers by units sold, ignoring cancelled orders |

| Concern | Where |
|---|---|
| UI5 front end (OData V4 model, routing, i18n) | `app/webapp/` |
| Domain model (CDS) | `db/schema.cds` |
| Seed data | `db/data/*.csv` |
| Service + authorization | `srv/shop-service.cds` |
| Custom Java logic | `srv/src/main/java/demo/shop/handlers/` |
| Pure pricing rules + unit test | `PricingCalculator`, `PricingCalculatorTest` |
| API tests with security | `ShopServiceTest` |
| Config (local and cloud profiles) | `srv/src/main/resources/application.yaml` |
| XSUAA roles | `xs-security.json` |
| Cloud Foundry deployment (HANA Cloud + XSUAA) | `mta.yaml` |

## Run it locally

Needs JDK 17+, Maven 3.9+ and Node 18+.

```bash
mvn spring-boot:run -f srv/pom.xml
```

Open **http://localhost:8080** for the UI5 storefront. The browser asks for a login the first time the app calls the API: use `customer` / `secret` (can browse and order) or `admin` / `secret` (can also change the catalogue). The UI is plain OpenUI5 loaded from the OpenUI5 CDN, so you need internet access. It is bundled into the jar by `srv/pom.xml`, so one `java -jar` serves UI and API from the same origin.

In production, put the UI behind the SAP Approuter or SAP Build Work Zone so users log in with XSUAA instead of basic auth.

You can also call the API directly:

```bash
# list products
curl -u customer:secret "http://localhost:8080/odata/v4/shop/Products?\$select=name,price,stock&\$orderby=name"

# orders with their lines and customer
curl -u customer:secret "http://localhost:8080/odata/v4/shop/Orders?\$expand=items,customer"

# products running low
curl -u customer:secret "http://localhost:8080/odata/v4/shop/lowStockProducts(threshold=5)"

# place an order (headphones x1, notebooks x4 => 5% discount => 180.30)
curl -u customer:secret -H "Content-Type: application/json" \
  -d '{"customerID":"1994eedc-fff6-4478-933a-8c34683b40b6","items":[{"productID":"f391e075-fb77-42d0-bf65-384e2165177a","quantity":1},{"productID":"77fe68b0-06bf-4b7c-b0bd-1138b09e91cd","quantity":4}]}' \
  http://localhost:8080/odata/v4/shop/placeOrder

# admin only: sales figures and best sellers
curl -u admin:secret "http://localhost:8080/odata/v4/shop/salesSummary()"
curl -u admin:secret "http://localhost:8080/odata/v4/shop/topProducts(limit=3)"

# admin only: move an order along (replace <orderID> with an id from /Orders)
curl -u admin:secret -H "Content-Type: application/json" -d '{"orderID":"<orderID>"}' http://localhost:8080/odata/v4/shop/markOrderPaid
curl -u admin:secret -H "Content-Type: application/json" -d '{"orderID":"<orderID>"}' http://localhost:8080/odata/v4/shop/shipOrder

# customers cannot delete products, so this returns 403
curl -u customer:secret -X DELETE "http://localhost:8080/odata/v4/shop/Products(f391e075-fb77-42d0-bf65-384e2165177a)"
```

## Run the tests

```bash
mvn test -f srv/pom.xml
```

## Deploy to SAP BTP (Cloud Foundry)

```bash
npm ci
mbt build
cf deploy mta_archives/shop_1.0.0.mtar
```

## Pricing rules

```
subtotal   = sum of unit price x quantity
discount   = subtotal x 5% (from 100), 10% (from 200) or 15% (from 500), rounded half up to 2 decimals
total      = subtotal - discount
```
