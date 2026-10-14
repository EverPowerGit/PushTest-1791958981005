const bson = require("bson");

const { assert, assertEqual, createClient } = require("../test-utils");

async function waitForOutput(client, promiseId, timeoutMs) {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error("Timed out waiting for output")), timeoutMs);
		client.on(require("hotpocket-js-client").events.contractOutput, r => {
			r.outputs.forEach(o => {
				const decoded = bson.deserialize(o);
				if (decoded.promiseId !== promiseId) return;
				clearTimeout(t);
				if (decoded.error) reject(new Error(decoded.error.message || decoded.error));
				else resolve(decoded.success);
			});
		});
	});
}

async function submitWithPromise(client, payload) {
	const promiseId = Math.random().toString(16).slice(2);
	await client.submitContractInput(bson.serialize({ promiseId, ...payload }));
	return waitForOutput(client, promiseId, 20000);
}

async function run() {
	const { client } = await createClient();

	// NOTE: These admin-only calls require the HotPocket pubkey to match MAINTAINER_PUBKEY.
	// In local testing, set MAINTAINER_PUBKEY to the generated pubkey of this test client.

	const emp = await submitWithPromise(client, {
		Service: "Employee",
		Action: "AddEmployee",
		data: { name: "Alice", salaryType: "HOURLY", salaryAmount: 25, currency: "USD" },
	});
	assert(emp.employeeId > 0, "employeeId not returned");

	const cycle = await submitWithPromise(client, {
		Service: "Payroll",
		Action: "CreatePayCycle",
		data: { startDate: "2026-01-01", endDate: "2026-01-15" },
	});
	assert(cycle.payCycleId > 0, "payCycleId not returned");

	await submitWithPromise(client, {
		Service: "Payroll",
		Action: "AddWorkLog",
		data: {
			payCycleId: cycle.payCycleId,
			employeeId: emp.employeeId,
			workDate: "2026-01-03",
			hours: 8,
		},
	});

	// Close cycle
	const cycleInfo = await submitWithPromise(client, {
		Service: "Payroll",
		Action: "GetPayCycleById",
		data: { id: cycle.payCycleId },
	});

	await submitWithPromise(client, {
		Service: "Payroll",
		Action: "ClosePayCycle",
		data: { id: cycle.payCycleId, concurrencyKey: cycleInfo.concurrencyKey },
	});

	const processed = await submitWithPromise(client, {
		Service: "Payroll",
		Action: "ProcessPayroll",
		data: { payCycleId: cycle.payCycleId },
	});
	assertEqual(processed.processed, true);
	assert(processed.paymentsCreated >= 1, "paymentsCreated should be >= 1");

	client.close();
}

module.exports = { run };
