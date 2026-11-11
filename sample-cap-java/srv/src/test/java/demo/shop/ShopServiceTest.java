package demo.shop;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ShopServiceTest {

	private static final String BASE = "/odata/v4/shop";
	private static final String PRIYA = "1994eedc-fff6-4478-933a-8c34683b40b6";
	private static final String HEADPHONES = "f391e075-fb77-42d0-bf65-384e2165177a";
	private static final String NOTEBOOKS = "77fe68b0-06bf-4b7c-b0bd-1138b09e91cd";
	private static final String KEYBOARD = "06356e12-77a5-4c3e-8371-078ebbbad351";
	private static final String PAID_ORDER = "95df245e-b87b-4b55-bd32-4227919660b5";
	private static final String NEW_ORDER = "34fcea77-7772-455c-b118-ba67e5b19830";

	@Autowired
	private MockMvc mvc;

	@Test
	void anonymousUsersAreRejected() throws Exception {
		mvc.perform(get(BASE + "/Products")).andExpect(status().isUnauthorized());
	}

	@Test
	void customerCanBrowseProducts() throws Exception {
		mvc.perform(get(BASE + "/Products").with(httpBasic("customer", "secret")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.value.length()").value(8));
	}

	@Test
	void customerCannotDeleteProducts() throws Exception {
		mvc.perform(delete(BASE + "/Products(" + HEADPHONES + ")").with(httpBasic("customer", "secret")))
				.andExpect(status().isForbidden());
	}

	@Test
	void adminCannotCreateProductWithNegativePrice() throws Exception {
		mvc.perform(post(BASE + "/Products")
						.with(httpBasic("admin", "secret"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"name\":\"Broken\",\"price\":-5,\"stock\":1}"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void placingAnOrderAppliesVolumeDiscount() throws Exception {
		mvc.perform(post(BASE + "/placeOrder")
						.with(httpBasic("customer", "secret"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"customerID\":\"" + PRIYA + "\",\"items\":["
								+ "{\"productID\":\"" + HEADPHONES + "\",\"quantity\":1},"
								+ "{\"productID\":\"" + NOTEBOOKS + "\",\"quantity\":4}]}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("NEW"))
				.andExpect(jsonPath("$.total").value(180.30));
	}

	@Test
	void customersCannotSeeSales() throws Exception {
		mvc.perform(get(BASE + "/salesSummary()").with(httpBasic("customer", "secret")))
				.andExpect(status().isForbidden());
	}

	@Test
	void adminSeesSalesSummary() throws Exception {
		mvc.perform(get(BASE + "/salesSummary()").with(httpBasic("admin", "secret")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.orders").value(org.hamcrest.Matchers.greaterThanOrEqualTo(3)));
	}

	@Test
	void paidOrdersCanBeShipped() throws Exception {
		mvc.perform(post(BASE + "/shipOrder")
						.with(httpBasic("admin", "secret"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"orderID\":\"" + PAID_ORDER + "\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("SHIPPED"));
	}

	@Test
	void newOrdersCannotBeShippedBeforePayment() throws Exception {
		mvc.perform(post(BASE + "/shipOrder")
						.with(httpBasic("admin", "secret"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"orderID\":\"" + NEW_ORDER + "\"}"))
				.andExpect(status().isConflict());
	}

	@Test
	void restockAddsToStock() throws Exception {
		mvc.perform(post(BASE + "/restockProduct")
						.with(httpBasic("admin", "secret"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"productID\":\"" + KEYBOARD + "\",\"quantity\":5}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.stock").value(17));
	}

	@Test
	void cannotOrderMoreThanInStock() throws Exception {
		mvc.perform(post(BASE + "/placeOrder")
						.with(httpBasic("customer", "secret"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"customerID\":\"" + PRIYA + "\",\"items\":[{\"productID\":\"" + KEYBOARD + "\",\"quantity\":9999}]}"))
				.andExpect(status().isConflict());
	}
}
