const fs = require("fs");

function parseEnv(text) {
	const env = {};
	String(text)
		.split(/\r?\n/)
		.forEach(line => {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) return;
			const idx = trimmed.indexOf("=");
			if (idx < 0) return;
			const key = trimmed.slice(0, idx).trim();
			let val = trimmed.slice(idx + 1);
			val = val.trim();
			if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
				val = val.slice(1, -1);
			}
			env[key] = val;
		});
	return env;
}

let env = {};
try {
	const res = fs.readFileSync(".env", "utf8");
	env = parseEnv(res);
} catch (e) {
	// Ignore if missing.
}

module.exports = env;
