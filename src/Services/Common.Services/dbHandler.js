const sqlite3 = require("sqlite3").verbose();
const { SharedService } = require("./SharedService");

const DataTypes = {
	TEXT: "TEXT",
	INTEGER: "INTEGER",
	NULL: "NULL",
};

class SqliteDatabase {
	constructor(dbFile) {
		this.dbFile = dbFile;
		this.openConnections = 0;
		this.db = null;
	}

	open() {
		if (this.openConnections <= 0) {
			this.db = new sqlite3.Database(this.dbFile);
			this.openConnections = 1;
		} else {
			this.openConnections++;
		}
	}

	close() {
		if (this.openConnections <= 1) {
			if (this.db) this.db.close();
			this.db = null;
			this.openConnections = 0;
		} else {
			this.openConnections--;
		}
	}

	runQuery(query, params) {
		if (!this.db) throw new Error("Database connection is not open.");
		return new Promise((resolve, reject) => {
			this.db.run(query, params || [], function (err) {
				if (err) return reject(err);
				resolve({ lastId: this.lastID, changes: this.changes });
			});
		});
	}

	runSelectQuery(query, params) {
		if (!this.db) throw new Error("Database connection is not open.");
		return new Promise((resolve, reject) => {
			this.db.all(query, params || [], (err, rows) => {
				if (err) return reject(err);
				resolve(rows);
			});
		});
	}

	getLastRecord(tableName) {
		return new Promise((resolve, reject) => {
			this.db.get(`SELECT * FROM ${tableName} ORDER BY rowid DESC LIMIT 1`, (err, row) => {
				if (err) return reject(err);
				resolve(row);
			});
		});
	}

	insertValue(tableName, value) {
		return this.insertValues(tableName, [value]);
	}

	insertValues(tableName, values) {
		if (!this.db) throw new Error("Database connection is not open.");
		if (!values || !values.length) return Promise.resolve({ lastId: 0, changes: 0 });

		const columnNames = Object.keys(values[0]);
		let rowValueStr = "";
		const rowValues = [];

		for (const val of values) {
			rowValueStr += "(";
			for (const c of columnNames) {
				rowValueStr += "?,";
				rowValues.push(val[c] ?? "NULL");
			}
			rowValueStr = rowValueStr.slice(0, -1) + "),";
		}
		rowValueStr = rowValueStr.slice(0, -1);

		const q = `INSERT INTO ${tableName}(${columnNames.join(", ")}) VALUES ${rowValueStr}`;
		return this.runQuery(q, rowValues);
	}

	updateValue(tableName, value, filter) {
		if (!this.db) throw new Error("Database connection is not open.");
		const cols = Object.keys(value || {});
		if (!cols.length) throw new Error("No fields to update.");

		let setStr = "";
		const params = [];
		for (const c of cols) {
			setStr += `${c} = ?,`;
			params.push(value[c] ?? "NULL");
		}
		setStr = setStr.slice(0, -1);

		const fcols = Object.keys(filter || {});
		if (!fcols.length) throw new Error("Filter is required.");
		let whereStr = "";
		for (const fc of fcols) {
			whereStr += `${fc} = ? AND `;
			params.push(filter[fc] ?? "NULL");
		}
		whereStr = whereStr.slice(0, -5);

		return this.runQuery(`UPDATE ${tableName} SET ${setStr} WHERE ${whereStr};`, params);
	}

	deleteValues(tableName, filter) {
		if (!this.db) throw new Error("Database connection is not open.");
		const fcols = Object.keys(filter || {});
		if (!fcols.length) throw new Error("Filter is required.");
		let whereStr = "";
		const params = [];
		for (const fc of fcols) {
			whereStr += `${fc} = ? AND `;
			params.push(filter[fc] ?? "NULL");
		}
		whereStr = whereStr.slice(0, -5);
		return this.runQuery(`DELETE FROM ${tableName} WHERE ${whereStr};`, params);
	}

	findById(tableName, id) {
		if (!this.db) throw new Error("Database connection is not open.");
		return new Promise((resolve, reject) => {
			this.db.get(`SELECT * FROM ${tableName} WHERE Id = ?`, [id], (err, row) => {
				if (err) return reject(err);
				resolve(row);
			});
		});
	}

	getValues(tableName, filter) {
		if (!this.db) throw new Error("Database connection is not open.");
		const fcols = Object.keys(filter || {});
		let whereStr = "1";
		const params = [];
		for (const fc of fcols) {
			whereStr += ` AND ${fc} = ?`;
			params.push(filter[fc] ?? "NULL");
		}
		return this.runSelectQuery(`SELECT * FROM ${tableName} WHERE ${whereStr};`, params);
	}

	updateWithConcurrencyCheck(table, id, newData, expectedConcurrencyKey) {
		if (!this.db) throw new Error("Database connection is not open.");
		return new Promise((resolve, reject) => {
			this.db.get(`SELECT ConcurrencyKey FROM ${table} WHERE Id = ?`, [id], (err, row) => {
				if (err) return reject(new Error("Database error: " + err.message));
				if (!row) return reject(new Error("Record not found"));
				if (row.ConcurrencyKey !== expectedConcurrencyKey) return reject(new Error("Concurrency conflict"));

				const newConcurrencyKey = SharedService.generateConcurrencyKey();
				const keys = Object.keys(newData || {});
				if (!keys.length) return reject(new Error("No fields to update"));
				const set = keys.map(k => `${k} = ?`).join(", ");
				const vals = keys.map(k => newData[k]);
				vals.push(newConcurrencyKey, id);

				this.db.run(
					`UPDATE ${table} SET ${set}, ConcurrencyKey = ? WHERE Id = ?`,
					vals,
					err2 => {
						if (err2) return reject(new Error("Database error: " + err2.message));
						resolve({ success: true, concurrencyKey: newConcurrencyKey });
					},
				);
			});
		});
	}
}

module.exports = {
	SqliteDatabase,
	DataTypes,
};
