const { EmployeeService } = require("../Services/Domain.Services/Employee.Service");

class EmployeeController {
	constructor(message) {
		this.message = message;
		this.service = new EmployeeService(message);
	}

	async handleRequest() {
		switch (this.message.Action) {
			case "AddEmployee":
				return await this.service.addEmployee();
			case "UpdateEmployee":
				return await this.service.updateEmployee();
			case "RemoveEmployee":
				return await this.service.removeEmployee();
			case "GetEmployeeById":
				return await this.service.getEmployeeById();
			case "GetAllEmployees":
				return await this.service.getAllEmployees();
			default:
				return { error: "Invalid action." };
		}
	}
}

module.exports = { EmployeeController };
