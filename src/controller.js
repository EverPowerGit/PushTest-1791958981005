const { ServiceTypes } = require("./Constants/ServiceTypes");

const { EmployeeController } = require("./Controllers/Employee.Controller");
const { PayrollController } = require("./Controllers/Payroll.Controller");
const { UpgradeController } = require("./Controllers/Upgrade.Controller");
const { ClusterManagementController } = require("./Controllers/ClusterManagement.Controller");

class Controller {
	async handleRequest(user, message, isReadOnly) {
		let result = {};
		try {
			const svc = message.Service || message.service;
			if (!svc) throw new Error("Service is required.");

			if (svc === ServiceTypes.UPGRADE || message.service === ServiceTypes.UPGRADE) {
				message.userPubKey = user.pubKey;
				const c = new UpgradeController(message);
				result = await c.handleRequest();
			} else if (svc === ServiceTypes.CLUSTER) {
				const c = new ClusterManagementController(message);
				result = await c.handleRequest();
			} else if (svc === ServiceTypes.EMPLOYEE) {
				message.userPubKey = user.pubKey;
				const c = new EmployeeController(message);
				result = await c.handleRequest();
			} else if (svc === ServiceTypes.PAYROLL) {
				message.userPubKey = user.pubKey;
				const c = new PayrollController(message);
				result = await c.handleRequest();
			} else {
				throw new Error(`Unknown service: ${svc}`);
			}
		} catch (e) {
			result = { error: e && e.message ? e.message : String(e) };
		}

		const response =
			!isReadOnly && message && message.promiseId
				? { promiseId: message.promiseId, ...result }
				: result;
		await user.send(response);
	}
}

module.exports = { Controller };

// automation-test-1791958929111
