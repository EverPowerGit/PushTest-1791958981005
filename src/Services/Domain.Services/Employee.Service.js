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

function mustBeNonEmptyString(v, field) {
	if (typeof v !== "string" || !v.trim()) throw new Error(`${field} is required.`);
}

function mustBePositiveNumber(v, field) {
	const n = Number(v);
	if (!Number.isFinite(n) || n <= 0) throw new Error(`${field} must be a positive number.`);
	return n;
}

function normalizeSalaryType(v) {
	const t = String(v || "").toUpperCase();
	if (t !== "MONTHLY" && t !== "HOURLY") throw new Error("salaryType must be MONTHLY or HOURLY");
	return t;
}

class EmployeeService {
	constructor(message) {
		this.message = message;
		this.db = new SqliteDatabase(settings.dbPath);
	}

	async addEmployee() {
		if (!isAdmin(this.message.userPubKey)) return { error: "Unauthorized" };
		try {
			const d = this.message.data || {};
			mustBeNonEmptyString(d.name, "name");
			const salaryType = normalizeSalaryType(d.salaryType);
			const salaryAmount = mustBePositiveNumber(d.salaryAmount, "salaryAmount");
			const currency = String(d.currency || "USD").toUpperCase();

			this.db.open();
			const now = SharedService.getCurrentTimestamp();
			const res = await this.db.insertValue(Tables.EMPLOYEE, {
				Name: d.name.trim(),
				SalaryType: salaryType,
				SalaryAmount: salaryAmount,
				Currency: currency,
				IsActive: 1,
				CreatedOn: now,
				LastUpdatedOn: now,
				ConcurrencyKey: SharedService.generateConcurrencyKey(),
			});
			return { success: { employeeId: res.lastId } };
		} catch (e) {
			return { error: e && e.message ? e.message : String(e) };
		} finally {
			this.db.close();
		}
	}

	async updateEmployee() {
		if (!isAdmin(this.message.userPubKey)) return { error: "Unauthorized" };
		try {
			const d = this.message.data || {};
			const id = parseInt(d.id, 10);
			if (!Number.isInteger(id) || id <= 0) throw new Error("id is required");

			const expectedConcurrencyKey = d.concurrencyKey;
			if (!expectedConcurrencyKey) throw new Error("concurrencyKey is required");

			const patch = {};
			if (d.name !== undefined) {
				mustBeNonEmptyString(d.name, "name");
				patch.Name = d.name.trim();
			}
			if (d.salaryType !== undefined) patch.SalaryType = normalizeSalaryType(d.salaryType);
			if (d.salaryAmount !== undefined) patch.SalaryAmount = mustBePositiveNumber(d.salaryAmount, "salaryAmount");
			if (d.currency !== undefined) patch.Currency = String(d.currency || "USD").toUpperCase();
			if (d.isActive !== undefined) patch.IsActive = d.isActive ? 1 : 0;
			patch.LastUpdatedOn = SharedService.getCurrentTimestamp();

			this.db.open();
			const r = await this.db.updateWithConcurrencyCheck(Tables.EMPLOYEE, id, patch, expectedConcurrencyKey);
			return { success: { updated: true, concurrencyKey: r.concurrencyKey } };
		} catch (e) {
			return { error: e && e.message ? e.message : String(e) };
		} finally {
			this.db.close();
		}
	}

	async removeEmployee() {
		if (!isAdmin(this.message.userPubKey)) return { error: "Unauthorized" };
		try {
			const d = this.message.data || {};
			const id = parseInt(d.id, 10);
			if (!Number.isInteger(id) || id <= 0) throw new Error("id is required");
			if (!d.concurrencyKey) throw new Error("concurrencyKey is required");

			this.db.open();
			const r = await this.db.updateWithConcurrencyCheck(
				Tables.EMPLOYEE,
				id,
				{
					IsActive: 0,
					LastUpdatedOn: SharedService.getCurrentTimestamp(),
				},
				d.concurrencyKey,
			);
			return { success: { removed: true, concurrencyKey: r.concurrencyKey } };
		} catch (e) {
			return { error: e && e.message ? e.message : String(e) };
		} finally {
			this.db.close();
		}
	}

	async getEmployeeById() {
		try {
			const d = this.message.data || {};
			const id = parseInt(d.id, 10);
			if (!Number.isInteger(id) || id <= 0) throw new Error("id is required");

			this.db.open();
			const row = await this.db.findById(Tables.EMPLOYEE, id);
			if (!row) return { error: "Employee not found" };
			return {
				success: {
					id: row.Id,
					name: row.Name,
					salaryType: row.SalaryType,
					salaryAmount: row.SalaryAmount,
					currency: row.Currency,
					isActive: !!row.IsActive,
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

	async getAllEmployees() {
		try {
			this.db.open();
			const rows = await this.db.getValues(Tables.EMPLOYEE, {});
			return {
				success: rows.map(r => ({
					id: r.Id,
					name: r.Name,
					salaryType: r.SalaryType,
					salaryAmount: r.SalaryAmount,
					currency: r.Currency,
					isActive: !!r.IsActive,
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
}

module.exports = { EmployeeService };
