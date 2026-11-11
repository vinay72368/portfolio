sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/Fragment",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function (Controller, Fragment, Filter, FilterOperator, JSONModel, MessageBox, MessageToast) {
	"use strict";

	// Same tiers as PricingCalculator.java. This is only a preview: the server recalculates the real price.
	function discountPercent(subtotal) {
		return subtotal >= 500 ? 15 : subtotal >= 200 ? 10 : subtotal >= 100 ? 5 : 0;
	}

	return Controller.extend("demo.shop.ui.controller.Products", {

		onInit: function () {
			this.getView().setModel(new JSONModel({ lines: [], count: 0, subtotal: 0, discountPercent: 0, discount: 0, total: 0 }), "cart");
		},

		onSearch: function (event) {
			const query = event.getParameter("query");
			const filters = [new Filter("active", FilterOperator.EQ, true)];
			if (query) {
				filters.push(new Filter("name", FilterOperator.Contains, query));
			}
			this.byId("productsTable").getBinding("items").filter(filters);
		},

		// Calls the CAP function lowStockProducts(threshold) and shows only the products it returns.
		onToggleLowStock: function (event) {
			const binding = this.byId("productsTable").getBinding("items");
			if (!event.getParameter("pressed")) {
				return binding.filter(new Filter("active", FilterOperator.EQ, true));
			}
			const call = this.getView().getModel().bindContext("/lowStockProducts(threshold=5)");
			call.requestObject().then(function (result) {
				const ids = result.value.map(function (product) { return new Filter("ID", FilterOperator.EQ, product.ID); });
				binding.filter(ids.length ? new Filter({ filters: ids, and: false })
					: new Filter("ID", FilterOperator.EQ, "00000000-0000-0000-0000-000000000000"));
			}).catch(function (error) { MessageBox.error(error.message); });
		},

		onAdd: function (event) {
			const product = event.getSource().getBindingContext().getObject();
			const cart = this.getView().getModel("cart"), data = cart.getData();
			const line = data.lines.find(function (l) { return l.productID === product.ID; });
			if (line) {
				if (line.quantity >= product.stock) { return MessageToast.show(product.name + ": no more in stock"); }
				line.quantity++;
			} else {
				data.lines.push({ productID: product.ID, name: product.name, price: Number(product.price), quantity: 1 });
			}
			this._recalculate(cart);
		},

		onRemoveLine: function (event) {
			const cart = this.getView().getModel("cart");
			const index = Number(event.getSource().getBindingContext("cart").getPath().split("/").pop());
			cart.getData().lines.splice(index, 1);
			this._recalculate(cart);
			if (!cart.getData().count) { this.onCancelCheckout(); }
		},

		_recalculate: function (cart) {
			const data = cart.getData();
			data.lines.forEach(function (l) { l.lineTotal = Math.round(l.price * l.quantity * 100) / 100; });
			data.count = data.lines.reduce(function (n, l) { return n + l.quantity; }, 0);
			data.subtotal = Math.round(data.lines.reduce(function (n, l) { return n + l.price * l.quantity * 100; }, 0)) / 100;
			data.discountPercent = discountPercent(data.subtotal);
			data.discount = Math.round(data.subtotal * data.discountPercent) / 100;
			data.total = Math.round((data.subtotal - data.discount) * 100) / 100;
			cart.refresh();
		},

		onCheckout: function () {
			if (!this._dialog) {
				this._dialog = Fragment.load({
					id: this.getView().getId(),
					name: "demo.shop.ui.view.Checkout",
					controller: this
				}).then(function (dialog) {
					this.getView().addDependent(dialog);
					return dialog;
				}.bind(this));
			}
			this._dialog.then(function (dialog) { dialog.open(); });
		},

		onCancelCheckout: function () {
			if (this._dialog) { this._dialog.then(function (dialog) { dialog.close(); }); }
		},

		// Calls the CAP action placeOrder(customerID, items). Stock and price are checked on the server.
		onPlaceOrder: function () {
			const model = this.getView().getModel(), cart = this.getView().getModel("cart");
			const action = model.bindContext("/placeOrder(...)");
			action.setParameter("customerID", this.byId("customer").getSelectedKey());
			action.setParameter("items", cart.getData().lines.map(function (l) { return { productID: l.productID, quantity: l.quantity }; }));
			action.execute().then(function () {
				const order = action.getBoundContext().getObject();
				MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("orderPlaced", [order.total]));
				cart.setData({ lines: [], count: 0, subtotal: 0, discountPercent: 0, discount: 0, total: 0 });
				this.onCancelCheckout();
				model.refresh();
				this.getOwnerComponent().getRouter().navTo("orders");
			}.bind(this)).catch(function (error) {
				MessageBox.error(error.message);   // e.g. "Only 3 left of USB-C Hub" (409)
			});
		},

		onOrders: function () {
			this.getOwnerComponent().getRouter().navTo("orders");
		},

		onSales: function () {
			this.getOwnerComponent().getRouter().navTo("sales");
		},

		formatStock: function (stock) {
			return stock < 5 ? "Error" : stock < 20 ? "Warning" : "Success";
		}
	});
});
