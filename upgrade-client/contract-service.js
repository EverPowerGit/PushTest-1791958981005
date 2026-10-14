const HotPocket = require("hotpocket-js-client");
const bson = require("bson");
const crypto = require("crypto");

class ContractService {
	constructor(servers) {
		this.servers = servers;
		this.userKeyPair = null;
		this.client = null;
		this.isConnectionSucceeded = false;
		this.promiseMap = new Map();
	}

	async init() {
		if (this.userKeyPair == null) {
			this.userKeyPair = await HotPocket.generateKeys();
		}

		if (this.client == null) {
			this.client = await HotPocket.createClient(this.servers, this.userKeyPair, {
				protocol: HotPocket.protocols.bson,
			});
		}

		this.client.on(HotPocket.events.disconnect, () => {
			this.isConnectionSucceeded = false;
		});

		this.client.on(HotPocket.events.contractOutput, r => {
			r.outputs.forEach(o => {
				const output = bson.deserialize(o);
				const pId = output.promiseId;
				if (!pId) return;
				const p = this.promiseMap.get(pId);
				if (!p) return;
				if (output.error) p.rejecter(output.error);
				else p.resolver(output.success);
				this.promiseMap.delete(pId);
			});
		});

		if (!this.isConnectionSucceeded) {
			if (!(await this.client.connect())) return false;
			this.isConnectionSucceeded = true;
		}

		return true;
	}

	submitInputToContract(payload) {
		const promiseId = this.#getUniqueId();
		const buf = bson.serialize({ promiseId, ...payload });

		this.client.submitContractInput(buf).then(input => {
			input?.submissionStatus?.then(s => {
				if (s.status !== "accepted") {
					throw new Error(`Ledger_Rejection: ${s.reason}`);
				}
			});
		});

		return new Promise((resolve, reject) => {
			this.promiseMap.set(promiseId, { resolver: resolve, rejecter: reject });
		});
	}

	#getUniqueId() {
		return crypto.randomBytes(10).toString("hex");
	}
}

module.exports = ContractService;
