const { run: payrollFlow } = require("./TestCases/PayrollFlowTest");

(async () => {
	try {
		await payrollFlow();
		console.log("All tests passed.");
		process.exit(0);
	} catch (e) {
		console.error("Tests failed:", e);
		process.exit(1);
	}
})();
