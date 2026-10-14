/*
Utility cleanup script placeholder.
HotPocket contract runtime does not automatically execute this.
You can manually run it inside the container/instance if needed.
*/

const fs = require("fs");

function cleanupDb(dbPath) {
	if (fs.existsSync(dbPath)) {
		fs.unlinkSync(dbPath);
		console.log("Deleted", dbPath);
	} else {
		console.log("No db file at", dbPath);
	}
}

module.exports = { cleanupDb };
