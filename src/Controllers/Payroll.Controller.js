const { PayrollService } = require("../Services/Domain.Services/Payroll.Service");

class PayrollController {
	constructor(message) {
		this.message = message;
		this.service = new PayrollService(message);
	}

	async handleRequest() {
		switch (this.message.Action) {
			case "CreatePayCycle":
				return await this.service.createPayCycle();
			case "ClosePayCycle":
				return await this.service.closePayCycle();
			case "AddWorkLog":
				return await this.service.addWorkLog();
			case "GetPayCycleById":
				return await this.service.getPayCycleById();
			case "ListPayCycles":
				return await this.service.listPayCycles();
			case "ProcessPayroll":
				return await this.service.processPayroll();
			case "GetPaymentsByCycle":
				return await this.service.getPaymentsByCycle();
			case "GetPaymentsByEmployee":
				return await this.service.getPaymentsByEmployee();
			default:
				return { error: "Invalid action." };
		}
	}
}

module.exports = { PayrollController };
