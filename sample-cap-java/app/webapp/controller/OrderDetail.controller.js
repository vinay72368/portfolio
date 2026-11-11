sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
	"use strict";

	return Controller.extend("demo.shop.ui.controller.OrderDetail", {

		onInit: function () {
			this.getOwnerComponent().getRouter().getRoute("orderDetail").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (event) {
			this._orderId = event.getParameter("arguments").orderId;
			this.getView().bindElement({ path: "/Orders(" + this._orderId + ")", parameters: { $expand: "customer" } });
		},

		onBack: function () {
			this.getOwnerComponent().getRouter().navTo("orders");
		},

		onMarkPaid: function () { this._run("markOrderPaid", "orderPaid"); },
		onShip: function () { this._run("shipOrder", "orderShipped"); },
		onCancelOrder: function () { this._run("cancelOrder", "orderCancelled"); },

		// Calls an unbound CAP action with the order id. The server decides whether it is allowed:
		// 409 if the order is in the wrong status, 403 if the user is not an Admin.
		_run: function (actionName, messageKey) {
			const action = this.getView().getModel().bindContext("/" + actionName + "(...)");
			action.setParameter("orderID", this._orderId);
			action.execute().then(function () {
				MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText(messageKey));
				this.getView().getElementBinding().refresh();
			}.bind(this)).catch(function (error) {
				MessageBox.error(error.message);
			});
		},

		formatStatus: function (status) {
			return { PAID: "Success", SHIPPED: "Success", NEW: "Warning", CANCELLED: "Error" }[status] || "None";
		}
	});
});
