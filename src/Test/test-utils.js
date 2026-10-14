const HotPocket = require("hotpocket-js-client");
const bson = require("bson");

const CONTRACT_URL = process.env.CONTRACT_URL || "ws://localhost:8081";

function assert(cond, msg) {
	if (!cond) throw new Error(msg || "Assertion failed");
}

function assertEqual(a, b, msg) {
	if (a !== b) throw new Error(msg || `Expected ${a} to equal ${b}`);
}

async function createClient() {
	const keys = await HotPocket.generateKeys();
	const client = await HotPocket.createClient([CONTRACT_URL], keys, {
		protocol: HotPocket.protocols.bson,
	});
	const ok = await client.connect();
	assert(ok, "Failed to connect to HotPocket");
	return { client, keys };
}

async function submitInput(client, payload) {
	const buf = bson.serialize(payload);
	await client.submitContractInput(buf);
}

async function submitReadRequest(client, payload) {
	const buf = bson.serialize(payload);
	const out = await client.submitContractReadRequest(buf);
	const decoded = bson.deserialize(out);
	if (decoded.error) throw new Error(decoded.error.message || decoded.error);
	return decoded.success;
}

module.exports = {
	CONTRACT_URL,
	assert,
	assertEqual,
	createClient,
	submitInput,
	submitReadRequest,
};
