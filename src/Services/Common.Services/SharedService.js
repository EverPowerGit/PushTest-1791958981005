const { v4: uuidv4 } = require("uuid");
const EventEmitter = require("events");

class SharedService {
	static context = null;
	static nplEventEmitter = new EventEmitter();

	static generateUUID() {
		return uuidv4();
	}

	static getUtcISOStringFromUnixTimestamp(milliseconds) {
		return new Date(milliseconds).toISOString();
	}

	static getCurrentTimestamp() {
		return this.getUtcISOStringFromUnixTimestamp(this.context.timestamp);
	}

	static generateConcurrencyKey() {
		const timestamp = this.getCurrentTimestamp();
		const extracted = timestamp.replace(/\D/g, "");
		const timestampHex = Number(extracted).toString(16).toUpperCase().padStart(14, "0");
		const checksum = 16 - timestampHex.length;
		return `0x${"0".repeat(checksum)}${timestampHex}`;
	}

	static objectArraySort(arrayObj, fieldName) {
		if (!Array.isArray(arrayObj) || arrayObj.length === 0) return arrayObj;
		return arrayObj.sort((a, b) => {
			const t1 = String(a[fieldName] || "").toLowerCase();
			const t2 = String(b[fieldName] || "").toLowerCase();
			if (t1 < t2) return -1;
			if (t1 > t2) return 1;
			return 0;
		});
	}
}

module.exports = { SharedService };
