const HotPocket = require("hotpocket-nodejs-contract");
const bson = require("bson");

const { Controller } = require("./controller");
const { DBInitializer } = require("./Data.Deploy/initDB");
const { SharedService } = require("./Services/Common.Services/SharedService");
const { Tables } = require("./Constants/Tables");

const settings = require("./settings.json").settings;
const dbHandler = require("./Services/Common.Services/dbHandler");

const payrollContract = async ctx => {
	console.log("Payroll contract is running.");

	SharedService.context = ctx;
	const isReadOnly = ctx.readonly;

	if (!isReadOnly) {
		ctx.unl.onMessage((node, msg) => {
			let obj;
			try {
				obj = JSON.parse(msg.toString());
			} catch (e) {
				return;
			}
			if (obj && obj.type) {
				SharedService.nplEventEmitter.emit(obj.type, node, msg);
			}
		});
	}

	try {
		await DBInitializer.init();
	} catch (e) {
		console.error("DB init failed", e);
	}

	// Log contract version.
	const db = new dbHandler.SqliteDatabase(settings.dbPath);
	try {
		db.open();
		const row = (await db.getLastRecord(Tables.CONTRACTVERSION)) || { Version: 1 };
		console.log("Current contract version:", row.Version);
	} catch (e) {
		console.log("Error while getting contract version", e);
	} finally {
		db.close();
	}

	const controller = new Controller();

	for (const user of ctx.users.list()) {
		for (const input of user.inputs) {
			const buf = await ctx.users.read(input);

			let message;
			try {
				message = JSON.parse(buf);
			} catch (e) {
				message = bson.deserialize(buf);
			}

			if (message && message.Data && !message.data) message.data = message.Data;

			console.log(
				`[Contract] Incoming ${isReadOnly ? "READ" : "WRITE"} — Service: ${message.Service}, Action: ${message.Action}`,
			);

			await controller.handleRequest(user, message, isReadOnly);
		}
	}
};

const hpc = new HotPocket.Contract();
hpc.init(payrollContract, HotPocket.clientProtocols.JSON, true);
