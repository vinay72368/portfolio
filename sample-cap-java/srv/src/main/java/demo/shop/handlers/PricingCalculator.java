package demo.shop.handlers;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Pure pricing rules with no CAP or Spring dependency, so they are trivial to unit test.
 * Volume discount on the basket subtotal: 5% from 100, 10% from 200, 15% from 500.
 */
public final class PricingCalculator {

	public record Line(BigDecimal unitPrice, int quantity) { }

	public record Quote(BigDecimal subtotal, int discountPercent, BigDecimal discount, BigDecimal total) { }

	private PricingCalculator() { }

	public static Quote quote(List<Line> lines) {
		BigDecimal subtotal = lines.stream()
				.map(line -> line.unitPrice().multiply(BigDecimal.valueOf(line.quantity())))
				.reduce(BigDecimal.ZERO, BigDecimal::add)
				.setScale(2, RoundingMode.HALF_UP);

		int percent = discountPercent(subtotal);
		BigDecimal discount = subtotal.multiply(BigDecimal.valueOf(percent))
				.divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

		return new Quote(subtotal, percent, discount, subtotal.subtract(discount));
	}

	static int discountPercent(BigDecimal subtotal) {
		if (subtotal.compareTo(BigDecimal.valueOf(500)) >= 0) return 15;
		if (subtotal.compareTo(BigDecimal.valueOf(200)) >= 0) return 10;
		if (subtotal.compareTo(BigDecimal.valueOf(100)) >= 0) return 5;
		return 0;
	}
}
