sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
	"use strict";

	return Controller.extend("demo.shop.ui.controller.Sales", {

		onInit: function () {
			this.getView().setModel(new JSONModel({}), "sales");
			this.getOwnerComponent().getRouter().getRoute("sales").attachPatternMatched(this._load, this);
		},

		// Calls the CAP functions salesSummary() and topProducts(limit). They are Admin-only,
		// so a customer gets a 403 and the page shows the message instead of numbers.
		_load: function () {
			const model = this.getView().getModel(), sales = this.getView().getModel("sales");
			sales.setData({});
			const summary = model.bindContext("/salesSummary()");
			const top = model.bindContext("/topProducts(limit=3)");
			Promise.all([summary.requestObject(), top.requestObject()]).then(function (results) {
				sales.setData({ summary: results[0], top: results[1].value });
			}).catch(function (error) {
				sales.setData({ error: error.message });
			});
		},

		onBack: function () {
			this.getOwnerComponent().getRouter().navTo("products");
		}
	});
});
