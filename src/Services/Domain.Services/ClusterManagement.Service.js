const { SharedService } = require("../Common.Services/SharedService");
const { Tables } = require("../../Constants/Tables");

const settings = require("../../settings.json").settings;
const { SqliteDatabase } = require("../Common.Services/dbHandler");
const fsp = require("fs/promises");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

class ClusterManagementService {
	constructor(message) {
		this.context = SharedService.context;
		this.message = message;
		this.db = new SqliteDatabase(settings.dbPath);
	}

	async updateClusterConfig() {
		if (!this.context) throw new Error("Cluster context is not available.");

		console.log("[ClusterManagement] Updating cluster configuration...", this.message.data);

		const hpConfig = await this.context.getConfig();
		let unl = hpConfig.unl;

		if (this.message.data.action === "add") {
			if (!unl.includes(this.message.data.publicKey)) {
				unl.push(this.message.data.publicKey);
			} else {
				return { error: "UNL already exists in the cluster configuration." };
			}
		} else if (this.message.data.action === "remove") {
			if (unl.includes(this.message.data.publicKey)) {
				unl = unl.filter(key => key !== this.message.data.publicKey);
				hpConfig.unl = unl;
			} else {
				return { error: "UNL does not exist in the cluster configuration." };
			}
		} else {
			return { error: "Invalid action. Use 'add' or 'remove'." };
		}

		const result = await this.context.updateConfig(hpConfig);
		return { success: result };
	}

	async getClusterUnl() {
		if (!this.context) throw new Error("Cluster context is not available.");
		const hpConfig = await this.context.getConfig();
		return { success: { unl: hpConfig.unl } };
	}

	async getContractVersion() {
		try {
			this.db.open();
			const query = `SELECT Version FROM ${Tables.CONTRACTVERSION} ORDER BY Id ASC LIMIT 1`;
			const rows = await this.db.runSelectQuery(query);
			if (rows.length > 0) {
				console.log(`\n[ClusterManagement] Contract version: ${rows[0].Version}\n`);
				return { success: { version: rows[0].Version } };
			}
			throw new Error("Contract version not found.");
		} finally {
			this.db.close();
		}
	}

	async updateClusterDetails() {
		console.log("[ClusterManagement] Updating cluster details...", this.message.data);
		try {
			if (!this.context) throw new Error("Cluster context is not available.");

			const hpCfgPath = "../../../../cfg/hp.cfg";
			const readConfigCommand = process.platform === "win32" ? `type "${hpCfgPath}"` : `cat "${hpCfgPath}"`;
			const { stdout, stderr } = await execAsync(readConfigCommand);
			if (stderr) console.warn("[ClusterManagement] hp.cfg read warning:", stderr);

			const hpCfgJson = JSON.parse(stdout);
			const nodePublicKey = hpCfgJson?.node?.public_key;

			const clusterDetails = this.message?.data?.clusterDetails;
			if (!Array.isArray(clusterDetails) || !clusterDetails.length) {
				throw new Error("clusterDetails is required and must be a non-empty array.");
			}

			const peers = [
				...new Set(
					clusterDetails
						.map(item => {
							const domain = item?.domain;
							const peerPort = item?.peer_port;
							const clusterPubKey = item?.pubkey;
							if (!domain || !peerPort) return null;
							if (nodePublicKey && clusterPubKey === nodePublicKey) return null;
							return `${domain}:${peerPort}`;
						})
						.filter(Boolean),
				),
			];

			if (!peers.length) throw new Error("No valid peers could be extracted from clusterDetails.");

			hpCfgJson.mesh = hpCfgJson.mesh ?? {};
			hpCfgJson.mesh.known_peers = peers;
			hpCfgJson.mesh.peer_discovery = { enabled: false };

			await fsp.writeFile(hpCfgPath, `${JSON.stringify(hpCfgJson, null, 2)}\n`, "utf8");

			return { success: { peers } };
		} catch (error) {
			console.error("[ClusterManagement] Error updating cluster details:", error);
			return { error: "Failed to update cluster details." };
		}
	}
}

module.exports = { ClusterManagementService };
