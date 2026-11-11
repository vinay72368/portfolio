package demo.shop.handlers;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.sap.cds.CdsData;
import com.sap.cds.Row;
import com.sap.cds.ql.CQL;
import com.sap.cds.ql.Insert;
import com.sap.cds.ql.Select;
import com.sap.cds.ql.Update;
import com.sap.cds.services.ErrorStatuses;
import com.sap.cds.services.ServiceException;
import com.sap.cds.services.cds.CqnService;
import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.Before;
import com.sap.cds.services.handler.annotations.On;
import com.sap.cds.services.handler.annotations.ServiceName;
import com.sap.cds.services.persistence.PersistenceService;

import cds.gen.shopservice.CancelOrderContext;
import cds.gen.shopservice.LowStockProductsContext;
import cds.gen.shopservice.MarkOrderPaidContext;
import cds.gen.shopservice.OrderItemInput;
import cds.gen.shopservice.Orders;
import cds.gen.shopservice.PlaceOrderContext;
import cds.gen.shopservice.Products;
import cds.gen.shopservice.RestockProductContext;
import cds.gen.shopservice.SalesSummary;
import cds.gen.shopservice.SalesSummaryContext;
import cds.gen.shopservice.ShipOrderContext;
import cds.gen.shopservice.ShopService_;
import cds.gen.shopservice.TopProduct;
import cds.gen.shopservice.TopProductsContext;
import demo.shop.handlers.PricingCalculator.Line;
import demo.shop.handlers.PricingCalculator.Quote;

/**
 * Custom logic for ShopService. CAP serves plain CRUD out of the box,
 * so this class only holds what is specific to the shop.
 */
@Component
@ServiceName(ShopService_.CDS_NAME)
public class ShopServiceHandler implements EventHandler {

	private static final String PRODUCTS = "demo.shop.Products";
	private static final String CUSTOMERS = "demo.shop.Customers";
	private static final String ORDERS = "demo.shop.Orders";
	private static final String ORDER_ITEMS = "demo.shop.OrderItems";

	private final PersistenceService db;

	public ShopServiceHandler(PersistenceService db) {
		this.db = db;
	}

	/** Runs before every CREATE on Products, so bad data never reaches the database. */
	@Before(event = CqnService.EVENT_CREATE, entity = "ShopService.Products")
	public void validateProduct(List<CdsData> products) {
		for (CdsData product : products) {
			BigDecimal price = (BigDecimal) product.get("price");
			if (price == null || price.signum() < 0) {
				throw new ServiceException(ErrorStatuses.BAD_REQUEST, "Price cannot be negative");
			}
		}
	}

	/** Implements the unbound action placeOrder(customerID, items). Runs in one transaction. */
	@On
	public void placeOrder(PlaceOrderContext context) {
		List<OrderItemInput> items = context.getItems();
		if (items == null || items.isEmpty()) {
			throw new ServiceException(ErrorStatuses.BAD_REQUEST, "An order needs at least one item");
		}
		String customerId = context.getCustomerID();
		db.run(Select.from(CUSTOMERS).where(CQL.get("ID").eq(customerId))).first()
				.orElseThrow(() -> new ServiceException(ErrorStatuses.NOT_FOUND, "Customer {} not found", customerId));

		String orderId = UUID.randomUUID().toString();
		List<Line> lines = new ArrayList<>();
		List<Map<String, Object>> itemRows = new ArrayList<>();
		Map<String, Integer> newStock = new HashMap<>();

		for (OrderItemInput item : items) {
			int quantity = item.getQuantity() == null ? 0 : item.getQuantity();
			if (quantity <= 0) {
				throw new ServiceException(ErrorStatuses.BAD_REQUEST, "Quantity must be positive");
			}
			String productId = item.getProductID();
			Map<String, Object> product = db.run(Select.from(PRODUCTS).where(CQL.get("ID").eq(productId))).first()
					.orElseThrow(() -> new ServiceException(ErrorStatuses.NOT_FOUND, "Product {} not found", productId));

			String name = (String) product.get("name");
			if (!Boolean.TRUE.equals(product.get("active"))) {
				throw new ServiceException(ErrorStatuses.CONFLICT, "{} is not available", name);
			}
			int stock = (Integer) product.get("stock");
			if (stock < quantity) {
				throw new ServiceException(ErrorStatuses.CONFLICT, "Only {} left of {}", stock, name);
			}

			BigDecimal price = (BigDecimal) product.get("price");
			lines.add(new Line(price, quantity));
			newStock.put(productId, stock - quantity);

			Map<String, Object> row = new HashMap<>();
			row.put("ID", UUID.randomUUID().toString());
			row.put("order_ID", orderId);
			row.put("product_ID", productId);
			row.put("quantity", quantity);
			row.put("unitPrice", price);
			row.put("lineTotal", price.multiply(BigDecimal.valueOf(quantity)));
			itemRows.add(row);
		}

		Quote quote = PricingCalculator.quote(lines);
		Map<String, Object> order = new HashMap<>();
		order.put("ID", orderId);
		order.put("orderNo", "SO-" + orderId.substring(0, 8).toUpperCase());
		order.put("customer_ID", customerId);
		order.put("orderedOn", LocalDate.now());
		order.put("status", "NEW");
		order.put("subtotal", quote.subtotal());
		order.put("discount", quote.discount());
		order.put("total", quote.total());

		db.run(Insert.into(ORDERS).entry(order));
		db.run(Insert.into(ORDER_ITEMS).entries(itemRows));
		newStock.forEach((productId, stock) ->
				db.run(Update.entity(PRODUCTS).byId(productId).data("stock", stock)));

		context.setResult(Orders.of(order));
	}

	/** Implements the unbound action cancelOrder(orderID). */
	@On
	public void cancelOrder(CancelOrderContext context) {
		String orderId = context.getOrderID();
		Map<String, Object> order = db.run(Select.from(ORDERS).where(CQL.get("ID").eq(orderId))).first()
				.orElseThrow(() -> new ServiceException(ErrorStatuses.NOT_FOUND, "Order {} not found", orderId));

		String status = (String) order.get("status");
		if ("SHIPPED".equals(status)) {
			throw new ServiceException(ErrorStatuses.CONFLICT, "Shipped orders cannot be cancelled");
		}
		if ("CANCELLED".equals(status)) {
			throw new ServiceException(ErrorStatuses.CONFLICT, "Order is already cancelled");
		}

		// Put the items back in stock
		db.run(Select.from(ORDER_ITEMS).where(CQL.get("order_ID").eq(orderId))).forEach(item -> {
			String productId = (String) item.get("product_ID");
			int stock = (Integer) db.run(Select.from(PRODUCTS).where(CQL.get("ID").eq(productId))).single().get("stock");
			db.run(Update.entity(PRODUCTS).byId(productId).data("stock", stock + (Integer) item.get("quantity")));
		});

		db.run(Update.entity(ORDERS).byId(orderId).data("status", "CANCELLED"));
		order.put("status", "CANCELLED");
		context.setResult(Orders.of(order));
	}

	/** Implements markOrderPaid(orderID): only a NEW order can be paid. */
	@On
	public void markOrderPaid(MarkOrderPaidContext context) {
		context.setResult(changeStatus(context.getOrderID(), "NEW", "PAID", "Only new orders can be marked as paid"));
	}

	/** Implements shipOrder(orderID): only a PAID order can be shipped. */
	@On
	public void shipOrder(ShipOrderContext context) {
		context.setResult(changeStatus(context.getOrderID(), "PAID", "SHIPPED", "Only paid orders can be shipped"));
	}

	private Orders changeStatus(String orderId, String from, String to, String conflictMessage) {
		Map<String, Object> order = db.run(Select.from(ORDERS).where(CQL.get("ID").eq(orderId))).first()
				.orElseThrow(() -> new ServiceException(ErrorStatuses.NOT_FOUND, "Order {} not found", orderId));
		if (!from.equals(order.get("status"))) {
			throw new ServiceException(ErrorStatuses.CONFLICT, conflictMessage);
		}
		db.run(Update.entity(ORDERS).byId(orderId).data("status", to));
		order.put("status", to);
		return Orders.of(order);
	}

	/** Implements restockProduct(productID, quantity). */
	@On
	public void restockProduct(RestockProductContext context) {
		int quantity = context.getQuantity() == null ? 0 : context.getQuantity();
		if (quantity <= 0) {
			throw new ServiceException(ErrorStatuses.BAD_REQUEST, "Quantity must be positive");
		}
		String productId = context.getProductID();
		Map<String, Object> product = db.run(Select.from(PRODUCTS).where(CQL.get("ID").eq(productId))).first()
				.orElseThrow(() -> new ServiceException(ErrorStatuses.NOT_FOUND, "Product {} not found", productId));

		int stock = (Integer) product.get("stock") + quantity;
		db.run(Update.entity(PRODUCTS).byId(productId).data("stock", stock));
		product.put("stock", stock);
		context.setResult(Products.of(product));
	}

	/** Implements the function salesSummary(): cancelled orders do not count. */
	@On
	public void salesSummary(SalesSummaryContext context) {
		List<Row> orders = db.run(Select.from(ORDERS).where(CQL.get("status").ne("CANCELLED"))).list();
		BigDecimal revenue = orders.stream().map(o -> (BigDecimal) o.get("total")).reduce(BigDecimal.ZERO, BigDecimal::add);
		BigDecimal average = orders.isEmpty() ? BigDecimal.ZERO
				: revenue.divide(BigDecimal.valueOf(orders.size()), 2, RoundingMode.HALF_UP);

		SalesSummary summary = SalesSummary.create();
		summary.setOrders(orders.size());
		summary.setRevenue(revenue);
		summary.setAverageOrder(average);
		context.setResult(summary);
	}

	/** Implements the function topProducts(limit): units sold per product, best first. */
	@On
	public void topProducts(TopProductsContext context) {
		int limit = context.getLimit() == null ? 3 : context.getLimit();
		Set<String> liveOrders = new HashSet<>();
		db.run(Select.from(ORDERS).where(CQL.get("status").ne("CANCELLED"))).forEach(o -> liveOrders.add((String) o.get("ID")));

		Map<String, Integer> sold = new HashMap<>();
		db.run(Select.from(ORDER_ITEMS)).forEach(item -> {
			if (liveOrders.contains((String) item.get("order_ID"))) {
				sold.merge((String) item.get("product_ID"), (Integer) item.get("quantity"), Integer::sum);
			}
		});

		List<TopProduct> result = new ArrayList<>();
		sold.entrySet().stream()
				.sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
				.limit(limit)
				.forEach(entry -> {
					TopProduct top = TopProduct.create();
					top.setProductID(entry.getKey());
					top.setName((String) db.run(Select.from(PRODUCTS).where(CQL.get("ID").eq(entry.getKey()))).single().get("name"));
					top.setUnitsSold(entry.getValue());
					result.add(top);
				});
		context.setResult(result);
	}

	/** Implements the unbound function lowStockProducts(threshold). */
	@On
	public void lowStockProducts(LowStockProductsContext context) {
		int threshold = context.getThreshold() == null ? 5 : context.getThreshold();
		context.setResult(db.run(Select.from(PRODUCTS)
						.where(CQL.get("stock").lt(threshold))
						.orderBy("stock"))
				.listOf(Products.class));
	}
}
