const { UpgradeService } = require("../Services/Common.Services/Upgrade.Service");
const env = require("../Utils/Environment");
const sodium = require("libsodium-wrappers");

function isMaintainer(userPubKeyHex) {
	const expected = (env.MAINTAINER_PUBKEY || "").toLowerCase();
	if (!expected) return false;
	if (!userPubKeyHex) return false;
	return userPubKeyHex.toLowerCase() === expected;
}

function hexToBuf(hex) {
	if (typeof hex !== "string" || !/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
		throw new Error("Invalid hex.");
	}
	return Buffer.from(hex, "hex");
}

class UpgradeController {
	constructor(message) {
		this.message = message;
		this.service = new UpgradeService(message);
	}

	async handleRequest() {
		try {
			if (this.message.Action !== "UpgradeContract") return { error: "Invalid action." };

			const userPubKey = this.message.userPubKey;
			if (!isMaintainer(userPubKey)) {
				return { error: { code: 401, message: "Unauthorized" } };
			}

			const data = this.message.data || {};
			const version = parseInt(data.version, 10);
			if (!Number.isInteger(version) || version <= 0) {
				return { error: { code: 400, message: "version must be a positive integer" } };
			}

			if (!data.zipBase64 || !data.zipSignatureHex) {
				return {
					error: {
						code: 400,
						message: "zipBase64 and zipSignatureHex are required",
					},
				};
			}

			const zipBuffer = Buffer.from(data.zipBase64, "base64");
			const signature = hexToBuf(data.zipSignatureHex);
			const pubKey = hexToBuf(userPubKey);

			if (signature.length !== 64) {
				return { error: { code: 400, message: "Invalid signature length" } };
			}
			if (pubKey.length !== 32) {
				return { error: { code: 400, message: "Invalid pubkey length" } };
			}

			await sodium.ready;
			const ok = sodium.crypto_sign_verify_detached(
				new Uint8Array(signature),
				new Uint8Array(zipBuffer),
				new Uint8Array(pubKey),
			);
			if (!ok) {
				return { error: { code: 401, message: "Invalid zip signature" } };
			}

			return await this.service.upgradeContract({
				version,
				description: data.description || "",
				zipBuffer,
			});
		} catch (e) {
			return { error: { code: 500, message: e && e.message ? e.message : String(e) } };
		}
	}
}

module.exports = { UpgradeController };
