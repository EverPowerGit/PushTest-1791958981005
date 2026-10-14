const { ClusterManagementService } = require("../Services/Domain.Services/ClusterManagement.Service");

class ClusterManagementController {
	constructor(message) {
		this.message = message;
		this.service = new ClusterManagementService(message);
	}

	async handleRequest() {
		console.log("[ClusterManagementController] Handling request:", this.message);
		try {
			switch (this.message.Action) {
				case "UpdateClusterConfig":
					return await this.service.updateClusterConfig();
				case "GetClusterUnl":
					return await this.service.getClusterUnl();
				case "GetContractVersion":
					return await this.service.getContractVersion();
				case "UpdateClusterDetails":
					return await this.service.updateClusterDetails();
				default:
					throw new Error("Invalid action.");
			}
		} catch (error) {
			return { error: error && error.message ? error.message : String(error) };
		}
	}
}

module.exports = { ClusterManagementController };
