const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const settings = require("../settings.json").settings;
const { Tables } = require("../Constants/Tables");

class DBInitializer {
	static async init() {
		const dbPath = settings.dbPath;

		if (!fs.existsSync(dbPath)) {
			const db = new sqlite3.Database(dbPath);
			await this.#runQuery(db, "PRAGMA foreign_keys = ON");

			// ContractVersion
			await this.#runQuery(
				db,
				`CREATE TABLE IF NOT EXISTS ${Tables.CONTRACTVERSION} (
					Id INTEGER,
					Version INTEGER NOT NULL,
					Description TEXT,
					CreatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
					LastUpdatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
					PRIMARY KEY("Id" AUTOINCREMENT)
				)`,
			);

			await this.#runQuery(
				db,
				`CREATE TABLE IF NOT EXISTS ${Tables.SQLSCRIPTMIGRATIONS} (
					Id INTEGER,
					Sprint TEXT NOT NULL,
					ScriptName TEXT NOT NULL,
					ExecutedTimestamp TEXT,
					ConcurrencyKey TEXT
						CHECK (ConcurrencyKey LIKE '0x%' AND length(ConcurrencyKey) = 18),
					PRIMARY KEY("Id" AUTOINCREMENT)
				)`,
			);

			await this.#runQuery(
				db,
				`CREATE TABLE IF NOT EXISTS ${Tables.ACTIVITYLOG} (
					Id INTEGER,
					ActivityType TEXT,
					User TEXT,
					Service TEXT,
					Action TEXT,
					Message TEXT,
					ExceptionMessage TEXT,
					TimeStamp TEXT,
					PRIMARY KEY("Id" AUTOINCREMENT)
				)`,
			);

			await this.#runQuery(
				db,
				`CREATE TABLE IF NOT EXISTS ${Tables.EMPLOYEE} (
					Id INTEGER,
					Name TEXT NOT NULL,
					SalaryType TEXT NOT NULL,
					SalaryAmount REAL NOT NULL,
					Currency TEXT NOT NULL,
					IsActive INTEGER DEFAULT 1,
					CreatedOn TEXT,
					LastUpdatedOn TEXT,
					ConcurrencyKey TEXT
						CHECK (ConcurrencyKey LIKE '0x%' AND length(ConcurrencyKey) = 18),
					PRIMARY KEY("Id" AUTOINCREMENT)
				)`,
			);

			await this.#runQuery(
				db,
				`CREATE TABLE IF NOT EXISTS ${Tables.PAYCYCLE} (
					Id INTEGER,
					StartDate TEXT NOT NULL,
					EndDate TEXT NOT NULL,
					Status TEXT NOT NULL,
					CreatedOn TEXT,
					LastUpdatedOn TEXT,
					ConcurrencyKey TEXT
						CHECK (ConcurrencyKey LIKE '0x%' AND length(ConcurrencyKey) = 18),
					PRIMARY KEY("Id" AUTOINCREMENT)
				)`,
			);

			await this.#runQuery(
				db,
				`CREATE TABLE IF NOT EXISTS ${Tables.WORKLOG} (
					Id INTEGER,
					PayCycleId INTEGER NOT NULL,
					EmployeeId INTEGER NOT NULL,
					WorkDate TEXT NOT NULL,
					Hours REAL NOT NULL,
					CreatedOn TEXT,
					PRIMARY KEY("Id" AUTOINCREMENT),
					FOREIGN KEY(PayCycleId) REFERENCES ${Tables.PAYCYCLE}(Id),
					FOREIGN KEY(EmployeeId) REFERENCES ${Tables.EMPLOYEE}(Id)
				)`,
			);

			await this.#runQuery(
				db,
				`CREATE TABLE IF NOT EXISTS ${Tables.PAYMENT} (
					Id INTEGER,
					PayCycleId INTEGER NOT NULL,
					EmployeeId INTEGER NOT NULL,
					GrossAmount REAL NOT NULL,
					Currency TEXT NOT NULL,
					PaidOn TEXT,
					Notes TEXT,
					PRIMARY KEY("Id" AUTOINCREMENT),
					FOREIGN KEY(PayCycleId) REFERENCES ${Tables.PAYCYCLE}(Id),
					FOREIGN KEY(EmployeeId) REFERENCES ${Tables.EMPLOYEE}(Id)
				)`,
			);

			// Seed initial contract version = 1
			await this.#runQuery(
				db,
				`INSERT INTO ${Tables.CONTRACTVERSION}(Version, Description) VALUES (1, 'Initial Contract')`,
			);

			db.close();
		}

		// Migration runner (Scripts folder)
		if (fs.existsSync(dbPath)) {
			const db = new sqlite3.Database(dbPath);
			const scriptsDir = settings.dbScriptsFolderPath;
			if (fs.existsSync(scriptsDir)) {
				// Flat-run *.sql in the folder (simple runner)
				const files = fs
					.readdirSync(scriptsDir)
					.filter(f => f.endsWith(".sql"))
					.sort();
				for (const f of files) {
					const sql = fs.readFileSync(path.join(scriptsDir, f), "utf8");
					const statements = sql
						.split(";")
						.map(s => s.trim())
						.filter(Boolean);
					for (const st of statements) {
						try {
							await this.#runQuery(db, st);
						} catch (e) {
							console.error("Migration statement failed", f, e);
						}
					}
				}
			}
			db.close();
		}
	}

	static #runQuery(db, query, params) {
		return new Promise((resolve, reject) => {
			db.run(query, params || [], function (err) {
				if (err) return reject(err);
				resolve({ lastId: this.lastID, changes: this.changes });
			});
		});
	}
}

module.exports = { DBInitializer };
