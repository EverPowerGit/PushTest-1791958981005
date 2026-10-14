const { Tables } = require("../../Constants/Tables");
const settings = require("../../settings.json").settings;
const { SqliteDatabase } = require("./dbHandler");
const { SharedService } = require("./SharedService");
const fs = require("fs");

class UpgradeService {
	constructor(message) {
		this.message = message;
		this.db = new SqliteDatabase(settings.dbPath);
	}

	async upgradeContract({ version, description, zipBuffer }) {
		let resObj = {};
		try {
			this.db.open();
			const row = (await this.db.getLastRecord(Tables.CONTRACTVERSION)) || { Version: 1 };
			const currentVersion = parseInt(row.Version, 10) || 1;
			const incomingVersion = parseInt(version, 10);

			if (!Number.isInteger(incomingVersion)) {
				return { error: { code: 400, message: "Version must be an integer" } };
			}
			if (incomingVersion <= currentVersion) {
				return {
					error: {
						code: 403,
						message: `Incoming version (${incomingVersion}) must be greater than current version (${currentVersion}).`,
					},
				};
			}

			fs.writeFileSync(settings.newContractZipFileName, Buffer.from(zipBuffer));

			const shellScriptContent = `#!/bin/bash

echo "Running post_exec.sh"

! command -v unzip &>/dev/null && apt-get update && apt-get install --no-install-recommends -y unzip

zip_file="${settings.newContractZipFileName}"

unzip -o -d ./ "$zip_file" >>/dev/null
rm "$zip_file" >>/dev/null
`;
			fs.writeFileSync(settings.postExecutionScriptName, shellScriptContent);
			fs.chmodSync(settings.postExecutionScriptName, 0o777);

			await this.db.insertValue(Tables.CONTRACTVERSION, {
				Version: incomingVersion,
				Description: description || "",
				CreatedOn: SharedService.context.timestamp,
				LastUpdatedOn: SharedService.context.timestamp,
			});

			resObj.success = { message: "Contract upgrade staged", version: incomingVersion };
		} catch (e) {
			resObj.error = { code: 500, message: e && e.message ? e.message : String(e) };
		} finally {
			this.db.close();
		}
		return resObj;
	}
}

module.exports = { UpgradeService };
