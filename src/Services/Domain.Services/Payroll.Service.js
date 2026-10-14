const settings = require("../../settings.json").settings;
const { Tables } = require("../../Constants/Tables");
const { SqliteDatabase } = require("../Common.Services/dbHandler");
const { SharedService } = require("../Common.Services/SharedService");
const env = require("../../Utils/Environment");

function isAdmin(userPubKeyHex) {
	const expected = (env.MAINTAINER_PUBKEY || "").toLowerCase();
	if (!expected) return false;
	if (!userPubKeyHex) return false;
	return userPubKeyHex.toLowerCase() === expected;
}

function mustBeIsoDate(dateStr, field) {
	if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
		throw new Error(`${field} must be YYYY-MM-DD`);
	}
	return dateStr;
}

function toNumber(v, field) {
	const n = Number(v);
	if (!Number.isFinite(n)) throw new Error(`${field} must be a number`);
	return n;
}

class PayrollService {
	constructor(message) {
		this.message = message;
		this.db = new SqliteDatabase(settings.dbPath);
	}

	async createPayCycle() {
		if (!isAdmin(this.message.userPubKey)) return { error: "Unauthorized" };
		try {
			const d = this.message.data || {};
			const startDate = mustBeIsoDate(d.startDate, "startDate");
			const endDate = mustBeIsoDate(d.endDate, "endDate");
			if (endDate < startDate) throw new Error("endDate must be >= startDate");

			this.db.open();
			const now = SharedService.getCurrentTimestamp();
			const res = await this.db.insertValue(Tables.PAYCYCLE, {
				StartDate: startDate,
				EndDate: endDate,
				Status: "OPEN",
				CreatedOn: now,
				LastUpdatedOn: now,
				ConcurrencyKey: SharedService.generateConcurrencyKey(),
			});
			return { success: { payCycleId: res.lastId } };
		} catch (e) {
			return { error: e && e.message ? e.message : String(e) };
		} finally {
			this.db.close();
		}
	}

	async closePayCycle() {
		if (!isAdmin(this.message.userPubKey)) return { error: "Unauthorized" };
		try {
			const d = this.message.data || {};
			const id = parseInt(d.id, 10);
			if (!Number.isInteger(id) || id <= 0) throw new Error("id is required");
			if (!d.concurrencyKey) throw new Error("concurrencyKey is required");

			this.db.open();
			const row = await this.db.findById(Tables.PAYCYCLE, id);
			if (!row) return { error: "PayCycle not found" };
			if (row.Status !== "OPEN") return { error: "PayCycle is not OPEN" };

			const r = await this.db.updateWithConcurrencyCheck(
				Tables.PAYCYCLE,
				id,
				{ Status: "CLOSED", LastUpdatedOn: SharedService.getCurrentTimestamp() },
				d.concurrencyKey,
			);
			return { success: { closed: true, concurrencyKey: r.concurrencyKey } };
		} catch (e) {
			return { error: e && e.message ? e.message : String(e) };
		} finally {
			this.db.close();
		}
	}

	async addWorkLog() {
		if (!isAdmin(this.message.userPubKey)) return { error: "Unauthorized" };
		try {
			const d = this.message.data || {};
			const payCycleId = parseInt(d.payCycleId, 10);
			const employeeId = parseInt(d.employeeId, 10);
			if (!Number.isInteger(payCycleId) || payCycleId <= 0) throw new Error("payCycleId is required");
			if (!Number.isInteger(employeeId) || employeeId <= 0) throw new Error("employeeId is required");
			const workDate = mustBeIsoDate(d.workDate, "workDate");
			const hours = toNumber(d.hours, "hours");
			if (hours <= 0) throw new Error("hours must be > 0");

			this.db.open();
			const cycle = await this.db.findById(Tables.PAYCYCLE, payCycleId);
			if (!cycle) return { error: "PayCycle not found" };
			if (cycle.Status !== "OPEN") return { error: "PayCycle is not OPEN" };
			if (workDate < cycle.StartDate || workDate > cycle.EndDate) {
				return { error: "workDate must be within pay cycle" };
			}

			const emp = await this.db.findById(Tables.EMPLOYEE, employeeId);
			if (!emp) return { error: "Employee not found" };
			if (!emp.IsActive) return { error: "Employee is inactive" };

			const now = SharedService.getCurrentTimestamp();
			const res = await this.db.insertValue(Tables.WORKLOG, {
				PayCycleId: payCycleId,
				EmployeeId: employeeId,
				WorkDate: workDate,
				Hours: hours,
				CreatedOn: now,
			});
			return { success: { workLogId: res.lastId } };
		} catch (e) {
			return { error: e && e.message ? e.message : String(e) };
		} finally {
			this.db.close();
		}
	}

	async getPayCycleById() {
		try {
			const d = this.message.data || {};
			const id = parseInt(d.id, 10);
			if (!Number.isInteger(id) || id <= 0) throw new Error("id is required");
			this.db.open();
			const row = await this.db.findById(Tables.PAYCYCLE, id);
			if (!row) return { error: "PayCycle not found" };
			return {
				success: {
					id: row.Id,
					startDate: row.StartDate,
					endDate: row.EndDate,
					status: row.Status,
					createdOn: row.CreatedOn,
					lastUpdatedOn: row.LastUpdatedOn,
					concurrencyKey: row.ConcurrencyKey,
				},
			};
		} catch (e) {
			return { error: e && e.message ? e.message : String(e) };
		} finally {
			this.db.close();
		}
	}

	async listPayCycles() {
		try {
			this.db.open();
			const rows = await this.db.getValues(Tables.PAYCYCLE, {});
			return {
				success: rows.map(r => ({
					id: r.Id,
					startDate: r.StartDate,
					endDate: r.EndDate,
					status: r.Status,
					createdOn: r.CreatedOn,
					lastUpdatedOn: r.LastUpdatedOn,
					concurrencyKey: r.ConcurrencyKey,
				})),
			};
		} catch (e) {
			return { error: e && e.message ? e.message : String(e) };
		} finally {
			this.db.close();
		}
	}

	async processPayroll() {
		if (!isAdmin(this.message.userPubKey)) return { error: "Unauthorized" };
		try {
			const d = this.message.data || {};
			const payCycleId = parseInt(d.payCycleId, 10);
			if (!Number.isInteger(payCycleId) || payCycleId <= 0) throw new Error("payCycleId is required");

			this.db.open();
			const cycle = await this.db.findById(Tables.PAYCYCLE, payCycleId);
			if (!cycle) return { error: "PayCycle not found" };
			if (cycle.Status !== "CLOSED") return { error: "PayCycle must be CLOSED before processing" };

			// Prevent double processing.
			const existing = await this.db.getValues(Tables.PAYMENT, { PayCycleId: payCycleId });
			if (existing.length) return { error: "Payroll already processed for this cycle" };

			const employees = await this.db.getValues(Tables.EMPLOYEE, { IsActive: 1 });
			const paymentsToInsert = [];

			for (const emp of employees) {
				let gross = 0;
				if (emp.SalaryType === "MONTHLY") {
					gross = Number(emp.SalaryAmount);
				} else if (emp.SalaryType === "HOURLY") {
					const logs = await this.db.runSelectQuery(
						`SELECT SUM(Hours) as TotalHours FROM ${Tables.WORKLOG} WHERE PayCycleId = ? AND EmployeeId = ?`,
						[payCycleId, emp.Id],
					);
					const totalHours = Number((logs[0] && logs[0].TotalHours) || 0);
					gross = totalHours * Number(emp.SalaryAmount);
				}

				// Skip zero payments (e.g., hourly employees with no hours).
				if (gross <= 0) continue;

				paymentsToInsert.push({
					PayCycleId: payCycleId,
					EmployeeId: emp.Id,
					GrossAmount: gross,
					Currency: emp.Currency || "USD",
					PaidOn: SharedService.getCurrentTimestamp(),
					Notes: "Processed in-contract (record only)",
				});
			}

			if (!paymentsToInsert.length) {
				return { error: "No payable employees for this cycle" };
			}

			await this.db.insertValues(Tables.PAYMENT, paymentsToInsert);
			return { success: { processed: true, paymentsCreated: paymentsToInsert.length } };
		} catch (e) {
			return { error: e && e.message ? e.message : String(e) };
		} finally {
			this.db.close();
		}
	}

	async getPaymentsByCycle() {
		try {
			const d = this.message.data || {};
			const payCycleId = parseInt(d.payCycleId, 10);
			if (!Number.isInteger(payCycleId) || payCycleId <= 0) throw new Error("payCycleId is required");
			this.db.open();
			const rows = await this.db.getValues(Tables.PAYMENT, { PayCycleId: payCycleId });
			return { success: rows };
		} catch (e) {
			return { error: e && e.message ? e.message : String(e) };
		} finally {
			this.db.close();
		}
	}

	async getPaymentsByEmployee() {
		try {
			const d = this.message.data || {};
			const employeeId = parseInt(d.employeeId, 10);
			if (!Number.isInteger(employeeId) || employeeId <= 0) throw new Error("employeeId is required");
			this.db.open();
			const rows = await this.db.getValues(Tables.PAYMENT, { EmployeeId: employeeId });
			return { success: rows };
		} catch (e) {
			return { error: e && e.message ? e.message : String(e) };
		} finally {
			this.db.close();
		}
	}
}

module.exports = { PayrollService };
