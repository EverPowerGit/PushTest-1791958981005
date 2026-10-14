/*
Run as:
node index.js <contractUrl> <zipFilePath> <maintainerSecretKeyHex> <versionInt> <description>

- maintainerSecretKeyHex: Ed25519 secret key (64 bytes) hex string (128 hex chars).
- versionInt: integer version (2, 3, 4...).
*/

const fs = require("fs");
const path = require("path");
const bson = require("bson");

// libsodium-wrappers is a transitive dependency of hotpocket-js-client.
const sodium = require("libsodium-wrappers");

const ContractService = require("./contract-service");

const contractUrl = process.argv[2];
const filepath = process.argv[3];
const secretKeyHex = process.argv[4];
const versionArg = process.argv[5];
const description = process.argv[6] || "";

function hexToU8(hex) {
	if (typeof hex !== "string" || !/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
		throw new Error("Invalid hex string.");
	}
	return Uint8Array.from(Buffer.from(hex, "hex"));
}

async function main() {
	if (!contractUrl || !filepath || !secretKeyHex || !versionArg) {
		console.log(
			"Usage: node index.js <contractUrl> <zipFilePath> <maintainerSecretKeyHex> <versionInt> <description>",
		);
		process.exit(1);
	}

	const version = parseInt(versionArg, 10);
	if (!Number.isInteger(version) || version <= 0) {
		throw new Error("versionInt must be a positive integer (e.g., 2). Do not use decimals.");
	}

	await sodium.ready;

	const fileName = path.basename(filepath);
	const zipBuffer = fs.readFileSync(filepath);
	const sizeKB = Math.round(zipBuffer.length / 1024);

	const secretKey = hexToU8(secretKeyHex);
	if (secretKey.length !== 64) {
		throw new Error("maintainerSecretKeyHex must be 64 bytes (128 hex chars). ");
	}

	const signature = sodium.crypto_sign_detached(new Uint8Array(zipBuffer), secretKey);
	const zipSignatureHex = Buffer.from(signature).toString("hex");
	const zipBase64 = zipBuffer.toString("base64");

	const contractService = new ContractService([contractUrl]);
	const ok = await contractService.init();
	if (!ok) throw new Error("Connection failed.");

	const submitData = {
		Service: "Upgrade",
		Action: "UpgradeContract",
		data: {
			version,
			description,
			zipBase64,
			zipSignatureHex,
		},
	};

	console.log(`Uploading ${fileName} (${sizeKB}KB) as version ${version}`);

	contractService
		.submitInputToContract(submitData)
		.then(r => {
			console.log("Upgrade submitted.", r);
		})
		.catch(e => {
			console.error("Upgrade failed.", e);
		})
		.finally(() => process.exit(0));
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
