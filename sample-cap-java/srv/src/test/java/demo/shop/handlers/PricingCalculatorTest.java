package demo.shop.handlers;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

import demo.shop.handlers.PricingCalculator.Line;

class PricingCalculatorTest {

	private static Line line(String price, int quantity) {
		return new Line(new BigDecimal(price), quantity);
	}

	@Test
	void smallBasketGetsNoDiscount() {
		var quote = PricingCalculator.quote(List.of(line("12.50", 4)));

		assertEquals(0, quote.discountPercent());
		assertEquals(new BigDecimal("50.00"), quote.total());
	}

	@Test
	void basketOver100Gets5Percent() {
		var quote = PricingCalculator.quote(List.of(line("79.99", 1), line("12.50", 4)));

		assertEquals(new BigDecimal("129.99"), quote.subtotal());
		assertEquals(5, quote.discountPercent());
		assertEquals(new BigDecimal("6.50"), quote.discount());
		assertEquals(new BigDecimal("123.49"), quote.total());
	}

	@Test
	void basketOver200Gets10Percent() {
		var quote = PricingCalculator.quote(List.of(line("89.90", 2), line("24.00", 1), line("39.00", 1)));

		assertEquals(10, quote.discountPercent());
		assertEquals(new BigDecimal("218.52"), quote.total());
	}

	@Test
	void thresholdsAreInclusive() {
		assertEquals(5, PricingCalculator.quote(List.of(line("100.00", 1))).discountPercent());
		assertEquals(15, PricingCalculator.quote(List.of(line("250.00", 2))).discountPercent());
	}
}
