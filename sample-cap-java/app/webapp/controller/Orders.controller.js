sap.ui.define(["sap/ui/core/mvc/Controller"], function (Controller) {
	"use strict";

	return Controller.extend("demo.shop.ui.controller.Orders", {

		onSelect: function (event) {
			const id = event.getSource().getBindingContext().getProperty("ID");
			this.getOwnerComponent().getRouter().navTo("orderDetail", { orderId: id });
		},

		onBack: function () {
			this.getOwnerComponent().getRouter().navTo("products");
		},

		formatStatus: function (status) {
			return { PAID: "Success", SHIPPED: "Success", NEW: "Warning", CANCELLED: "Error" }[status] || "None";
		}
	});
});
