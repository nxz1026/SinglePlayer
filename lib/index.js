import { createRequire } from "node:module";
import { constants, createCipheriv, createHash, publicEncrypt, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
//#endregion
//#region src/log.ts
/**
* 宿主半统一日志 —— 带 [music] 前缀输出到 dsh 进程 stdout/stderr。
* 日志级别：INFO / WARN / ERROR。通过 LOG_LEVEL 环境变量控制（默认 INFO）。
*/
const PREFIX = "[music]";
const LEVEL = (process.env.LOG_LEVEL ?? "INFO").toUpperCase();
function shouldLog(minLevel) {
	const order = [
		"ERROR",
		"WARN",
		"INFO"
	];
	return order.indexOf(LEVEL) >= order.indexOf(minLevel);
}
function logInfo(...args) {
	if (shouldLog("INFO")) console.log(PREFIX, ...args);
}
function logWarn(...args) {
	if (shouldLog("WARN")) console.warn(PREFIX, ...args);
}
function logError(context, error) {
	if (shouldLog("ERROR")) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`${PREFIX} ${context}:`, message);
	}
}
//#endregion
//#region src/proxy/audio.ts
/** 上游音频请求头（对齐 Mineradio audioProxyHeadersFor 的关键面）。 */
function upstreamHeadersFor(url, range) {
	const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" };
	if (range) headers.Range = range;
	let referer = "";
	try {
		const { host } = new URL(url);
		if (host.endsWith("qq.com")) referer = "https://y.qq.com/";
		else if (host.endsWith("music.126.net")) referer = "https://music.163.com/";
	} catch {
		return headers;
	}
	if (referer) headers.Referer = referer;
	return headers;
}
const PASSTHROUGH_HEADERS = [
	"content-type",
	"content-length",
	"content-range",
	"accept-ranges"
];
async function proxyAudio(req, res, rawUrl) {
	let target;
	try {
		target = new URL(rawUrl);
	} catch {
		res.writeHead(400).end("bad url");
		return;
	}
	if (target.protocol !== "http:" && target.protocol !== "https:") {
		res.writeHead(400).end("bad protocol");
		return;
	}
	try {
		const upstream = await fetch(target, {
			headers: upstreamHeadersFor(target.toString(), req.headers.range),
			redirect: "follow"
		});
		const headers = { "cache-control": "no-store" };
		for (const name of PASSTHROUGH_HEADERS) {
			const value = upstream.headers.get(name);
			if (value) headers[name] = value;
		}
		res.writeHead(upstream.status, headers);
		if (!upstream.body || req.method === "HEAD") {
			res.end();
			return;
		}
		await pipelineBody(upstream.body, res);
	} catch (error) {
		if (!res.headersSent) res.writeHead(502);
		res.end(`proxy error: ${error instanceof Error ? error.message : String(error)}`);
	}
}
/** ReadableStream(Web) → Node 响应。 */
async function pipelineBody(body, res) {
	const reader = body.getReader();
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!res.write(value)) await new Promise((resolve) => {
				res.once("drain", resolve);
			});
		}
		res.end();
	} catch (error) {
		res.destroy(error instanceof Error ? error : new Error(String(error)));
	} finally {
		reader.releaseLock();
	}
}
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/can-promise.js
var require_can_promise = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function() {
		return typeof Promise === "function" && Promise.prototype && Promise.prototype.then;
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/utils.js
var require_utils$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	let toSJISFunction;
	const CODEWORDS_COUNT = [
		0,
		26,
		44,
		70,
		100,
		134,
		172,
		196,
		242,
		292,
		346,
		404,
		466,
		532,
		581,
		655,
		733,
		815,
		901,
		991,
		1085,
		1156,
		1258,
		1364,
		1474,
		1588,
		1706,
		1828,
		1921,
		2051,
		2185,
		2323,
		2465,
		2611,
		2761,
		2876,
		3034,
		3196,
		3362,
		3532,
		3706
	];
	/**
	* Returns the QR Code size for the specified version
	*
	* @param  {Number} version QR Code version
	* @return {Number}         size of QR code
	*/
	exports.getSymbolSize = function getSymbolSize(version) {
		if (!version) throw new Error("\"version\" cannot be null or undefined");
		if (version < 1 || version > 40) throw new Error("\"version\" should be in range from 1 to 40");
		return version * 4 + 17;
	};
	/**
	* Returns the total number of codewords used to store data and EC information.
	*
	* @param  {Number} version QR Code version
	* @return {Number}         Data length in bits
	*/
	exports.getSymbolTotalCodewords = function getSymbolTotalCodewords(version) {
		return CODEWORDS_COUNT[version];
	};
	/**
	* Encode data with Bose-Chaudhuri-Hocquenghem
	*
	* @param  {Number} data Value to encode
	* @return {Number}      Encoded value
	*/
	exports.getBCHDigit = function(data) {
		let digit = 0;
		while (data !== 0) {
			digit++;
			data >>>= 1;
		}
		return digit;
	};
	exports.setToSJISFunction = function setToSJISFunction(f) {
		if (typeof f !== "function") throw new Error("\"toSJISFunc\" is not a valid function.");
		toSJISFunction = f;
	};
	exports.isKanjiModeEnabled = function() {
		return typeof toSJISFunction !== "undefined";
	};
	exports.toSJIS = function toSJIS(kanji) {
		return toSJISFunction(kanji);
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/error-correction-level.js
var require_error_correction_level = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.L = { bit: 1 };
	exports.M = { bit: 0 };
	exports.Q = { bit: 3 };
	exports.H = { bit: 2 };
	function fromString(string) {
		if (typeof string !== "string") throw new Error("Param is not a string");
		switch (string.toLowerCase()) {
			case "l":
			case "low": return exports.L;
			case "m":
			case "medium": return exports.M;
			case "q":
			case "quartile": return exports.Q;
			case "h":
			case "high": return exports.H;
			default: throw new Error("Unknown EC Level: " + string);
		}
	}
	exports.isValid = function isValid(level) {
		return level && typeof level.bit !== "undefined" && level.bit >= 0 && level.bit < 4;
	};
	exports.from = function from(value, defaultValue) {
		if (exports.isValid(value)) return value;
		try {
			return fromString(value);
		} catch (e) {
			return defaultValue;
		}
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/bit-buffer.js
var require_bit_buffer = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function BitBuffer() {
		this.buffer = [];
		this.length = 0;
	}
	BitBuffer.prototype = {
		get: function(index) {
			const bufIndex = Math.floor(index / 8);
			return (this.buffer[bufIndex] >>> 7 - index % 8 & 1) === 1;
		},
		put: function(num, length) {
			for (let i = 0; i < length; i++) this.putBit((num >>> length - i - 1 & 1) === 1);
		},
		getLengthInBits: function() {
			return this.length;
		},
		putBit: function(bit) {
			const bufIndex = Math.floor(this.length / 8);
			if (this.buffer.length <= bufIndex) this.buffer.push(0);
			if (bit) this.buffer[bufIndex] |= 128 >>> this.length % 8;
			this.length++;
		}
	};
	module.exports = BitBuffer;
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/bit-matrix.js
var require_bit_matrix = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Helper class to handle QR Code symbol modules
	*
	* @param {Number} size Symbol size
	*/
	function BitMatrix(size) {
		if (!size || size < 1) throw new Error("BitMatrix size must be defined and greater than 0");
		this.size = size;
		this.data = new Uint8Array(size * size);
		this.reservedBit = new Uint8Array(size * size);
	}
	/**
	* Set bit value at specified location
	* If reserved flag is set, this bit will be ignored during masking process
	*
	* @param {Number}  row
	* @param {Number}  col
	* @param {Boolean} value
	* @param {Boolean} reserved
	*/
	BitMatrix.prototype.set = function(row, col, value, reserved) {
		const index = row * this.size + col;
		this.data[index] = value;
		if (reserved) this.reservedBit[index] = true;
	};
	/**
	* Returns bit value at specified location
	*
	* @param  {Number}  row
	* @param  {Number}  col
	* @return {Boolean}
	*/
	BitMatrix.prototype.get = function(row, col) {
		return this.data[row * this.size + col];
	};
	/**
	* Applies xor operator at specified location
	* (used during masking process)
	*
	* @param {Number}  row
	* @param {Number}  col
	* @param {Boolean} value
	*/
	BitMatrix.prototype.xor = function(row, col, value) {
		this.data[row * this.size + col] ^= value;
	};
	/**
	* Check if bit at specified location is reserved
	*
	* @param {Number}   row
	* @param {Number}   col
	* @return {Boolean}
	*/
	BitMatrix.prototype.isReserved = function(row, col) {
		return this.reservedBit[row * this.size + col];
	};
	module.exports = BitMatrix;
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/alignment-pattern.js
var require_alignment_pattern = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Alignment pattern are fixed reference pattern in defined positions
	* in a matrix symbology, which enables the decode software to re-synchronise
	* the coordinate mapping of the image modules in the event of moderate amounts
	* of distortion of the image.
	*
	* Alignment patterns are present only in QR Code symbols of version 2 or larger
	* and their number depends on the symbol version.
	*/
	const getSymbolSize = require_utils$1().getSymbolSize;
	/**
	* Calculate the row/column coordinates of the center module of each alignment pattern
	* for the specified QR Code version.
	*
	* The alignment patterns are positioned symmetrically on either side of the diagonal
	* running from the top left corner of the symbol to the bottom right corner.
	*
	* Since positions are simmetrical only half of the coordinates are returned.
	* Each item of the array will represent in turn the x and y coordinate.
	* @see {@link getPositions}
	*
	* @param  {Number} version QR Code version
	* @return {Array}          Array of coordinate
	*/
	exports.getRowColCoords = function getRowColCoords(version) {
		if (version === 1) return [];
		const posCount = Math.floor(version / 7) + 2;
		const size = getSymbolSize(version);
		const intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
		const positions = [size - 7];
		for (let i = 1; i < posCount - 1; i++) positions[i] = positions[i - 1] - intervals;
		positions.push(6);
		return positions.reverse();
	};
	/**
	* Returns an array containing the positions of each alignment pattern.
	* Each array's element represent the center point of the pattern as (x, y) coordinates
	*
	* Coordinates are calculated expanding the row/column coordinates returned by {@link getRowColCoords}
	* and filtering out the items that overlaps with finder pattern
	*
	* @example
	* For a Version 7 symbol {@link getRowColCoords} returns values 6, 22 and 38.
	* The alignment patterns, therefore, are to be centered on (row, column)
	* positions (6,22), (22,6), (22,22), (22,38), (38,22), (38,38).
	* Note that the coordinates (6,6), (6,38), (38,6) are occupied by finder patterns
	* and are not therefore used for alignment patterns.
	*
	* let pos = getPositions(7)
	* // [[6,22], [22,6], [22,22], [22,38], [38,22], [38,38]]
	*
	* @param  {Number} version QR Code version
	* @return {Array}          Array of coordinates
	*/
	exports.getPositions = function getPositions(version) {
		const coords = [];
		const pos = exports.getRowColCoords(version);
		const posLength = pos.length;
		for (let i = 0; i < posLength; i++) for (let j = 0; j < posLength; j++) {
			if (i === 0 && j === 0 || i === 0 && j === posLength - 1 || i === posLength - 1 && j === 0) continue;
			coords.push([pos[i], pos[j]]);
		}
		return coords;
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/finder-pattern.js
var require_finder_pattern = /* @__PURE__ */ __commonJSMin(((exports) => {
	const getSymbolSize = require_utils$1().getSymbolSize;
	const FINDER_PATTERN_SIZE = 7;
	/**
	* Returns an array containing the positions of each finder pattern.
	* Each array's element represent the top-left point of the pattern as (x, y) coordinates
	*
	* @param  {Number} version QR Code version
	* @return {Array}          Array of coordinates
	*/
	exports.getPositions = function getPositions(version) {
		const size = getSymbolSize(version);
		return [
			[0, 0],
			[size - FINDER_PATTERN_SIZE, 0],
			[0, size - FINDER_PATTERN_SIZE]
		];
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/mask-pattern.js
var require_mask_pattern = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Data mask pattern reference
	* @type {Object}
	*/
	exports.Patterns = {
		PATTERN000: 0,
		PATTERN001: 1,
		PATTERN010: 2,
		PATTERN011: 3,
		PATTERN100: 4,
		PATTERN101: 5,
		PATTERN110: 6,
		PATTERN111: 7
	};
	/**
	* Weighted penalty scores for the undesirable features
	* @type {Object}
	*/
	const PenaltyScores = {
		N1: 3,
		N2: 3,
		N3: 40,
		N4: 10
	};
	/**
	* Check if mask pattern value is valid
	*
	* @param  {Number}  mask    Mask pattern
	* @return {Boolean}         true if valid, false otherwise
	*/
	exports.isValid = function isValid(mask) {
		return mask != null && mask !== "" && !isNaN(mask) && mask >= 0 && mask <= 7;
	};
	/**
	* Returns mask pattern from a value.
	* If value is not valid, returns undefined
	*
	* @param  {Number|String} value        Mask pattern value
	* @return {Number}                     Valid mask pattern or undefined
	*/
	exports.from = function from(value) {
		return exports.isValid(value) ? parseInt(value, 10) : void 0;
	};
	/**
	* Find adjacent modules in row/column with the same color
	* and assign a penalty value.
	*
	* Points: N1 + i
	* i is the amount by which the number of adjacent modules of the same color exceeds 5
	*/
	exports.getPenaltyN1 = function getPenaltyN1(data) {
		const size = data.size;
		let points = 0;
		let sameCountCol = 0;
		let sameCountRow = 0;
		let lastCol = null;
		let lastRow = null;
		for (let row = 0; row < size; row++) {
			sameCountCol = sameCountRow = 0;
			lastCol = lastRow = null;
			for (let col = 0; col < size; col++) {
				let module$1 = data.get(row, col);
				if (module$1 === lastCol) sameCountCol++;
				else {
					if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
					lastCol = module$1;
					sameCountCol = 1;
				}
				module$1 = data.get(col, row);
				if (module$1 === lastRow) sameCountRow++;
				else {
					if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
					lastRow = module$1;
					sameCountRow = 1;
				}
			}
			if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
			if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
		}
		return points;
	};
	/**
	* Find 2x2 blocks with the same color and assign a penalty value
	*
	* Points: N2 * (m - 1) * (n - 1)
	*/
	exports.getPenaltyN2 = function getPenaltyN2(data) {
		const size = data.size;
		let points = 0;
		for (let row = 0; row < size - 1; row++) for (let col = 0; col < size - 1; col++) {
			const last = data.get(row, col) + data.get(row, col + 1) + data.get(row + 1, col) + data.get(row + 1, col + 1);
			if (last === 4 || last === 0) points++;
		}
		return points * PenaltyScores.N2;
	};
	/**
	* Find 1:1:3:1:1 ratio (dark:light:dark:light:dark) pattern in row/column,
	* preceded or followed by light area 4 modules wide
	*
	* Points: N3 * number of pattern found
	*/
	exports.getPenaltyN3 = function getPenaltyN3(data) {
		const size = data.size;
		let points = 0;
		let bitsCol = 0;
		let bitsRow = 0;
		for (let row = 0; row < size; row++) {
			bitsCol = bitsRow = 0;
			for (let col = 0; col < size; col++) {
				bitsCol = bitsCol << 1 & 2047 | data.get(row, col);
				if (col >= 10 && (bitsCol === 1488 || bitsCol === 93)) points++;
				bitsRow = bitsRow << 1 & 2047 | data.get(col, row);
				if (col >= 10 && (bitsRow === 1488 || bitsRow === 93)) points++;
			}
		}
		return points * PenaltyScores.N3;
	};
	/**
	* Calculate proportion of dark modules in entire symbol
	*
	* Points: N4 * k
	*
	* k is the rating of the deviation of the proportion of dark modules
	* in the symbol from 50% in steps of 5%
	*/
	exports.getPenaltyN4 = function getPenaltyN4(data) {
		let darkCount = 0;
		const modulesCount = data.data.length;
		for (let i = 0; i < modulesCount; i++) darkCount += data.data[i];
		return Math.abs(Math.ceil(darkCount * 100 / modulesCount / 5) - 10) * PenaltyScores.N4;
	};
	/**
	* Return mask value at given position
	*
	* @param  {Number} maskPattern Pattern reference value
	* @param  {Number} i           Row
	* @param  {Number} j           Column
	* @return {Boolean}            Mask value
	*/
	function getMaskAt(maskPattern, i, j) {
		switch (maskPattern) {
			case exports.Patterns.PATTERN000: return (i + j) % 2 === 0;
			case exports.Patterns.PATTERN001: return i % 2 === 0;
			case exports.Patterns.PATTERN010: return j % 3 === 0;
			case exports.Patterns.PATTERN011: return (i + j) % 3 === 0;
			case exports.Patterns.PATTERN100: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
			case exports.Patterns.PATTERN101: return i * j % 2 + i * j % 3 === 0;
			case exports.Patterns.PATTERN110: return (i * j % 2 + i * j % 3) % 2 === 0;
			case exports.Patterns.PATTERN111: return (i * j % 3 + (i + j) % 2) % 2 === 0;
			default: throw new Error("bad maskPattern:" + maskPattern);
		}
	}
	/**
	* Apply a mask pattern to a BitMatrix
	*
	* @param  {Number}    pattern Pattern reference number
	* @param  {BitMatrix} data    BitMatrix data
	*/
	exports.applyMask = function applyMask(pattern, data) {
		const size = data.size;
		for (let col = 0; col < size; col++) for (let row = 0; row < size; row++) {
			if (data.isReserved(row, col)) continue;
			data.xor(row, col, getMaskAt(pattern, row, col));
		}
	};
	/**
	* Returns the best mask pattern for data
	*
	* @param  {BitMatrix} data
	* @return {Number} Mask pattern reference number
	*/
	exports.getBestMask = function getBestMask(data, setupFormatFunc) {
		const numPatterns = Object.keys(exports.Patterns).length;
		let bestPattern = 0;
		let lowerPenalty = Infinity;
		for (let p = 0; p < numPatterns; p++) {
			setupFormatFunc(p);
			exports.applyMask(p, data);
			const penalty = exports.getPenaltyN1(data) + exports.getPenaltyN2(data) + exports.getPenaltyN3(data) + exports.getPenaltyN4(data);
			exports.applyMask(p, data);
			if (penalty < lowerPenalty) {
				lowerPenalty = penalty;
				bestPattern = p;
			}
		}
		return bestPattern;
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/error-correction-code.js
var require_error_correction_code = /* @__PURE__ */ __commonJSMin(((exports) => {
	const ECLevel = require_error_correction_level();
	const EC_BLOCKS_TABLE = [
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		2,
		2,
		1,
		2,
		2,
		4,
		1,
		2,
		4,
		4,
		2,
		4,
		4,
		4,
		2,
		4,
		6,
		5,
		2,
		4,
		6,
		6,
		2,
		5,
		8,
		8,
		4,
		5,
		8,
		8,
		4,
		5,
		8,
		11,
		4,
		8,
		10,
		11,
		4,
		9,
		12,
		16,
		4,
		9,
		16,
		16,
		6,
		10,
		12,
		18,
		6,
		10,
		17,
		16,
		6,
		11,
		16,
		19,
		6,
		13,
		18,
		21,
		7,
		14,
		21,
		25,
		8,
		16,
		20,
		25,
		8,
		17,
		23,
		25,
		9,
		17,
		23,
		34,
		9,
		18,
		25,
		30,
		10,
		20,
		27,
		32,
		12,
		21,
		29,
		35,
		12,
		23,
		34,
		37,
		12,
		25,
		34,
		40,
		13,
		26,
		35,
		42,
		14,
		28,
		38,
		45,
		15,
		29,
		40,
		48,
		16,
		31,
		43,
		51,
		17,
		33,
		45,
		54,
		18,
		35,
		48,
		57,
		19,
		37,
		51,
		60,
		19,
		38,
		53,
		63,
		20,
		40,
		56,
		66,
		21,
		43,
		59,
		70,
		22,
		45,
		62,
		74,
		24,
		47,
		65,
		77,
		25,
		49,
		68,
		81
	];
	const EC_CODEWORDS_TABLE = [
		7,
		10,
		13,
		17,
		10,
		16,
		22,
		28,
		15,
		26,
		36,
		44,
		20,
		36,
		52,
		64,
		26,
		48,
		72,
		88,
		36,
		64,
		96,
		112,
		40,
		72,
		108,
		130,
		48,
		88,
		132,
		156,
		60,
		110,
		160,
		192,
		72,
		130,
		192,
		224,
		80,
		150,
		224,
		264,
		96,
		176,
		260,
		308,
		104,
		198,
		288,
		352,
		120,
		216,
		320,
		384,
		132,
		240,
		360,
		432,
		144,
		280,
		408,
		480,
		168,
		308,
		448,
		532,
		180,
		338,
		504,
		588,
		196,
		364,
		546,
		650,
		224,
		416,
		600,
		700,
		224,
		442,
		644,
		750,
		252,
		476,
		690,
		816,
		270,
		504,
		750,
		900,
		300,
		560,
		810,
		960,
		312,
		588,
		870,
		1050,
		336,
		644,
		952,
		1110,
		360,
		700,
		1020,
		1200,
		390,
		728,
		1050,
		1260,
		420,
		784,
		1140,
		1350,
		450,
		812,
		1200,
		1440,
		480,
		868,
		1290,
		1530,
		510,
		924,
		1350,
		1620,
		540,
		980,
		1440,
		1710,
		570,
		1036,
		1530,
		1800,
		570,
		1064,
		1590,
		1890,
		600,
		1120,
		1680,
		1980,
		630,
		1204,
		1770,
		2100,
		660,
		1260,
		1860,
		2220,
		720,
		1316,
		1950,
		2310,
		750,
		1372,
		2040,
		2430
	];
	/**
	* Returns the number of error correction block that the QR Code should contain
	* for the specified version and error correction level.
	*
	* @param  {Number} version              QR Code version
	* @param  {Number} errorCorrectionLevel Error correction level
	* @return {Number}                      Number of error correction blocks
	*/
	exports.getBlocksCount = function getBlocksCount(version, errorCorrectionLevel) {
		switch (errorCorrectionLevel) {
			case ECLevel.L: return EC_BLOCKS_TABLE[(version - 1) * 4 + 0];
			case ECLevel.M: return EC_BLOCKS_TABLE[(version - 1) * 4 + 1];
			case ECLevel.Q: return EC_BLOCKS_TABLE[(version - 1) * 4 + 2];
			case ECLevel.H: return EC_BLOCKS_TABLE[(version - 1) * 4 + 3];
			default: return;
		}
	};
	/**
	* Returns the number of error correction codewords to use for the specified
	* version and error correction level.
	*
	* @param  {Number} version              QR Code version
	* @param  {Number} errorCorrectionLevel Error correction level
	* @return {Number}                      Number of error correction codewords
	*/
	exports.getTotalCodewordsCount = function getTotalCodewordsCount(version, errorCorrectionLevel) {
		switch (errorCorrectionLevel) {
			case ECLevel.L: return EC_CODEWORDS_TABLE[(version - 1) * 4 + 0];
			case ECLevel.M: return EC_CODEWORDS_TABLE[(version - 1) * 4 + 1];
			case ECLevel.Q: return EC_CODEWORDS_TABLE[(version - 1) * 4 + 2];
			case ECLevel.H: return EC_CODEWORDS_TABLE[(version - 1) * 4 + 3];
			default: return;
		}
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/galois-field.js
var require_galois_field = /* @__PURE__ */ __commonJSMin(((exports) => {
	const EXP_TABLE = /* @__PURE__ */ new Uint8Array(512);
	const LOG_TABLE = /* @__PURE__ */ new Uint8Array(256);
	(function initTables() {
		let x = 1;
		for (let i = 0; i < 255; i++) {
			EXP_TABLE[i] = x;
			LOG_TABLE[x] = i;
			x <<= 1;
			if (x & 256) x ^= 285;
		}
		for (let i = 255; i < 512; i++) EXP_TABLE[i] = EXP_TABLE[i - 255];
	})();
	/**
	* Returns log value of n inside Galois Field
	*
	* @param  {Number} n
	* @return {Number}
	*/
	exports.log = function log(n) {
		if (n < 1) throw new Error("log(" + n + ")");
		return LOG_TABLE[n];
	};
	/**
	* Returns anti-log value of n inside Galois Field
	*
	* @param  {Number} n
	* @return {Number}
	*/
	exports.exp = function exp(n) {
		return EXP_TABLE[n];
	};
	/**
	* Multiplies two number inside Galois Field
	*
	* @param  {Number} x
	* @param  {Number} y
	* @return {Number}
	*/
	exports.mul = function mul(x, y) {
		if (x === 0 || y === 0) return 0;
		return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/polynomial.js
var require_polynomial = /* @__PURE__ */ __commonJSMin(((exports) => {
	const GF = require_galois_field();
	/**
	* Multiplies two polynomials inside Galois Field
	*
	* @param  {Uint8Array} p1 Polynomial
	* @param  {Uint8Array} p2 Polynomial
	* @return {Uint8Array}    Product of p1 and p2
	*/
	exports.mul = function mul(p1, p2) {
		const coeff = new Uint8Array(p1.length + p2.length - 1);
		for (let i = 0; i < p1.length; i++) for (let j = 0; j < p2.length; j++) coeff[i + j] ^= GF.mul(p1[i], p2[j]);
		return coeff;
	};
	/**
	* Calculate the remainder of polynomials division
	*
	* @param  {Uint8Array} divident Polynomial
	* @param  {Uint8Array} divisor  Polynomial
	* @return {Uint8Array}          Remainder
	*/
	exports.mod = function mod(divident, divisor) {
		let result = new Uint8Array(divident);
		while (result.length - divisor.length >= 0) {
			const coeff = result[0];
			for (let i = 0; i < divisor.length; i++) result[i] ^= GF.mul(divisor[i], coeff);
			let offset = 0;
			while (offset < result.length && result[offset] === 0) offset++;
			result = result.slice(offset);
		}
		return result;
	};
	/**
	* Generate an irreducible generator polynomial of specified degree
	* (used by Reed-Solomon encoder)
	*
	* @param  {Number} degree Degree of the generator polynomial
	* @return {Uint8Array}    Buffer containing polynomial coefficients
	*/
	exports.generateECPolynomial = function generateECPolynomial(degree) {
		let poly = new Uint8Array([1]);
		for (let i = 0; i < degree; i++) poly = exports.mul(poly, new Uint8Array([1, GF.exp(i)]));
		return poly;
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/reed-solomon-encoder.js
var require_reed_solomon_encoder = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Polynomial = require_polynomial();
	function ReedSolomonEncoder(degree) {
		this.genPoly = void 0;
		this.degree = degree;
		if (this.degree) this.initialize(this.degree);
	}
	/**
	* Initialize the encoder.
	* The input param should correspond to the number of error correction codewords.
	*
	* @param  {Number} degree
	*/
	ReedSolomonEncoder.prototype.initialize = function initialize(degree) {
		this.degree = degree;
		this.genPoly = Polynomial.generateECPolynomial(this.degree);
	};
	/**
	* Encodes a chunk of data
	*
	* @param  {Uint8Array} data Buffer containing input data
	* @return {Uint8Array}      Buffer containing encoded data
	*/
	ReedSolomonEncoder.prototype.encode = function encode(data) {
		if (!this.genPoly) throw new Error("Encoder not initialized");
		const paddedData = new Uint8Array(data.length + this.degree);
		paddedData.set(data);
		const remainder = Polynomial.mod(paddedData, this.genPoly);
		const start = this.degree - remainder.length;
		if (start > 0) {
			const buff = new Uint8Array(this.degree);
			buff.set(remainder, start);
			return buff;
		}
		return remainder;
	};
	module.exports = ReedSolomonEncoder;
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/version-check.js
var require_version_check = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Check if QR Code version is valid
	*
	* @param  {Number}  version QR Code version
	* @return {Boolean}         true if valid version, false otherwise
	*/
	exports.isValid = function isValid(version) {
		return !isNaN(version) && version >= 1 && version <= 40;
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/regex.js
var require_regex = /* @__PURE__ */ __commonJSMin(((exports) => {
	const numeric = "[0-9]+";
	const alphanumeric = "[A-Z $%*+\\-./:]+";
	let kanji = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
	kanji = kanji.replace(/u/g, "\\u");
	const byte = "(?:(?![A-Z0-9 $%*+\\-./:]|" + kanji + ")(?:.|[\r\n]))+";
	exports.KANJI = new RegExp(kanji, "g");
	exports.BYTE_KANJI = /* @__PURE__ */ new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
	exports.BYTE = new RegExp(byte, "g");
	exports.NUMERIC = new RegExp(numeric, "g");
	exports.ALPHANUMERIC = new RegExp(alphanumeric, "g");
	const TEST_KANJI = new RegExp("^" + kanji + "$");
	const TEST_NUMERIC = /* @__PURE__ */ new RegExp("^[0-9]+$");
	const TEST_ALPHANUMERIC = /* @__PURE__ */ new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
	exports.testKanji = function testKanji(str) {
		return TEST_KANJI.test(str);
	};
	exports.testNumeric = function testNumeric(str) {
		return TEST_NUMERIC.test(str);
	};
	exports.testAlphanumeric = function testAlphanumeric(str) {
		return TEST_ALPHANUMERIC.test(str);
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/mode.js
var require_mode = /* @__PURE__ */ __commonJSMin(((exports) => {
	const VersionCheck = require_version_check();
	const Regex = require_regex();
	/**
	* Numeric mode encodes data from the decimal digit set (0 - 9)
	* (byte values 30HEX to 39HEX).
	* Normally, 3 data characters are represented by 10 bits.
	*
	* @type {Object}
	*/
	exports.NUMERIC = {
		id: "Numeric",
		bit: 1,
		ccBits: [
			10,
			12,
			14
		]
	};
	/**
	* Alphanumeric mode encodes data from a set of 45 characters,
	* i.e. 10 numeric digits (0 - 9),
	*      26 alphabetic characters (A - Z),
	*   and 9 symbols (SP, $, %, *, +, -, ., /, :).
	* Normally, two input characters are represented by 11 bits.
	*
	* @type {Object}
	*/
	exports.ALPHANUMERIC = {
		id: "Alphanumeric",
		bit: 2,
		ccBits: [
			9,
			11,
			13
		]
	};
	/**
	* In byte mode, data is encoded at 8 bits per character.
	*
	* @type {Object}
	*/
	exports.BYTE = {
		id: "Byte",
		bit: 4,
		ccBits: [
			8,
			16,
			16
		]
	};
	/**
	* The Kanji mode efficiently encodes Kanji characters in accordance with
	* the Shift JIS system based on JIS X 0208.
	* The Shift JIS values are shifted from the JIS X 0208 values.
	* JIS X 0208 gives details of the shift coded representation.
	* Each two-byte character value is compacted to a 13-bit binary codeword.
	*
	* @type {Object}
	*/
	exports.KANJI = {
		id: "Kanji",
		bit: 8,
		ccBits: [
			8,
			10,
			12
		]
	};
	/**
	* Mixed mode will contain a sequences of data in a combination of any of
	* the modes described above
	*
	* @type {Object}
	*/
	exports.MIXED = { bit: -1 };
	/**
	* Returns the number of bits needed to store the data length
	* according to QR Code specifications.
	*
	* @param  {Mode}   mode    Data mode
	* @param  {Number} version QR Code version
	* @return {Number}         Number of bits
	*/
	exports.getCharCountIndicator = function getCharCountIndicator(mode, version) {
		if (!mode.ccBits) throw new Error("Invalid mode: " + mode);
		if (!VersionCheck.isValid(version)) throw new Error("Invalid version: " + version);
		if (version >= 1 && version < 10) return mode.ccBits[0];
		else if (version < 27) return mode.ccBits[1];
		return mode.ccBits[2];
	};
	/**
	* Returns the most efficient mode to store the specified data
	*
	* @param  {String} dataStr Input data string
	* @return {Mode}           Best mode
	*/
	exports.getBestModeForData = function getBestModeForData(dataStr) {
		if (Regex.testNumeric(dataStr)) return exports.NUMERIC;
		else if (Regex.testAlphanumeric(dataStr)) return exports.ALPHANUMERIC;
		else if (Regex.testKanji(dataStr)) return exports.KANJI;
		else return exports.BYTE;
	};
	/**
	* Return mode name as string
	*
	* @param {Mode} mode Mode object
	* @returns {String}  Mode name
	*/
	exports.toString = function toString(mode) {
		if (mode && mode.id) return mode.id;
		throw new Error("Invalid mode");
	};
	/**
	* Check if input param is a valid mode object
	*
	* @param   {Mode}    mode Mode object
	* @returns {Boolean} True if valid mode, false otherwise
	*/
	exports.isValid = function isValid(mode) {
		return mode && mode.bit && mode.ccBits;
	};
	/**
	* Get mode object from its name
	*
	* @param   {String} string Mode name
	* @returns {Mode}          Mode object
	*/
	function fromString(string) {
		if (typeof string !== "string") throw new Error("Param is not a string");
		switch (string.toLowerCase()) {
			case "numeric": return exports.NUMERIC;
			case "alphanumeric": return exports.ALPHANUMERIC;
			case "kanji": return exports.KANJI;
			case "byte": return exports.BYTE;
			default: throw new Error("Unknown mode: " + string);
		}
	}
	/**
	* Returns mode from a value.
	* If value is not a valid mode, returns defaultValue
	*
	* @param  {Mode|String} value        Encoding mode
	* @param  {Mode}        defaultValue Fallback value
	* @return {Mode}                     Encoding mode
	*/
	exports.from = function from(value, defaultValue) {
		if (exports.isValid(value)) return value;
		try {
			return fromString(value);
		} catch (e) {
			return defaultValue;
		}
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/version.js
var require_version = /* @__PURE__ */ __commonJSMin(((exports) => {
	const Utils = require_utils$1();
	const ECCode = require_error_correction_code();
	const ECLevel = require_error_correction_level();
	const Mode = require_mode();
	const VersionCheck = require_version_check();
	const G18 = 7973;
	const G18_BCH = Utils.getBCHDigit(G18);
	function getBestVersionForDataLength(mode, length, errorCorrectionLevel) {
		for (let currentVersion = 1; currentVersion <= 40; currentVersion++) if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, mode)) return currentVersion;
	}
	function getReservedBitsCount(mode, version) {
		return Mode.getCharCountIndicator(mode, version) + 4;
	}
	function getTotalBitsFromDataArray(segments, version) {
		let totalBits = 0;
		segments.forEach(function(data) {
			const reservedBits = getReservedBitsCount(data.mode, version);
			totalBits += reservedBits + data.getBitsLength();
		});
		return totalBits;
	}
	function getBestVersionForMixedData(segments, errorCorrectionLevel) {
		for (let currentVersion = 1; currentVersion <= 40; currentVersion++) if (getTotalBitsFromDataArray(segments, currentVersion) <= exports.getCapacity(currentVersion, errorCorrectionLevel, Mode.MIXED)) return currentVersion;
	}
	/**
	* Returns version number from a value.
	* If value is not a valid version, returns defaultValue
	*
	* @param  {Number|String} value        QR Code version
	* @param  {Number}        defaultValue Fallback value
	* @return {Number}                     QR Code version number
	*/
	exports.from = function from(value, defaultValue) {
		if (VersionCheck.isValid(value)) return parseInt(value, 10);
		return defaultValue;
	};
	/**
	* Returns how much data can be stored with the specified QR code version
	* and error correction level
	*
	* @param  {Number} version              QR Code version (1-40)
	* @param  {Number} errorCorrectionLevel Error correction level
	* @param  {Mode}   mode                 Data mode
	* @return {Number}                      Quantity of storable data
	*/
	exports.getCapacity = function getCapacity(version, errorCorrectionLevel, mode) {
		if (!VersionCheck.isValid(version)) throw new Error("Invalid QR Code version");
		if (typeof mode === "undefined") mode = Mode.BYTE;
		const dataTotalCodewordsBits = (Utils.getSymbolTotalCodewords(version) - ECCode.getTotalCodewordsCount(version, errorCorrectionLevel)) * 8;
		if (mode === Mode.MIXED) return dataTotalCodewordsBits;
		const usableBits = dataTotalCodewordsBits - getReservedBitsCount(mode, version);
		switch (mode) {
			case Mode.NUMERIC: return Math.floor(usableBits / 10 * 3);
			case Mode.ALPHANUMERIC: return Math.floor(usableBits / 11 * 2);
			case Mode.KANJI: return Math.floor(usableBits / 13);
			case Mode.BYTE:
			default: return Math.floor(usableBits / 8);
		}
	};
	/**
	* Returns the minimum version needed to contain the amount of data
	*
	* @param  {Segment} data                    Segment of data
	* @param  {Number} [errorCorrectionLevel=H] Error correction level
	* @param  {Mode} mode                       Data mode
	* @return {Number}                          QR Code version
	*/
	exports.getBestVersionForData = function getBestVersionForData(data, errorCorrectionLevel) {
		let seg;
		const ecl = ECLevel.from(errorCorrectionLevel, ECLevel.M);
		if (Array.isArray(data)) {
			if (data.length > 1) return getBestVersionForMixedData(data, ecl);
			if (data.length === 0) return 1;
			seg = data[0];
		} else seg = data;
		return getBestVersionForDataLength(seg.mode, seg.getLength(), ecl);
	};
	/**
	* Returns version information with relative error correction bits
	*
	* The version information is included in QR Code symbols of version 7 or larger.
	* It consists of an 18-bit sequence containing 6 data bits,
	* with 12 error correction bits calculated using the (18, 6) Golay code.
	*
	* @param  {Number} version QR Code version
	* @return {Number}         Encoded version info bits
	*/
	exports.getEncodedBits = function getEncodedBits(version) {
		if (!VersionCheck.isValid(version) || version < 7) throw new Error("Invalid QR Code version");
		let d = version << 12;
		while (Utils.getBCHDigit(d) - G18_BCH >= 0) d ^= G18 << Utils.getBCHDigit(d) - G18_BCH;
		return version << 12 | d;
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/format-info.js
var require_format_info = /* @__PURE__ */ __commonJSMin(((exports) => {
	const Utils = require_utils$1();
	const G15 = 1335;
	const G15_MASK = 21522;
	const G15_BCH = Utils.getBCHDigit(G15);
	/**
	* Returns format information with relative error correction bits
	*
	* The format information is a 15-bit sequence containing 5 data bits,
	* with 10 error correction bits calculated using the (15, 5) BCH code.
	*
	* @param  {Number} errorCorrectionLevel Error correction level
	* @param  {Number} mask                 Mask pattern
	* @return {Number}                      Encoded format information bits
	*/
	exports.getEncodedBits = function getEncodedBits(errorCorrectionLevel, mask) {
		const data = errorCorrectionLevel.bit << 3 | mask;
		let d = data << 10;
		while (Utils.getBCHDigit(d) - G15_BCH >= 0) d ^= G15 << Utils.getBCHDigit(d) - G15_BCH;
		return (data << 10 | d) ^ G15_MASK;
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/numeric-data.js
var require_numeric_data = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Mode = require_mode();
	function NumericData(data) {
		this.mode = Mode.NUMERIC;
		this.data = data.toString();
	}
	NumericData.getBitsLength = function getBitsLength(length) {
		return 10 * Math.floor(length / 3) + (length % 3 ? length % 3 * 3 + 1 : 0);
	};
	NumericData.prototype.getLength = function getLength() {
		return this.data.length;
	};
	NumericData.prototype.getBitsLength = function getBitsLength() {
		return NumericData.getBitsLength(this.data.length);
	};
	NumericData.prototype.write = function write(bitBuffer) {
		let i, group, value;
		for (i = 0; i + 3 <= this.data.length; i += 3) {
			group = this.data.substr(i, 3);
			value = parseInt(group, 10);
			bitBuffer.put(value, 10);
		}
		const remainingNum = this.data.length - i;
		if (remainingNum > 0) {
			group = this.data.substr(i);
			value = parseInt(group, 10);
			bitBuffer.put(value, remainingNum * 3 + 1);
		}
	};
	module.exports = NumericData;
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/alphanumeric-data.js
var require_alphanumeric_data = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Mode = require_mode();
	/**
	* Array of characters available in alphanumeric mode
	*
	* As per QR Code specification, to each character
	* is assigned a value from 0 to 44 which in this case coincides
	* with the array index
	*
	* @type {Array}
	*/
	const ALPHA_NUM_CHARS = [
		"0",
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		"A",
		"B",
		"C",
		"D",
		"E",
		"F",
		"G",
		"H",
		"I",
		"J",
		"K",
		"L",
		"M",
		"N",
		"O",
		"P",
		"Q",
		"R",
		"S",
		"T",
		"U",
		"V",
		"W",
		"X",
		"Y",
		"Z",
		" ",
		"$",
		"%",
		"*",
		"+",
		"-",
		".",
		"/",
		":"
	];
	function AlphanumericData(data) {
		this.mode = Mode.ALPHANUMERIC;
		this.data = data;
	}
	AlphanumericData.getBitsLength = function getBitsLength(length) {
		return 11 * Math.floor(length / 2) + 6 * (length % 2);
	};
	AlphanumericData.prototype.getLength = function getLength() {
		return this.data.length;
	};
	AlphanumericData.prototype.getBitsLength = function getBitsLength() {
		return AlphanumericData.getBitsLength(this.data.length);
	};
	AlphanumericData.prototype.write = function write(bitBuffer) {
		let i;
		for (i = 0; i + 2 <= this.data.length; i += 2) {
			let value = ALPHA_NUM_CHARS.indexOf(this.data[i]) * 45;
			value += ALPHA_NUM_CHARS.indexOf(this.data[i + 1]);
			bitBuffer.put(value, 11);
		}
		if (this.data.length % 2) bitBuffer.put(ALPHA_NUM_CHARS.indexOf(this.data[i]), 6);
	};
	module.exports = AlphanumericData;
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/byte-data.js
var require_byte_data = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Mode = require_mode();
	function ByteData(data) {
		this.mode = Mode.BYTE;
		if (typeof data === "string") this.data = new TextEncoder().encode(data);
		else this.data = new Uint8Array(data);
	}
	ByteData.getBitsLength = function getBitsLength(length) {
		return length * 8;
	};
	ByteData.prototype.getLength = function getLength() {
		return this.data.length;
	};
	ByteData.prototype.getBitsLength = function getBitsLength() {
		return ByteData.getBitsLength(this.data.length);
	};
	ByteData.prototype.write = function(bitBuffer) {
		for (let i = 0, l = this.data.length; i < l; i++) bitBuffer.put(this.data[i], 8);
	};
	module.exports = ByteData;
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/kanji-data.js
var require_kanji_data = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Mode = require_mode();
	const Utils = require_utils$1();
	function KanjiData(data) {
		this.mode = Mode.KANJI;
		this.data = data;
	}
	KanjiData.getBitsLength = function getBitsLength(length) {
		return length * 13;
	};
	KanjiData.prototype.getLength = function getLength() {
		return this.data.length;
	};
	KanjiData.prototype.getBitsLength = function getBitsLength() {
		return KanjiData.getBitsLength(this.data.length);
	};
	KanjiData.prototype.write = function(bitBuffer) {
		let i;
		for (i = 0; i < this.data.length; i++) {
			let value = Utils.toSJIS(this.data[i]);
			if (value >= 33088 && value <= 40956) value -= 33088;
			else if (value >= 57408 && value <= 60351) value -= 49472;
			else throw new Error("Invalid SJIS character: " + this.data[i] + "\nMake sure your charset is UTF-8");
			value = (value >>> 8 & 255) * 192 + (value & 255);
			bitBuffer.put(value, 13);
		}
	};
	module.exports = KanjiData;
}));
//#endregion
//#region node_modules/.pnpm/dijkstrajs@1.0.3/node_modules/dijkstrajs/dijkstra.js
var require_dijkstra = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/******************************************************************************
	* Created 2008-08-19.
	*
	* Dijkstra path-finding functions. Adapted from the Dijkstar Python project.
	*
	* Copyright (C) 2008
	*   Wyatt Baldwin <self@wyattbaldwin.com>
	*   All rights reserved
	*
	* Licensed under the MIT license.
	*
	*   http://www.opensource.org/licenses/mit-license.php
	*
	* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	* THE SOFTWARE.
	*****************************************************************************/
	var dijkstra = {
		single_source_shortest_paths: function(graph, s, d) {
			var predecessors = {};
			var costs = {};
			costs[s] = 0;
			var open = dijkstra.PriorityQueue.make();
			open.push(s, 0);
			var closest, u, v, cost_of_s_to_u, adjacent_nodes, cost_of_e, cost_of_s_to_u_plus_cost_of_e, cost_of_s_to_v, first_visit;
			while (!open.empty()) {
				closest = open.pop();
				u = closest.value;
				cost_of_s_to_u = closest.cost;
				adjacent_nodes = graph[u] || {};
				for (v in adjacent_nodes) if (adjacent_nodes.hasOwnProperty(v)) {
					cost_of_e = adjacent_nodes[v];
					cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;
					cost_of_s_to_v = costs[v];
					first_visit = typeof costs[v] === "undefined";
					if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
						costs[v] = cost_of_s_to_u_plus_cost_of_e;
						open.push(v, cost_of_s_to_u_plus_cost_of_e);
						predecessors[v] = u;
					}
				}
			}
			if (typeof d !== "undefined" && typeof costs[d] === "undefined") {
				var msg = [
					"Could not find a path from ",
					s,
					" to ",
					d,
					"."
				].join("");
				throw new Error(msg);
			}
			return predecessors;
		},
		extract_shortest_path_from_predecessor_list: function(predecessors, d) {
			var nodes = [];
			var u = d;
			while (u) {
				nodes.push(u);
				predecessors[u];
				u = predecessors[u];
			}
			nodes.reverse();
			return nodes;
		},
		find_path: function(graph, s, d) {
			var predecessors = dijkstra.single_source_shortest_paths(graph, s, d);
			return dijkstra.extract_shortest_path_from_predecessor_list(predecessors, d);
		},
		/**
		* A very naive priority queue implementation.
		*/
		PriorityQueue: {
			make: function(opts) {
				var T = dijkstra.PriorityQueue, t = {}, key;
				opts = opts || {};
				for (key in T) if (T.hasOwnProperty(key)) t[key] = T[key];
				t.queue = [];
				t.sorter = opts.sorter || T.default_sorter;
				return t;
			},
			default_sorter: function(a, b) {
				return a.cost - b.cost;
			},
			/**
			* Add a new item to the queue and ensure the highest priority element
			* is at the front of the queue.
			*/
			push: function(value, cost) {
				var item = {
					value,
					cost
				};
				this.queue.push(item);
				this.queue.sort(this.sorter);
			},
			/**
			* Return the highest priority element in the queue.
			*/
			pop: function() {
				return this.queue.shift();
			},
			empty: function() {
				return this.queue.length === 0;
			}
		}
	};
	if (typeof module !== "undefined") module.exports = dijkstra;
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/segments.js
var require_segments = /* @__PURE__ */ __commonJSMin(((exports) => {
	const Mode = require_mode();
	const NumericData = require_numeric_data();
	const AlphanumericData = require_alphanumeric_data();
	const ByteData = require_byte_data();
	const KanjiData = require_kanji_data();
	const Regex = require_regex();
	const Utils = require_utils$1();
	const dijkstra = require_dijkstra();
	/**
	* Returns UTF8 byte length
	*
	* @param  {String} str Input string
	* @return {Number}     Number of byte
	*/
	function getStringByteLength(str) {
		return unescape(encodeURIComponent(str)).length;
	}
	/**
	* Get a list of segments of the specified mode
	* from a string
	*
	* @param  {Mode}   mode Segment mode
	* @param  {String} str  String to process
	* @return {Array}       Array of object with segments data
	*/
	function getSegments(regex, mode, str) {
		const segments = [];
		let result;
		while ((result = regex.exec(str)) !== null) segments.push({
			data: result[0],
			index: result.index,
			mode,
			length: result[0].length
		});
		return segments;
	}
	/**
	* Extracts a series of segments with the appropriate
	* modes from a string
	*
	* @param  {String} dataStr Input string
	* @return {Array}          Array of object with segments data
	*/
	function getSegmentsFromString(dataStr) {
		const numSegs = getSegments(Regex.NUMERIC, Mode.NUMERIC, dataStr);
		const alphaNumSegs = getSegments(Regex.ALPHANUMERIC, Mode.ALPHANUMERIC, dataStr);
		let byteSegs;
		let kanjiSegs;
		if (Utils.isKanjiModeEnabled()) {
			byteSegs = getSegments(Regex.BYTE, Mode.BYTE, dataStr);
			kanjiSegs = getSegments(Regex.KANJI, Mode.KANJI, dataStr);
		} else {
			byteSegs = getSegments(Regex.BYTE_KANJI, Mode.BYTE, dataStr);
			kanjiSegs = [];
		}
		return numSegs.concat(alphaNumSegs, byteSegs, kanjiSegs).sort(function(s1, s2) {
			return s1.index - s2.index;
		}).map(function(obj) {
			return {
				data: obj.data,
				mode: obj.mode,
				length: obj.length
			};
		});
	}
	/**
	* Returns how many bits are needed to encode a string of
	* specified length with the specified mode
	*
	* @param  {Number} length String length
	* @param  {Mode} mode     Segment mode
	* @return {Number}        Bit length
	*/
	function getSegmentBitsLength(length, mode) {
		switch (mode) {
			case Mode.NUMERIC: return NumericData.getBitsLength(length);
			case Mode.ALPHANUMERIC: return AlphanumericData.getBitsLength(length);
			case Mode.KANJI: return KanjiData.getBitsLength(length);
			case Mode.BYTE: return ByteData.getBitsLength(length);
		}
	}
	/**
	* Merges adjacent segments which have the same mode
	*
	* @param  {Array} segs Array of object with segments data
	* @return {Array}      Array of object with segments data
	*/
	function mergeSegments(segs) {
		return segs.reduce(function(acc, curr) {
			const prevSeg = acc.length - 1 >= 0 ? acc[acc.length - 1] : null;
			if (prevSeg && prevSeg.mode === curr.mode) {
				acc[acc.length - 1].data += curr.data;
				return acc;
			}
			acc.push(curr);
			return acc;
		}, []);
	}
	/**
	* Generates a list of all possible nodes combination which
	* will be used to build a segments graph.
	*
	* Nodes are divided by groups. Each group will contain a list of all the modes
	* in which is possible to encode the given text.
	*
	* For example the text '12345' can be encoded as Numeric, Alphanumeric or Byte.
	* The group for '12345' will contain then 3 objects, one for each
	* possible encoding mode.
	*
	* Each node represents a possible segment.
	*
	* @param  {Array} segs Array of object with segments data
	* @return {Array}      Array of object with segments data
	*/
	function buildNodes(segs) {
		const nodes = [];
		for (let i = 0; i < segs.length; i++) {
			const seg = segs[i];
			switch (seg.mode) {
				case Mode.NUMERIC:
					nodes.push([
						seg,
						{
							data: seg.data,
							mode: Mode.ALPHANUMERIC,
							length: seg.length
						},
						{
							data: seg.data,
							mode: Mode.BYTE,
							length: seg.length
						}
					]);
					break;
				case Mode.ALPHANUMERIC:
					nodes.push([seg, {
						data: seg.data,
						mode: Mode.BYTE,
						length: seg.length
					}]);
					break;
				case Mode.KANJI:
					nodes.push([seg, {
						data: seg.data,
						mode: Mode.BYTE,
						length: getStringByteLength(seg.data)
					}]);
					break;
				case Mode.BYTE: nodes.push([{
					data: seg.data,
					mode: Mode.BYTE,
					length: getStringByteLength(seg.data)
				}]);
			}
		}
		return nodes;
	}
	/**
	* Builds a graph from a list of nodes.
	* All segments in each node group will be connected with all the segments of
	* the next group and so on.
	*
	* At each connection will be assigned a weight depending on the
	* segment's byte length.
	*
	* @param  {Array} nodes    Array of object with segments data
	* @param  {Number} version QR Code version
	* @return {Object}         Graph of all possible segments
	*/
	function buildGraph(nodes, version) {
		const table = {};
		const graph = { start: {} };
		let prevNodeIds = ["start"];
		for (let i = 0; i < nodes.length; i++) {
			const nodeGroup = nodes[i];
			const currentNodeIds = [];
			for (let j = 0; j < nodeGroup.length; j++) {
				const node = nodeGroup[j];
				const key = "" + i + j;
				currentNodeIds.push(key);
				table[key] = {
					node,
					lastCount: 0
				};
				graph[key] = {};
				for (let n = 0; n < prevNodeIds.length; n++) {
					const prevNodeId = prevNodeIds[n];
					if (table[prevNodeId] && table[prevNodeId].node.mode === node.mode) {
						graph[prevNodeId][key] = getSegmentBitsLength(table[prevNodeId].lastCount + node.length, node.mode) - getSegmentBitsLength(table[prevNodeId].lastCount, node.mode);
						table[prevNodeId].lastCount += node.length;
					} else {
						if (table[prevNodeId]) table[prevNodeId].lastCount = node.length;
						graph[prevNodeId][key] = getSegmentBitsLength(node.length, node.mode) + 4 + Mode.getCharCountIndicator(node.mode, version);
					}
				}
			}
			prevNodeIds = currentNodeIds;
		}
		for (let n = 0; n < prevNodeIds.length; n++) graph[prevNodeIds[n]].end = 0;
		return {
			map: graph,
			table
		};
	}
	/**
	* Builds a segment from a specified data and mode.
	* If a mode is not specified, the more suitable will be used.
	*
	* @param  {String} data             Input data
	* @param  {Mode | String} modesHint Data mode
	* @return {Segment}                 Segment
	*/
	function buildSingleSegment(data, modesHint) {
		let mode;
		const bestMode = Mode.getBestModeForData(data);
		mode = Mode.from(modesHint, bestMode);
		if (mode !== Mode.BYTE && mode.bit < bestMode.bit) throw new Error("\"" + data + "\" cannot be encoded with mode " + Mode.toString(mode) + ".\n Suggested mode is: " + Mode.toString(bestMode));
		if (mode === Mode.KANJI && !Utils.isKanjiModeEnabled()) mode = Mode.BYTE;
		switch (mode) {
			case Mode.NUMERIC: return new NumericData(data);
			case Mode.ALPHANUMERIC: return new AlphanumericData(data);
			case Mode.KANJI: return new KanjiData(data);
			case Mode.BYTE: return new ByteData(data);
		}
	}
	/**
	* Builds a list of segments from an array.
	* Array can contain Strings or Objects with segment's info.
	*
	* For each item which is a string, will be generated a segment with the given
	* string and the more appropriate encoding mode.
	*
	* For each item which is an object, will be generated a segment with the given
	* data and mode.
	* Objects must contain at least the property "data".
	* If property "mode" is not present, the more suitable mode will be used.
	*
	* @param  {Array} array Array of objects with segments data
	* @return {Array}       Array of Segments
	*/
	exports.fromArray = function fromArray(array) {
		return array.reduce(function(acc, seg) {
			if (typeof seg === "string") acc.push(buildSingleSegment(seg, null));
			else if (seg.data) acc.push(buildSingleSegment(seg.data, seg.mode));
			return acc;
		}, []);
	};
	/**
	* Builds an optimized sequence of segments from a string,
	* which will produce the shortest possible bitstream.
	*
	* @param  {String} data    Input string
	* @param  {Number} version QR Code version
	* @return {Array}          Array of segments
	*/
	exports.fromString = function fromString(data, version) {
		const graph = buildGraph(buildNodes(getSegmentsFromString(data, Utils.isKanjiModeEnabled())), version);
		const path = dijkstra.find_path(graph.map, "start", "end");
		const optimizedSegs = [];
		for (let i = 1; i < path.length - 1; i++) optimizedSegs.push(graph.table[path[i]].node);
		return exports.fromArray(mergeSegments(optimizedSegs));
	};
	/**
	* Splits a string in various segments with the modes which
	* best represent their content.
	* The produced segments are far from being optimized.
	* The output of this function is only used to estimate a QR Code version
	* which may contain the data.
	*
	* @param  {string} data Input string
	* @return {Array}       Array of segments
	*/
	exports.rawSplit = function rawSplit(data) {
		return exports.fromArray(getSegmentsFromString(data, Utils.isKanjiModeEnabled()));
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/qrcode.js
var require_qrcode = /* @__PURE__ */ __commonJSMin(((exports) => {
	const Utils = require_utils$1();
	const ECLevel = require_error_correction_level();
	const BitBuffer = require_bit_buffer();
	const BitMatrix = require_bit_matrix();
	const AlignmentPattern = require_alignment_pattern();
	const FinderPattern = require_finder_pattern();
	const MaskPattern = require_mask_pattern();
	const ECCode = require_error_correction_code();
	const ReedSolomonEncoder = require_reed_solomon_encoder();
	const Version = require_version();
	const FormatInfo = require_format_info();
	const Mode = require_mode();
	const Segments = require_segments();
	/**
	* QRCode for JavaScript
	*
	* modified by Ryan Day for nodejs support
	* Copyright (c) 2011 Ryan Day
	*
	* Licensed under the MIT license:
	*   http://www.opensource.org/licenses/mit-license.php
	*
	//---------------------------------------------------------------------
	// QRCode for JavaScript
	//
	// Copyright (c) 2009 Kazuhiko Arase
	//
	// URL: http://www.d-project.com/
	//
	// Licensed under the MIT license:
	//   http://www.opensource.org/licenses/mit-license.php
	//
	// The word "QR Code" is registered trademark of
	// DENSO WAVE INCORPORATED
	//   http://www.denso-wave.com/qrcode/faqpatent-e.html
	//
	//---------------------------------------------------------------------
	*/
	/**
	* Add finder patterns bits to matrix
	*
	* @param  {BitMatrix} matrix  Modules matrix
	* @param  {Number}    version QR Code version
	*/
	function setupFinderPattern(matrix, version) {
		const size = matrix.size;
		const pos = FinderPattern.getPositions(version);
		for (let i = 0; i < pos.length; i++) {
			const row = pos[i][0];
			const col = pos[i][1];
			for (let r = -1; r <= 7; r++) {
				if (row + r <= -1 || size <= row + r) continue;
				for (let c = -1; c <= 7; c++) {
					if (col + c <= -1 || size <= col + c) continue;
					if (r >= 0 && r <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (r === 0 || r === 6) || r >= 2 && r <= 4 && c >= 2 && c <= 4) matrix.set(row + r, col + c, true, true);
					else matrix.set(row + r, col + c, false, true);
				}
			}
		}
	}
	/**
	* Add timing pattern bits to matrix
	*
	* Note: this function must be called before {@link setupAlignmentPattern}
	*
	* @param  {BitMatrix} matrix Modules matrix
	*/
	function setupTimingPattern(matrix) {
		const size = matrix.size;
		for (let r = 8; r < size - 8; r++) {
			const value = r % 2 === 0;
			matrix.set(r, 6, value, true);
			matrix.set(6, r, value, true);
		}
	}
	/**
	* Add alignment patterns bits to matrix
	*
	* Note: this function must be called after {@link setupTimingPattern}
	*
	* @param  {BitMatrix} matrix  Modules matrix
	* @param  {Number}    version QR Code version
	*/
	function setupAlignmentPattern(matrix, version) {
		const pos = AlignmentPattern.getPositions(version);
		for (let i = 0; i < pos.length; i++) {
			const row = pos[i][0];
			const col = pos[i][1];
			for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) if (r === -2 || r === 2 || c === -2 || c === 2 || r === 0 && c === 0) matrix.set(row + r, col + c, true, true);
			else matrix.set(row + r, col + c, false, true);
		}
	}
	/**
	* Add version info bits to matrix
	*
	* @param  {BitMatrix} matrix  Modules matrix
	* @param  {Number}    version QR Code version
	*/
	function setupVersionInfo(matrix, version) {
		const size = matrix.size;
		const bits = Version.getEncodedBits(version);
		let row, col, mod;
		for (let i = 0; i < 18; i++) {
			row = Math.floor(i / 3);
			col = i % 3 + size - 8 - 3;
			mod = (bits >> i & 1) === 1;
			matrix.set(row, col, mod, true);
			matrix.set(col, row, mod, true);
		}
	}
	/**
	* Add format info bits to matrix
	*
	* @param  {BitMatrix} matrix               Modules matrix
	* @param  {ErrorCorrectionLevel}    errorCorrectionLevel Error correction level
	* @param  {Number}    maskPattern          Mask pattern reference value
	*/
	function setupFormatInfo(matrix, errorCorrectionLevel, maskPattern) {
		const size = matrix.size;
		const bits = FormatInfo.getEncodedBits(errorCorrectionLevel, maskPattern);
		let i, mod;
		for (i = 0; i < 15; i++) {
			mod = (bits >> i & 1) === 1;
			if (i < 6) matrix.set(i, 8, mod, true);
			else if (i < 8) matrix.set(i + 1, 8, mod, true);
			else matrix.set(size - 15 + i, 8, mod, true);
			if (i < 8) matrix.set(8, size - i - 1, mod, true);
			else if (i < 9) matrix.set(8, 15 - i - 1 + 1, mod, true);
			else matrix.set(8, 15 - i - 1, mod, true);
		}
		matrix.set(size - 8, 8, 1, true);
	}
	/**
	* Add encoded data bits to matrix
	*
	* @param  {BitMatrix}  matrix Modules matrix
	* @param  {Uint8Array} data   Data codewords
	*/
	function setupData(matrix, data) {
		const size = matrix.size;
		let inc = -1;
		let row = size - 1;
		let bitIndex = 7;
		let byteIndex = 0;
		for (let col = size - 1; col > 0; col -= 2) {
			if (col === 6) col--;
			while (true) {
				for (let c = 0; c < 2; c++) if (!matrix.isReserved(row, col - c)) {
					let dark = false;
					if (byteIndex < data.length) dark = (data[byteIndex] >>> bitIndex & 1) === 1;
					matrix.set(row, col - c, dark);
					bitIndex--;
					if (bitIndex === -1) {
						byteIndex++;
						bitIndex = 7;
					}
				}
				row += inc;
				if (row < 0 || size <= row) {
					row -= inc;
					inc = -inc;
					break;
				}
			}
		}
	}
	/**
	* Create encoded codewords from data input
	*
	* @param  {Number}   version              QR Code version
	* @param  {ErrorCorrectionLevel}   errorCorrectionLevel Error correction level
	* @param  {ByteData} data                 Data input
	* @return {Uint8Array}                    Buffer containing encoded codewords
	*/
	function createData(version, errorCorrectionLevel, segments) {
		const buffer = new BitBuffer();
		segments.forEach(function(data) {
			buffer.put(data.mode.bit, 4);
			buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version));
			data.write(buffer);
		});
		const dataTotalCodewordsBits = (Utils.getSymbolTotalCodewords(version) - ECCode.getTotalCodewordsCount(version, errorCorrectionLevel)) * 8;
		if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) buffer.put(0, 4);
		while (buffer.getLengthInBits() % 8 !== 0) buffer.putBit(0);
		const remainingByte = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
		for (let i = 0; i < remainingByte; i++) buffer.put(i % 2 ? 17 : 236, 8);
		return createCodewords(buffer, version, errorCorrectionLevel);
	}
	/**
	* Encode input data with Reed-Solomon and return codewords with
	* relative error correction bits
	*
	* @param  {BitBuffer} bitBuffer            Data to encode
	* @param  {Number}    version              QR Code version
	* @param  {ErrorCorrectionLevel} errorCorrectionLevel Error correction level
	* @return {Uint8Array}                     Buffer containing encoded codewords
	*/
	function createCodewords(bitBuffer, version, errorCorrectionLevel) {
		const totalCodewords = Utils.getSymbolTotalCodewords(version);
		const dataTotalCodewords = totalCodewords - ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
		const ecTotalBlocks = ECCode.getBlocksCount(version, errorCorrectionLevel);
		const blocksInGroup1 = ecTotalBlocks - totalCodewords % ecTotalBlocks;
		const totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);
		const dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
		const dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;
		const ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;
		const rs = new ReedSolomonEncoder(ecCount);
		let offset = 0;
		const dcData = new Array(ecTotalBlocks);
		const ecData = new Array(ecTotalBlocks);
		let maxDataSize = 0;
		const buffer = new Uint8Array(bitBuffer.buffer);
		for (let b = 0; b < ecTotalBlocks; b++) {
			const dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;
			dcData[b] = buffer.slice(offset, offset + dataSize);
			ecData[b] = rs.encode(dcData[b]);
			offset += dataSize;
			maxDataSize = Math.max(maxDataSize, dataSize);
		}
		const data = new Uint8Array(totalCodewords);
		let index = 0;
		let i, r;
		for (i = 0; i < maxDataSize; i++) for (r = 0; r < ecTotalBlocks; r++) if (i < dcData[r].length) data[index++] = dcData[r][i];
		for (i = 0; i < ecCount; i++) for (r = 0; r < ecTotalBlocks; r++) data[index++] = ecData[r][i];
		return data;
	}
	/**
	* Build QR Code symbol
	*
	* @param  {String} data                 Input string
	* @param  {Number} version              QR Code version
	* @param  {ErrorCorretionLevel} errorCorrectionLevel Error level
	* @param  {MaskPattern} maskPattern     Mask pattern
	* @return {Object}                      Object containing symbol data
	*/
	function createSymbol(data, version, errorCorrectionLevel, maskPattern) {
		let segments;
		if (Array.isArray(data)) segments = Segments.fromArray(data);
		else if (typeof data === "string") {
			let estimatedVersion = version;
			if (!estimatedVersion) {
				const rawSegments = Segments.rawSplit(data);
				estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel);
			}
			segments = Segments.fromString(data, estimatedVersion || 40);
		} else throw new Error("Invalid data");
		const bestVersion = Version.getBestVersionForData(segments, errorCorrectionLevel);
		if (!bestVersion) throw new Error("The amount of data is too big to be stored in a QR Code");
		if (!version) version = bestVersion;
		else if (version < bestVersion) throw new Error("\nThe chosen QR Code version cannot contain this amount of data.\nMinimum version required to store current data is: " + bestVersion + ".\n");
		const dataBits = createData(version, errorCorrectionLevel, segments);
		const moduleCount = Utils.getSymbolSize(version);
		const modules = new BitMatrix(moduleCount);
		setupFinderPattern(modules, version);
		setupTimingPattern(modules);
		setupAlignmentPattern(modules, version);
		setupFormatInfo(modules, errorCorrectionLevel, 0);
		if (version >= 7) setupVersionInfo(modules, version);
		setupData(modules, dataBits);
		if (isNaN(maskPattern)) maskPattern = MaskPattern.getBestMask(modules, setupFormatInfo.bind(null, modules, errorCorrectionLevel));
		MaskPattern.applyMask(maskPattern, modules);
		setupFormatInfo(modules, errorCorrectionLevel, maskPattern);
		return {
			modules,
			version,
			errorCorrectionLevel,
			maskPattern,
			segments
		};
	}
	/**
	* QR Code
	*
	* @param {String | Array} data                 Input data
	* @param {Object} options                      Optional configurations
	* @param {Number} options.version              QR Code version
	* @param {String} options.errorCorrectionLevel Error correction level
	* @param {Function} options.toSJISFunc         Helper func to convert utf8 to sjis
	*/
	exports.create = function create(data, options) {
		if (typeof data === "undefined" || data === "") throw new Error("No input text");
		let errorCorrectionLevel = ECLevel.M;
		let version;
		let mask;
		if (typeof options !== "undefined") {
			errorCorrectionLevel = ECLevel.from(options.errorCorrectionLevel, ECLevel.M);
			version = Version.from(options.version);
			mask = MaskPattern.from(options.maskPattern);
			if (options.toSJISFunc) Utils.setToSJISFunction(options.toSJISFunc);
		}
		return createSymbol(data, version, errorCorrectionLevel, mask);
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/chunkstream.js
var require_chunkstream = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let util$5 = __require("util");
	let Stream$2 = __require("stream");
	let ChunkStream = module.exports = function() {
		Stream$2.call(this);
		this._buffers = [];
		this._buffered = 0;
		this._reads = [];
		this._paused = false;
		this._encoding = "utf8";
		this.writable = true;
	};
	util$5.inherits(ChunkStream, Stream$2);
	ChunkStream.prototype.read = function(length, callback) {
		this._reads.push({
			length: Math.abs(length),
			allowLess: length < 0,
			func: callback
		});
		process.nextTick(function() {
			this._process();
			if (this._paused && this._reads && this._reads.length > 0) {
				this._paused = false;
				this.emit("drain");
			}
		}.bind(this));
	};
	ChunkStream.prototype.write = function(data, encoding) {
		if (!this.writable) {
			this.emit("error", /* @__PURE__ */ new Error("Stream not writable"));
			return false;
		}
		let dataBuffer;
		if (Buffer.isBuffer(data)) dataBuffer = data;
		else dataBuffer = Buffer.from(data, encoding || this._encoding);
		this._buffers.push(dataBuffer);
		this._buffered += dataBuffer.length;
		this._process();
		if (this._reads && this._reads.length === 0) this._paused = true;
		return this.writable && !this._paused;
	};
	ChunkStream.prototype.end = function(data, encoding) {
		if (data) this.write(data, encoding);
		this.writable = false;
		if (!this._buffers) return;
		if (this._buffers.length === 0) this._end();
		else {
			this._buffers.push(null);
			this._process();
		}
	};
	ChunkStream.prototype.destroySoon = ChunkStream.prototype.end;
	ChunkStream.prototype._end = function() {
		if (this._reads.length > 0) this.emit("error", /* @__PURE__ */ new Error("Unexpected end of input"));
		this.destroy();
	};
	ChunkStream.prototype.destroy = function() {
		if (!this._buffers) return;
		this.writable = false;
		this._reads = null;
		this._buffers = null;
		this.emit("close");
	};
	ChunkStream.prototype._processReadAllowingLess = function(read) {
		this._reads.shift();
		let smallerBuf = this._buffers[0];
		if (smallerBuf.length > read.length) {
			this._buffered -= read.length;
			this._buffers[0] = smallerBuf.slice(read.length);
			read.func.call(this, smallerBuf.slice(0, read.length));
		} else {
			this._buffered -= smallerBuf.length;
			this._buffers.shift();
			read.func.call(this, smallerBuf);
		}
	};
	ChunkStream.prototype._processRead = function(read) {
		this._reads.shift();
		let pos = 0;
		let count = 0;
		let data = Buffer.alloc(read.length);
		while (pos < read.length) {
			let buf = this._buffers[count++];
			let len = Math.min(buf.length, read.length - pos);
			buf.copy(data, pos, 0, len);
			pos += len;
			if (len !== buf.length) this._buffers[--count] = buf.slice(len);
		}
		if (count > 0) this._buffers.splice(0, count);
		this._buffered -= read.length;
		read.func.call(this, data);
	};
	ChunkStream.prototype._process = function() {
		try {
			while (this._buffered > 0 && this._reads && this._reads.length > 0) {
				let read = this._reads[0];
				if (read.allowLess) this._processReadAllowingLess(read);
				else if (this._buffered >= read.length) this._processRead(read);
				else break;
			}
			if (this._buffers && !this.writable) this._end();
		} catch (ex) {
			this.emit("error", ex);
		}
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/interlace.js
var require_interlace = /* @__PURE__ */ __commonJSMin(((exports) => {
	let imagePasses = [
		{
			x: [0],
			y: [0]
		},
		{
			x: [4],
			y: [0]
		},
		{
			x: [0, 4],
			y: [4]
		},
		{
			x: [2, 6],
			y: [0, 4]
		},
		{
			x: [
				0,
				2,
				4,
				6
			],
			y: [2, 6]
		},
		{
			x: [
				1,
				3,
				5,
				7
			],
			y: [
				0,
				2,
				4,
				6
			]
		},
		{
			x: [
				0,
				1,
				2,
				3,
				4,
				5,
				6,
				7
			],
			y: [
				1,
				3,
				5,
				7
			]
		}
	];
	exports.getImagePasses = function(width, height) {
		let images = [];
		let xLeftOver = width % 8;
		let yLeftOver = height % 8;
		let xRepeats = (width - xLeftOver) / 8;
		let yRepeats = (height - yLeftOver) / 8;
		for (let i = 0; i < imagePasses.length; i++) {
			let pass = imagePasses[i];
			let passWidth = xRepeats * pass.x.length;
			let passHeight = yRepeats * pass.y.length;
			for (let j = 0; j < pass.x.length; j++) if (pass.x[j] < xLeftOver) passWidth++;
			else break;
			for (let j = 0; j < pass.y.length; j++) if (pass.y[j] < yLeftOver) passHeight++;
			else break;
			if (passWidth > 0 && passHeight > 0) images.push({
				width: passWidth,
				height: passHeight,
				index: i
			});
		}
		return images;
	};
	exports.getInterlaceIterator = function(width) {
		return function(x, y, pass) {
			let outerXLeftOver = x % imagePasses[pass].x.length;
			let outerX = (x - outerXLeftOver) / imagePasses[pass].x.length * 8 + imagePasses[pass].x[outerXLeftOver];
			let outerYLeftOver = y % imagePasses[pass].y.length;
			let outerY = (y - outerYLeftOver) / imagePasses[pass].y.length * 8 + imagePasses[pass].y[outerYLeftOver];
			return outerX * 4 + outerY * width * 4;
		};
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/paeth-predictor.js
var require_paeth_predictor = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function paethPredictor(left, above, upLeft) {
		let paeth = left + above - upLeft;
		let pLeft = Math.abs(paeth - left);
		let pAbove = Math.abs(paeth - above);
		let pUpLeft = Math.abs(paeth - upLeft);
		if (pLeft <= pAbove && pLeft <= pUpLeft) return left;
		if (pAbove <= pUpLeft) return above;
		return upLeft;
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/filter-parse.js
var require_filter_parse = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let interlaceUtils = require_interlace();
	let paethPredictor = require_paeth_predictor();
	function getByteWidth(width, bpp, depth) {
		let byteWidth = width * bpp;
		if (depth !== 8) byteWidth = Math.ceil(byteWidth / (8 / depth));
		return byteWidth;
	}
	let Filter = module.exports = function(bitmapInfo, dependencies) {
		let width = bitmapInfo.width;
		let height = bitmapInfo.height;
		let interlace = bitmapInfo.interlace;
		let bpp = bitmapInfo.bpp;
		let depth = bitmapInfo.depth;
		this.read = dependencies.read;
		this.write = dependencies.write;
		this.complete = dependencies.complete;
		this._imageIndex = 0;
		this._images = [];
		if (interlace) {
			let passes = interlaceUtils.getImagePasses(width, height);
			for (let i = 0; i < passes.length; i++) this._images.push({
				byteWidth: getByteWidth(passes[i].width, bpp, depth),
				height: passes[i].height,
				lineIndex: 0
			});
		} else this._images.push({
			byteWidth: getByteWidth(width, bpp, depth),
			height,
			lineIndex: 0
		});
		if (depth === 8) this._xComparison = bpp;
		else if (depth === 16) this._xComparison = bpp * 2;
		else this._xComparison = 1;
	};
	Filter.prototype.start = function() {
		this.read(this._images[this._imageIndex].byteWidth + 1, this._reverseFilterLine.bind(this));
	};
	Filter.prototype._unFilterType1 = function(rawData, unfilteredLine, byteWidth) {
		let xComparison = this._xComparison;
		let xBiggerThan = xComparison - 1;
		for (let x = 0; x < byteWidth; x++) {
			let rawByte = rawData[1 + x];
			let f1Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
			unfilteredLine[x] = rawByte + f1Left;
		}
	};
	Filter.prototype._unFilterType2 = function(rawData, unfilteredLine, byteWidth) {
		let lastLine = this._lastLine;
		for (let x = 0; x < byteWidth; x++) {
			let rawByte = rawData[1 + x];
			let f2Up = lastLine ? lastLine[x] : 0;
			unfilteredLine[x] = rawByte + f2Up;
		}
	};
	Filter.prototype._unFilterType3 = function(rawData, unfilteredLine, byteWidth) {
		let xComparison = this._xComparison;
		let xBiggerThan = xComparison - 1;
		let lastLine = this._lastLine;
		for (let x = 0; x < byteWidth; x++) {
			let rawByte = rawData[1 + x];
			let f3Up = lastLine ? lastLine[x] : 0;
			let f3Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
			let f3Add = Math.floor((f3Left + f3Up) / 2);
			unfilteredLine[x] = rawByte + f3Add;
		}
	};
	Filter.prototype._unFilterType4 = function(rawData, unfilteredLine, byteWidth) {
		let xComparison = this._xComparison;
		let xBiggerThan = xComparison - 1;
		let lastLine = this._lastLine;
		for (let x = 0; x < byteWidth; x++) {
			let rawByte = rawData[1 + x];
			let f4Up = lastLine ? lastLine[x] : 0;
			let f4Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
			let f4UpLeft = x > xBiggerThan && lastLine ? lastLine[x - xComparison] : 0;
			let f4Add = paethPredictor(f4Left, f4Up, f4UpLeft);
			unfilteredLine[x] = rawByte + f4Add;
		}
	};
	Filter.prototype._reverseFilterLine = function(rawData) {
		let filter = rawData[0];
		let unfilteredLine;
		let currentImage = this._images[this._imageIndex];
		let byteWidth = currentImage.byteWidth;
		if (filter === 0) unfilteredLine = rawData.slice(1, byteWidth + 1);
		else {
			unfilteredLine = Buffer.alloc(byteWidth);
			switch (filter) {
				case 1:
					this._unFilterType1(rawData, unfilteredLine, byteWidth);
					break;
				case 2:
					this._unFilterType2(rawData, unfilteredLine, byteWidth);
					break;
				case 3:
					this._unFilterType3(rawData, unfilteredLine, byteWidth);
					break;
				case 4:
					this._unFilterType4(rawData, unfilteredLine, byteWidth);
					break;
				default: throw new Error("Unrecognised filter type - " + filter);
			}
		}
		this.write(unfilteredLine);
		currentImage.lineIndex++;
		if (currentImage.lineIndex >= currentImage.height) {
			this._lastLine = null;
			this._imageIndex++;
			currentImage = this._images[this._imageIndex];
		} else this._lastLine = unfilteredLine;
		if (currentImage) this.read(currentImage.byteWidth + 1, this._reverseFilterLine.bind(this));
		else {
			this._lastLine = null;
			this.complete();
		}
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/filter-parse-async.js
var require_filter_parse_async = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let util$4 = __require("util");
	let ChunkStream = require_chunkstream();
	let Filter = require_filter_parse();
	let FilterAsync = module.exports = function(bitmapInfo) {
		ChunkStream.call(this);
		let buffers = [];
		let that = this;
		this._filter = new Filter(bitmapInfo, {
			read: this.read.bind(this),
			write: function(buffer) {
				buffers.push(buffer);
			},
			complete: function() {
				that.emit("complete", Buffer.concat(buffers));
			}
		});
		this._filter.start();
	};
	util$4.inherits(FilterAsync, ChunkStream);
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/constants.js
var require_constants = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = {
		PNG_SIGNATURE: [
			137,
			80,
			78,
			71,
			13,
			10,
			26,
			10
		],
		TYPE_IHDR: 1229472850,
		TYPE_IEND: 1229278788,
		TYPE_IDAT: 1229209940,
		TYPE_PLTE: 1347179589,
		TYPE_tRNS: 1951551059,
		TYPE_gAMA: 1732332865,
		COLORTYPE_GRAYSCALE: 0,
		COLORTYPE_PALETTE: 1,
		COLORTYPE_COLOR: 2,
		COLORTYPE_ALPHA: 4,
		COLORTYPE_PALETTE_COLOR: 3,
		COLORTYPE_COLOR_ALPHA: 6,
		COLORTYPE_TO_BPP_MAP: {
			0: 1,
			2: 3,
			3: 1,
			4: 2,
			6: 4
		},
		GAMMA_DIVISION: 1e5
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/crc.js
var require_crc = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let crcTable = [];
	(function() {
		for (let i = 0; i < 256; i++) {
			let currentCrc = i;
			for (let j = 0; j < 8; j++) if (currentCrc & 1) currentCrc = 3988292384 ^ currentCrc >>> 1;
			else currentCrc = currentCrc >>> 1;
			crcTable[i] = currentCrc;
		}
	})();
	let CrcCalculator = module.exports = function() {
		this._crc = -1;
	};
	CrcCalculator.prototype.write = function(data) {
		for (let i = 0; i < data.length; i++) this._crc = crcTable[(this._crc ^ data[i]) & 255] ^ this._crc >>> 8;
		return true;
	};
	CrcCalculator.prototype.crc32 = function() {
		return this._crc ^ -1;
	};
	CrcCalculator.crc32 = function(buf) {
		let crc = -1;
		for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 255] ^ crc >>> 8;
		return crc ^ -1;
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/parser.js
var require_parser = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let constants = require_constants();
	let CrcCalculator = require_crc();
	let Parser = module.exports = function(options, dependencies) {
		this._options = options;
		options.checkCRC = options.checkCRC !== false;
		this._hasIHDR = false;
		this._hasIEND = false;
		this._emittedHeadersFinished = false;
		this._palette = [];
		this._colorType = 0;
		this._chunks = {};
		this._chunks[constants.TYPE_IHDR] = this._handleIHDR.bind(this);
		this._chunks[constants.TYPE_IEND] = this._handleIEND.bind(this);
		this._chunks[constants.TYPE_IDAT] = this._handleIDAT.bind(this);
		this._chunks[constants.TYPE_PLTE] = this._handlePLTE.bind(this);
		this._chunks[constants.TYPE_tRNS] = this._handleTRNS.bind(this);
		this._chunks[constants.TYPE_gAMA] = this._handleGAMA.bind(this);
		this.read = dependencies.read;
		this.error = dependencies.error;
		this.metadata = dependencies.metadata;
		this.gamma = dependencies.gamma;
		this.transColor = dependencies.transColor;
		this.palette = dependencies.palette;
		this.parsed = dependencies.parsed;
		this.inflateData = dependencies.inflateData;
		this.finished = dependencies.finished;
		this.simpleTransparency = dependencies.simpleTransparency;
		this.headersFinished = dependencies.headersFinished || function() {};
	};
	Parser.prototype.start = function() {
		this.read(constants.PNG_SIGNATURE.length, this._parseSignature.bind(this));
	};
	Parser.prototype._parseSignature = function(data) {
		let signature = constants.PNG_SIGNATURE;
		for (let i = 0; i < signature.length; i++) if (data[i] !== signature[i]) {
			this.error(/* @__PURE__ */ new Error("Invalid file signature"));
			return;
		}
		this.read(8, this._parseChunkBegin.bind(this));
	};
	Parser.prototype._parseChunkBegin = function(data) {
		let length = data.readUInt32BE(0);
		let type = data.readUInt32BE(4);
		let name = "";
		for (let i = 4; i < 8; i++) name += String.fromCharCode(data[i]);
		let ancillary = Boolean(data[4] & 32);
		if (!this._hasIHDR && type !== constants.TYPE_IHDR) {
			this.error(/* @__PURE__ */ new Error("Expected IHDR on beggining"));
			return;
		}
		this._crc = new CrcCalculator();
		this._crc.write(Buffer.from(name));
		if (this._chunks[type]) return this._chunks[type](length);
		if (!ancillary) {
			this.error(/* @__PURE__ */ new Error("Unsupported critical chunk type " + name));
			return;
		}
		this.read(length + 4, this._skipChunk.bind(this));
	};
	Parser.prototype._skipChunk = function() {
		this.read(8, this._parseChunkBegin.bind(this));
	};
	Parser.prototype._handleChunkEnd = function() {
		this.read(4, this._parseChunkEnd.bind(this));
	};
	Parser.prototype._parseChunkEnd = function(data) {
		let fileCrc = data.readInt32BE(0);
		let calcCrc = this._crc.crc32();
		if (this._options.checkCRC && calcCrc !== fileCrc) {
			this.error(/* @__PURE__ */ new Error("Crc error - " + fileCrc + " - " + calcCrc));
			return;
		}
		if (!this._hasIEND) this.read(8, this._parseChunkBegin.bind(this));
	};
	Parser.prototype._handleIHDR = function(length) {
		this.read(length, this._parseIHDR.bind(this));
	};
	Parser.prototype._parseIHDR = function(data) {
		this._crc.write(data);
		let width = data.readUInt32BE(0);
		let height = data.readUInt32BE(4);
		let depth = data[8];
		let colorType = data[9];
		let compr = data[10];
		let filter = data[11];
		let interlace = data[12];
		if (depth !== 8 && depth !== 4 && depth !== 2 && depth !== 1 && depth !== 16) {
			this.error(/* @__PURE__ */ new Error("Unsupported bit depth " + depth));
			return;
		}
		if (!(colorType in constants.COLORTYPE_TO_BPP_MAP)) {
			this.error(/* @__PURE__ */ new Error("Unsupported color type"));
			return;
		}
		if (compr !== 0) {
			this.error(/* @__PURE__ */ new Error("Unsupported compression method"));
			return;
		}
		if (filter !== 0) {
			this.error(/* @__PURE__ */ new Error("Unsupported filter method"));
			return;
		}
		if (interlace !== 0 && interlace !== 1) {
			this.error(/* @__PURE__ */ new Error("Unsupported interlace method"));
			return;
		}
		this._colorType = colorType;
		let bpp = constants.COLORTYPE_TO_BPP_MAP[this._colorType];
		this._hasIHDR = true;
		this.metadata({
			width,
			height,
			depth,
			interlace: Boolean(interlace),
			palette: Boolean(colorType & constants.COLORTYPE_PALETTE),
			color: Boolean(colorType & constants.COLORTYPE_COLOR),
			alpha: Boolean(colorType & constants.COLORTYPE_ALPHA),
			bpp,
			colorType
		});
		this._handleChunkEnd();
	};
	Parser.prototype._handlePLTE = function(length) {
		this.read(length, this._parsePLTE.bind(this));
	};
	Parser.prototype._parsePLTE = function(data) {
		this._crc.write(data);
		let entries = Math.floor(data.length / 3);
		for (let i = 0; i < entries; i++) this._palette.push([
			data[i * 3],
			data[i * 3 + 1],
			data[i * 3 + 2],
			255
		]);
		this.palette(this._palette);
		this._handleChunkEnd();
	};
	Parser.prototype._handleTRNS = function(length) {
		this.simpleTransparency();
		this.read(length, this._parseTRNS.bind(this));
	};
	Parser.prototype._parseTRNS = function(data) {
		this._crc.write(data);
		if (this._colorType === constants.COLORTYPE_PALETTE_COLOR) {
			if (this._palette.length === 0) {
				this.error(/* @__PURE__ */ new Error("Transparency chunk must be after palette"));
				return;
			}
			if (data.length > this._palette.length) {
				this.error(/* @__PURE__ */ new Error("More transparent colors than palette size"));
				return;
			}
			for (let i = 0; i < data.length; i++) this._palette[i][3] = data[i];
			this.palette(this._palette);
		}
		if (this._colorType === constants.COLORTYPE_GRAYSCALE) this.transColor([data.readUInt16BE(0)]);
		if (this._colorType === constants.COLORTYPE_COLOR) this.transColor([
			data.readUInt16BE(0),
			data.readUInt16BE(2),
			data.readUInt16BE(4)
		]);
		this._handleChunkEnd();
	};
	Parser.prototype._handleGAMA = function(length) {
		this.read(length, this._parseGAMA.bind(this));
	};
	Parser.prototype._parseGAMA = function(data) {
		this._crc.write(data);
		this.gamma(data.readUInt32BE(0) / constants.GAMMA_DIVISION);
		this._handleChunkEnd();
	};
	Parser.prototype._handleIDAT = function(length) {
		if (!this._emittedHeadersFinished) {
			this._emittedHeadersFinished = true;
			this.headersFinished();
		}
		this.read(-length, this._parseIDAT.bind(this, length));
	};
	Parser.prototype._parseIDAT = function(length, data) {
		this._crc.write(data);
		if (this._colorType === constants.COLORTYPE_PALETTE_COLOR && this._palette.length === 0) throw new Error("Expected palette not found");
		this.inflateData(data);
		let leftOverLength = length - data.length;
		if (leftOverLength > 0) this._handleIDAT(leftOverLength);
		else this._handleChunkEnd();
	};
	Parser.prototype._handleIEND = function(length) {
		this.read(length, this._parseIEND.bind(this));
	};
	Parser.prototype._parseIEND = function(data) {
		this._crc.write(data);
		this._hasIEND = true;
		this._handleChunkEnd();
		if (this.finished) this.finished();
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/bitmapper.js
var require_bitmapper = /* @__PURE__ */ __commonJSMin(((exports) => {
	let interlaceUtils = require_interlace();
	let pixelBppMapper = [
		function() {},
		function(pxData, data, pxPos, rawPos) {
			if (rawPos === data.length) throw new Error("Ran out of data");
			let pixel = data[rawPos];
			pxData[pxPos] = pixel;
			pxData[pxPos + 1] = pixel;
			pxData[pxPos + 2] = pixel;
			pxData[pxPos + 3] = 255;
		},
		function(pxData, data, pxPos, rawPos) {
			if (rawPos + 1 >= data.length) throw new Error("Ran out of data");
			let pixel = data[rawPos];
			pxData[pxPos] = pixel;
			pxData[pxPos + 1] = pixel;
			pxData[pxPos + 2] = pixel;
			pxData[pxPos + 3] = data[rawPos + 1];
		},
		function(pxData, data, pxPos, rawPos) {
			if (rawPos + 2 >= data.length) throw new Error("Ran out of data");
			pxData[pxPos] = data[rawPos];
			pxData[pxPos + 1] = data[rawPos + 1];
			pxData[pxPos + 2] = data[rawPos + 2];
			pxData[pxPos + 3] = 255;
		},
		function(pxData, data, pxPos, rawPos) {
			if (rawPos + 3 >= data.length) throw new Error("Ran out of data");
			pxData[pxPos] = data[rawPos];
			pxData[pxPos + 1] = data[rawPos + 1];
			pxData[pxPos + 2] = data[rawPos + 2];
			pxData[pxPos + 3] = data[rawPos + 3];
		}
	];
	let pixelBppCustomMapper = [
		function() {},
		function(pxData, pixelData, pxPos, maxBit) {
			let pixel = pixelData[0];
			pxData[pxPos] = pixel;
			pxData[pxPos + 1] = pixel;
			pxData[pxPos + 2] = pixel;
			pxData[pxPos + 3] = maxBit;
		},
		function(pxData, pixelData, pxPos) {
			let pixel = pixelData[0];
			pxData[pxPos] = pixel;
			pxData[pxPos + 1] = pixel;
			pxData[pxPos + 2] = pixel;
			pxData[pxPos + 3] = pixelData[1];
		},
		function(pxData, pixelData, pxPos, maxBit) {
			pxData[pxPos] = pixelData[0];
			pxData[pxPos + 1] = pixelData[1];
			pxData[pxPos + 2] = pixelData[2];
			pxData[pxPos + 3] = maxBit;
		},
		function(pxData, pixelData, pxPos) {
			pxData[pxPos] = pixelData[0];
			pxData[pxPos + 1] = pixelData[1];
			pxData[pxPos + 2] = pixelData[2];
			pxData[pxPos + 3] = pixelData[3];
		}
	];
	function bitRetriever(data, depth) {
		let leftOver = [];
		let i = 0;
		function split() {
			if (i === data.length) throw new Error("Ran out of data");
			let byte = data[i];
			i++;
			let byte8, byte7, byte6, byte5, byte4, byte3, byte2, byte1;
			switch (depth) {
				default: throw new Error("unrecognised depth");
				case 16:
					byte2 = data[i];
					i++;
					leftOver.push((byte << 8) + byte2);
					break;
				case 4:
					byte2 = byte & 15;
					byte1 = byte >> 4;
					leftOver.push(byte1, byte2);
					break;
				case 2:
					byte4 = byte & 3;
					byte3 = byte >> 2 & 3;
					byte2 = byte >> 4 & 3;
					byte1 = byte >> 6 & 3;
					leftOver.push(byte1, byte2, byte3, byte4);
					break;
				case 1:
					byte8 = byte & 1;
					byte7 = byte >> 1 & 1;
					byte6 = byte >> 2 & 1;
					byte5 = byte >> 3 & 1;
					byte4 = byte >> 4 & 1;
					byte3 = byte >> 5 & 1;
					byte2 = byte >> 6 & 1;
					byte1 = byte >> 7 & 1;
					leftOver.push(byte1, byte2, byte3, byte4, byte5, byte6, byte7, byte8);
			}
		}
		return {
			get: function(count) {
				while (leftOver.length < count) split();
				let returner = leftOver.slice(0, count);
				leftOver = leftOver.slice(count);
				return returner;
			},
			resetAfterLine: function() {
				leftOver.length = 0;
			},
			end: function() {
				if (i !== data.length) throw new Error("extra data found");
			}
		};
	}
	function mapImage8Bit(image, pxData, getPxPos, bpp, data, rawPos) {
		let imageWidth = image.width;
		let imageHeight = image.height;
		let imagePass = image.index;
		for (let y = 0; y < imageHeight; y++) for (let x = 0; x < imageWidth; x++) {
			let pxPos = getPxPos(x, y, imagePass);
			pixelBppMapper[bpp](pxData, data, pxPos, rawPos);
			rawPos += bpp;
		}
		return rawPos;
	}
	function mapImageCustomBit(image, pxData, getPxPos, bpp, bits, maxBit) {
		let imageWidth = image.width;
		let imageHeight = image.height;
		let imagePass = image.index;
		for (let y = 0; y < imageHeight; y++) {
			for (let x = 0; x < imageWidth; x++) {
				let pixelData = bits.get(bpp);
				let pxPos = getPxPos(x, y, imagePass);
				pixelBppCustomMapper[bpp](pxData, pixelData, pxPos, maxBit);
			}
			bits.resetAfterLine();
		}
	}
	exports.dataToBitMap = function(data, bitmapInfo) {
		let width = bitmapInfo.width;
		let height = bitmapInfo.height;
		let depth = bitmapInfo.depth;
		let bpp = bitmapInfo.bpp;
		let interlace = bitmapInfo.interlace;
		let bits;
		if (depth !== 8) bits = bitRetriever(data, depth);
		let pxData;
		if (depth <= 8) pxData = Buffer.alloc(width * height * 4);
		else pxData = new Uint16Array(width * height * 4);
		let maxBit = Math.pow(2, depth) - 1;
		let rawPos = 0;
		let images;
		let getPxPos;
		if (interlace) {
			images = interlaceUtils.getImagePasses(width, height);
			getPxPos = interlaceUtils.getInterlaceIterator(width, height);
		} else {
			let nonInterlacedPxPos = 0;
			getPxPos = function() {
				let returner = nonInterlacedPxPos;
				nonInterlacedPxPos += 4;
				return returner;
			};
			images = [{
				width,
				height
			}];
		}
		for (let imageIndex = 0; imageIndex < images.length; imageIndex++) if (depth === 8) rawPos = mapImage8Bit(images[imageIndex], pxData, getPxPos, bpp, data, rawPos);
		else mapImageCustomBit(images[imageIndex], pxData, getPxPos, bpp, bits, maxBit);
		if (depth === 8) {
			if (rawPos !== data.length) throw new Error("extra data found");
		} else bits.end();
		return pxData;
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/format-normaliser.js
var require_format_normaliser = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function dePalette(indata, outdata, width, height, palette) {
		let pxPos = 0;
		for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
			let color = palette[indata[pxPos]];
			if (!color) throw new Error("index " + indata[pxPos] + " not in palette");
			for (let i = 0; i < 4; i++) outdata[pxPos + i] = color[i];
			pxPos += 4;
		}
	}
	function replaceTransparentColor(indata, outdata, width, height, transColor) {
		let pxPos = 0;
		for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
			let makeTrans = false;
			if (transColor.length === 1) {
				if (transColor[0] === indata[pxPos]) makeTrans = true;
			} else if (transColor[0] === indata[pxPos] && transColor[1] === indata[pxPos + 1] && transColor[2] === indata[pxPos + 2]) makeTrans = true;
			if (makeTrans) for (let i = 0; i < 4; i++) outdata[pxPos + i] = 0;
			pxPos += 4;
		}
	}
	function scaleDepth(indata, outdata, width, height, depth) {
		let maxOutSample = 255;
		let maxInSample = Math.pow(2, depth) - 1;
		let pxPos = 0;
		for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
			for (let i = 0; i < 4; i++) outdata[pxPos + i] = Math.floor(indata[pxPos + i] * maxOutSample / maxInSample + .5);
			pxPos += 4;
		}
	}
	module.exports = function(indata, imageData) {
		let depth = imageData.depth;
		let width = imageData.width;
		let height = imageData.height;
		let colorType = imageData.colorType;
		let transColor = imageData.transColor;
		let palette = imageData.palette;
		let outdata = indata;
		if (colorType === 3) dePalette(indata, outdata, width, height, palette);
		else {
			if (transColor) replaceTransparentColor(indata, outdata, width, height, transColor);
			if (depth !== 8) {
				if (depth === 16) outdata = Buffer.alloc(width * height * 4);
				scaleDepth(indata, outdata, width, height, depth);
			}
		}
		return outdata;
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/parser-async.js
var require_parser_async = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let util$3 = __require("util");
	let zlib$4 = __require("zlib");
	let ChunkStream = require_chunkstream();
	let FilterAsync = require_filter_parse_async();
	let Parser = require_parser();
	let bitmapper = require_bitmapper();
	let formatNormaliser = require_format_normaliser();
	let ParserAsync = module.exports = function(options) {
		ChunkStream.call(this);
		this._parser = new Parser(options, {
			read: this.read.bind(this),
			error: this._handleError.bind(this),
			metadata: this._handleMetaData.bind(this),
			gamma: this.emit.bind(this, "gamma"),
			palette: this._handlePalette.bind(this),
			transColor: this._handleTransColor.bind(this),
			finished: this._finished.bind(this),
			inflateData: this._inflateData.bind(this),
			simpleTransparency: this._simpleTransparency.bind(this),
			headersFinished: this._headersFinished.bind(this)
		});
		this._options = options;
		this.writable = true;
		this._parser.start();
	};
	util$3.inherits(ParserAsync, ChunkStream);
	ParserAsync.prototype._handleError = function(err) {
		this.emit("error", err);
		this.writable = false;
		this.destroy();
		if (this._inflate && this._inflate.destroy) this._inflate.destroy();
		if (this._filter) {
			this._filter.destroy();
			this._filter.on("error", function() {});
		}
		this.errord = true;
	};
	ParserAsync.prototype._inflateData = function(data) {
		if (!this._inflate) {
			if (this._bitmapInfo.interlace) {
				this._inflate = zlib$4.createInflate();
				this._inflate.on("error", this.emit.bind(this, "error"));
				this._filter.on("complete", this._complete.bind(this));
				this._inflate.pipe(this._filter);
			} else {
				let imageSize = ((this._bitmapInfo.width * this._bitmapInfo.bpp * this._bitmapInfo.depth + 7 >> 3) + 1) * this._bitmapInfo.height;
				let chunkSize = Math.max(imageSize, zlib$4.Z_MIN_CHUNK);
				this._inflate = zlib$4.createInflate({ chunkSize });
				let leftToInflate = imageSize;
				let emitError = this.emit.bind(this, "error");
				this._inflate.on("error", function(err) {
					if (!leftToInflate) return;
					emitError(err);
				});
				this._filter.on("complete", this._complete.bind(this));
				let filterWrite = this._filter.write.bind(this._filter);
				this._inflate.on("data", function(chunk) {
					if (!leftToInflate) return;
					if (chunk.length > leftToInflate) chunk = chunk.slice(0, leftToInflate);
					leftToInflate -= chunk.length;
					filterWrite(chunk);
				});
				this._inflate.on("end", this._filter.end.bind(this._filter));
			}
		}
		this._inflate.write(data);
	};
	ParserAsync.prototype._handleMetaData = function(metaData) {
		this._metaData = metaData;
		this._bitmapInfo = Object.create(metaData);
		this._filter = new FilterAsync(this._bitmapInfo);
	};
	ParserAsync.prototype._handleTransColor = function(transColor) {
		this._bitmapInfo.transColor = transColor;
	};
	ParserAsync.prototype._handlePalette = function(palette) {
		this._bitmapInfo.palette = palette;
	};
	ParserAsync.prototype._simpleTransparency = function() {
		this._metaData.alpha = true;
	};
	ParserAsync.prototype._headersFinished = function() {
		this.emit("metadata", this._metaData);
	};
	ParserAsync.prototype._finished = function() {
		if (this.errord) return;
		if (!this._inflate) this.emit("error", "No Inflate block");
		else this._inflate.end();
	};
	ParserAsync.prototype._complete = function(filteredData) {
		if (this.errord) return;
		let normalisedBitmapData;
		try {
			let bitmapData = bitmapper.dataToBitMap(filteredData, this._bitmapInfo);
			normalisedBitmapData = formatNormaliser(bitmapData, this._bitmapInfo);
			bitmapData = null;
		} catch (ex) {
			this._handleError(ex);
			return;
		}
		this.emit("parsed", normalisedBitmapData);
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/bitpacker.js
var require_bitpacker = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let constants = require_constants();
	module.exports = function(dataIn, width, height, options) {
		let outHasAlpha = [constants.COLORTYPE_COLOR_ALPHA, constants.COLORTYPE_ALPHA].indexOf(options.colorType) !== -1;
		if (options.colorType === options.inputColorType) {
			let bigEndian = (function() {
				let buffer = /* @__PURE__ */ new ArrayBuffer(2);
				new DataView(buffer).setInt16(0, 256, true);
				return new Int16Array(buffer)[0] !== 256;
			})();
			if (options.bitDepth === 8 || options.bitDepth === 16 && bigEndian) return dataIn;
		}
		let data = options.bitDepth !== 16 ? dataIn : new Uint16Array(dataIn.buffer);
		let maxValue = 255;
		let inBpp = constants.COLORTYPE_TO_BPP_MAP[options.inputColorType];
		if (inBpp === 4 && !options.inputHasAlpha) inBpp = 3;
		let outBpp = constants.COLORTYPE_TO_BPP_MAP[options.colorType];
		if (options.bitDepth === 16) {
			maxValue = 65535;
			outBpp *= 2;
		}
		let outData = Buffer.alloc(width * height * outBpp);
		let inIndex = 0;
		let outIndex = 0;
		let bgColor = options.bgColor || {};
		if (bgColor.red === void 0) bgColor.red = maxValue;
		if (bgColor.green === void 0) bgColor.green = maxValue;
		if (bgColor.blue === void 0) bgColor.blue = maxValue;
		function getRGBA() {
			let red;
			let green;
			let blue;
			let alpha = maxValue;
			switch (options.inputColorType) {
				case constants.COLORTYPE_COLOR_ALPHA:
					alpha = data[inIndex + 3];
					red = data[inIndex];
					green = data[inIndex + 1];
					blue = data[inIndex + 2];
					break;
				case constants.COLORTYPE_COLOR:
					red = data[inIndex];
					green = data[inIndex + 1];
					blue = data[inIndex + 2];
					break;
				case constants.COLORTYPE_ALPHA:
					alpha = data[inIndex + 1];
					red = data[inIndex];
					green = red;
					blue = red;
					break;
				case constants.COLORTYPE_GRAYSCALE:
					red = data[inIndex];
					green = red;
					blue = red;
					break;
				default: throw new Error("input color type:" + options.inputColorType + " is not supported at present");
			}
			if (options.inputHasAlpha) {
				if (!outHasAlpha) {
					alpha /= maxValue;
					red = Math.min(Math.max(Math.round((1 - alpha) * bgColor.red + alpha * red), 0), maxValue);
					green = Math.min(Math.max(Math.round((1 - alpha) * bgColor.green + alpha * green), 0), maxValue);
					blue = Math.min(Math.max(Math.round((1 - alpha) * bgColor.blue + alpha * blue), 0), maxValue);
				}
			}
			return {
				red,
				green,
				blue,
				alpha
			};
		}
		for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
			let rgba = getRGBA(data, inIndex);
			switch (options.colorType) {
				case constants.COLORTYPE_COLOR_ALPHA:
				case constants.COLORTYPE_COLOR:
					if (options.bitDepth === 8) {
						outData[outIndex] = rgba.red;
						outData[outIndex + 1] = rgba.green;
						outData[outIndex + 2] = rgba.blue;
						if (outHasAlpha) outData[outIndex + 3] = rgba.alpha;
					} else {
						outData.writeUInt16BE(rgba.red, outIndex);
						outData.writeUInt16BE(rgba.green, outIndex + 2);
						outData.writeUInt16BE(rgba.blue, outIndex + 4);
						if (outHasAlpha) outData.writeUInt16BE(rgba.alpha, outIndex + 6);
					}
					break;
				case constants.COLORTYPE_ALPHA:
				case constants.COLORTYPE_GRAYSCALE: {
					let grayscale = (rgba.red + rgba.green + rgba.blue) / 3;
					if (options.bitDepth === 8) {
						outData[outIndex] = grayscale;
						if (outHasAlpha) outData[outIndex + 1] = rgba.alpha;
					} else {
						outData.writeUInt16BE(grayscale, outIndex);
						if (outHasAlpha) outData.writeUInt16BE(rgba.alpha, outIndex + 2);
					}
					break;
				}
				default: throw new Error("unrecognised color Type " + options.colorType);
			}
			inIndex += inBpp;
			outIndex += outBpp;
		}
		return outData;
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/filter-pack.js
var require_filter_pack = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let paethPredictor = require_paeth_predictor();
	function filterNone(pxData, pxPos, byteWidth, rawData, rawPos) {
		for (let x = 0; x < byteWidth; x++) rawData[rawPos + x] = pxData[pxPos + x];
	}
	function filterSumNone(pxData, pxPos, byteWidth) {
		let sum = 0;
		let length = pxPos + byteWidth;
		for (let i = pxPos; i < length; i++) sum += Math.abs(pxData[i]);
		return sum;
	}
	function filterSub(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
		for (let x = 0; x < byteWidth; x++) {
			let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
			let val = pxData[pxPos + x] - left;
			rawData[rawPos + x] = val;
		}
	}
	function filterSumSub(pxData, pxPos, byteWidth, bpp) {
		let sum = 0;
		for (let x = 0; x < byteWidth; x++) {
			let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
			let val = pxData[pxPos + x] - left;
			sum += Math.abs(val);
		}
		return sum;
	}
	function filterUp(pxData, pxPos, byteWidth, rawData, rawPos) {
		for (let x = 0; x < byteWidth; x++) {
			let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
			let val = pxData[pxPos + x] - up;
			rawData[rawPos + x] = val;
		}
	}
	function filterSumUp(pxData, pxPos, byteWidth) {
		let sum = 0;
		let length = pxPos + byteWidth;
		for (let x = pxPos; x < length; x++) {
			let up = pxPos > 0 ? pxData[x - byteWidth] : 0;
			let val = pxData[x] - up;
			sum += Math.abs(val);
		}
		return sum;
	}
	function filterAvg(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
		for (let x = 0; x < byteWidth; x++) {
			let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
			let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
			let val = pxData[pxPos + x] - (left + up >> 1);
			rawData[rawPos + x] = val;
		}
	}
	function filterSumAvg(pxData, pxPos, byteWidth, bpp) {
		let sum = 0;
		for (let x = 0; x < byteWidth; x++) {
			let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
			let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
			let val = pxData[pxPos + x] - (left + up >> 1);
			sum += Math.abs(val);
		}
		return sum;
	}
	function filterPaeth(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
		for (let x = 0; x < byteWidth; x++) {
			let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
			let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
			let upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
			let val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
			rawData[rawPos + x] = val;
		}
	}
	function filterSumPaeth(pxData, pxPos, byteWidth, bpp) {
		let sum = 0;
		for (let x = 0; x < byteWidth; x++) {
			let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
			let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
			let upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
			let val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
			sum += Math.abs(val);
		}
		return sum;
	}
	let filters = {
		0: filterNone,
		1: filterSub,
		2: filterUp,
		3: filterAvg,
		4: filterPaeth
	};
	let filterSums = {
		0: filterSumNone,
		1: filterSumSub,
		2: filterSumUp,
		3: filterSumAvg,
		4: filterSumPaeth
	};
	module.exports = function(pxData, width, height, options, bpp) {
		let filterTypes;
		if (!("filterType" in options) || options.filterType === -1) filterTypes = [
			0,
			1,
			2,
			3,
			4
		];
		else if (typeof options.filterType === "number") filterTypes = [options.filterType];
		else throw new Error("unrecognised filter types");
		if (options.bitDepth === 16) bpp *= 2;
		let byteWidth = width * bpp;
		let rawPos = 0;
		let pxPos = 0;
		let rawData = Buffer.alloc((byteWidth + 1) * height);
		let sel = filterTypes[0];
		for (let y = 0; y < height; y++) {
			if (filterTypes.length > 1) {
				let min = Infinity;
				for (let i = 0; i < filterTypes.length; i++) {
					let sum = filterSums[filterTypes[i]](pxData, pxPos, byteWidth, bpp);
					if (sum < min) {
						sel = filterTypes[i];
						min = sum;
					}
				}
			}
			rawData[rawPos] = sel;
			rawPos++;
			filters[sel](pxData, pxPos, byteWidth, rawData, rawPos, bpp);
			rawPos += byteWidth;
			pxPos += byteWidth;
		}
		return rawData;
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/packer.js
var require_packer = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let constants = require_constants();
	let CrcStream = require_crc();
	let bitPacker = require_bitpacker();
	let filter = require_filter_pack();
	let zlib$3 = __require("zlib");
	let Packer = module.exports = function(options) {
		this._options = options;
		options.deflateChunkSize = options.deflateChunkSize || 32768;
		options.deflateLevel = options.deflateLevel != null ? options.deflateLevel : 9;
		options.deflateStrategy = options.deflateStrategy != null ? options.deflateStrategy : 3;
		options.inputHasAlpha = options.inputHasAlpha != null ? options.inputHasAlpha : true;
		options.deflateFactory = options.deflateFactory || zlib$3.createDeflate;
		options.bitDepth = options.bitDepth || 8;
		options.colorType = typeof options.colorType === "number" ? options.colorType : constants.COLORTYPE_COLOR_ALPHA;
		options.inputColorType = typeof options.inputColorType === "number" ? options.inputColorType : constants.COLORTYPE_COLOR_ALPHA;
		if ([
			constants.COLORTYPE_GRAYSCALE,
			constants.COLORTYPE_COLOR,
			constants.COLORTYPE_COLOR_ALPHA,
			constants.COLORTYPE_ALPHA
		].indexOf(options.colorType) === -1) throw new Error("option color type:" + options.colorType + " is not supported at present");
		if ([
			constants.COLORTYPE_GRAYSCALE,
			constants.COLORTYPE_COLOR,
			constants.COLORTYPE_COLOR_ALPHA,
			constants.COLORTYPE_ALPHA
		].indexOf(options.inputColorType) === -1) throw new Error("option input color type:" + options.inputColorType + " is not supported at present");
		if (options.bitDepth !== 8 && options.bitDepth !== 16) throw new Error("option bit depth:" + options.bitDepth + " is not supported at present");
	};
	Packer.prototype.getDeflateOptions = function() {
		return {
			chunkSize: this._options.deflateChunkSize,
			level: this._options.deflateLevel,
			strategy: this._options.deflateStrategy
		};
	};
	Packer.prototype.createDeflate = function() {
		return this._options.deflateFactory(this.getDeflateOptions());
	};
	Packer.prototype.filterData = function(data, width, height) {
		let packedData = bitPacker(data, width, height, this._options);
		let bpp = constants.COLORTYPE_TO_BPP_MAP[this._options.colorType];
		return filter(packedData, width, height, this._options, bpp);
	};
	Packer.prototype._packChunk = function(type, data) {
		let len = data ? data.length : 0;
		let buf = Buffer.alloc(len + 12);
		buf.writeUInt32BE(len, 0);
		buf.writeUInt32BE(type, 4);
		if (data) data.copy(buf, 8);
		buf.writeInt32BE(CrcStream.crc32(buf.slice(4, buf.length - 4)), buf.length - 4);
		return buf;
	};
	Packer.prototype.packGAMA = function(gamma) {
		let buf = Buffer.alloc(4);
		buf.writeUInt32BE(Math.floor(gamma * constants.GAMMA_DIVISION), 0);
		return this._packChunk(constants.TYPE_gAMA, buf);
	};
	Packer.prototype.packIHDR = function(width, height) {
		let buf = Buffer.alloc(13);
		buf.writeUInt32BE(width, 0);
		buf.writeUInt32BE(height, 4);
		buf[8] = this._options.bitDepth;
		buf[9] = this._options.colorType;
		buf[10] = 0;
		buf[11] = 0;
		buf[12] = 0;
		return this._packChunk(constants.TYPE_IHDR, buf);
	};
	Packer.prototype.packIDAT = function(data) {
		return this._packChunk(constants.TYPE_IDAT, data);
	};
	Packer.prototype.packIEND = function() {
		return this._packChunk(constants.TYPE_IEND, null);
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/packer-async.js
var require_packer_async = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let util$2 = __require("util");
	let Stream$1 = __require("stream");
	let constants = require_constants();
	let Packer = require_packer();
	let PackerAsync = module.exports = function(opt) {
		Stream$1.call(this);
		let options = opt || {};
		this._packer = new Packer(options);
		this._deflate = this._packer.createDeflate();
		this.readable = true;
	};
	util$2.inherits(PackerAsync, Stream$1);
	PackerAsync.prototype.pack = function(data, width, height, gamma) {
		this.emit("data", Buffer.from(constants.PNG_SIGNATURE));
		this.emit("data", this._packer.packIHDR(width, height));
		if (gamma) this.emit("data", this._packer.packGAMA(gamma));
		let filteredData = this._packer.filterData(data, width, height);
		this._deflate.on("error", this.emit.bind(this, "error"));
		this._deflate.on("data", function(compressedData) {
			this.emit("data", this._packer.packIDAT(compressedData));
		}.bind(this));
		this._deflate.on("end", function() {
			this.emit("data", this._packer.packIEND());
			this.emit("end");
		}.bind(this));
		this._deflate.end(filteredData);
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/sync-inflate.js
var require_sync_inflate = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let assert = __require("assert").ok;
	let zlib$2 = __require("zlib");
	let util$1 = __require("util");
	let kMaxLength = __require("buffer").kMaxLength;
	function Inflate(opts) {
		if (!(this instanceof Inflate)) return new Inflate(opts);
		if (opts && opts.chunkSize < zlib$2.Z_MIN_CHUNK) opts.chunkSize = zlib$2.Z_MIN_CHUNK;
		zlib$2.Inflate.call(this, opts);
		this._offset = this._offset === void 0 ? this._outOffset : this._offset;
		this._buffer = this._buffer || this._outBuffer;
		if (opts && opts.maxLength != null) this._maxLength = opts.maxLength;
	}
	function createInflate(opts) {
		return new Inflate(opts);
	}
	function _close(engine, callback) {
		if (callback) process.nextTick(callback);
		if (!engine._handle) return;
		engine._handle.close();
		engine._handle = null;
	}
	Inflate.prototype._processChunk = function(chunk, flushFlag, asyncCb) {
		if (typeof asyncCb === "function") return zlib$2.Inflate._processChunk.call(this, chunk, flushFlag, asyncCb);
		let self = this;
		let availInBefore = chunk && chunk.length;
		let availOutBefore = this._chunkSize - this._offset;
		let leftToInflate = this._maxLength;
		let inOff = 0;
		let buffers = [];
		let nread = 0;
		let error;
		this.on("error", function(err) {
			error = err;
		});
		function handleChunk(availInAfter, availOutAfter) {
			if (self._hadError) return;
			let have = availOutBefore - availOutAfter;
			assert(have >= 0, "have should not go down");
			if (have > 0) {
				let out = self._buffer.slice(self._offset, self._offset + have);
				self._offset += have;
				if (out.length > leftToInflate) out = out.slice(0, leftToInflate);
				buffers.push(out);
				nread += out.length;
				leftToInflate -= out.length;
				if (leftToInflate === 0) return false;
			}
			if (availOutAfter === 0 || self._offset >= self._chunkSize) {
				availOutBefore = self._chunkSize;
				self._offset = 0;
				self._buffer = Buffer.allocUnsafe(self._chunkSize);
			}
			if (availOutAfter === 0) {
				inOff += availInBefore - availInAfter;
				availInBefore = availInAfter;
				return true;
			}
			return false;
		}
		assert(this._handle, "zlib binding closed");
		let res;
		do {
			res = this._handle.writeSync(flushFlag, chunk, inOff, availInBefore, this._buffer, this._offset, availOutBefore);
			res = res || this._writeState;
		} while (!this._hadError && handleChunk(res[0], res[1]));
		if (this._hadError) throw error;
		if (nread >= kMaxLength) {
			_close(this);
			throw new RangeError("Cannot create final Buffer. It would be larger than 0x" + kMaxLength.toString(16) + " bytes");
		}
		let buf = Buffer.concat(buffers, nread);
		_close(this);
		return buf;
	};
	util$1.inherits(Inflate, zlib$2.Inflate);
	function zlibBufferSync(engine, buffer) {
		if (typeof buffer === "string") buffer = Buffer.from(buffer);
		if (!(buffer instanceof Buffer)) throw new TypeError("Not a string or buffer");
		let flushFlag = engine._finishFlushFlag;
		if (flushFlag == null) flushFlag = zlib$2.Z_FINISH;
		return engine._processChunk(buffer, flushFlag);
	}
	function inflateSync(buffer, opts) {
		return zlibBufferSync(new Inflate(opts), buffer);
	}
	module.exports = exports = inflateSync;
	exports.Inflate = Inflate;
	exports.createInflate = createInflate;
	exports.inflateSync = inflateSync;
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/sync-reader.js
var require_sync_reader = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let SyncReader = module.exports = function(buffer) {
		this._buffer = buffer;
		this._reads = [];
	};
	SyncReader.prototype.read = function(length, callback) {
		this._reads.push({
			length: Math.abs(length),
			allowLess: length < 0,
			func: callback
		});
	};
	SyncReader.prototype.process = function() {
		while (this._reads.length > 0 && this._buffer.length) {
			let read = this._reads[0];
			if (this._buffer.length && (this._buffer.length >= read.length || read.allowLess)) {
				this._reads.shift();
				let buf = this._buffer;
				this._buffer = buf.slice(read.length);
				read.func.call(this, buf.slice(0, read.length));
			} else break;
		}
		if (this._reads.length > 0) return /* @__PURE__ */ new Error("There are some read requests waitng on finished stream");
		if (this._buffer.length > 0) return /* @__PURE__ */ new Error("unrecognised content at end of stream");
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/filter-parse-sync.js
var require_filter_parse_sync = /* @__PURE__ */ __commonJSMin(((exports) => {
	let SyncReader = require_sync_reader();
	let Filter = require_filter_parse();
	exports.process = function(inBuffer, bitmapInfo) {
		let outBuffers = [];
		let reader = new SyncReader(inBuffer);
		new Filter(bitmapInfo, {
			read: reader.read.bind(reader),
			write: function(bufferPart) {
				outBuffers.push(bufferPart);
			},
			complete: function() {}
		}).start();
		reader.process();
		return Buffer.concat(outBuffers);
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/parser-sync.js
var require_parser_sync = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let hasSyncZlib = true;
	let zlib$1 = __require("zlib");
	let inflateSync = require_sync_inflate();
	if (!zlib$1.deflateSync) hasSyncZlib = false;
	let SyncReader = require_sync_reader();
	let FilterSync = require_filter_parse_sync();
	let Parser = require_parser();
	let bitmapper = require_bitmapper();
	let formatNormaliser = require_format_normaliser();
	module.exports = function(buffer, options) {
		if (!hasSyncZlib) throw new Error("To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0");
		let err;
		function handleError(_err_) {
			err = _err_;
		}
		let metaData;
		function handleMetaData(_metaData_) {
			metaData = _metaData_;
		}
		function handleTransColor(transColor) {
			metaData.transColor = transColor;
		}
		function handlePalette(palette) {
			metaData.palette = palette;
		}
		function handleSimpleTransparency() {
			metaData.alpha = true;
		}
		let gamma;
		function handleGamma(_gamma_) {
			gamma = _gamma_;
		}
		let inflateDataList = [];
		function handleInflateData(inflatedData) {
			inflateDataList.push(inflatedData);
		}
		let reader = new SyncReader(buffer);
		new Parser(options, {
			read: reader.read.bind(reader),
			error: handleError,
			metadata: handleMetaData,
			gamma: handleGamma,
			palette: handlePalette,
			transColor: handleTransColor,
			inflateData: handleInflateData,
			simpleTransparency: handleSimpleTransparency
		}).start();
		reader.process();
		if (err) throw err;
		let inflateData = Buffer.concat(inflateDataList);
		inflateDataList.length = 0;
		let inflatedData;
		if (metaData.interlace) inflatedData = zlib$1.inflateSync(inflateData);
		else {
			let imageSize = ((metaData.width * metaData.bpp * metaData.depth + 7 >> 3) + 1) * metaData.height;
			inflatedData = inflateSync(inflateData, {
				chunkSize: imageSize,
				maxLength: imageSize
			});
		}
		inflateData = null;
		if (!inflatedData || !inflatedData.length) throw new Error("bad png - invalid inflate data response");
		let unfilteredData = FilterSync.process(inflatedData, metaData);
		inflateData = null;
		let bitmapData = bitmapper.dataToBitMap(unfilteredData, metaData);
		unfilteredData = null;
		let normalisedBitmapData = formatNormaliser(bitmapData, metaData);
		metaData.data = normalisedBitmapData;
		metaData.gamma = gamma || 0;
		return metaData;
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/packer-sync.js
var require_packer_sync = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let hasSyncZlib = true;
	let zlib = __require("zlib");
	if (!zlib.deflateSync) hasSyncZlib = false;
	let constants = require_constants();
	let Packer = require_packer();
	module.exports = function(metaData, opt) {
		if (!hasSyncZlib) throw new Error("To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0");
		let packer = new Packer(opt || {});
		let chunks = [];
		chunks.push(Buffer.from(constants.PNG_SIGNATURE));
		chunks.push(packer.packIHDR(metaData.width, metaData.height));
		if (metaData.gamma) chunks.push(packer.packGAMA(metaData.gamma));
		let filteredData = packer.filterData(metaData.data, metaData.width, metaData.height);
		let compressedData = zlib.deflateSync(filteredData, packer.getDeflateOptions());
		filteredData = null;
		if (!compressedData || !compressedData.length) throw new Error("bad png - invalid compressed data response");
		chunks.push(packer.packIDAT(compressedData));
		chunks.push(packer.packIEND());
		return Buffer.concat(chunks);
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/png-sync.js
var require_png_sync = /* @__PURE__ */ __commonJSMin(((exports) => {
	let parse = require_parser_sync();
	let pack = require_packer_sync();
	exports.read = function(buffer, options) {
		return parse(buffer, options || {});
	};
	exports.write = function(png, options) {
		return pack(png, options);
	};
}));
//#endregion
//#region node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/png.js
var require_png$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	let util = __require("util");
	let Stream = __require("stream");
	let Parser = require_parser_async();
	let Packer = require_packer_async();
	let PNGSync = require_png_sync();
	let PNG = exports.PNG = function(options) {
		Stream.call(this);
		options = options || {};
		this.width = options.width | 0;
		this.height = options.height | 0;
		this.data = this.width > 0 && this.height > 0 ? Buffer.alloc(4 * this.width * this.height) : null;
		if (options.fill && this.data) this.data.fill(0);
		this.gamma = 0;
		this.readable = this.writable = true;
		this._parser = new Parser(options);
		this._parser.on("error", this.emit.bind(this, "error"));
		this._parser.on("close", this._handleClose.bind(this));
		this._parser.on("metadata", this._metadata.bind(this));
		this._parser.on("gamma", this._gamma.bind(this));
		this._parser.on("parsed", function(data) {
			this.data = data;
			this.emit("parsed", data);
		}.bind(this));
		this._packer = new Packer(options);
		this._packer.on("data", this.emit.bind(this, "data"));
		this._packer.on("end", this.emit.bind(this, "end"));
		this._parser.on("close", this._handleClose.bind(this));
		this._packer.on("error", this.emit.bind(this, "error"));
	};
	util.inherits(PNG, Stream);
	PNG.sync = PNGSync;
	PNG.prototype.pack = function() {
		if (!this.data || !this.data.length) {
			this.emit("error", "No data provided");
			return this;
		}
		process.nextTick(function() {
			this._packer.pack(this.data, this.width, this.height, this.gamma);
		}.bind(this));
		return this;
	};
	PNG.prototype.parse = function(data, callback) {
		if (callback) {
			let onParsed, onError;
			onParsed = function(parsedData) {
				this.removeListener("error", onError);
				this.data = parsedData;
				callback(null, this);
			}.bind(this);
			onError = function(err) {
				this.removeListener("parsed", onParsed);
				callback(err, null);
			}.bind(this);
			this.once("parsed", onParsed);
			this.once("error", onError);
		}
		this.end(data);
		return this;
	};
	PNG.prototype.write = function(data) {
		this._parser.write(data);
		return true;
	};
	PNG.prototype.end = function(data) {
		this._parser.end(data);
	};
	PNG.prototype._metadata = function(metadata) {
		this.width = metadata.width;
		this.height = metadata.height;
		this.emit("metadata", metadata);
	};
	PNG.prototype._gamma = function(gamma) {
		this.gamma = gamma;
	};
	PNG.prototype._handleClose = function() {
		if (!this._parser.writable && !this._packer.readable) this.emit("close");
	};
	PNG.bitblt = function(src, dst, srcX, srcY, width, height, deltaX, deltaY) {
		srcX |= 0;
		srcY |= 0;
		width |= 0;
		height |= 0;
		deltaX |= 0;
		deltaY |= 0;
		if (srcX > src.width || srcY > src.height || srcX + width > src.width || srcY + height > src.height) throw new Error("bitblt reading outside image");
		if (deltaX > dst.width || deltaY > dst.height || deltaX + width > dst.width || deltaY + height > dst.height) throw new Error("bitblt writing outside image");
		for (let y = 0; y < height; y++) src.data.copy(dst.data, (deltaY + y) * dst.width + deltaX << 2, (srcY + y) * src.width + srcX << 2, (srcY + y) * src.width + srcX + width << 2);
	};
	PNG.prototype.bitblt = function(dst, srcX, srcY, width, height, deltaX, deltaY) {
		PNG.bitblt(this, dst, srcX, srcY, width, height, deltaX, deltaY);
		return this;
	};
	PNG.adjustGamma = function(src) {
		if (src.gamma) {
			for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
				let idx = src.width * y + x << 2;
				for (let i = 0; i < 3; i++) {
					let sample = src.data[idx + i] / 255;
					sample = Math.pow(sample, 1 / 2.2 / src.gamma);
					src.data[idx + i] = Math.round(sample * 255);
				}
			}
			src.gamma = 0;
		}
	};
	PNG.prototype.adjustGamma = function() {
		PNG.adjustGamma(this);
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/utils.js
var require_utils = /* @__PURE__ */ __commonJSMin(((exports) => {
	function hex2rgba(hex) {
		if (typeof hex === "number") hex = hex.toString();
		if (typeof hex !== "string") throw new Error("Color should be defined as hex string");
		let hexCode = hex.slice().replace("#", "").split("");
		if (hexCode.length < 3 || hexCode.length === 5 || hexCode.length > 8) throw new Error("Invalid hex color: " + hex);
		if (hexCode.length === 3 || hexCode.length === 4) hexCode = Array.prototype.concat.apply([], hexCode.map(function(c) {
			return [c, c];
		}));
		if (hexCode.length === 6) hexCode.push("F", "F");
		const hexValue = parseInt(hexCode.join(""), 16);
		return {
			r: hexValue >> 24 & 255,
			g: hexValue >> 16 & 255,
			b: hexValue >> 8 & 255,
			a: hexValue & 255,
			hex: "#" + hexCode.slice(0, 6).join("")
		};
	}
	exports.getOptions = function getOptions(options) {
		if (!options) options = {};
		if (!options.color) options.color = {};
		const margin = typeof options.margin === "undefined" || options.margin === null || options.margin < 0 ? 4 : options.margin;
		const width = options.width && options.width >= 21 ? options.width : void 0;
		const scale = options.scale || 4;
		return {
			width,
			scale: width ? 4 : scale,
			margin,
			color: {
				dark: hex2rgba(options.color.dark || "#000000ff"),
				light: hex2rgba(options.color.light || "#ffffffff")
			},
			type: options.type,
			rendererOpts: options.rendererOpts || {}
		};
	};
	exports.getScale = function getScale(qrSize, opts) {
		return opts.width && opts.width >= qrSize + opts.margin * 2 ? opts.width / (qrSize + opts.margin * 2) : opts.scale;
	};
	exports.getImageWidth = function getImageWidth(qrSize, opts) {
		const scale = exports.getScale(qrSize, opts);
		return Math.floor((qrSize + opts.margin * 2) * scale);
	};
	exports.qrToImageData = function qrToImageData(imgData, qr, opts) {
		const size = qr.modules.size;
		const data = qr.modules.data;
		const scale = exports.getScale(size, opts);
		const symbolSize = Math.floor((size + opts.margin * 2) * scale);
		const scaledMargin = opts.margin * scale;
		const palette = [opts.color.light, opts.color.dark];
		for (let i = 0; i < symbolSize; i++) for (let j = 0; j < symbolSize; j++) {
			let posDst = (i * symbolSize + j) * 4;
			let pxColor = opts.color.light;
			if (i >= scaledMargin && j >= scaledMargin && i < symbolSize - scaledMargin && j < symbolSize - scaledMargin) {
				const iSrc = Math.floor((i - scaledMargin) / scale);
				const jSrc = Math.floor((j - scaledMargin) / scale);
				pxColor = palette[data[iSrc * size + jSrc] ? 1 : 0];
			}
			imgData[posDst++] = pxColor.r;
			imgData[posDst++] = pxColor.g;
			imgData[posDst++] = pxColor.b;
			imgData[posDst] = pxColor.a;
		}
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/png.js
var require_png = /* @__PURE__ */ __commonJSMin(((exports) => {
	const fs = __require("fs");
	const PNG = require_png$1().PNG;
	const Utils = require_utils();
	exports.render = function render(qrData, options) {
		const opts = Utils.getOptions(options);
		const pngOpts = opts.rendererOpts;
		const size = Utils.getImageWidth(qrData.modules.size, opts);
		pngOpts.width = size;
		pngOpts.height = size;
		const pngImage = new PNG(pngOpts);
		Utils.qrToImageData(pngImage.data, qrData, opts);
		return pngImage;
	};
	exports.renderToDataURL = function renderToDataURL(qrData, options, cb) {
		if (typeof cb === "undefined") {
			cb = options;
			options = void 0;
		}
		exports.renderToBuffer(qrData, options, function(err, output) {
			if (err) cb(err);
			let url = "data:image/png;base64,";
			url += output.toString("base64");
			cb(null, url);
		});
	};
	exports.renderToBuffer = function renderToBuffer(qrData, options, cb) {
		if (typeof cb === "undefined") {
			cb = options;
			options = void 0;
		}
		const png = exports.render(qrData, options);
		const buffer = [];
		png.on("error", cb);
		png.on("data", function(data) {
			buffer.push(data);
		});
		png.on("end", function() {
			cb(null, Buffer.concat(buffer));
		});
		png.pack();
	};
	exports.renderToFile = function renderToFile(path, qrData, options, cb) {
		if (typeof cb === "undefined") {
			cb = options;
			options = void 0;
		}
		let called = false;
		const done = (...args) => {
			if (called) return;
			called = true;
			cb.apply(null, args);
		};
		const stream = fs.createWriteStream(path);
		stream.on("error", done);
		stream.on("close", done);
		exports.renderToFileStream(stream, qrData, options);
	};
	exports.renderToFileStream = function renderToFileStream(stream, qrData, options) {
		exports.render(qrData, options).pack().pipe(stream);
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/utf8.js
var require_utf8 = /* @__PURE__ */ __commonJSMin(((exports) => {
	const Utils = require_utils();
	const BLOCK_CHAR = {
		WW: " ",
		WB: "▄",
		BB: "█",
		BW: "▀"
	};
	const INVERTED_BLOCK_CHAR = {
		BB: " ",
		BW: "▄",
		WW: "█",
		WB: "▀"
	};
	function getBlockChar(top, bottom, blocks) {
		if (top && bottom) return blocks.BB;
		if (top && !bottom) return blocks.BW;
		if (!top && bottom) return blocks.WB;
		return blocks.WW;
	}
	exports.render = function(qrData, options, cb) {
		const opts = Utils.getOptions(options);
		let blocks = BLOCK_CHAR;
		if (opts.color.dark.hex === "#ffffff" || opts.color.light.hex === "#000000") blocks = INVERTED_BLOCK_CHAR;
		const size = qrData.modules.size;
		const data = qrData.modules.data;
		let output = "";
		let hMargin = Array(size + opts.margin * 2 + 1).join(blocks.WW);
		hMargin = Array(opts.margin / 2 + 1).join(hMargin + "\n");
		const vMargin = Array(opts.margin + 1).join(blocks.WW);
		output += hMargin;
		for (let i = 0; i < size; i += 2) {
			output += vMargin;
			for (let j = 0; j < size; j++) {
				const topModule = data[i * size + j];
				const bottomModule = data[(i + 1) * size + j];
				output += getBlockChar(topModule, bottomModule, blocks);
			}
			output += vMargin + "\n";
		}
		output += hMargin.slice(0, -1);
		if (typeof cb === "function") cb(null, output);
		return output;
	};
	exports.renderToFile = function renderToFile(path, qrData, options, cb) {
		if (typeof cb === "undefined") {
			cb = options;
			options = void 0;
		}
		const fs = __require("fs");
		const utf8 = exports.render(qrData, options);
		fs.writeFile(path, utf8, cb);
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/terminal/terminal.js
var require_terminal$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.render = function(qrData, options, cb) {
		const size = qrData.modules.size;
		const data = qrData.modules.data;
		const black = "\x1B[40m  \x1B[0m";
		const white = "\x1B[47m  \x1B[0m";
		let output = "";
		const hMargin = Array(size + 3).join(white);
		const vMargin = Array(2).join(white);
		output += hMargin + "\n";
		for (let i = 0; i < size; ++i) {
			output += white;
			for (let j = 0; j < size; j++) output += data[i * size + j] ? black : white;
			output += vMargin + "\n";
		}
		output += hMargin + "\n";
		if (typeof cb === "function") cb(null, output);
		return output;
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/terminal/terminal-small.js
var require_terminal_small = /* @__PURE__ */ __commonJSMin(((exports) => {
	const foregroundWhite = "\x1B[37m";
	const foregroundBlack = "\x1B[30m";
	const reset = "\x1B[0m";
	const lineSetupNormal = "\x1B[47m\x1B[30m";
	const lineSetupInverse = "\x1B[40m\x1B[37m";
	const createPalette = function(lineSetup, foregroundWhite, foregroundBlack) {
		return {
			"00": "\x1B[0m " + lineSetup,
			"01": reset + foregroundWhite + "▄" + lineSetup,
			"02": reset + foregroundBlack + "▄" + lineSetup,
			10: reset + foregroundWhite + "▀" + lineSetup,
			11: " ",
			12: "▄",
			20: reset + foregroundBlack + "▀" + lineSetup,
			21: "▀",
			22: "█"
		};
	};
	/**
	* Returns code for QR pixel
	* @param {boolean[][]} modules
	* @param {number} size
	* @param {number} x
	* @param {number} y
	* @return {'0' | '1' | '2'}
	*/
	const mkCodePixel = function(modules, size, x, y) {
		const sizePlus = size + 1;
		if (x >= sizePlus || y >= sizePlus || y < -1 || x < -1) return "0";
		if (x >= size || y >= size || y < 0 || x < 0) return "1";
		return modules[y * size + x] ? "2" : "1";
	};
	/**
	* Returns code for four QR pixels. Suitable as key in palette.
	* @param {boolean[][]} modules
	* @param {number} size
	* @param {number} x
	* @param {number} y
	* @return {keyof palette}
	*/
	const mkCode = function(modules, size, x, y) {
		return mkCodePixel(modules, size, x, y) + mkCodePixel(modules, size, x, y + 1);
	};
	exports.render = function(qrData, options, cb) {
		const size = qrData.modules.size;
		const data = qrData.modules.data;
		const inverse = !!(options && options.inverse);
		const lineSetup = options && options.inverse ? lineSetupInverse : lineSetupNormal;
		const palette = createPalette(lineSetup, inverse ? foregroundBlack : foregroundWhite, inverse ? foregroundWhite : foregroundBlack);
		const newLine = "\x1B[0m\n" + lineSetup;
		let output = lineSetup;
		for (let y = -1; y < size + 1; y += 2) {
			for (let x = -1; x < size; x++) output += palette[mkCode(data, size, x, y)];
			output += palette[mkCode(data, size, size, y)] + newLine;
		}
		output += reset;
		if (typeof cb === "function") cb(null, output);
		return output;
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/terminal.js
var require_terminal = /* @__PURE__ */ __commonJSMin(((exports) => {
	const big = require_terminal$1();
	const small = require_terminal_small();
	exports.render = function(qrData, options, cb) {
		if (options && options.small) return small.render(qrData, options, cb);
		return big.render(qrData, options, cb);
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/svg-tag.js
var require_svg_tag = /* @__PURE__ */ __commonJSMin(((exports) => {
	const Utils = require_utils();
	function getColorAttrib(color, attrib) {
		const alpha = color.a / 255;
		const str = attrib + "=\"" + color.hex + "\"";
		return alpha < 1 ? str + " " + attrib + "-opacity=\"" + alpha.toFixed(2).slice(1) + "\"" : str;
	}
	function svgCmd(cmd, x, y) {
		let str = cmd + x;
		if (typeof y !== "undefined") str += " " + y;
		return str;
	}
	function qrToPath(data, size, margin) {
		let path = "";
		let moveBy = 0;
		let newRow = false;
		let lineLength = 0;
		for (let i = 0; i < data.length; i++) {
			const col = Math.floor(i % size);
			const row = Math.floor(i / size);
			if (!col && !newRow) newRow = true;
			if (data[i]) {
				lineLength++;
				if (!(i > 0 && col > 0 && data[i - 1])) {
					path += newRow ? svgCmd("M", col + margin, .5 + row + margin) : svgCmd("m", moveBy, 0);
					moveBy = 0;
					newRow = false;
				}
				if (!(col + 1 < size && data[i + 1])) {
					path += svgCmd("h", lineLength);
					lineLength = 0;
				}
			} else moveBy++;
		}
		return path;
	}
	exports.render = function render(qrData, options, cb) {
		const opts = Utils.getOptions(options);
		const size = qrData.modules.size;
		const data = qrData.modules.data;
		const qrcodesize = size + opts.margin * 2;
		const bg = !opts.color.light.a ? "" : "<path " + getColorAttrib(opts.color.light, "fill") + " d=\"M0 0h" + qrcodesize + "v" + qrcodesize + "H0z\"/>";
		const path = "<path " + getColorAttrib(opts.color.dark, "stroke") + " d=\"" + qrToPath(data, size, opts.margin) + "\"/>";
		const viewBox = "viewBox=\"0 0 " + qrcodesize + " " + qrcodesize + "\"";
		const svgTag = "<svg xmlns=\"http://www.w3.org/2000/svg\" " + (!opts.width ? "" : "width=\"" + opts.width + "\" height=\"" + opts.width + "\" ") + viewBox + " shape-rendering=\"crispEdges\">" + bg + path + "</svg>\n";
		if (typeof cb === "function") cb(null, svgTag);
		return svgTag;
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/svg.js
var require_svg = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.render = require_svg_tag().render;
	exports.renderToFile = function renderToFile(path, qrData, options, cb) {
		if (typeof cb === "undefined") {
			cb = options;
			options = void 0;
		}
		const fs = __require("fs");
		const xmlStr = "<?xml version=\"1.0\" encoding=\"utf-8\"?><!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">" + exports.render(qrData, options);
		fs.writeFile(path, xmlStr, cb);
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/canvas.js
var require_canvas = /* @__PURE__ */ __commonJSMin(((exports) => {
	const Utils = require_utils();
	function clearCanvas(ctx, canvas, size) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!canvas.style) canvas.style = {};
		canvas.height = size;
		canvas.width = size;
		canvas.style.height = size + "px";
		canvas.style.width = size + "px";
	}
	function getCanvasElement() {
		try {
			return document.createElement("canvas");
		} catch (e) {
			throw new Error("You need to specify a canvas element");
		}
	}
	exports.render = function render(qrData, canvas, options) {
		let opts = options;
		let canvasEl = canvas;
		if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
			opts = canvas;
			canvas = void 0;
		}
		if (!canvas) canvasEl = getCanvasElement();
		opts = Utils.getOptions(opts);
		const size = Utils.getImageWidth(qrData.modules.size, opts);
		const ctx = canvasEl.getContext("2d");
		const image = ctx.createImageData(size, size);
		Utils.qrToImageData(image.data, qrData, opts);
		clearCanvas(ctx, canvasEl, size);
		ctx.putImageData(image, 0, 0);
		return canvasEl;
	};
	exports.renderToDataURL = function renderToDataURL(qrData, canvas, options) {
		let opts = options;
		if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
			opts = canvas;
			canvas = void 0;
		}
		if (!opts) opts = {};
		const canvasEl = exports.render(qrData, canvas, opts);
		const type = opts.type || "image/png";
		const rendererOpts = opts.rendererOpts || {};
		return canvasEl.toDataURL(type, rendererOpts.quality);
	};
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/browser.js
var require_browser = /* @__PURE__ */ __commonJSMin(((exports) => {
	const canPromise = require_can_promise();
	const QRCode = require_qrcode();
	const CanvasRenderer = require_canvas();
	const SvgRenderer = require_svg_tag();
	function renderCanvas(renderFunc, canvas, text, opts, cb) {
		const args = [].slice.call(arguments, 1);
		const argsNum = args.length;
		const isLastArgCb = typeof args[argsNum - 1] === "function";
		if (!isLastArgCb && !canPromise()) throw new Error("Callback required as last argument");
		if (isLastArgCb) {
			if (argsNum < 2) throw new Error("Too few arguments provided");
			if (argsNum === 2) {
				cb = text;
				text = canvas;
				canvas = opts = void 0;
			} else if (argsNum === 3) {
				if (canvas.getContext && typeof cb === "undefined") {
					cb = opts;
					opts = void 0;
				} else {
					cb = opts;
					opts = text;
					text = canvas;
					canvas = void 0;
				}
			}
		} else {
			if (argsNum < 1) throw new Error("Too few arguments provided");
			if (argsNum === 1) {
				text = canvas;
				canvas = opts = void 0;
			} else if (argsNum === 2 && !canvas.getContext) {
				opts = text;
				text = canvas;
				canvas = void 0;
			}
			return new Promise(function(resolve, reject) {
				try {
					resolve(renderFunc(QRCode.create(text, opts), canvas, opts));
				} catch (e) {
					reject(e);
				}
			});
		}
		try {
			const data = QRCode.create(text, opts);
			cb(null, renderFunc(data, canvas, opts));
		} catch (e) {
			cb(e);
		}
	}
	exports.create = QRCode.create;
	exports.toCanvas = renderCanvas.bind(null, CanvasRenderer.render);
	exports.toDataURL = renderCanvas.bind(null, CanvasRenderer.renderToDataURL);
	exports.toString = renderCanvas.bind(null, function(data, _, opts) {
		return SvgRenderer.render(data, opts);
	});
}));
//#endregion
//#region node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/server.js
var require_server = /* @__PURE__ */ __commonJSMin(((exports) => {
	const canPromise = require_can_promise();
	const QRCode = require_qrcode();
	require_png();
	const Utf8Renderer = require_utf8();
	const TerminalRenderer = require_terminal();
	const SvgRenderer = require_svg();
	function checkParams(text, opts, cb) {
		if (typeof text === "undefined") throw new Error("String required as first argument");
		if (typeof cb === "undefined") {
			cb = opts;
			opts = {};
		}
		if (typeof cb !== "function") {
			if (!canPromise()) throw new Error("Callback required as last argument");
			else {
				opts = cb || {};
				cb = null;
			}
		}
		return {
			opts,
			cb
		};
	}
	function getStringRendererFromType(type) {
		switch (type) {
			case "svg": return SvgRenderer;
			case "terminal": return TerminalRenderer;
			default: return Utf8Renderer;
		}
	}
	function render(renderFunc, text, params) {
		if (!params.cb) return new Promise(function(resolve, reject) {
			try {
				return renderFunc(QRCode.create(text, params.opts), params.opts, function(err, data) {
					return err ? reject(err) : resolve(data);
				});
			} catch (e) {
				reject(e);
			}
		});
		try {
			return renderFunc(QRCode.create(text, params.opts), params.opts, params.cb);
		} catch (e) {
			params.cb(e);
		}
	}
	exports.create = QRCode.create;
	exports.toCanvas = require_browser().toCanvas;
	exports.toString = function toString(text, opts, cb) {
		const params = checkParams(text, opts, cb);
		return render(getStringRendererFromType(params.opts ? params.opts.type : void 0).render, text, params);
	};
}));
//#endregion
//#region src/providers/ncm.ts
/**
* 网易云音乐原生实现 —— 零运行时依赖（仅 node:crypto + fetch）。
* 复刻 NeteaseCloudMusicApi 的 weapi / eapi 加密与请求约定，
* 供 netease.ts 以一致的 { status, body, cookie } 形态调用。
*/
var import_lib = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_server();
})))(), 1);
const IV = "0102030405060708";
const PRESET_KEY = "0CoJUm6Qyw8W8jud";
const EAPI_KEY = "e82ckenh8dichen8";
const BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ID_XOR_KEY_1 = "3go8&$8*3*3h0k(2)2";
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`;
const DOMAIN = "https://music.163.com";
const API_DOMAIN = "https://interface.music.163.com";
const WEAPI_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0";
const API_UA = "NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)";
const osMap = { pc: {
	os: "pc",
	appver: "3.1.17.204416",
	osver: "Microsoft-Windows-10-Professional-build-19045-64bit",
	channel: "netease"
} };
let anonToken = "";
let anonFetching = false;
function cloudmusicDllEncodeId(someId) {
	let xored = "";
	for (let i = 0; i < someId.length; i++) {
		const cc = someId.charCodeAt(i) ^ ID_XOR_KEY_1.charCodeAt(i % 18);
		xored += String.fromCharCode(cc);
	}
	return createHash("md5").update(Buffer.from(xored, "utf8")).digest("base64");
}
async function registerAnonimous() {
	const deviceId = randomBytes(26).toString("hex");
	const m = ((await createRequest("/api/register/anonimous", { username: Buffer.from(`${deviceId} ${cloudmusicDllEncodeId(deviceId)}`).toString("base64") }, {
		crypto: "weapi",
		cookie: {}
	})).cookie || []).join("; ").match(/MUSIC_A=([^;]+)/);
	return m ? m[1] ?? "" : "";
}
async function ensureAnon() {
	if (anonToken || anonFetching) return;
	anonFetching = true;
	try {
		anonToken = await registerAnonimous();
	} catch {
		anonToken = "";
	} finally {
		anonFetching = false;
	}
}
function md5$1(s) {
	return createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");
}
function aesEncrypt(text, mode, key, iv, format = "base64") {
	const cipher = createCipheriv(mode === "ecb" ? "aes-128-ecb" : "aes-128-cbc", Buffer.from(key, "utf8"), mode === "ecb" ? null : Buffer.from(iv, "utf8"));
	cipher.setAutoPadding(true);
	const enc = Buffer.concat([cipher.update(Buffer.from(text, "utf8")), cipher.final()]);
	return format === "base64" ? enc.toString("base64") : enc.toString("hex").toUpperCase();
}
function rsaEncrypt(str) {
	const buf = Buffer.from(str, "utf8");
	const padded = Buffer.alloc(128);
	buf.copy(padded, 128 - buf.length);
	return publicEncrypt({
		key: PUBLIC_KEY,
		padding: constants.RSA_NO_PADDING
	}, padded).toString("hex");
}
function weapi(object) {
	const text = JSON.stringify(object);
	let secretKey = "";
	for (let i = 0; i < 16; i++) secretKey += BASE62.charAt(Math.floor(Math.random() * 62));
	return {
		params: aesEncrypt(aesEncrypt(text, "cbc", PRESET_KEY, IV), "cbc", secretKey, IV),
		encSecKey: rsaEncrypt(secretKey.split("").reverse().join(""))
	};
}
function eapi(url, object) {
	const text = JSON.stringify(object);
	return { params: aesEncrypt(`${url}-36cd479b6b5-${text}-36cd479b6b5-${md5$1(`nobody${url}use${text}md5forencrypt`)}`, "ecb", EAPI_KEY, "", "hex") };
}
function cookieToJson(cookie) {
	const obj = {};
	for (const item of cookie.split(";")) {
		const idx = item.indexOf("=");
		if (idx > 0) {
			const k = item.slice(0, idx).trim();
			const v = item.slice(idx + 1).trim();
			if (k) obj[k] = v;
		}
	}
	return obj;
}
function cookieObjToString(cookie) {
	return Object.keys(cookie).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(cookie[k]))}`).join("; ");
}
const globalDeviceId = randomBytes(26).toString("hex");
const WNMCID = `${randomStr(6)}.${Date.now()}.01.0`;
function randomStr(n) {
	const c = "abcdefghijklmnopqrstuvwxyz";
	let s = "";
	for (let i = 0; i < n; i++) s += c.charAt(Math.floor(Math.random() * 26));
	return s;
}
function processCookieObject(cookie, uri) {
	const _ntes_nuid = randomBytes(16).toString("hex");
	const os = osMap[cookie.os] || osMap["pc"];
	const processed = {
		...cookie,
		__remember_me: "true",
		ntes_kaola_ad: "1",
		_ntes_nuid: cookie._ntes_nuid || _ntes_nuid,
		_ntes_nnid: cookie._ntes_nnid || `${_ntes_nuid},${Date.now()}`,
		WNMCID: cookie.WNMCID || WNMCID,
		WEVNSM: cookie.WEVNSM || "1.0.0",
		osver: cookie.osver || os.osver,
		deviceId: cookie.deviceId || globalDeviceId,
		os: cookie.os || os.os,
		channel: cookie.channel || os.channel,
		appver: cookie.appver || os.appver
	};
	if (uri.indexOf("login") === -1) processed["NMTID"] = randomBytes(8).toString("hex");
	if (!processed.MUSIC_U) processed.MUSIC_A = processed.MUSIC_A || anonToken;
	return processed;
}
function createHeaderCookie(header) {
	return Object.keys(header).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(header[k]))}`).join("; ");
}
function generateRequestId() {
	return `${Date.now()}_${String(Math.floor(Math.random() * 1e3)).padStart(4, "0")}`;
}
async function createRequest(uri, data, options) {
	let cryptoType = options.crypto || "";
	if (cryptoType === "") cryptoType = "api";
	if (cryptoType === "eapi") await ensureAnon();
	const headers = { ...options.headers || {} };
	let cookie = options.cookie || {};
	if (typeof cookie === "string") cookie = cookieToJson(cookie);
	if (typeof cookie === "object") {
		cookie = processCookieObject(cookie, uri);
		headers["Cookie"] = cookieObjToString(cookie);
	}
	const csrfToken = cookie && cookie["__csrf"] || "";
	let url = "";
	let encryptData;
	if (cryptoType === "weapi") {
		headers["Referer"] = options.domain || DOMAIN;
		headers["User-Agent"] = options.ua || WEAPI_UA;
		data.csrf_token = csrfToken;
		encryptData = weapi(data);
		url = (options.domain || DOMAIN) + "/weapi/" + uri.substring(5);
	} else {
		const header = {
			osver: cookie.osver,
			deviceId: cookie.deviceId,
			os: cookie.os,
			appver: cookie.appver,
			versioncode: cookie.versioncode || "140",
			mobilename: cookie.mobilename || "",
			buildver: cookie.buildver || String(Date.now()).slice(0, 10),
			resolution: cookie.resolution || "1920x1080",
			__csrf: csrfToken,
			channel: cookie.channel,
			requestId: generateRequestId()
		};
		if (cookie.MUSIC_U) header["MUSIC_U"] = cookie.MUSIC_U;
		if (cookie.MUSIC_A) header["MUSIC_A"] = cookie.MUSIC_A;
		headers["Cookie"] = createHeaderCookie(header);
		headers["User-Agent"] = options.ua || API_UA;
		data.header = header;
		encryptData = eapi(uri, data);
		url = (options.domain || API_DOMAIN) + "/eapi/" + uri.substring(5);
	}
	const bodyStr = new URLSearchParams(encryptData).toString();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 1e4);
	let resp;
	try {
		resp = await fetch(url, {
			method: "POST",
			headers: {
				...headers,
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: bodyStr,
			signal: controller.signal
		});
	} finally {
		clearTimeout(timer);
	}
	const setCookie = (typeof resp.headers.getSetCookie === "function" ? resp.headers.getSetCookie() : resp.headers.get("set-cookie")?.split(",") ?? []).map((x) => x.replace(/\s*Domain=[^(;|$)]+;*/g, ""));
	const text = await resp.text();
	let body;
	try {
		body = JSON.parse(text);
	} catch {
		body = text;
	}
	const answer = {
		status: 500,
		body: {},
		cookie: setCookie
	};
	if (body && body.code) body.code = Number(body.code);
	answer.body = body;
	answer.status = Number(body && body.code || resp.status);
	if ((/* @__PURE__ */ new Set([
		201,
		302,
		400,
		502,
		800,
		801,
		802,
		803
	])).has(answer.body.code)) answer.status = 200;
	answer.status = answer.status > 100 && answer.status < 600 ? answer.status : 400;
	if (answer.status === 200) return answer;
	throw answer;
}
function createOption(query, crypto = "") {
	return {
		crypto: query.crypto || crypto || "",
		cookie: query.cookie,
		ua: query.ua || "",
		proxy: query.proxy,
		realIP: query.realIP,
		e_r: query.e_r ?? void 0,
		domain: query.domain || "",
		checkToken: query.checkToken || false
	};
}
const cloudsearch = (query) => createRequest("/api/cloudsearch/pc", {
	s: query.keywords,
	type: query.type || 1,
	limit: query.limit || 30,
	offset: query.offset || 0,
	total: true
}, createOption(query));
const song_url_v1 = (query) => {
	const data = {
		ids: "[" + query.id + "]",
		level: query.level,
		encodeType: "flac"
	};
	if (data.level === "sky") data.immerseType = "c51";
	return createRequest("/api/song/enhance/player/url/v1", data, createOption(query));
};
const lyric_new = (query) => createRequest("/api/song/lyric/v1", {
	id: query.id,
	cp: false,
	tv: 0,
	lv: 0,
	rv: 0,
	kv: 0,
	yv: 0,
	ytv: 0,
	yrv: 0
}, createOption(query));
const login_qr_key = async (query) => {
	const result = await createRequest("/api/login/qrcode/unikey", { type: 3 }, createOption(query));
	return {
		status: 200,
		body: {
			data: result.body,
			code: 200
		},
		cookie: result.cookie
	};
};
const login_qr_create = async (query) => {
	const platform = query.platform || "pc";
	let url = `https://music.163.com/login?codekey=${query.key}`;
	if (platform === "web") {
		const chainId = `v1_unknown_${Math.floor(Math.random() * 1e6)}_web_login_${Date.now()}`;
		url += `&chainId=${chainId}`;
	}
	const qrimg = query.qrimg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await import_lib.toString(url, {
		type: "svg",
		margin: 1
	}))}` : "";
	return {
		code: 200,
		status: 200,
		body: {
			code: 200,
			data: {
				qrurl: url,
				qrimg
			}
		}
	};
};
const login_qr_check = async (query) => {
	const data = {
		key: query.key,
		type: 3
	};
	try {
		let result = await createRequest("/api/login/qrcode/client/login", data, createOption(query));
		result = {
			status: 200,
			body: {
				...result.body,
				cookie: result.cookie.join(";")
			},
			cookie: result.cookie
		};
		return result;
	} catch (error) {
		return {
			status: 200,
			body: {},
			cookie: error?.cookie || []
		};
	}
};
const user_account = (query) => createRequest("/api/nuser/account/get", {}, createOption(query, "weapi"));
const likelist = (query) => createRequest("/api/song/like/get", { uid: query.uid }, createOption(query));
const song_detail = (query) => {
	return createRequest("/api/v3/song/detail", { c: "[" + String(query.ids).split(/\s*,\s*/).map((id) => `{"id":${id}}`).join(",") + "]" }, createOption(query, "weapi"));
};
const playlist_track_all = async (query) => {
	const data = {
		id: query.id,
		n: 1e5,
		s: query.s || 8
	};
	const limit = parseInt(query.limit) || 1e3;
	const offset = parseInt(query.offset) || 0;
	return createRequest("/api/v3/song/detail", { c: "[" + ((await createRequest("/api/v6/playlist/detail", data, createOption(query))).body?.playlist?.trackIds || []).slice(offset, offset + limit).map((item) => `{"id":${item.id}}`).join(",") + "]" }, createOption(query));
};
const toplist = (query) => createRequest("/api/toplist", {}, createOption(query));
const recommend_songs = (query) => createRequest("/api/v3/discovery/recommend/songs", {}, createOption(query, "weapi"));
const like$1 = (query) => {
	const liked = query.like === "false" ? false : true;
	return createRequest("/api/radio/like", {
		alg: "itembased",
		trackId: query.id,
		like: liked,
		time: "3"
	}, createOption(query, "weapi"));
};
const song_like_check = (query) => {
	const raw = query.ids ?? (query.id != null ? [query.id] : []);
	return createRequest("/api/song/like/check", { trackIds: Array.isArray(raw) ? raw : [raw] }, createOption(query));
};
const ncm = {
	cloudsearch,
	song_url_v1,
	lyric_new,
	login_qr_key,
	login_qr_create,
	login_qr_check,
	user_account,
	likelist,
	song_detail,
	playlist_track_all,
	toplist,
	recommend_songs,
	like: like$1,
	song_like_check
};
//#endregion
//#region src/store/auth.ts
/** 登录态持久化：$DSH_HOME/dsh-music-huazai/auth.json。 */
const EMPTY = {
	neteaseCookie: "",
	qqCookie: ""
};
let cached = null;
function dataDir() {
	const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
	return join(home, "dsh-music-huazai");
}
function authFile() {
	return join(dataDir(), "auth.json");
}
function loadAuth() {
	if (cached) return cached;
	try {
		if (!existsSync(authFile())) return { ...EMPTY };
		const parsed = JSON.parse(readFileSync(authFile(), "utf8"));
		cached = {
			neteaseCookie: typeof parsed.neteaseCookie === "string" ? parsed.neteaseCookie : "",
			qqCookie: typeof parsed.qqCookie === "string" ? parsed.qqCookie : ""
		};
		return cached;
	} catch {
		return { ...EMPTY };
	}
}
function saveAuth(patch) {
	const next = {
		...loadAuth(),
		...patch
	};
	cached = next;
	mkdirSync(dataDir(), { recursive: true });
	writeFileSync(authFile(), JSON.stringify(next, null, 2), "utf8");
	try {
		chmodSync(authFile(), 384);
	} catch {}
	return next;
}
//#endregion
//#region src/providers/netease.ts
/**
* 网易云音乐 Provider —— 原生实现（src/providers/ncm.ts，零运行时依赖）。
* 调用约定与 NeteaseCloudMusicApi 对齐：cloudsearch / song_url_v1 / lyric_new / login_qr_*。
*/
/** 原生模块导出形态：{ status, body, cookie }，直接按名解构。 */
const lib = ncm;
/** 库的 TS 类型偏窄（timestamp/noCookie 运行时合法），统一走宽松调用。 */
function invoke(fn, params) {
	return fn(params);
}
/** level 词表 → song_url_v1 的 level 参数。 */
const LEVELS = {
	standard: "standard",
	exhigh: "exhigh",
	lossless: "lossless",
	hires: "hires",
	jymaster: "jymaster"
};
/** 统一曲目映射（对齐 Mineradio mapSongRecord）。 */
function mapTrack$2(s) {
	if (!s || !s.id) return void 0;
	const artists = (s.ar ?? s.artists ?? []).map((a) => String(a?.name ?? "")).filter(Boolean);
	const album = s.al ?? s.album ?? {};
	return {
		id: `netease:${s.id}`,
		provider: "netease",
		songId: String(s.id),
		name: String(s.name ?? ""),
		artists,
		album: String(album.name ?? ""),
		durationMs: Number(s.dt ?? s.duration ?? 0) || 0,
		cover: String(album.picUrl ?? ""),
		vip: Number(s.fee ?? 0) === 1
	};
}
async function search$2(keyword, limit = 12, offset = 0) {
	const kw = keyword.trim();
	if (!kw) return [];
	return ((await invoke(lib.cloudsearch, {
		keywords: kw,
		type: 1,
		limit,
		offset,
		cookie: loadAuth().neteaseCookie || void 0,
		timestamp: Date.now()
	})).body?.result?.songs ?? []).map((song) => mapTrack$2(song)).filter((t) => !!t);
}
/** 匿名/非 VIP 账号在高音质档常拿不到直链，逐级降档重试。 */
const LEVEL_FALLBACK = {
	jymaster: [
		"hires",
		"lossless",
		"exhigh",
		"standard"
	],
	hires: [
		"lossless",
		"exhigh",
		"standard"
	],
	lossless: ["exhigh", "standard"],
	exhigh: ["standard"],
	standard: []
};
async function songUrl$2(songId, quality = "hires") {
	const id = songId.replace(/\D/g, "");
	if (!id) return {
		url: "",
		reason: "MISSING_ID"
	};
	const cookie = loadAuth().neteaseCookie || void 0;
	const requested = LEVELS[quality] ?? "exhigh";
	const levels = [requested, ...LEVEL_FALLBACK[requested] ?? []];
	let lastBodyCode = "?";
	for (const level of levels) {
		const result = await invoke(lib.song_url_v1, {
			id,
			level,
			cookie,
			timestamp: Date.now()
		});
		const data = result.body?.data?.[0];
		lastBodyCode = String(result.body?.code ?? "?");
		const url = String(data?.url ?? "");
		if (!url) continue;
		return {
			url,
			quality: String(data?.level ?? level),
			trial: data?.freeTrialInfo != null,
			vipRequired: data?.freeTrialInfo != null
		};
	}
	return {
		url: "",
		vipRequired: true,
		reason: `NETEASE_URL_UNAVAILABLE(code=${lastBodyCode}，已尝试 ${levels.join("→")}）`
	};
}
async function lyric$2(songId) {
	const id = songId.replace(/\D/g, "");
	const empty = {
		lrc: "",
		tlyric: "",
		yrc: "",
		roma: ""
	};
	if (!id) return empty;
	try {
		const body = (await invoke(lib.lyric_new, {
			id,
			cookie: loadAuth().neteaseCookie || void 0
		})).body ?? {};
		const pick = (block) => {
			const text = block?.lyric;
			return typeof text === "string" ? text : "";
		};
		return {
			lrc: pick(body.lrc),
			tlyric: pick(body.tlyric),
			yrc: pick(body.yrc),
			roma: pick(body.romalrc)
		};
	} catch {
		return empty;
	}
}
/** 发起扫码登录：返回 unikey。 */
async function qrKeyStart() {
	const r = await invoke(lib.login_qr_key, { timestamp: Date.now() });
	return String(r.body?.data?.unikey ?? "");
}
/** 生成二维码（base64 dataURL）。 */
async function qrImage(key) {
	const d = (await invoke(lib.login_qr_create, {
		key,
		qrimg: true,
		timestamp: Date.now()
	})).body?.data ?? {};
	return {
		img: String(d.qrimg ?? ""),
		url: String(d.qrurl ?? "")
	};
}
/** 从库响应中收集 Set-Cookie 为完整 Cookie 串，并剔除 Path/Expires/Domain 等属性段
*  （这些属性段被原样塞回后续请求 Cookie 头会导致 user_account 等接口失败）。 */
function collectCookie(r) {
	const raw = r.cookie;
	return cleanCookie((Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(";") : []).map((s) => s.trim()));
}
const COOKIE_ATTRS = /* @__PURE__ */ new Set([
	"expires",
	"max-age",
	"domain",
	"path",
	"secure",
	"httponly",
	"samesite",
	"priority",
	"partitionkey"
]);
function cleanCookie(segments) {
	return segments.map((s) => s.trim()).filter((s) => {
		const eq = s.indexOf("=");
		if (eq <= 0) return false;
		const key = s.slice(0, eq).trim().toLowerCase();
		return !COOKIE_ATTRS.has(key);
	}).join("; ");
}
/** 登录成功的判据：Cookie 中含 MUSIC_U（匿名令牌是 MUSIC_A，不算）。 */
function hasAuthCookie(cookie) {
	return /(?:^|;)\s*MUSIC_U=[^;\s]/.test(cookie);
}
/**
* 轮询扫码状态：800 过期 / 801 等待 / 802 已扫 / 803 成功。
* 注意官方文档：扫码确认后本接口可能返回 502（Cookie 已随响应 Set-Cookie 下发），
* 因此只要捕获到含 MUSIC_U 的 Cookie 即按登录成功处理，不依赖 body.code === 803。
*/
async function qrCheck(key) {
	const once = () => invoke(lib.login_qr_check, {
		key,
		timestamp: Date.now()
	});
	let r = await once();
	let code = Number(r.body?.code ?? 0);
	let cookie = collectCookie(r);
	if (!hasAuthCookie(cookie) && code !== 800 && code !== 801 && code !== 802) {
		const retry = await once();
		const retryCookie = collectCookie(retry);
		const retryCode = Number(retry.body?.code ?? 0);
		if (hasAuthCookie(retryCookie) || retryCode === 803 || retryCode === 502) {
			r = retry;
			code = retryCode;
			cookie = retryCookie;
		}
	}
	const message = String(r.body?.message ?? r.body?.msg ?? "");
	if (hasAuthCookie(cookie)) {
		saveAuth({ neteaseCookie: cookie });
		const ok = await verifyNeteaseCookie(cookie);
		logInfo(`[netease] 扫码登录已保存 Cookie（body.code=${code}），nickname=${ok.nickname ?? "(核验未返回昵称)"}`);
		return {
			code: 803,
			message: code === 502 ? "登录成功" : message || "登录成功",
			nickname: ok.nickname,
			avatar: ok.avatar,
			verified: true
		};
	}
	if (code === 803) {
		logWarn("[netease] 扫码 803 但未捕获到 Cookie，引导用户改用 Cookie 粘贴");
		return {
			code: 803,
			message: "登录已确认，但本插件未能自动获取 Cookie，请用账号页「Cookie 粘贴」登录",
			verified: false
		};
	}
	if (code === 800 || code === 802) return {
		code,
		message
	};
	return {
		code: 801,
		message
	};
}
/** 用 Cookie 调一次 user_account，确认其能拿到账号资料（防止存了无效登录态）。 */
async function verifyNeteaseCookie(cookie) {
	try {
		const profile = (await invoke(lib.user_account, { cookie })).body?.profile;
		if (profile?.nickname) return {
			ok: true,
			nickname: String(profile.nickname),
			avatar: String(profile.avatarUrl ?? "")
		};
	} catch {}
	return { ok: false };
}
async function authStatus$1() {
	const item = {
		provider: "netease",
		loggedIn: false
	};
	const cookie = loadAuth().neteaseCookie;
	if (!cookie) return item;
	try {
		const r = await invoke(lib.user_account, { cookie });
		const profile = r.body?.profile;
		if (profile?.nickname) {
			item.loggedIn = true;
			item.nickname = String(profile.nickname);
			item.avatar = String(profile.avatarUrl ?? "");
			const vipType = Number(r.body?.account?.vipType ?? 0);
			item.vipLabel = vipType >= 11 ? "SVIP" : vipType > 0 ? "VIP" : "无VIP";
		}
	} catch {
		item.loggedIn = false;
	}
	return item;
}
/** 红心收藏（需登录）；同时失效红心缓存。 */
async function like(songId, liked) {
	const cookie = loadAuth().neteaseCookie;
	if (!cookie) throw new Error("网易云未登录");
	await invoke(lib.like, {
		id: songId.replace(/\D/g, ""),
		like: liked,
		cookie,
		timestamp: Date.now()
	});
	invalidateLikesCache();
	return { liked };
}
/** 查询红心状态。 */
async function likeCheck(songId) {
	const cookie = loadAuth().neteaseCookie;
	if (!cookie) return { liked: false };
	try {
		const r = await invoke(lib.song_like_check, {
			id: songId.replace(/\D/g, ""),
			cookie
		});
		return { liked: (Array.isArray(r.body?.songs) ? r.body.songs : [])[0]?.liked === true };
	} catch {
		return { liked: false };
	}
}
/** 红心曲目缓存（点赞/取消后失效）。 */
let likesCacheAt = 0;
let likesCacheTracks = [];
function invalidateLikesCache() {
	likesCacheAt = 0;
	likesCacheTracks = [];
}
/** 已登录用户的红心歌曲全量（未登录返回空；5 分钟缓存，并行分块拉取）。 */
async function likedTracks(max = 300) {
	const cookie = loadAuth().neteaseCookie;
	if (!cookie) return [];
	if (likesCacheTracks.length && Date.now() - likesCacheAt < 3e5) return likesCacheTracks.slice(0, max);
	try {
		const account = await invoke(lib.user_account, { cookie });
		const uid = String(account.body?.account?.id ?? "");
		if (!uid) return [];
		const likes = await invoke(lib.likelist, {
			uid,
			cookie
		});
		const rawIds = likes.body?.ids ?? likes.body?.chunk?.slice?.(-1)?.[0]?.ids;
		const ids = Array.isArray(rawIds) ? rawIds.map(String).slice(0, max) : [];
		const chunks = [];
		for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
		const details = await Promise.all(chunks.map((chunk) => invoke(lib.song_detail, {
			ids: chunk.join(","),
			cookie
		}).catch(() => null)));
		const out = [];
		for (const detail of details) {
			if (!detail) continue;
			const songs = Array.isArray(detail.body?.songs) ? detail.body.songs : [];
			for (const song of songs) {
				const track = mapTrack$2(song);
				if (track) out.push(track);
			}
		}
		likesCacheAt = Date.now();
		likesCacheTracks = out;
		return out;
	} catch {
		return [];
	}
}
/** 匿名可用的公开榜单曲目。 */
async function chartTracksById(chartId, limit = 60) {
	try {
		const r = await invoke(lib.playlist_track_all, {
			id: chartId,
			limit,
			timestamp: Date.now()
		});
		return (Array.isArray(r.body?.songs) ? r.body.songs : []).map((song) => mapTrack$2(song)).filter((t) => !!t);
	} catch {
		return [];
	}
}
/** 登录用户的每日个性化推荐（需登录）。 */
async function dailyRecommend() {
	const cookie = loadAuth().neteaseCookie;
	if (!cookie) return [];
	try {
		const r = await invoke(lib.recommend_songs, {
			cookie,
			timestamp: Date.now()
		});
		return (Array.isArray(r.body?.data?.dailySongs) ? r.body.data.dailySongs : []).map((song) => mapTrack$2(song)).filter((t) => !!t);
	} catch {
		return [];
	}
}
/** 网易云 MusicProvider 实现（向 registry 注册，供 routes/tools/merge 统一取用）。 */
const neteaseProvider = {
	id: "netease",
	label: "网易云音乐",
	description: "原生实现（零依赖，weapi/eapi 直连）",
	search: search$2,
	songUrl: (id, quality) => songUrl$2(id, quality),
	lyric: lyric$2,
	authStatus: authStatus$1,
	dailyRecommend,
	chartTracksById,
	likedTracks
};
//#endregion
//#region src/providers/qq.ts
/**
* QQ 音乐 Provider —— 移植自 Mineradio server.js 的 fcg 直连实现：
* sha1 签名（qqSearchSign）、移动端搜索、vkey 取流、逐字歌词（qrc）。
*/
const MUSICU_URL = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const SMARTBOX_URL = "https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg";
const UA = "QQMusic 14090508(android 12)";
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const HEADERS$1 = {
	Referer: "https://y.qq.com/",
	"User-Agent": UA
};
const WEB_HEADERS = {
	Referer: "https://y.qq.com/",
	"User-Agent": WEB_UA
};
/** 音质候选模板：从目标档位向下回退（对齐 Mineradio QQ_QUALITY_CANDIDATE_TEMPLATES）。 */
const QUALITY_TEMPLATES = [
	{
		prefix: "RS01",
		ext: ".flac",
		level: "hires",
		label: "Hi-Res FLAC"
	},
	{
		prefix: "F000",
		ext: ".flac",
		level: "lossless",
		label: "无损 FLAC"
	},
	{
		prefix: "M800",
		ext: ".mp3",
		level: "exhigh",
		label: "320k MP3"
	},
	{
		prefix: "M500",
		ext: ".mp3",
		level: "standard",
		label: "128k MP3"
	},
	{
		prefix: "C400",
		ext: ".m4a",
		level: "aac",
		label: "AAC/M4A"
	}
];
function normalizeQuality$1(value) {
	const raw = value.toLowerCase().trim();
	if ([
		"jymaster",
		"master",
		"studio",
		"svip"
	].includes(raw)) return "jymaster";
	if ([
		"hires",
		"hi-res",
		"highres"
	].includes(raw)) return "hires";
	if ([
		"lossless",
		"flac",
		"sq"
	].includes(raw)) return "lossless";
	if ([
		"exhigh",
		"high",
		"320",
		"320k",
		"hq"
	].includes(raw)) return "exhigh";
	if ([
		"standard",
		"normal",
		"128",
		"128k",
		"std"
	].includes(raw)) return "standard";
	return "hires";
}
function qualityCandidates(target) {
	const normalized = normalizeQuality$1(target);
	const index = QUALITY_TEMPLATES.findIndex((item) => item.level === normalized);
	return QUALITY_TEMPLATES.slice(index >= 0 ? index : 0);
}
function parseCookieString(text) {
	const out = {};
	for (const part of String(text ?? "").split(";")) {
		const eq = part.indexOf("=");
		if (eq <= 0) continue;
		const key = part.slice(0, eq).trim();
		if (!key) continue;
		try {
			out[key] = decodeURIComponent(part.slice(eq + 1).trim());
		} catch {
			out[key] = part.slice(eq + 1).trim();
		}
	}
	return out;
}
function authCookie() {
	const text = loadAuth().qqCookie;
	const cookie = parseCookieString(text);
	const rawUin = !!cookie.wxopenid || Number(cookie.login_type) === 2 ? cookie.wxuin ?? cookie.uin ?? cookie.p_uin : cookie.uin ?? cookie.qqmusic_uin ?? cookie.wxuin ?? cookie.p_uin;
	const digits = String(rawUin ?? "").replace(/\D/g, "");
	return {
		text,
		cookie,
		uin: digits.replace(/^0+/, "") || digits || "0",
		key: cookie.qm_keyst ?? cookie.qqmusic_key ?? cookie.music_key ?? cookie.wxskey ?? cookie.p_skey ?? ""
	};
}
async function requestText(url, init) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 1e4);
	try {
		const resp = await fetch(url, {
			method: init.method ?? "GET",
			headers: init.headers,
			body: init.body,
			signal: controller.signal
		});
		const text = await resp.text();
		if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text.slice(0, 120)}`);
		return text;
	} finally {
		clearTimeout(timer);
	}
}
async function requestJson(url, init) {
	return JSON.parse(await requestText(url, init));
}
async function webGet(url, params, referer) {
	const query = new URLSearchParams(params).toString();
	return requestJson(`${url}${url.includes("?") ? "&" : "?"}${query}`, { headers: {
		...WEB_HEADERS,
		Referer: referer
	} });
}
/** musicu.fcg 统一入口（带 Cookie）。 */
async function musicu(payload, useCookie = true) {
	const body = JSON.stringify(payload);
	const headers = {
		...HEADERS$1,
		"Content-Type": "application/json;charset=UTF-8"
	};
	const { text } = authCookie();
	if (useCookie && text) headers.Cookie = text;
	return requestJson(MUSICU_URL, {
		method: "POST",
		headers,
		body
	});
}
/** Mineradio qqSearchSign 原样移植。 */
function searchSign(text) {
	const hash = createHash("sha1").update(text).digest("hex");
	const part1 = [
		23,
		14,
		6,
		36,
		16,
		40,
		7,
		19
	].map((index) => hash[index]).join("");
	const part2 = [
		16,
		1,
		32,
		12,
		19,
		27,
		8,
		5
	].map((index) => hash[index]).join("");
	const bytes = [
		89,
		39,
		179,
		150,
		218,
		82,
		58,
		252,
		177,
		52,
		186,
		123,
		120,
		64,
		242,
		133,
		143,
		161,
		121,
		179
	].map((value, index) => value ^ Number.parseInt(hash.slice(index * 2, index * 2 + 2), 16));
	return `zzc${part1}${Buffer.from(bytes).toString("base64").replace(/[\\/+=]/g, "")}${part2}`.toLowerCase();
}
function albumCover(albumMid, size = 300) {
	if (!albumMid) return "";
	return `https://y.qq.com/music/photo_new/T002R${size}x${size}M000${albumMid}.jpg?max_age=2592000`;
}
function mapTrack$1(raw) {
	const track = raw ?? {};
	const album = track.album ?? {};
	const artists = (track.singer ?? []).map((a) => String(a?.name ?? "")).filter(Boolean);
	const mid = String(track.mid ?? "");
	const albumMid = String(album.mid ?? album.pmid ?? "");
	if (!track.name || !mid) return void 0;
	return {
		id: `qq:${mid}`,
		provider: "qq",
		songId: mid,
		name: String(track.name ?? ""),
		artists,
		album: String(album.name ?? ""),
		durationMs: (Number(track.interval) || 0) * 1e3,
		cover: albumCover(albumMid),
		vip: Number(track.pay?.pay_play ?? 0) > 0 || Number(track.privilege ?? 0) >= 9,
		mediaMid: String(track.file?.media_mid ?? "")
	};
}
async function smartboxSearch(keyword, limit) {
	return ((await webGet(SMARTBOX_URL, {
		format: "json",
		key: keyword,
		g_tk: "5381",
		loginUin: "0",
		hostUin: "0",
		inCharset: "utf8",
		outCharset: "utf-8",
		notice: "0",
		platform: "yqq.json",
		needNewCode: "0"
	}, "https://y.qq.com/"))?.data?.song?.itemlist ?? []).slice(0, Math.min(limit, 10)).map((item) => mapTrack$1({
		mid: item.mid ?? item.songmid ?? "",
		id: item.id ?? "",
		name: item.name ?? item.title ?? "",
		singer: [{ name: item.singer ?? "" }]
	})).filter((t) => !!t);
}
async function fullSongSearch(keyword, limit, offset) {
	const pageNumber = Math.floor(offset / limit) + 1;
	const payload = {
		comm: {
			ct: "11",
			cv: "14090508",
			v: "14090508",
			tmeAppID: "qqmusic",
			phonetype: "EBG-AN10",
			os_ver: "12",
			OpenUDID: "0",
			QIMEI36: "0",
			udid: "0",
			chid: "0",
			aid: "0",
			oaid: "0",
			taid: "0",
			tid: "0",
			wid: "0",
			uid: "0",
			sid: "0",
			modeSwitch: "6",
			teenMode: "0",
			ui_mode: "2",
			nettype: "1020"
		},
		req: {
			module: "music.search.SearchCgiService",
			method: "DoSearchForQQMusicMobile",
			param: {
				search_type: 0,
				searchid: `${Date.now()}${Math.random()}`.replace(".", "").slice(0, 18),
				query: keyword,
				page_num: pageNumber,
				num_per_page: limit,
				highlight: 0,
				nqc_flag: 0,
				multi_zhida: 0,
				cat: 2,
				grp: 1,
				sin: offset,
				sem: 0
			}
		}
	};
	const bodyText = JSON.stringify(payload);
	const data = (await requestJson(`https://u.y.qq.com/cgi-bin/musics.fcg?sign=${searchSign(bodyText)}`, {
		method: "POST",
		timeoutMs: 1e4,
		headers: {
			"User-Agent": UA,
			"Content-Type": "application/json"
		},
		body: bodyText
	}))?.req?.data;
	const body = data?.body ?? data;
	return (Array.isArray(body?.item_song) ? body.item_song : Array.isArray(body?.song?.list) ? body.song.list : []).map((item) => mapTrack$1(item?.track_info ?? item)).filter((t) => !!t);
}
async function search$1(keyword, limit = 12, offset = 0) {
	const kw = keyword.trim();
	if (!kw) return [];
	let base = [];
	try {
		base = await fullSongSearch(kw, limit, offset);
	} catch {}
	if (!base.length && offset === 0) base = await smartboxSearch(kw, limit);
	const seen = /* @__PURE__ */ new Set();
	return base.filter((song) => {
		if (!song.songId || seen.has(song.songId)) return false;
		seen.add(song.songId);
		return true;
	});
}
/** 轻量探测：Range 取头确认可播（对齐 Mineradio probe 思路的简化版）。 */
async function probePlayable(url) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 2500);
	try {
		const resp = await fetch(url, {
			headers: { Range: "bytes=0-8191" },
			signal: controller.signal
		});
		if (!(resp.status === 200 || resp.status === 206)) return false;
		const type = String(resp.headers.get("content-type") ?? "").toLowerCase();
		if (/text\/html|application\/(json|xml)/.test(type)) return false;
		const buffer = Buffer.from(await resp.arrayBuffer());
		return buffer.length >= 512 && audioMagic(buffer) !== "";
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}
function audioMagic(buffer) {
	if (buffer.subarray(0, 3).toString("ascii") === "ID3") return "mp3-id3";
	if (buffer.subarray(0, 4).toString("ascii") === "fLaC") return "flac";
	if (buffer.subarray(0, 4).toString("ascii") === "OggS") return "ogg";
	if (buffer.subarray(4, 8).toString("ascii") === "ftyp") return "mp4";
	const scan = Math.min(buffer.length - 1, 2048);
	for (let i = 0; i < scan; i++) if (buffer[i] === 255 && (buffer[i + 1] & 224) === 224) return "mpeg-frame";
	return "";
}
async function songUrl$1(mid, quality = "hires", mediaMidHint = "") {
	const songmid = mid.trim();
	if (!songmid) return {
		url: "",
		reason: "MISSING_MID"
	};
	const { uin, key } = authCookie();
	const candidates = [...new Set([mediaMidHint.trim(), songmid].filter(Boolean))].flatMap((mediaId) => qualityCandidates(quality).map((item) => ({
		...item,
		mediaId,
		filename: item.prefix + mediaId + item.ext
	})));
	const filenames = candidates.map((item) => item.filename);
	const param = {
		guid: String(1e7 + Math.floor(Math.random() * 9e7)),
		songmid: filenames.map(() => songmid),
		songtype: filenames.map(() => 0),
		filename: filenames,
		uin,
		loginflag: 1,
		platform: "20"
	};
	const comm = {
		uin,
		format: "json",
		ct: key ? 19 : 24,
		cv: 0
	};
	if (key) comm.authst = key;
	const data = (await musicu({
		comm,
		req_0: {
			module: "vkey.GetVkeyServer",
			method: "CgiGetVkey",
			param
		}
	}))?.req_0?.data;
	const purls = (Array.isArray(data?.midurlinfo) ? data.midurlinfo : []).filter((item) => item?.purl);
	const sips = Array.isArray(data?.sip) && data.sip.length ? data.sip : ["https://ws.stream.qqmusic.qq.com/"];
	const MAX_PROBE_PURLS = 2;
	let probed = 0;
	for (const info of purls) {
		if (probed >= MAX_PROBE_PURLS) break;
		probed++;
		try {
			return {
				url: await Promise.any(sips.map((sip) => {
					const candidate = sip + String(info.purl);
					return probePlayable(candidate).then((ok) => ok ? candidate : Promise.reject(/* @__PURE__ */ new Error("unplayable")));
				})),
				quality: candidates.find((item) => item.filename === info.filename)?.label ?? info.filename,
				vipRequired: false
			};
		} catch {
			continue;
		}
	}
	const first = purls[0];
	return {
		url: "",
		reason: first ? `QQ_URL_UNAVAILABLE(code=${String(first.result ?? first.code ?? "?")} ${String(first.msg ?? first.tips ?? "")})` : "QQ_URL_EMPTY（未登录或非VIP曲目可能受限）",
		vipRequired: true
	};
}
function decodeEntities(text) {
	return String(text ?? "").replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16))).replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10))).replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
}
function decodeLyricText(text) {
	if (typeof text !== "string" || !text) return "";
	let raw = decodeEntities(text.trim());
	if (!raw) return "";
	const compact = raw.replace(/\s+/g, "");
	if (compact.length >= 8 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact) && !/^\s*\[/.test(raw)) try {
		const decoded = Buffer.from(compact, "base64").toString("utf8").replace(/^\uFEFF/, "");
		if (decoded && (decoded.includes("[") || /[\u4e00-\u9fa5]/.test(decoded))) raw = decoded;
	} catch {}
	return decodeEntities(raw).replace(/\r\n/g, "\n").trim();
}
async function lyric$1(mid, numericId = "") {
	const empty = {
		lrc: "",
		tlyric: "",
		yrc: "",
		roma: ""
	};
	if (!mid) return empty;
	try {
		const param = { songMID: mid };
		const digits = numericId.replace(/\D/g, "");
		if (digits) param.songID = Number(digits);
		const data = (await musicu({
			comm: {
				ct: 24,
				cv: 0
			},
			lyric: {
				module: "music.musichallSong.PlayLyricInfo",
				method: "GetPlayLyricInfo",
				param
			}
		}))?.lyric?.data;
		return {
			lrc: decodeLyricText(data?.lyric),
			tlyric: decodeLyricText(data?.trans),
			yrc: decodeLyricText(data?.qrc),
			roma: decodeLyricText(data?.roma)
		};
	} catch {
		return empty;
	}
}
/** 从 QQ Cookie 串中提取 uin（用于登录态判断）。 */
function extractQQUin(cookieText) {
	for (const part of cookieText.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if ((key === "uin" || key === "wxuin" || key === "p_uin") && rest.join("=")) return rest.join("=");
	}
	return "";
}
const QQ_XLOGIN = "https://xui.ptlogin2.qq.com/cgi-bin/xlogin";
const QQ_QRSHOW = "https://ssl.ptlogin2.qq.com/ptqrshow";
const QQ_QRLOGIN = "https://ssl.ptlogin2.qq.com/ptqrlogin";
const QQ_APPID = "716027609";
const QQ_DAID = "383";
const QQ_3RD_AID = "100497308";
const QQ_JUMP = "https://graph.qq.com/oauth2.0/login_jump";
/** qrsig → ptqrtoken（腾讯 hash33）。 */
function hash33(qrsig) {
	let e = 0;
	for (let i = 0; i < qrsig.length; i++) e = e + ((e << 5) + qrsig.charCodeAt(i)) | 0;
	return 2147483647 & e;
}
function getSetCookie(resp) {
	const raw = resp.headers.getSetCookie?.();
	if (Array.isArray(raw)) return raw;
	const single = resp.headers.get("set-cookie");
	return single ? single.split(/,(?=[^ ]+?=)/).map((s) => s.trim()) : [];
}
function mergeSetCookies(merged, headers) {
	for (const sc of headers) {
		const [kv] = sc.split(";");
		if (!kv) continue;
		const idx = kv.indexOf("=");
		if (idx <= 0) continue;
		const key = kv.slice(0, idx).trim();
		if (!key) continue;
		let value = kv.slice(idx + 1).trim();
		try {
			value = decodeURIComponent(value);
		} catch {}
		merged.set(key, value);
	}
}
/** 手动跟随重定向，收集整条链路上所有 set-cookie（undici 默认只给最后一跳）。 */
async function collectCookies(startUrl, seedCookie) {
	const merged = /* @__PURE__ */ new Map();
	for (const [k, v] of Object.entries(parseCookieString(seedCookie))) merged.set(k, v);
	const cookieHeader = () => [...merged].map(([k, v]) => `${k}=${v}`).join("; ");
	let url = startUrl;
	for (let i = 0; i < 6; i++) {
		const resp = await fetch(url, {
			headers: {
				Cookie: cookieHeader(),
				"User-Agent": WEB_UA,
				Referer: "https://y.qq.com/"
			},
			redirect: "manual"
		});
		mergeSetCookies(merged, getSetCookie(resp));
		const loc = resp.headers.get("location");
		if (!loc || resp.status < 300 || resp.status >= 400) break;
		url = new URL(loc, url).href;
	}
	return merged;
}
/** 获取 QQ 扫码二维码（返回 base64 图 + 轮询所需签名）。 */
async function qqQrStart() {
	const xloginReferer = "https://xui.ptlogin2.qq.com/";
	const ptLoginSig = getSetCookie(await fetch(`${QQ_XLOGIN}?appid=${QQ_APPID}&daid=${QQ_DAID}&style=33&login_text=授权并登录&hide_title_bar=1&hide_border=1&target=self&s_url=${encodeURIComponent(QQ_JUMP)}&pt_3rd_aid=${QQ_3RD_AID}`, { headers: { "User-Agent": WEB_UA } })).map((h) => /pt_login_sig=([^;]+)/.exec(h)?.[1]).find(Boolean) ?? "";
	const qrCookie = ptLoginSig ? `pt_login_sig=${ptLoginSig}` : "";
	const qr = await fetch(`${QQ_QRSHOW}?appid=${QQ_APPID}&e=2&l=M&s=3&d=72&v=4&t=${Math.random()}&daid=${QQ_DAID}&pt_3rd_aid=${QQ_3RD_AID}`, { headers: {
		"User-Agent": WEB_UA,
		Referer: xloginReferer,
		...qrCookie ? { Cookie: qrCookie } : {}
	} });
	const buf = Buffer.from(await qr.arrayBuffer());
	return {
		qrsig: getSetCookie(qr).map((h) => /qrsig=([^;]+)/.exec(h)?.[1]).find(Boolean) ?? "",
		ptLoginSig,
		img: `data:image/png;base64,${buf.toString("base64")}`
	};
}
/** 轮询扫码状态；成功则换取 QQ 音乐凭证并落库。 */
async function qqQrCheck(qrsig, ptLoginSig) {
	if (!qrsig || !ptLoginSig) return {
		phase: "error",
		note: "缺少二维码参数，请重新获取"
	};
	const ptqrtoken = hash33(qrsig);
	const url = `${QQ_QRLOGIN}?u1=${encodeURIComponent(QQ_JUMP)}&ptqrtoken=${ptqrtoken}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052&action=0-0-${Date.now()}&js_ver=20052116&js_type=1&login_sig=${encodeURIComponent(ptLoginSig)}&pt_uistyle=40&aid=${QQ_APPID}&daid=${QQ_DAID}&pt_3rd_aid=${QQ_3RD_AID}&has_onekey=1`;
	const text = await (await fetch(url, { headers: {
		Referer: "https://xui.ptlogin2.qq.com/",
		"User-Agent": WEB_UA,
		Cookie: `qrsig=${qrsig}; pt_login_sig=${ptLoginSig}`
	} })).text();
	logInfo(`[qq] qr check raw: ${text.slice(0, 240)}`);
	const codeMatch = text.match(/ptuiCB\(\s*'?(\d+)'?/);
	const code = codeMatch ? codeMatch[1] : "";
	if (code === "65" || /二维码已经失效|已失效/.test(text)) return { phase: "expired" };
	if (code === "67" || /二维码认证中|等待.*确认/.test(text)) return { phase: "scanned" };
	const jumpUrl = (text.match(/https?:\/\/[^\s'")]+/) ?? [])[0] ?? "";
	const uin = (text.match(/[?&]uin=([^&'")]+)/) ?? [])[1] ?? "";
	if (code === "0" || /登录成功/.test(text) || jumpUrl) try {
		const merged = await collectCookies(jumpUrl || "https://y.qq.com/", uin ? `uin=${uin}` : "");
		const cookie = [
			"uin",
			"p_uin",
			"p_skey",
			"p_luin",
			"p_lskey",
			"qm_keyst",
			"qqmusic_key",
			"music_key",
			"wxskey",
			"skey",
			"luin",
			"lskey"
		].filter((k) => merged.has(k)).map((k) => `${k}=${merged.get(k)}`).join("; ");
		const hasMusicKey = merged.has("qm_keyst") || merged.has("music_key") || merged.has("qqmusic_key");
		const existing = loadAuth().qqCookie;
		const existingHasKey = /(?:qm_keyst|music_key|qqmusic_key)=/.test(existing);
		if (hasMusicKey || !existingHasKey) {
			saveAuth({ qqCookie: cookie });
			return {
				phase: "success",
				note: hasMusicKey ? "已获取 QQ 音乐登录凭证" : "已扫码登录（基础态）；VIP 曲目若无法播放，请在账号页粘贴完整 Cookie"
			};
		}
		return {
			phase: "success",
			note: "扫码仅获基础登录态，已保留原有完整 Cookie（会员权益不受影响）"
		};
	} catch (cause) {
		logWarn(`[qq] 扫码成功但换取凭证异常：${cause instanceof Error ? cause.message : String(cause)}`);
		return {
			phase: "success",
			note: "扫码已确认，但换取 QQ 音乐凭证失败，请在账号页粘贴完整 Cookie"
		};
	}
	return { phase: "waiting" };
}
/** QQ 音乐 MusicProvider 实现（向 registry 注册）。 */
const qqProvider = {
	id: "qq",
	label: "QQ 音乐",
	description: "移植自 Mineradio fcg 直连 + sha1 签名",
	search: search$1,
	songUrl: (id, quality, extra) => songUrl$1(id, quality, extra?.mediaMid ?? ""),
	lyric: (id, extra) => lyric$1(id, extra?.numericId ?? ""),
	authStatus: async () => {
		const cookie = loadAuth().qqCookie;
		return {
			provider: "qq",
			loggedIn: !!(cookie ? extractQQUin(cookie) : "")
		};
	}
};
//#endregion
//#region src/providers/types.ts
/** 内置已知平台（仅用于 UI/默认启用，非白名单）。 */
const KNOWN_PROVIDERS = [
	"netease",
	"qq",
	"kugou"
];
/** 曲目唯一键 `${provider}:${songId}`。 */
function trackKey(track) {
	return `${track.provider}:${track.songId}`;
}
//#endregion
//#region src/providers/kugou.ts
/**
* 酷狗音乐 Provider —— 轻量直连（移动端公开接口 + md5 签名取流），
* 零外部依赖，复用 node:crypto / fetch。仅匿名可用，不支持登录态。
*/
const HEADERS = {
	"User-Agent": "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
	Referer: "https://www.kugou.com/"
};
function reqText(url, timeoutMs = 1e4) {
	const c = new AbortController();
	const t = setTimeout(() => c.abort(), timeoutMs);
	return fetch(url, {
		headers: HEADERS,
		signal: c.signal
	}).then((r) => r.text()).finally(() => clearTimeout(t));
}
function reqJson(url, timeoutMs = 1e4) {
	return reqText(url, timeoutMs).then((t) => JSON.parse(t));
}
function md5(text) {
	return createHash("md5").update(text).digest("hex");
}
function mapTrack(s) {
	const hash = String(s.hash ?? "");
	if (!hash || !s.songname) return void 0;
	const artists = String(s.singername ?? s.singer ?? "").split(/[/、,，]/).map((a) => a.trim()).filter(Boolean);
	const dur = Number(s.duration) || 0;
	const durationMs = dur > 1e4 ? dur : dur * 1e3;
	const albumId = String(s.album_id ?? "");
	return {
		id: `kugou:${hash}`,
		provider: "kugou",
		songId: hash,
		name: String(s.songname),
		artists,
		album: String(s.album_name ?? s.album ?? ""),
		durationMs,
		cover: albumId ? `https://img2.kugou.com/albumimg/150/${albumId}.jpg` : ""
	};
}
async function search(keyword, limit = 20, offset = 0) {
	const kw = keyword.trim();
	if (!kw) return [];
	const page = Math.floor(offset / limit) + 1;
	const url = `https://mobiles.kugou.com/api/v3/search/song?keyword=${encodeURIComponent(kw)}&page=${page}&pagesize=${limit}&format=json&plat=2&version=7910&area_code=1`;
	try {
		return ((await reqJson(url))?.data?.info ?? []).map(mapTrack).filter((t) => !!t);
	} catch {
		return [];
	}
}
const KG_APPKEY = "NVPhm6kzbTO1j6MmQvJsmxoNbQuW9pC9bc08tTTxwYB8wGaEwPzZxZyUW8WiBlMBaY1VZ1ZeBzpNYDZzf7Z0z0";
function kgSign(params) {
	const sorted = Object.keys(params).sort().map((k) => k + params[k]).join("");
	return md5(KG_APPKEY + sorted);
}
async function songUrl(hash, _quality = "standard") {
	const clean = hash.trim();
	if (!clean) return {
		url: "",
		reason: "MISSING_HASH"
	};
	const mobileUrl = `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${clean}&from=web`;
	try {
		const json = await reqJson(mobileUrl);
		const url = String(json?.url ?? "").trim();
		if (url) return {
			url: url.startsWith("//") ? `https:${url}` : url,
			quality: "standard"
		};
	} catch {}
	const params = {
		r: "play/getdata",
		hash: clean,
		appid: "1014",
		mid: "000000000000",
		platid: "4",
		dfid: "-",
		_: String(Date.now())
	};
	const sig = kgSign(params);
	const desktopUrl = `https://www.kugou.com/yy/index.php?${new URLSearchParams({
		...params,
		signature: sig
	}).toString()}`;
	try {
		const json = await reqJson(desktopUrl);
		const url = String(json?.data?.play_url ?? "").trim();
		if (url) return {
			url: url.startsWith("//") ? `https:${url}` : url,
			quality: "standard"
		};
	} catch {}
	return {
		url: "",
		reason: "KUGOU_URL_UNAVAILABLE"
	};
}
async function lyric(hash) {
	const empty = {
		lrc: "",
		tlyric: "",
		yrc: "",
		roma: ""
	};
	const clean = hash.trim();
	if (!clean) return empty;
	try {
		const json = await reqJson(`https://www.kugou.com/yy/index.php?r=play/getdata&hash=${clean}&appid=1014&platid=4`);
		return {
			...empty,
			lrc: String(json?.data?.lyrics ?? "")
		};
	} catch {
		return empty;
	}
}
async function authStatus() {
	return {
		provider: "kugou",
		loggedIn: false
	};
}
const kugouProvider = {
	id: "kugou",
	label: "酷狗音乐",
	description: "移动端公开接口直连（匿名）",
	search,
	songUrl,
	lyric,
	authStatus
};
//#endregion
//#region src/store/settings.ts
/**
* 插件设置 —— 通知 / 定时任务 / 反向推送开关。
* 声音通知与音箱文字提醒是两条独立通道：
* - notifySound：浏览器半播放提示音（Web Audio，无需任何硬件）
* - notifyHaloText：花再音箱屏幕文字（依赖设备连接）
* 持久化于 $DSH_HOME/dsh-music-huazai/settings.json。
*/
const DEFAULTS = {
	notifySound: true,
	notifyHaloText: true,
	schedulerEnabled: true,
	reversePushEnabled: false,
	enabledProviders: []
};
let cache$2 = null;
function file$2() {
	return join(dataDir(), "settings.json");
}
function bool(value, fallback) {
	return typeof value === "boolean" ? value : fallback;
}
function strArray(value) {
	if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value;
}
function load$1() {
	if (cache$2) return cache$2;
	try {
		if (existsSync(file$2())) {
			const raw = JSON.parse(readFileSync(file$2(), "utf8"));
			cache$2 = {
				notifySound: bool(raw.notifySound, DEFAULTS.notifySound),
				notifyHaloText: bool(raw.notifyHaloText, DEFAULTS.notifyHaloText),
				schedulerEnabled: bool(raw.schedulerEnabled, DEFAULTS.schedulerEnabled),
				reversePushEnabled: bool(raw.reversePushEnabled, DEFAULTS.reversePushEnabled),
				enabledProviders: strArray(raw.enabledProviders) ?? [...DEFAULTS.enabledProviders]
			};
			return cache$2;
		}
	} catch {}
	cache$2 = { ...DEFAULTS };
	return cache$2;
}
function getSettings() {
	return { ...load$1() };
}
function patchSettings(patch) {
	const current = load$1();
	const next = {
		notifySound: bool(patch.notifySound, current.notifySound),
		notifyHaloText: bool(patch.notifyHaloText, current.notifyHaloText),
		schedulerEnabled: bool(patch.schedulerEnabled, current.schedulerEnabled),
		reversePushEnabled: bool(patch.reversePushEnabled, current.reversePushEnabled),
		enabledProviders: strArray(patch.enabledProviders) ?? current.enabledProviders
	};
	cache$2 = next;
	try {
		writeFileSync(file$2(), JSON.stringify(next, null, 2), "utf8");
	} catch {}
	return { ...next };
}
/** 读取启用的音源 id（供 registry 使用）。 */
function loadEnabledProviderIds() {
	return getSettings().enabledProviders;
}
/** 持久化启用的音源 id（供 registry 使用）。 */
function saveEnabledProviderIds(ids) {
	patchSettings({ enabledProviders: ids });
}
//#endregion
//#region src/providers/registry.ts
/**
* Provider 注册表 —— 音源的可插拔中枢（对标 HaloLyricSync 的 factory.py）。
*
* 消费方（routes/tools/merge）只通过本表取用 Provider，新增平台无需改动它们。
* 新增源流程：
*   1. 在 providers/<x>.ts 实现 MusicProvider 接口并 export 一个对象；
*   2. 在 installBuiltinProviders() 里 registerProvider(...) 一次（或在运行时动态注册）。
*/
const registry = /* @__PURE__ */ new Map();
const enabled = /* @__PURE__ */ new Set();
/** 注册一个音源（默认启用）。重复注册会覆盖。 */
function registerProvider(provider) {
	registry.set(provider.id, provider);
	enabled.add(provider.id);
}
/** 按 id 取用（不存在返回 undefined）。 */
function getProvider(id) {
	return registry.get(id);
}
/** 是否存在某音源。 */
function hasProvider(id) {
	return registry.has(id);
}
/** 全部已注册音源（按插入顺序）。 */
function listProviders() {
	return [...registry.values()];
}
/** 所有已注册音源 id。 */
function allProviderIds() {
	return [...registry.keys()];
}
/** 设置启用/停用（未注册者忽略）。 */
function setEnabled(id, on) {
	if (!registry.has(id)) return;
	if (on) enabled.add(id);
	else enabled.delete(id);
	persistEnabled();
}
/** 是否启用。 */
function isEnabled(id) {
	return enabled.has(id);
}
/** 当前启用中的音源。 */
function enabledProviders() {
	return [...enabled].map((id) => registry.get(id)).filter((p) => !!p);
}
/** 当前启用中的音源 id。 */
function enabledProviderIds() {
	return [...enabled];
}
function persistEnabled() {
	saveEnabledProviderIds([...enabled]);
}
/**
* 注册内置音源（netease / qq）并应用设置里的启用集。
* 应在插件启动时调用一次（幂等）。
*/
function installBuiltinProviders() {
	registerProvider(neteaseProvider);
	registerProvider(qqProvider);
	registerProvider(kugouProvider);
	const saved = loadEnabledProviderIds();
	if (saved.length) {
		const savedSet = new Set(saved);
		for (const id of allProviderIds()) if (savedSet.has(id)) setEnabled(id, true);
		else if (KNOWN_PROVIDERS.includes(id)) setEnabled(id, true);
		else setEnabled(id, false);
	}
	persistEnabled();
}
//#endregion
//#region src/providers/merge.ts
/** 聚合搜索：并发多平台 → 合并去重（M2 简单交错，后续可升级 Mineradio 打分算法）。 */
async function aggregateSearch(options) {
	const keyword = options.keyword.trim();
	const limit = Math.min(Math.max(options.limit ?? 12, 1), 30);
	const offset = Math.max(options.offset ?? 0, 0);
	if (!keyword) return [];
	const wanted = options.providers ?? enabledProviders().map((p) => p.id);
	const tasks = [];
	for (const id of wanted) {
		const provider = getProvider(id);
		if (!provider) continue;
		tasks.push(provider.search(keyword, limit, offset).catch(() => []));
	}
	const results = await Promise.all(tasks);
	const seen = /* @__PURE__ */ new Set();
	const merged = [];
	for (const list of results) for (const track of list) {
		const key = `${track.provider}:${track.songId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		merged.push(track);
	}
	return merged;
}
//#endregion
//#region src/bridge.ts
const MAX_COMMANDS = 32;
let nowPlaying = null;
let lastReportAt = 0;
const pendingCommands = [];
function reportNowPlaying(report) {
	nowPlaying = report;
	lastReportAt = Date.now();
}
function nowPlayingSnapshot() {
	return {
		report: nowPlaying,
		stale: nowPlaying !== null && Date.now() - lastReportAt > 3e4
	};
}
function pushCommand(command) {
	if (pendingCommands.length >= MAX_COMMANDS) return false;
	pendingCommands.push(command);
	return true;
}
/** 浏览器轮询：取走全部待执行命令。 */
function drainCommands() {
	return pendingCommands.splice(0, pendingCommands.length);
}
//#endregion
//#region src/store/library.ts
/**
* 本地曲库 —— 多列表 + 播放统计，持久化于 $DSH_HOME/dsh-music-huazai/library.json。
* 列表内嵌曲目完整元数据（离线可见）；网易红心为虚拟列表由路由实时拉取。
*/
const FAV_ID = "fav";
function emptyLibrary() {
	return {
		lists: [{
			id: FAV_ID,
			name: "本地红心",
			kind: "favorites",
			tracks: []
		}],
		plays: {},
		recent: []
	};
}
let cache$1 = null;
function file$1() {
	return join(dataDir(), "library.json");
}
function load() {
	if (cache$1) return cache$1;
	try {
		if (existsSync(file$1())) {
			const raw = JSON.parse(readFileSync(file$1(), "utf8"));
			const data = {
				lists: Array.isArray(raw.lists) && raw.lists.length ? raw.lists : emptyLibrary().lists,
				plays: raw.plays ?? {},
				recent: Array.isArray(raw.recent) ? raw.recent : []
			};
			if (!data.lists.some((list) => list.id === FAV_ID)) data.lists.unshift({
				id: FAV_ID,
				name: "本地红心",
				kind: "favorites",
				tracks: []
			});
			cache$1 = data;
			return data;
		}
	} catch {}
	cache$1 = emptyLibrary();
	return cache$1;
}
function save() {
	if (!cache$1) return;
	try {
		writeFileSync(file$1(), JSON.stringify(cache$1, null, 2), "utf8");
	} catch {}
}
function getLists() {
	return load().lists;
}
/** 创建自定义列表；重名允许（id 区分）。 */
function createList(name) {
	const data = load();
	const list = {
		id: `l${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`,
		name: name.trim() || "新列表",
		kind: "custom",
		tracks: []
	};
	data.lists.push(list);
	save();
	return list;
}
function deleteList(id) {
	const data = load();
	const index = data.lists.findIndex((list) => list.id === id);
	if (index < 0 || data.lists[index]?.kind === "favorites") return false;
	data.lists.splice(index, 1);
	save();
	return true;
}
function addTrack(listId, track) {
	const list = load().lists.find((item) => item.id === listId);
	if (!list) return void 0;
	const key = trackKey(track);
	if (list.tracks.some((item) => trackKey(item) === key)) return "exists";
	list.tracks.push({ ...track });
	save();
	return "added";
}
function removeTrack(listId, trackId) {
	const list = load().lists.find((item) => item.id === listId);
	if (!list) return false;
	const before = list.tracks.length;
	list.tracks = list.tracks.filter((item) => trackKey(item) !== trackId);
	const changed = list.tracks.length !== before;
	if (changed) save();
	return changed;
}
/** 记录一次播放：计数 +1 并更新最近播放。 */
function recordPlay(track) {
	const data = load();
	const key = trackKey(track);
	const stat = data.plays[key];
	if (stat) {
		stat.count += 1;
		stat.lastAt = Date.now();
	} else data.plays[key] = {
		count: 1,
		lastAt: Date.now()
	};
	data.recent = [track, ...data.recent.filter((item) => trackKey(item) !== key)].slice(0, 100);
	save();
}
function getStats() {
	const data = load();
	return {
		plays: data.plays,
		recent: data.recent
	};
}
//#endregion
//#region src/recommend.ts
/**
* 推荐与「随便听听」逻辑 —— 从 routes.ts 拆分。
* - buildRecommendSections：每日推荐（登录）+ 热歌榜兜底
* - buildShuffleMix：曲库随机打乱开播
*/
/** 推荐分组：每日推荐（登录）+ 热歌榜兜底。 */
async function buildRecommendSections() {
	const sections = [];
	try {
		const daily = await dailyRecommend();
		if (daily.length) sections.push({
			source: "netease-daily",
			title: "每日推荐",
			tracks: daily.slice(0, 30)
		});
	} catch {}
	if (!sections.length) {
		const tracks = await chartTracksById("3778678", 30).catch(() => []);
		if (tracks.length) sections.push({
			source: "chart-3778678",
			title: "热歌榜",
			tracks
		});
	}
	return sections;
}
/**
* 随便听听：本地曲库 + 平台红心 混合后随机打乱开播。
* 未登录或曲库为空时，从公开榜单（热歌/飙升/新歌等）匿名补歌，保证开播即有曲。
*/
const SHUFFLE_SIZE = 36;
const FALLBACK_CHARTS = [
	"3778678",
	"19723756",
	"3779629",
	"2884035"
];
async function buildShuffleMix() {
	const seen = /* @__PURE__ */ new Set();
	const pool = [];
	const pushUnique = (track) => {
		if (!track) return;
		const key = trackKey(track);
		if (!key || seen.has(key)) return;
		seen.add(key);
		pool.push(track);
	};
	for (const list of getLists()) for (const track of list.tracks) pushUnique(track);
	try {
		for (const track of await likedTracks(300)) pushUnique(track);
	} catch {}
	if (pool.length < SHUFFLE_SIZE) for (const chartId of FALLBACK_CHARTS) {
		if (pool.length >= SHUFFLE_SIZE) break;
		try {
			const tracks = await chartTracksById(chartId, 30);
			for (const track of tracks) pushUnique(track);
		} catch {}
	}
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	return pool.slice(0, SHUFFLE_SIZE);
}
//#endregion
//#region src/halo/protocol.ts
/**
* 花再（EDIFIER Halo PixelBar）HID 协议 —— 移植自 Mineradio desktop/halo-lyric-sync.js。
* 设备：USB VID 0x2D99 / PID 0xA106，控制接口 usage page 0xFF14 / usage 1，包长 64 字节。
*
* 协议来源：
* - 文字包 v1：HaloLyricSync / HaloPixelToolBox
* - 增强指令 v2：Seraph310/halo-pixelbar-mcp PROTOCOL_NOTES
*/
const VENDOR_ID = 11673;
const PRODUCT_ID = 41222;
/** 对齐字节（v2 0xEF 01 包末字节）。 */
const ALIGN = {
	left: 0,
	center: 1,
	right: 2,
	justify: 3
};
/** 内置场景分类（UI 模式包）。 */
const SCENE_CATEGORY = {
	clock: 0,
	game: 1,
	work: 2,
	reading: 3,
	cats: 4,
	dogs: 5,
	memes: 6,
	cyber: 7,
	waves: 8
};
/** 文本校验和：acc=128; for b: acc += b+2; acc%256。 */
function checksumV1(textBytes) {
	let acc = 128;
	for (const b of textBytes) acc += b + 2;
	return acc % 256;
}
/** v2 校验和：从 AA 字节（索引1）起求和 mod 256。 */
function checksumV2(packetBeforeChecksum) {
	let sum = 0;
	for (let i = 1; i < packetBeforeChecksum.length; i++) sum += packetBeforeChecksum[i] ?? 0;
	return sum % 256;
}
function pad64(buf) {
	if (buf.length >= 64) return buf.subarray(0, 64);
	const out = Buffer.alloc(64, 0);
	buf.copy(out, 0);
	return out;
}
/** CJK 近似显示宽度。 */
function displayWidth(text) {
	let width = 0;
	for (const ch of text) {
		const code = ch.codePointAt(0) ?? 0;
		width += code > 11904 && code < 65440 ? 2 : 1;
	}
	return width;
}
/**
* 清洗设备文本：剔除非 BMP 字符（emoji 等 4 字节 UTF-8 序列）。
* 固件解码器不支持 4 字节序列，一个 emoji 会打乱后续全部多字节解析，
* 使中文显示为「？」；控制字符一并剔除。
*/
function sanitizeDeviceText(text) {
	return Array.from(String(text ?? "")).filter((ch) => {
		const code = ch.codePointAt(0) ?? 0;
		return code >= 32 && code <= 65535;
	}).join("").replace(/\s+/g, " ").trim();
}
/**
* 文字包 v1：`2E AA EC E8 + 颜色(1) + 总长(2 LE) + 文本长(1) + UTF-8 + 校验和(1)`。
* 颜色必须为 0（白）：非零颜色字节会触发固件复位并掉线。
*/
function buildTextPacket(text, colorByte = 0, maxChars = 32) {
	let s = sanitizeDeviceText(text);
	while ((displayWidth(s) > maxChars || Buffer.byteLength(s, "utf-8") > 54) && s.length > 0) s = s.slice(0, -1);
	const textBytes = Buffer.from(s, "utf-8");
	const totalLen = 1 + textBytes.length + 1;
	const pkt = Buffer.alloc(8 + textBytes.length + 1);
	pkt[0] = 46;
	pkt[1] = 170;
	pkt[2] = 236;
	pkt[3] = 232;
	pkt[4] = colorByte & 255;
	pkt.writeUInt16LE(totalLen, 5);
	pkt[7] = textBytes.length & 255;
	textBytes.copy(pkt, 8);
	pkt[8 + textBytes.length] = checksumV1(textBytes);
	return pad64(pkt);
}
/** v2 通用帧：`2E AA ED <cmd> <len-hi> <len-lo> <payload> <checksum>`。 */
function buildFrameV2(cmd, payload) {
	const head = Buffer.from([
		46,
		170,
		237,
		cmd,
		payload.length >> 8 & 255,
		payload.length & 255
	]);
	const before = Buffer.concat([head, payload]);
	return pad64(Buffer.concat([before, Buffer.from([checksumV2(before)])]));
}
/** 屏色：cmd 0xEF payload 03 R G B ... */
function buildScreenColorPacket(r, g, b) {
	return buildFrameV2(239, Buffer.from([
		3,
		r & 255,
		g & 255,
		b & 255,
		0,
		0,
		255,
		255,
		255
	]));
}
/** 对齐模式：cmd 0xEF payload 01 R G B 00 02 00 <align> FF */
function buildAlignPacket(alignByte, r, g, b) {
	return buildFrameV2(239, Buffer.from([
		1,
		r & 255,
		g & 255,
		b & 255,
		0,
		2,
		0,
		alignByte & 255,
		255
	]));
}
/** 动态右到左滚动：cmd 0xEF payload 01 R G B 00 02 01 01 FF */
function buildDynamicTextPacket(r, g, b) {
	return buildFrameV2(239, Buffer.from([
		1,
		r & 255,
		g & 255,
		b & 255,
		0,
		2,
		1,
		1,
		255
	]));
}
/** UI 场景包：颜色固定 F0 B4 C8（与官方 TempoHub 一致，规避改字体色导致设备复位）。 */
function buildScenePacket(category) {
	const payload = Buffer.from([
		2,
		240,
		180,
		200,
		0,
		1,
		category & 255,
		255,
		255
	]);
	const before = Buffer.from([
		46,
		170,
		236,
		239,
		0,
		9,
		...payload
	]);
	return pad64(Buffer.concat([before, Buffer.from([checksumV2(before), 0])]));
}
/** 时钟样式包：style 1..11 → index = style-1；校验和 (0xFFFB+index)&0xFFFF 小端。 */
function buildClockPacket(style) {
	const index = (Math.trunc(Number(style)) || 1) - 1 & 255;
	const head = Buffer.from([
		46,
		170,
		236,
		239,
		0,
		9,
		1,
		240,
		180,
		200,
		0,
		1
	]);
	const pkt = Buffer.alloc(17);
	head.copy(pkt, 0);
	pkt[12] = index >> 8 & 255;
	pkt[13] = index & 255;
	pkt[14] = 255;
	const checksum = 65531 + index & 65535;
	pkt[15] = checksum & 255;
	pkt[16] = checksum >> 8 & 255;
	return pad64(pkt);
}
/** 频谱样式包：style 1..4 → styleIndex 0..3；校验和 (0x0040+8+idx)&0xFFFF 小端。 */
function buildSpectrumPacket(style) {
	const styleIndex = (Math.trunc(Number(style)) | 0) - 1 & 255;
	const pkt = Buffer.alloc(17);
	Buffer.from([
		46,
		170,
		236,
		239,
		0,
		9,
		1,
		192,
		255,
		242,
		0,
		1,
		8
	]).copy(pkt, 0);
	pkt[13] = styleIndex & 255;
	pkt[14] = 255;
	const checksum = 72 + styleIndex & 65535;
	pkt[15] = checksum & 255;
	pkt[16] = checksum >> 8 & 255;
	return pad64(pkt);
}
//#endregion
//#region src/halo/sync.ts
/**
* 花再同步服务 —— HID 设备管理 + 歌词/切歌/播放状态事件入口。
* 逻辑移植自 Mineradio HaloSync：换行去重、切歌信息 3 秒过渡、暂停时钟、特性降级。
* 所有调用尽力而为：设备不在线/未启用时空转，不影响播放器本体。
*/
const hexId = (n) => "0x" + (Number(n) || 0).toString(16).toUpperCase().padStart(4, "0");
const DEFAULT_CONFIG = {
	enabled: false,
	align: "center",
	dynamicScroll: false,
	idleClockWhenPaused: true,
	maxCharsPerLine: 32,
	notifyDurationSec: 0,
	screenColor: {
		r: 102,
		g: 175,
		b: 255
	}
};
function configPath() {
	return join(dataDir(), "halo.json");
}
/**
* 惰性加载 node-hid（原生模块）。缺失/加载失败时返回错误信息，
* 并实测一次枚举——旧版包装器能 require 成功但调用即抛「Could not locate the bindings file」，
* 不实测会把「假可用」误判为正常，导致永远找不到设备。
*/
function loadHid() {
	try {
		const hid = createRequire(import.meta.url)("node-hid");
		if (!hid || typeof hid.devices !== "function" && typeof hid.enumerate !== "function") return {
			hid: null,
			error: "node-hid 版本异常（缺少枚举接口）"
		};
		if (typeof hid.setDriverType === "function") try {
			if (process.platform === "win32") hid.setDriverType("windows");
		} catch {}
		try {
			(hid.enumerate ?? hid.devices).call(hid);
		} catch (cause) {
			return {
				hid: null,
				error: `HID 原生模块不可用：${cause instanceof Error ? cause.message : String(cause)}（请重装依赖或升级 node-hid ≥3）`
			};
		}
		return {
			hid,
			error: ""
		};
	} catch (cause) {
		return {
			hid: null,
			error: `node-hid 加载失败：${cause instanceof Error ? cause.message : String(cause)}（未安装可选依赖）`
		};
	}
}
var HaloSync = class {
	config;
	hid = null;
	device = null;
	connected = false;
	simulated = false;
	/** node-hid 加载/枚举层面的错误（模拟模式或枚举异常时给 UI 展示）。 */
	hidError = "";
	/** 最近一次连接失败原因（设备未找到/打开失败），成功后清空。 */
	connectError = "";
	playing = false;
	lastLine = null;
	notifyPinned = false;
	songTextUntil = 0;
	featureFails = {};
	featureDisabled = {};
	featureDisabledAt = {};
	devicesCacheAt = 0;
	devicesCacheCount = 0;
	constructor() {
		this.config = this.loadConfig();
	}
	loadConfig() {
		try {
			const file = configPath();
			if (existsSync(file)) {
				const raw = JSON.parse(readFileSync(file, "utf8"));
				return {
					...DEFAULT_CONFIG,
					...raw
				};
			}
		} catch {}
		return { ...DEFAULT_CONFIG };
	}
	getConfig() {
		return { ...this.config };
	}
	setConfig(patch) {
		const prev = this.config;
		this.config = {
			...this.config,
			...patch
		};
		if (patch.enabled === true) this.connect();
		if (patch.enabled === false) {
			try {
				this.restoreClock();
			} catch {}
			this.disconnect();
		}
		if ((patch.dynamicScroll !== void 0 && patch.dynamicScroll !== prev.dynamicScroll || patch.align !== void 0 && patch.align !== prev.align || !!patch.screenColor && (patch.screenColor.r !== prev.screenColor.r || patch.screenColor.g !== prev.screenColor.g || patch.screenColor.b !== prev.screenColor.b)) && this.connected) this.applyScreenMode();
		if (patch.maxCharsPerLine !== void 0 && patch.maxCharsPerLine !== prev.maxCharsPerLine) this.lastLine = null;
		if (patch.idleClockWhenPaused === true && !prev.idleClockWhenPaused && !this.playing && this.connected) this.sendFeature("clock", buildClockPacket(1));
		try {
			writeFileSync(configPath(), JSON.stringify(this.config, null, 2), "utf8");
		} catch {}
		return this.getConfig();
	}
	listDevices() {
		if (!this.hid) {
			const loaded = loadHid();
			if (loaded.hid) this.hid = loaded.hid;
			else this.hidError = loaded.error;
		}
		if (!this.hid) return [];
		try {
			const fn = this.hid.enumerate ?? this.hid.devices;
			const list = typeof fn === "function" ? fn.call(this.hid) : [];
			const arr = Array.isArray(list) ? list : [];
			this.devicesCacheAt = Date.now();
			this.devicesCacheCount = arr.length;
			return arr;
		} catch (cause) {
			this.hidError = `枚举 HID 失败：${cause instanceof Error ? cause.message : String(cause)}`;
			return [];
		}
	}
	status() {
		if (Date.now() - this.devicesCacheAt > 15e3) this.listDevices();
		if (this.config.enabled && !this.connected) this.ensureConnected();
		return {
			enabled: this.config.enabled,
			connected: this.connected,
			simulated: this.simulated,
			playing: this.playing,
			devices: this.devicesCacheCount,
			hidError: this.hidError,
			connectError: this.connectError,
			config: this.getConfig()
		};
	}
	findDevice() {
		if (!this.hid) return null;
		let devices = [];
		try {
			const fn = this.hid.enumerate ?? this.hid.devices;
			devices = typeof fn === "function" ? fn.call(this.hid) : [];
		} catch {
			return null;
		}
		const exact = devices.filter((d) => d.vendorId === 11673 && d.productId === 41222 && d.usagePage === 65300 && d.usage === 1);
		if (exact[0]) return exact[0];
		const byVidPid = devices.filter((d) => d.vendorId === 11673 && d.productId === 41222);
		if (byVidPid[0]) return byVidPid[0];
		const byVendor = devices.filter((d) => d.vendorId === VENDOR_ID);
		if (byVendor[0]) {
			logWarn(`[halo] 未精确匹配 ${hexId(VENDOR_ID)}:${hexId(PRODUCT_ID)}，改用同厂商设备（PID ${hexId(byVendor[0].productId)}）`);
			return byVendor[0];
		}
		return null;
	}
	async connect() {
		if (!this.config.enabled) return false;
		if (this.connected) return true;
		this.connectError = "";
		if (!this.hid) {
			const loaded = loadHid();
			if (loaded.hid) this.hid = loaded.hid;
			else this.hidError = loaded.error;
		}
		if (!this.hid) {
			this.connected = true;
			this.simulated = true;
			return true;
		}
		const info = this.findDevice();
		if (!info?.path) {
			const dump = this.listDevices().map((d) => `${hexId(d.vendorId)}:${hexId(d.productId)} up=${d.usagePage} u=${d.usage}`).join(" | ") || "(无 HID 设备)";
			const count = this.devicesCacheCount;
			this.connectError = count > 0 ? `未找到花再设备（检测到 ${count} 台 HID，但无 ${hexId(VENDOR_ID)}:${hexId(PRODUCT_ID)}）` : "未找到花再设备（未枚举到任何 HID 设备）";
			logWarn(`[halo] USB 未连接或驱动未就绪。已枚举 HID: ${dump}`);
			return false;
		}
		try {
			const dev = new this.hid.HID(info.path);
			dev.setNonBlocking(1);
			this.device = dev;
			this.connected = true;
			this.simulated = false;
			this.hidError = "";
			logInfo(`[halo] 已连接花再音箱（${hexId(VENDOR_ID)}:${hexId(PRODUCT_ID)}）`);
			this.applyScreenMode();
			return true;
		} catch (cause) {
			this.connectError = `打开花再设备失败：${cause instanceof Error ? cause.message : String(cause)}`;
			logWarn(`[halo] 打开花再设备失败: ${cause instanceof Error ? cause.message : String(cause)}`);
			return false;
		}
	}
	disconnect() {
		if (this.device) try {
			this.device.close();
		} catch {}
		this.device = null;
		this.connected = false;
	}
	/** 退出时把音响恢复到时钟界面（移植 Mineradio restoreInitialState：时钟包 + 时钟场景包双保险）。 */
	restoreClock() {
		if (!this.connected) return;
		try {
			this.sendRaw(buildClockPacket(1));
			this.sendRaw(buildScenePacket(SCENE_CATEGORY.clock));
		} catch {}
	}
	/** 卸载/退出清理：先恢复时钟再断开设备。 */
	dispose() {
		try {
			this.restoreClock();
		} catch {}
		try {
			this.disconnect();
		} catch {}
	}
	/** 屏色 + 对齐/滚动模式（连接后初始化用）。 */
	applyScreenMode() {
		const { r, g, b } = this.config.screenColor;
		this.sendRaw(buildScreenColorPacket(r, g, b));
		if (this.config.dynamicScroll) this.sendRaw(buildDynamicTextPacket(r, g, b));
		else this.sendRaw(buildAlignPacket(ALIGN[this.config.align] ?? ALIGN.center, r, g, b));
	}
	sendRaw(packet) {
		if (!this.connected || !packet) return false;
		if (this.simulated || !this.device) return true;
		try {
			const res = this.device.write(packet);
			if (res < 0) throw new Error(`write ${res}`);
			return true;
		} catch {
			if (!this.reopen()) this.connected = false;
			return false;
		}
	}
	/** 特性安全降级：非文字包连续 3 次失败则临时禁用该特性，保住歌词通道。 */
	sendFeature(feature, packet) {
		if (feature !== "text" && this.featureDisabled[feature] === true) {
			if (Date.now() - (this.featureDisabledAt[feature] ?? 0) > 3e5) {
				this.featureDisabled[feature] = false;
				this.featureFails[feature] = 0;
			} else return false;
		}
		const ok = this.sendRaw(packet);
		if (ok) {
			const fails = this.featureFails[feature];
			if (fails != null && fails > 0) this.featureFails[feature] = fails - 1;
		} else if (feature !== "text") {
			this.featureFails[feature] = (this.featureFails[feature] ?? 0) + 1;
			if (this.featureFails[feature] >= 3) {
				this.featureDisabled[feature] = true;
				this.featureDisabledAt[feature] = Date.now();
				logWarn(`[halo] 特性 ` + feature + ` 连续失败，已临时禁用（5 分钟后自动重试）`);
			}
		}
		return ok;
	}
	reopen() {
		try {
			this.device?.close();
		} catch {}
		this.device = null;
		const info = this.findDevice();
		if (!info?.path) return false;
		try {
			const hidCtor = this.hid?.HID;
			if (typeof hidCtor !== "function") return false;
			const dev = new hidCtor(info.path);
			dev.setNonBlocking(1);
			this.device = dev;
			return true;
		} catch {
			return false;
		}
	}
	lastConnectAttempt = 0;
	/** 惰性连接：未连接时限流尝试（5s），插拔后尽快自动恢复。 */
	ensureConnected() {
		if (!this.config.enabled || this.connected) return;
		const now = Date.now();
		if (now - this.lastConnectAttempt < 5e3) return;
		this.lastConnectAttempt = now;
		this.connect();
	}
	onLyric(text) {
		if (!this.config.enabled || !this.playing) return;
		this.ensureConnected();
		const line = String(text ?? "").trim();
		if (!line || line === this.lastLine) return;
		this.lastLine = line;
		if (Date.now() < this.songTextUntil || this.notifyPinned) return;
		this.sendFeature("text", buildTextPacket(line, 0, this.config.maxCharsPerLine));
	}
	onSong(name, artist) {
		if (!this.config.enabled) return;
		this.ensureConnected();
		const info = `${name || "未知"} - ${artist}`.trimEnd();
		this.notifyPinned = false;
		this.songTextUntil = Date.now() + 3e3;
		this.lastLine = null;
		this.sendFeature("text", buildTextPacket(info, 0, this.config.maxCharsPerLine));
	}
	onPlayState(playing) {
		if (!this.config.enabled) return;
		this.playing = !!playing;
		if (!playing) {
			this.lastLine = null;
			if (this.config.idleClockWhenPaused) this.sendFeature("clock", buildClockPacket(1));
		}
	}
	/**
	* 文字提醒（通知通道）：不要求正在播放，直接上屏并压制歌词。
	* 时长取 config.notifyDurationSec（默认 8s；<=0 表示置顶，直到 dismissNotify 或切歌）。
	* 设备未连接时先走一次显式重连并短暂等待，避免静默丢通知。
	*/
	async onNotify(text) {
		if (!this.config.enabled) return false;
		const line = String(text ?? "").trim();
		if (!line) return false;
		if (!this.connected) {
			await this.connect().catch(() => false);
			for (let i = 0; i < 10 && !this.connected; i++) await new Promise((resolve) => setTimeout(resolve, 200));
		}
		if (!this.connected) {
			logWarn("[halo] notify 发送失败：设备未连接（USB 未插或驱动未就绪）");
			return false;
		}
		const seconds = Math.trunc(Number(this.config.notifyDurationSec ?? 8));
		this.notifyPinned = !(seconds > 0);
		this.songTextUntil = Date.now() + Math.max(seconds, 1) * 1e3;
		this.lastLine = null;
		const ok = this.sendFeature("text", buildTextPacket(line, 0, this.config.maxCharsPerLine));
		if (ok && !this.notifyPinned) {
			const until = this.songTextUntil;
			setTimeout(() => {
				if (this.notifyPinned || this.playing || Date.now() < this.songTextUntil) return;
				if (until !== this.songTextUntil) return;
				if (this.config.idleClockWhenPaused) this.sendFeature("clock", buildClockPacket(1));
			}, Math.max(seconds, 1) * 1e3 + 300);
		}
		return ok;
	}
	/** 消除置顶/展示中的通知：立即恢复上一句歌词；暂停中则回时钟。 */
	dismissNotify() {
		this.notifyPinned = false;
		this.songTextUntil = 0;
		if (!this.config.enabled || !this.connected) return false;
		if (this.playing && this.lastLine) this.sendFeature("text", buildTextPacket(this.lastLine, 0, this.config.maxCharsPerLine));
		else if (!this.playing && this.config.idleClockWhenPaused) {
			this.lastLine = null;
			this.sendFeature("clock", buildClockPacket(1));
		}
		return true;
	}
	/** 屏色设置：走 setConfig 以持久化并即时重发屏幕模式。 */
	sendScreenColor(r, g, b) {
		if (!this.connected) return false;
		const clamp = (v) => Math.min(255, Math.max(0, Math.round(v)));
		this.setConfig({ screenColor: {
			r: clamp(r),
			g: clamp(g),
			b: clamp(b)
		} });
		return true;
	}
	sendScene(name) {
		const category = SCENE_CATEGORY[name];
		if (category == null) return false;
		return this.sendFeature("scene", buildScenePacket(category));
	}
	sendSpectrum(style) {
		if (!(style >= 1 && style <= 4)) return false;
		return this.sendFeature("spectrum", buildSpectrumPacket(style));
	}
	sendClock(style) {
		if (!(style >= 1 && style <= 11)) return false;
		return this.sendFeature("clock", buildClockPacket(style));
	}
};
/** 页面级单例（宿主进程内）。 */
let instance;
function getHaloSync() {
	instance = instance ?? new HaloSync();
	return instance;
}
//#endregion
//#region src/halo/routes.ts
function json$1(res, status, value) {
	const body = JSON.stringify(value);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(body);
}
function requireMethod$1(req, res, method) {
	if (req.method === method) return true;
	json$1(res, 405, {
		ok: false,
		error: `method ${req.method} not allowed`
	});
	return false;
}
async function readJsonBody$1(req) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		chunks.push(chunk);
		total += chunk.length;
		if (total > 1048576) throw new Error("body too large（上限 1MB）");
	}
	const text = Buffer.concat(chunks).toString("utf8");
	if (!text) return {};
	try {
		const parsed = JSON.parse(text);
		return typeof parsed === "object" && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}
function makeHaloRoutes() {
	const get = (path, run) => ({
		kind: "exact",
		path,
		handler(req, res) {
			if (!requireMethod$1(req, res, "GET")) return;
			const query = new URL(req.url ?? "/", "http://localhost").searchParams;
			run(query).then((value) => json$1(res, 200, {
				ok: true,
				...value
			}), (error) => {
				json$1(res, 500, {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}
	});
	const post = (path, run) => ({
		kind: "exact",
		path,
		handler(req, res) {
			if (!requireMethod$1(req, res, "POST")) return Promise.resolve();
			return readJsonBody$1(req).then((body) => run(body).then((value) => json$1(res, 200, {
				ok: true,
				...value
			}), (error) => {
				json$1(res, 400, {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				});
			}));
		}
	});
	return [
		get(`${API_PREFIX}/halo/status`, async () => ({ halo: getHaloSync().status() })),
		post(`${API_PREFIX}/halo/config`, async (body) => {
			const patch = body.config ?? {};
			return { config: getHaloSync().setConfig(patch) };
		}),
		post(`${API_PREFIX}/halo/lyric`, async (body) => {
			getHaloSync().onLyric(String(body.text ?? ""));
			return {};
		}),
		post(`${API_PREFIX}/halo/song`, async (body) => {
			getHaloSync().onSong(String(body.name ?? ""), String(body.artist ?? ""));
			return {};
		}),
		post(`${API_PREFIX}/halo/state`, async (body) => {
			getHaloSync().onPlayState(body.playing === true);
			return {};
		}),
		post(`${API_PREFIX}/halo/notify/dismiss`, async () => {
			getHaloSync().dismissNotify();
			return {};
		}),
		post(`${API_PREFIX}/halo/command`, async (body) => {
			const halo = getHaloSync();
			const kind = String(body.kind ?? "");
			if (kind === "scene") return { ok: halo.sendScene(String(body.value ?? "")) };
			if (kind === "spectrum") return { ok: halo.sendSpectrum(Number(body.value) || 0) };
			if (kind === "clock") return { ok: halo.sendClock(Number(body.value) || 1) };
			throw new Error(`bad kind: ${kind}`);
		}),
		...makeNotifySoundRoutes()
	];
}
const SOUND_EXTS = [
	"mp3",
	"wav",
	"ogg",
	"m4a",
	"flac"
];
const MAX_SOUND_BYTES = 3145728;
const CONTENT_TYPE = {
	mp3: "audio/mpeg",
	wav: "audio/wav",
	ogg: "audio/ogg",
	m4a: "audio/mp4",
	flac: "audio/flac"
};
function soundPath(ext) {
	return join(dataDir(), `notify-sound.${ext}`);
}
function findSoundFile() {
	for (const ext of SOUND_EXTS) try {
		const file = soundPath(ext);
		if (existsSync(file)) return {
			ext,
			bytes: readFileSync(file)
		};
	} catch {}
	return null;
}
/** 魔数校验：防止改扩展名伪装，避免浏览器解码崩溃。 */
function sniffSoundExt(bytes) {
	const ascii = (start, len) => bytes.subarray(start, start + len).toString("latin1");
	if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "wav";
	if (bytes.length >= 4 && ascii(0, 3) === "ID3") return "mp3";
	if (bytes.length >= 2 && bytes[0] === 255 && (bytes[1] & 224) === 224) return "mp3";
	if (bytes.length >= 4 && ascii(0, 4) === "OggS") return "ogg";
	if (bytes.length >= 12 && ascii(4, 4) === "ftyp") return "m4a";
	if (bytes.length >= 4 && ascii(0, 4) === "fLaC") return "flac";
	return null;
}
/** 清掉其它扩展名的旧文件，保证全库只有一份自定义提示音。 */
function removeOtherSounds(keep) {
	for (const ext of SOUND_EXTS) {
		if (ext === keep) continue;
		try {
			const file = soundPath(ext);
			if (existsSync(file)) unlinkSync(file);
		} catch {}
	}
}
function makeNotifySoundRoutes() {
	return [
		{
			kind: "exact",
			path: `${API_PREFIX}/notify/sound/upload`,
			handler(req, res) {
				if (!requireMethod$1(req, res, "POST")) return;
				(async () => {
					try {
						const chunks = [];
						let total = 0;
						for await (const chunk of req) {
							total += chunk.length;
							if (total > MAX_SOUND_BYTES) throw new Error(`文件过大（上限 ${MAX_SOUND_BYTES / 1024 / 1024}MB）`);
							chunks.push(chunk);
						}
						const bytes = Buffer.concat(chunks);
						if (bytes.length < 32) throw new Error("文件太小，不像有效音频");
						const ext = sniffSoundExt(bytes);
						if (!ext) throw new Error("不支持的音频格式（仅 mp3/wav/ogg/m4a/flac）");
						mkdirSync(dataDir(), { recursive: true });
						removeOtherSounds(ext);
						writeFileSync(soundPath(ext), bytes);
						json$1(res, 200, {
							ok: true,
							exists: true,
							ext,
							bytes: bytes.length
						});
					} catch (error) {
						json$1(res, 400, {
							ok: false,
							error: error instanceof Error ? error.message : String(error)
						});
					}
				})();
			}
		},
		{
			kind: "exact",
			path: `${API_PREFIX}/notify/sound/info`,
			handler(req, res) {
				if (!requireMethod$1(req, res, "GET")) return;
				const found = findSoundFile();
				json$1(res, 200, found ? {
					ok: true,
					exists: true,
					ext: found.ext,
					bytes: found.bytes.length
				} : {
					ok: true,
					exists: false
				});
			}
		},
		{
			kind: "exact",
			path: `${API_PREFIX}/notify/sound/file`,
			handler(req, res) {
				if (!requireMethod$1(req, res, "GET")) return;
				const found = findSoundFile();
				if (!found) {
					res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
					res.end(JSON.stringify({
						ok: false,
						error: "no custom sound"
					}));
					return;
				}
				res.writeHead(200, {
					"content-type": CONTENT_TYPE[found.ext],
					"content-length": found.bytes.length,
					"cache-control": "no-store"
				});
				res.end(found.bytes);
			}
		},
		{
			kind: "exact",
			path: `${API_PREFIX}/notify/sound/reset`,
			handler(req, res) {
				if (!requireMethod$1(req, res, "POST")) return;
				removeOtherSounds();
				json$1(res, 200, {
					ok: true,
					exists: false
				});
			}
		}
	];
}
//#endregion
//#region src/notify.ts
/**
* 通知分发 —— 把提醒送到两条相互独立的通道：
* - 声音：经桥下发浏览器半播放提示音（受 settings.notifySound 控制）
* - 音箱文字：直写花再屏幕（受 settings.notifyHaloText 控制，依赖设备连接）
*/
async function dispatchNotify(title, text = "") {
	const settings = getSettings();
	const result = {
		soundQueued: false,
		haloTextSent: false
	};
	const body = `${title}${text ? `：${text}` : ""}`.trim();
	if (settings.notifySound) result.soundQueued = pushCommand({
		type: "notify",
		title,
		text
	});
	if (settings.notifyHaloText) try {
		result.haloTextSent = await getHaloSync().onNotify(body);
		if (!result.haloTextSent) logWarn("[notify] 音箱未连接，文字提醒未送达");
	} catch (cause) {
		logWarn(`[notify] 音箱提醒失败: ${cause instanceof Error ? cause.message : String(cause)}`);
	}
	return result;
}
//#endregion
//#region src/scheduler.ts
/**
* 定时任务 —— 音乐闹钟（每日 HH:mm 搜歌开播）+ 睡眠定时器（到点暂停）。
* 受 settings.schedulerEnabled 总开关控制；触发走桥下发浏览器执行，
* 并按通知开关做声音/音箱提醒。闹钟持久化于 $DSH_HOME/dsh-music-huazai/schedule.json。
*/
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
let cache = null;
const firedToday = /* @__PURE__ */ new Set();
let sleepTimer = null;
let sleepEndsAt = 0;
function file() {
	return join(dataDir(), "schedule.json");
}
function loadAlarms() {
	if (cache) return cache;
	try {
		if (existsSync(file())) {
			const raw = JSON.parse(readFileSync(file(), "utf8"));
			if (Array.isArray(raw)) {
				cache = raw.filter((item) => item && typeof item.id === "string" && TIME_RE.test(String(item.time ?? ""))).map((item) => ({
					id: String(item.id),
					time: String(item.time),
					keyword: String(item.keyword ?? ""),
					label: typeof item.label === "string" ? item.label : void 0
				}));
				return cache;
			}
		}
	} catch {}
	cache = [];
	return cache;
}
function saveAlarms() {
	if (!cache) return;
	try {
		writeFileSync(file(), JSON.stringify(cache, null, 2), "utf8");
	} catch {}
}
function todayKey() {
	const d = /* @__PURE__ */ new Date();
	return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
async function fireAlarm(alarm) {
	let played = "";
	try {
		const track = (await aggregateSearch({
			keyword: alarm.keyword,
			limit: 1
		}))[0];
		if (track) {
			pushCommand({
				type: "play",
				track
			});
			played = `${track.name} - ${track.artists.join(" / ")}`;
		}
	} catch {}
	pushCommand({ type: "resume" });
	dispatchNotify(alarm.label || "音乐闹钟", played || `没找到「${alarm.keyword}」，请手动播放`);
}
function tick() {
	if (!getSettings().schedulerEnabled) return;
	const d = /* @__PURE__ */ new Date();
	const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
	const dayKey = todayKey();
	for (const alarm of loadAlarms()) {
		if (alarm.time !== hhmm) continue;
		const key = `${alarm.id}:${dayKey}`;
		if (firedToday.has(key)) continue;
		firedToday.add(key);
		fireAlarm(alarm);
	}
	if (firedToday.size > 200) {
		for (const key of firedToday) if (!key.endsWith(`:${dayKey}`)) firedToday.delete(key);
	}
}
function listAlarms() {
	return [...loadAlarms()];
}
function addAlarm(time, keyword, label) {
	const normalized = String(time ?? "").trim();
	if (!TIME_RE.test(normalized)) throw new Error("时间格式应为 HH:mm（24 小时制），如 07:30");
	const kw = String(keyword ?? "").trim();
	if (!kw) throw new Error("需要提供要播放的歌（keyword）");
	const alarm = {
		id: `a${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`,
		time: normalized,
		keyword: kw,
		label: label?.trim() || void 0
	};
	loadAlarms().push(alarm);
	saveAlarms();
	return alarm;
}
function removeAlarm(id) {
	const list = loadAlarms();
	const before = list.length;
	cache = list.filter((item) => item.id !== id);
	saveAlarms();
	return cache.length !== before;
}
/** 设置睡眠定时器；minutes<=0 视为取消。返回结束时间戳。 */
function startSleepTimer(minutes) {
	cancelSleepTimer();
	if (!(minutes > 0)) return 0;
	sleepEndsAt = Date.now() + minutes * 6e4;
	sleepTimer = setTimeout(() => {
		sleepTimer = null;
		sleepEndsAt = 0;
		pushCommand({ type: "pause" });
		dispatchNotify("睡眠定时", "时间到，已暂停播放");
	}, minutes * 6e4);
	return sleepEndsAt;
}
function cancelSleepTimer() {
	if (sleepTimer) clearTimeout(sleepTimer);
	const had = sleepTimer != null;
	sleepTimer = null;
	sleepEndsAt = 0;
	return had;
}
function sleepRemainingSec() {
	return sleepEndsAt > 0 ? Math.max(0, Math.round((sleepEndsAt - Date.now()) / 1e3)) : 0;
}
function scheduleSnapshot() {
	return {
		alarms: listAlarms(),
		sleepRemainingSec: sleepRemainingSec(),
		schedulerEnabled: getSettings().schedulerEnabled
	};
}
const TICK_MS = 2e4;
/** 启动调度循环（幂等）。 */
function startScheduler() {
	const handle = setInterval(tick, TICK_MS);
	return () => clearInterval(handle);
}
//#endregion
//#region src/reverse.ts
const BURST_GAP_MS = 3e3;
let lastAt = 0;
/** 已成功写入的曲目：换歌才写（避免 2s 上报重复刷屏）；失败允许重试。 */
let lastWrittenTrackId = "";
/** 取末条事件的时间戳（无事件退化为 createdAt），用于挑最近活跃会话。 */
function activityOf(agent) {
	try {
		const session = agent.session;
		const events = session?.events;
		if (Array.isArray(events) && events.length > 0) return Number(events[events.length - 1]?.time ?? 0);
		return Number(session?.header?.createdAt ?? 0);
	} catch {
		return 0;
	}
}
function pickTarget(pool) {
	const usable = pool.filter((item) => typeof item?.session?.append === "function");
	if (!usable.length) return void 0;
	return usable.reduce((best, item) => activityOf(item) > activityOf(best) ? item : best);
}
function maybeReversePush(ctx, report, isNewTrack) {
	if (!getSettings().reversePushEnabled) return;
	if (!isNewTrack || !report.name) return;
	if (report.trackId === lastWrittenTrackId) return;
	const now = Date.now();
	if (now - lastAt < BURST_GAP_MS) return;
	lastAt = now;
	(async () => {
		try {
			const registry = ctx.agents;
			if (!registry || typeof registry.list !== "function") {
				logWarn("[reverse] ctx.agents 服务不可用，跳过反向推送");
				return;
			}
			const roots = typeof registry.roots === "function" ? registry.roots() : [];
			const all = registry.list();
			const target = pickTarget([...roots, ...all]);
			if (!target) {
				logWarn(`[reverse] 无可写入会话（roots=${roots.length}, all=${all.length}），跳过`);
				return;
			}
			const text = `正在播放：${report.name} - ${report.artists.join(" / ")}`;
			const mod = await import("@deepseek-ai/dsh-llm");
			if (typeof mod.createUserMessage !== "function") {
				logWarn("[reverse] @deepseek-ai/dsh-llm.createUserMessage 不可用，跳过");
				return;
			}
			const message = mod.createUserMessage({
				content: [{
					type: "text",
					text
				}],
				source: {
					kind: "plugin",
					plugin: "dsh-music-huazai",
					form: "notice",
					summary: text.slice(0, 120)
				}
			});
			target.session.append("user/message", message, { surfaceOp: "append" });
			lastWrittenTrackId = report.trackId;
			logInfo(`[reverse] 已写入会话 ${String(target.id ?? "?")}：${text}`);
		} catch (cause) {
			logWarn(`[reverse] 写入失败: ${cause instanceof Error ? cause.message : String(cause)}`);
		}
	})();
}
//#endregion
//#region src/routes.ts
const API_PREFIX = "/api/dsh-music";
function json(res, status, value) {
	const body = JSON.stringify(value);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(body);
}
function requireMethod(req, res, method) {
	if (req.method === method) return true;
	json(res, 405, {
		ok: false,
		error: `method ${req.method} not allowed`
	});
	return false;
}
async function readJsonBody(req) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		chunks.push(chunk);
		total += chunk.length;
		if (total > 1048576) throw new Error("body too large（上限 1MB）");
	}
	const text = Buffer.concat(chunks).toString("utf8");
	if (!text) return {};
	try {
		const parsed = JSON.parse(text);
		return typeof parsed === "object" && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}
/** 解析平台限定 id：`netease:123456` / `qq:<mid>` / 任意已注册音源。 */
function parseTrackId(id) {
	const index = id.indexOf(":");
	if (index <= 0) return void 0;
	const provider = id.slice(0, index);
	const songId = id.slice(index + 1);
	if (!songId) return void 0;
	return {
		provider,
		songId
	};
}
function makeRoutes(ctx) {
	const get = (path, run) => ({
		kind: "exact",
		path,
		handler(req, res) {
			if (!requireMethod(req, res, "GET")) return;
			const query = new URL(req.url ?? "/", "http://localhost").searchParams;
			run(query).then((value) => json(res, 200, {
				ok: true,
				...value
			}), (error) => {
				logError(`GET ${path}`, error);
				json(res, 500, {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}
	});
	const post = (path, run) => ({
		kind: "exact",
		path,
		handler(req, res) {
			if (!requireMethod(req, res, "POST")) return Promise.resolve();
			return readJsonBody(req).then((body) => run(body).then((value) => json(res, 200, {
				ok: true,
				...value
			}), (error) => {
				logError(`POST ${path}`, error);
				json(res, 400, {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				});
			}));
		}
	});
	return [
		get(`${API_PREFIX}/health`, async () => ({
			plugin: "dsh-music-huazai",
			version: "0.1.0",
			milestone: "M6"
		})),
		get(`${API_PREFIX}/search`, async (query) => {
			const keyword = query.get("keyword") ?? "";
			const limit = Number(query.get("limit") ?? 12) || 12;
			const offset = Number(query.get("offset") ?? 0) || 0;
			const rawProviders = query.get("providers");
			return { tracks: await aggregateSearch({
				keyword,
				limit,
				offset,
				providers: rawProviders ? rawProviderList(rawProviders) : void 0
			}) };
		}),
		get(`${API_PREFIX}/url`, async (query) => {
			const parsed = parseTrackId(query.get("id") ?? "");
			if (!parsed) throw new Error("bad track id（期望 netease:<id> 或 qq:<mid>）");
			const quality = query.get("quality") ?? "exhigh";
			const provider = getProvider(parsed.provider);
			if (!provider) throw new Error(`未知音源: ${parsed.provider}`);
			const mediaMid = query.get("mediaMid") ?? "";
			const result = await provider.songUrl(parsed.songId, normalizeQuality(quality), { mediaMid });
			if (result.url) logInfo(`url ok ${parsed.provider}:${parsed.songId} level=${result.quality ?? "?"}`);
			else logWarn(`url miss ${parsed.provider}:${parsed.songId} q=${quality}: ${result.reason ?? "unknown"}`);
			return { result };
		}),
		get(`${API_PREFIX}/lyric`, async (query) => {
			const parsed = parseTrackId(query.get("id") ?? "");
			if (!parsed) throw new Error("bad track id");
			const provider = getProvider(parsed.provider);
			if (!provider) throw new Error(`未知音源: ${parsed.provider}`);
			return { lyric: await provider.lyric(parsed.songId, { numericId: query.get("numericId") ?? "" }) };
		}),
		{
			kind: "exact",
			path: `${API_PREFIX}/audio`,
			handler(req, res) {
				if (!requireMethod(req, res, "GET")) return;
				const query = new URL(req.url ?? "/", "http://localhost").searchParams;
				proxyAudio(req, res, query.get("url") ?? "");
			}
		},
		post(`${API_PREFIX}/auth/netease/qr`, async () => {
			return { key: await qrKeyStart() };
		}),
		get(`${API_PREFIX}/auth/netease/qr/create`, async (query) => {
			const { img, url } = await qrImage(query.get("key") ?? "");
			return {
				img,
				url
			};
		}),
		get(`${API_PREFIX}/auth/netease/qr/check`, async (query) => {
			return { qr: await qrCheck(query.get("key") ?? "") };
		}),
		post(`${API_PREFIX}/auth/qq`, async (body) => {
			const cookie = String(body.cookie ?? "").trim();
			if (!cookie.toLowerCase().includes("uin=")) throw new Error("Cookie 需包含 uin=（从 y.qq.com 复制）");
			saveAuth({ qqCookie: cookie });
			return { saved: true };
		}),
		post(`${API_PREFIX}/auth/qq/qr`, async () => {
			const { qrsig, ptLoginSig, img } = await qqQrStart();
			return {
				qrsig,
				ptLoginSig,
				img
			};
		}),
		get(`${API_PREFIX}/auth/qq/qr/check`, async (query) => {
			return { qr: await qqQrCheck(query.get("qrsig") ?? "", query.get("ptLoginSig") ?? "") };
		}),
		get(`${API_PREFIX}/auth/status`, async () => {
			return { providers: await Promise.all(listProviders().map((p) => p.authStatus())) };
		}),
		post(`${API_PREFIX}/like/set`, async (body) => {
			const parsed = parseTrackId(String(body.id ?? ""));
			if (!parsed || parsed.provider !== "netease") throw new Error("仅支持 netease:<id>");
			return like(parsed.songId, body.liked === true);
		}),
		get(`${API_PREFIX}/like/check`, async (query) => {
			const parsed = parseTrackId(query.get("id") ?? "");
			if (!parsed || parsed.provider !== "netease") return { liked: false };
			return likeCheck(parsed.songId);
		}),
		post(`${API_PREFIX}/bridge/report`, async (body) => {
			const raw = body.nowPlaying;
			if (raw && typeof raw.trackId === "string") {
				const report = {
					trackId: raw.trackId,
					name: String(raw.name ?? ""),
					artists: Array.isArray(raw.artists) ? raw.artists.map(String) : [],
					album: String(raw.album ?? ""),
					provider: String(raw.provider ?? ""),
					positionSec: Number(raw.positionSec) || 0,
					durationSec: Number(raw.durationSec) || 0,
					playing: raw.playing === true
				};
				const isNewTrack = report.trackId !== getNowPlaying()?.trackId;
				reportNowPlaying(report);
				maybeReversePush(ctx, report, isNewTrack);
			}
			return {};
		}),
		get(`${API_PREFIX}/bridge/poll`, async () => ({ commands: drainCommands() })),
		post(`${API_PREFIX}/bridge/command`, async (body) => {
			const command = normalizeCommand(body);
			if (!command) throw new Error("bad command");
			return { queued: pushCommand(command) };
		}),
		get(`${API_PREFIX}/recommend`, async () => ({ sections: await buildRecommendSections() })),
		get(`${API_PREFIX}/chart`, async (query) => {
			return { tracks: await chartTracksById(query.get("id") ?? "3778678", Number(query.get("limit") ?? 50) || 50) };
		}),
		get(`${API_PREFIX}/shuffle-mix`, async () => ({ tracks: await buildShuffleMix() })),
		get(`${API_PREFIX}/lists`, async () => ({
			lists: getLists(),
			recent: getStats().recent,
			plays: getStats().plays
		})),
		post(`${API_PREFIX}/list/create`, async (body) => {
			return { list: createList(String(body.name ?? "")) };
		}),
		post(`${API_PREFIX}/list/delete`, async (body) => {
			return { deleted: deleteList(String(body.id ?? "")) };
		}),
		post(`${API_PREFIX}/list/add`, async (body) => {
			const track = body.track;
			const result = track ? addTrack(String(body.id ?? ""), track) : void 0;
			if (result === void 0) throw new Error("列表不存在");
			return { added: result === "added" };
		}),
		post(`${API_PREFIX}/list/remove`, async (body) => {
			return { removed: removeTrack(String(body.id ?? ""), String(body.trackId ?? "")) };
		}),
		post(`${API_PREFIX}/list/import`, async (body) => {
			const incoming = Array.isArray(body.lists) ? body.lists : [];
			let imported = 0;
			for (const raw of incoming) {
				const name = String(raw.name ?? "").trim();
				const tracks = Array.isArray(raw.tracks) ? raw.tracks : [];
				if (!name || !tracks.length) continue;
				const list = createList(name);
				for (const track of tracks) if (addTrack(list.id, track) === "added") imported += 1;
			}
			return {
				lists: getLists().length,
				tracks: imported
			};
		}),
		post(`${API_PREFIX}/stats/play`, async (body) => {
			const track = body.track;
			if (!track?.provider || !track.songId) throw new Error("bad track");
			recordPlay(track);
			return {};
		}),
		get(`${API_PREFIX}/settings`, async () => ({ settings: getSettings() })),
		post(`${API_PREFIX}/settings/save`, async (body) => {
			return { settings: patchSettings(body.settings ?? body) };
		}),
		get(`${API_PREFIX}/providers`, async () => {
			return { providers: listProviders().map((p) => ({
				id: p.id,
				label: p.label,
				description: p.description ?? "",
				enabled: isEnabled(p.id)
			})) };
		}),
		post(`${API_PREFIX}/providers/toggle`, async (body) => {
			const id = String(body.id ?? "");
			const on = body.enabled === true;
			if (!hasProvider(id)) throw new Error(`未知音源: ${id}`);
			setEnabled(id, on);
			return {
				id,
				enabled: isEnabled(id)
			};
		}),
		get(`${API_PREFIX}/schedule`, async () => scheduleSnapshot()),
		post(`${API_PREFIX}/alarm/add`, async (body) => ({ alarm: addAlarm(String(body.time ?? ""), String(body.keyword ?? ""), body.label == null ? void 0 : String(body.label)) })),
		post(`${API_PREFIX}/alarm/remove`, async (body) => ({ removed: removeAlarm(String(body.id ?? "")) })),
		post(`${API_PREFIX}/sleep/set`, async (body) => {
			const minutes = Number(body.minutes) || 0;
			if (!(minutes > 0)) {
				cancelSleepTimer();
				return { remainingSec: 0 };
			}
			return { endsAt: startSleepTimer(Math.min(minutes, 720)) };
		}),
		post(`${API_PREFIX}/sleep/clear`, async () => ({ cleared: cancelSleepTimer() })),
		post(`${API_PREFIX}/notify`, async (body) => {
			return dispatchNotify(String(body.title ?? "提醒").slice(0, 40), String(body.text ?? "").slice(0, 120));
		}),
		...makeHaloRoutes()
	];
}
function rawProviderList(raw) {
	const valid = [];
	for (const part of raw.split(",")) {
		const trimmed = part.trim();
		if (allProviderIds().includes(trimmed)) valid.push(trimmed);
	}
	return valid.length ? valid : enabledProviderIds();
}
function normalizeQuality(raw) {
	return {
		standard: "standard",
		exhigh: "exhigh",
		lossless: "lossless",
		hires: "hires",
		jymaster: "jymaster"
	}[raw.toLowerCase()] ?? "exhigh";
}
/** 宽松校验桥命令（工具侧也可直接调 pushCommand，此入口供调试）。 */
function normalizeCommand(body) {
	const type = String(body.type ?? "");
	if (type === "pause" || type === "resume" || type === "next" || type === "prev") return { type };
}
/** 工具层读取正在播放快照；浏览器 30s 无上报视为不在线，返回 null。 */
function getNowPlaying() {
	const snap = nowPlayingSnapshot();
	return snap.report && !snap.stale ? snap.report : null;
}
/** 注册全部路由并返回注销函数（供 ctx.effect 使用）。 */
function registerRoutes(ctx) {
	const routes = makeRoutes(ctx);
	logInfo(`routes registered: ${routes.length}`);
	const disposers = routes.map((route) => ctx.webServer.register(route));
	return () => {
		for (const dispose of disposers) dispose();
	};
}
//#endregion
//#region src/tools.ts
async function searchHits(query, platform, limit) {
	return (await aggregateSearch({
		keyword: query,
		limit,
		providers: platform ? [platform] : void 0
	})).map((track) => ({
		id: track.id,
		name: track.name,
		artists: track.artists.join(" / "),
		album: track.album,
		vip: track.vip === true
	}));
}
function formatHits(hits) {
	if (!hits.length) return "没有找到相关歌曲";
	return hits.map((hit, i) => `${i + 1}. ${hit.id} | ${hit.name} - ${hit.artists}${hit.vip ? " [VIP]" : ""}`).join("\n");
}
const trackSummary = (track) => `${track.name} - ${track.artists.join(" / ")}`;
function registerTools(ctx) {
	const disposes = [];
	const reg = (tool) => {
		const dispose = ctx.tools.register(tool);
		if (typeof dispose === "function") disposes.push(dispose);
	};
	reg(defineTool({
		name: "music_search",
		description: "搜索音乐（聚合网易云与QQ音乐）。返回曲目 id 列表，可用 music_play 的 track_id 参数播放。",
		parameters: {
			query: {
				type: "string",
				required: true,
				description: "歌名/歌手关键词"
			},
			platform: {
				type: "string",
				description: "限定平台：netease 或 qq，默认全部"
			},
			limit: {
				type: "number",
				description: "每个平台返回数量上限，默认 6"
			}
		},
		output: {
			schema: { type: "json" },
			render: (_args, value) => [{
				type: "text",
				text: formatHits(value)
			}]
		},
		async execute(args) {
			return await searchHits(args.query, args.platform, args.limit ?? 6);
		}
	}));
	reg(defineTool({
		name: "music_play",
		description: "播放指定歌曲。优先传 track_id（来自 music_search）；只传 query 时自动选第一首。用户说\"放一首XX\"用这个。",
		parameters: {
			track_id: {
				type: "string",
				description: "曲目 id，如 netease:347230 或 qq:0039MnYb0qxYhV"
			},
			query: {
				type: "string",
				description: "无 track_id 时按关键词搜索并播第一首"
			},
			platform: {
				type: "string",
				description: "query 搜索时可限定平台"
			}
		},
		output: {
			schema: { type: "json" },
			render: (_args, value) => [{
				type: "text",
				text: String(value.message ?? "")
			}]
		},
		async execute(args) {
			if (args.track_id) {
				const parsed = parseIdLoose(args.track_id);
				if (!parsed) throw new Error(`bad track_id: ${args.track_id}`);
				const track = {
					...parsed,
					name: parsed.name || args.track_id,
					artists: [],
					album: "",
					durationMs: 0,
					cover: ""
				};
				const matched = (await aggregateSearch({
					keyword: track.name,
					limit: 10
				})).find((item) => item.id === args.track_id);
				if (matched) Object.assign(track, matched, { songId: matched.songId });
				queueOrThrow({
					type: "play",
					track
				});
				return { message: `已下发播放：${matched ? trackSummary(matched) : track.name}（浏览器将在数秒内响应）` };
			}
			const query = (args.query ?? "").trim();
			if (!query) throw new Error("需要 track_id 或 query");
			const first = (await searchHits(query, args.platform, 1))[0];
			if (!first) throw new Error(`没找到"${query}"`);
			const match = (await aggregateSearch({
				keyword: query,
				limit: 8
			})).find((item) => item.id === first.id);
			if (!match) throw new Error("搜索结果异常");
			queueOrThrow({
				type: "play",
				track: match
			});
			return { message: `已下发播放：${trackSummary(match)}` };
		}
	}));
	reg(defineTool({
		name: "music_control",
		description: "控制播放器：pause(暂停)/resume(继续)/next(下一首)/prev(上一首)/seek(跳转进度，需 position_sec)。",
		parameters: {
			action: {
				type: "string",
				required: true,
				description: "pause | resume | next | prev | seek"
			},
			position_sec: {
				type: "number",
				description: "action=seek 时目标位置（秒）"
			}
		},
		output: {
			schema: { type: "json" },
			render: (_args, value) => [{
				type: "text",
				text: String(value.message ?? "")
			}]
		},
		isConcurrencySafe: () => false,
		async execute(args) {
			const action = args.action.toLowerCase().trim();
			if (action === "seek") {
				const position = Number(args.position_sec);
				if (!(position >= 0)) throw new Error("需要 position_sec（秒）");
				queueOrThrow({
					type: "seek",
					position
				});
				return { message: `已跳转到 ${formatTime(position)}` };
			}
			if (action !== "pause" && action !== "resume" && action !== "next" && action !== "prev") throw new Error(`bad action: ${args.action}`);
			queueOrThrow({ type: action });
			return { message: `已下发：${action}` };
		}
	}));
	reg(defineTool({
		name: "music_now_playing",
		description: "查询当前播放状态：正在播放的曲名、歌手、进度、是否暂停。",
		parameters: {},
		output: {
			schema: { type: "json" },
			render: (_args, value) => [{
				type: "text",
				text: describeNowPlaying(value)
			}]
		},
		execute() {
			return Promise.resolve(nowPlayingText());
		}
	}));
	reg(defineTool({
		name: "music_lyric",
		description: "获取歌词文本（LRC）。不传 track_id 时返回当前播放歌曲的歌词。",
		parameters: {
			track_id: {
				type: "string",
				description: "netease:<id> 或 qq:<mid>"
			},
			max_chars: {
				type: "number",
				description: "返回文本长度上限，默认 3000"
			}
		},
		output: {
			schema: { type: "json" },
			render: (_args, value) => [{
				type: "text",
				text: String(value.lyric ?? "")
			}]
		},
		async execute(args) {
			const maxChars = Math.min(Math.max(args.max_chars ?? 3e3, 200), 8e3);
			let providerId;
			let songId;
			if (args.track_id) {
				const parsed = parseIdLoose(args.track_id);
				if (!parsed) throw new Error(`bad track_id: ${args.track_id}`);
				providerId = parsed.provider;
				songId = parsed.songId;
			} else {
				const current = getNowPlaying();
				if (!current) throw new Error("当前没有播放中的歌曲，请提供 track_id");
				providerId = current.provider;
				songId = current.trackId.split(":")[1] ?? "";
			}
			const provider = getProvider(providerId);
			if (!provider) throw new Error(`未知音源: ${providerId}`);
			return { lyric: (await provider.lyric(songId, { numericId: "" })).lrc.slice(0, maxChars) || "(无歌词)" };
		}
	}));
	reg(defineTool({
		name: "music_halo",
		description: "控制花再(HALO PixelBar)音箱屏幕：scene 内置场景 / spectrum 频谱样式 / clock 时钟样式 / color 屏幕颜色。需已在插件设置开启「启用歌词同步」。",
		parameters: {
			action: {
				type: "string",
				required: true,
				description: "scene | spectrum | clock | color"
			},
			value: {
				type: "string",
				description: "scene: clock/game/work/reading/cats/dogs/memes/cyber/waves；spectrum: 1-4；clock: 1-11；color: #rrggbb 或 r,g,b"
			}
		},
		output: {
			schema: { type: "json" },
			render: (_args, value) => [{
				type: "text",
				text: String(value.message ?? "")
			}]
		},
		async execute(args) {
			const halo = getHaloSync();
			if (halo.status().connected !== true) throw new Error("花再音箱未连接：请先在插件设置中启用歌词同步");
			const action = String(args.action ?? "").toLowerCase().trim();
			const raw = String(args.value ?? "").trim();
			let ok = false;
			let detail = "";
			if (action === "scene") {
				ok = halo.sendScene(raw.toLowerCase());
				detail = `场景 ${raw}`;
			} else if (action === "spectrum") {
				ok = halo.sendSpectrum(Number(raw) || 0);
				detail = `频谱样式 ${raw}`;
			} else if (action === "clock") {
				ok = halo.sendClock(Number(raw) || 1);
				detail = `时钟样式 ${raw}`;
			} else if (action === "color") {
				const rgb = parseRgb(raw);
				if (!rgb) throw new Error("颜色格式应为 #rrggbb 或 r,g,b，如 #3366ff 或 51,102,255");
				ok = halo.sendScreenColor(rgb.r, rgb.g, rgb.b);
				detail = `屏色 rgb(${rgb.r},${rgb.g},${rgb.b})`;
			} else throw new Error(`bad action: ${args.action}`);
			return { message: ok ? `已下发：${detail}` : `${detail} 下发失败（设备可能离线）` };
		}
	}));
	reg(defineTool({
		name: "music_queue",
		description: "管理播放队列：add(搜索并加入队列尾部，不打断当前播放)/clear(清空队列)/mode(切换播放模式)。",
		parameters: {
			action: {
				type: "string",
				required: true,
				description: "add | clear | mode"
			},
			query: {
				type: "string",
				description: "action=add 时搜索关键词"
			},
			mode: {
				type: "string",
				description: "action=mode 时：order(顺序)/repeat(列表循环)/one(单曲循环)/random(随机)"
			}
		},
		output: {
			schema: { type: "json" },
			render: (_args, value) => [{
				type: "text",
				text: String(value.message ?? "")
			}]
		},
		async execute(args) {
			const action = String(args.action ?? "").toLowerCase().trim();
			if (action === "clear") {
				queueOrThrow({ type: "queue_clear" });
				return { message: "已清空播放队列" };
			}
			if (action === "mode") {
				const mode = String(args.mode ?? "").toLowerCase().trim();
				if (mode !== "order" && mode !== "repeat" && mode !== "one" && mode !== "random") throw new Error("mode 应为 order/repeat/one/random");
				queueOrThrow({
					type: "mode",
					mode
				});
				return { message: `播放模式已切换：${PLAY_MODE_LABEL[mode]}` };
			}
			if (action === "add") {
				const query = (args.query ?? "").trim();
				if (!query) throw new Error("需要 query 关键词");
				const tracks = await aggregateSearch({
					keyword: query,
					limit: 5
				});
				if (!tracks.length) throw new Error(`没找到「${query}」`);
				queueOrThrow({
					type: "queue_add",
					tracks
				});
				return { message: `已加入队列：${trackSummary(tracks[0])}${tracks.length > 1 ? ` 等 ${tracks.length} 首` : ""}` };
			}
			throw new Error(`bad action: ${args.action}`);
		}
	}));
	reg(defineTool({
		name: "music_volume",
		description: "调节播放器音量（0-100）。",
		parameters: { level: {
			type: "number",
			required: true,
			description: "音量 0-100"
		} },
		output: {
			schema: { type: "json" },
			render: (_args, value) => [{
				type: "text",
				text: String(value.message ?? "")
			}]
		},
		async execute(args) {
			const level = Number(args.level);
			if (!(level >= 0 && level <= 100)) throw new Error("level 应在 0-100");
			queueOrThrow({
				type: "volume",
				value: Math.round(level) / 100
			});
			return { message: `音量已设为 ${Math.round(level)}%` };
		}
	}));
	reg(defineTool({
		name: "music_favorite",
		description: "把当前正在播放的歌曲收藏到「本地红心」列表，或取消收藏。不传 liked 则自动切换。",
		parameters: { liked: {
			type: "boolean",
			description: "true=收藏 false=取消收藏；缺省为切换"
		} },
		output: {
			schema: { type: "json" },
			render: (_args, value) => [{
				type: "text",
				text: String(value.message ?? "")
			}]
		},
		async execute(args) {
			const current = getNowPlaying();
			if (!current) throw new Error("当前没有播放中的歌曲");
			const track = (await aggregateSearch({
				keyword: `${current.name} ${current.artists[0] ?? ""}`.trim(),
				limit: 10
			})).find((item) => item.id === current.trackId);
			if (!track) throw new Error("未能定位当前曲目的完整信息，无法收藏");
			const exists = !!getLists().find((list) => list.id === "fav")?.tracks.some((item) => item.provider === track.provider && item.songId === track.songId);
			const want = typeof args.liked === "boolean" ? args.liked : !exists;
			if (want && !exists) {
				addTrack("fav", track);
				return { message: `已收藏到本地红心：${trackSummary(track)}` };
			}
			if (!want && exists) {
				removeTrack("fav", `${track.provider}:${track.songId}`);
				return { message: `已取消收藏：${trackSummary(track)}` };
			}
			return { message: `${want ? "已" : "未"}在红心列表：${trackSummary(track)}` };
		}
	}));
	reg(defineTool({
		name: "music_sleep_timer",
		description: "睡眠定时器：N 分钟后自动暂停播放并提醒。minutes 传 0 或负数取消。",
		parameters: { minutes: {
			type: "number",
			required: true,
			description: "分钟数；0 表示取消"
		} },
		output: {
			schema: { type: "json" },
			render: (_args, value) => [{
				type: "text",
				text: String(value.message ?? "")
			}]
		},
		async execute(args) {
			requireScheduler();
			const minutes = Number(args.minutes);
			if (!(minutes > 0)) {
				cancelSleepTimer();
				return { message: "睡眠定时器已取消" };
			}
			const capped = Math.min(minutes, 720);
			startSleepTimer(capped);
			return { message: `将在 ${capped} 分钟后暂停播放` };
		}
	}));
	reg(defineTool({
		name: "music_alarm",
		description: "音乐闹钟：每天到点自动搜索并播放指定歌曲，同时按设置做声音/音箱提醒。",
		parameters: {
			action: {
				type: "string",
				required: true,
				description: "create | list | delete"
			},
			time: {
				type: "string",
				description: "HH:mm（24 小时制），action=create 必填"
			},
			keyword: {
				type: "string",
				description: "到点播放的歌（歌名/歌手），action=create 必填"
			},
			label: {
				type: "string",
				description: "备注名，如「起床闹钟」"
			},
			id: {
				type: "string",
				description: "action=delete 时必填"
			}
		},
		output: {
			schema: { type: "json" },
			render: (_args, value) => [{
				type: "text",
				text: String(value.message ?? "")
			}]
		},
		async execute(args) {
			requireScheduler();
			const action = String(args.action ?? "").toLowerCase().trim();
			if (action === "list") {
				const alarms = listAlarms();
				if (!alarms.length) return { message: "还没有闹钟" };
				return { message: alarms.map((a) => `${a.id} | ${a.time} | ${a.keyword}${a.label ? ` | ${a.label}` : ""}`).join("\n") };
			}
			if (action === "create") {
				const alarm = addAlarm(String(args.time ?? ""), String(args.keyword ?? ""), args.label == null ? void 0 : String(args.label));
				return { message: `闹钟已创建：${alarm.time} 播放「${alarm.keyword}」${alarm.label ? `（${alarm.label}）` : ""}` };
			}
			if (action === "delete") return { message: removeAlarm(String(args.id ?? "")) ? "闹钟已删除" : `没找到 id=${args.id}` };
			throw new Error(`bad action: ${args.action}`);
		}
	}));
	return () => {
		for (const dispose of disposes) dispose();
	};
}
const PLAY_MODE_LABEL = {
	order: "顺序播放",
	repeat: "列表循环",
	one: "单曲循环",
	random: "随机播放"
};
/** 解析 #rrggbb 或 r,g,b 颜色。 */
function parseRgb(text) {
	const hex = /^#?([0-9a-f]{6})$/i.exec(text.trim());
	if (hex?.[1]) {
		const n = parseInt(hex[1], 16);
		return {
			r: n >> 16 & 255,
			g: n >> 8 & 255,
			b: n & 255
		};
	}
	const parts = text.split(",").map((part) => Number(part.trim()));
	if (parts.length === 3 && parts.every((v) => Number.isFinite(v))) return {
		r: parts[0],
		g: parts[1],
		b: parts[2]
	};
}
/** 定时任务类工具的开关门卫。 */
function requireScheduler() {
	if (!getSettings().schedulerEnabled) throw new Error("定时任务已在插件设置中关闭");
}
function nowPlayingText() {
	const snapshot = getNowPlaying();
	if (!snapshot) return {
		playing: false,
		message: "浏览器端未连接或尚未开始播放"
	};
	const position = formatTime(snapshot.positionSec);
	const duration = snapshot.durationSec > 0 ? formatTime(snapshot.durationSec) : "?";
	return {
		playing: snapshot.playing,
		track: snapshot.name,
		artists: snapshot.artists.join(" / "),
		position,
		duration,
		message: snapshot.playing ? "正在播放" : "已暂停"
	};
}
function describeNowPlaying(value) {
	if (value.playing !== true && !value.track) return String(value.message ?? "未在播放");
	return `${String(value.playing === true ? "▶ 正在播放" : "⏸ 已暂停")}：${String(value.track ?? "?")} - ${String(value.artists ?? "")} (${String(value.position ?? "")}/${String(value.duration ?? "")})`;
}
function parseIdLoose(id) {
	const index = id.indexOf(":");
	if (index <= 0) return void 0;
	const provider = id.slice(0, index);
	const songId = id.slice(index + 1);
	if (!songId) return void 0;
	return {
		provider,
		songId,
		id,
		name: ""
	};
}
function queueOrThrow(command) {
	if (!pushCommand(command)) throw new Error("命令队列已满，请稍后重试");
}
function formatTime(seconds) {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
}
//#endregion
//#region src/index.ts
/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
const name = "music";
/** 宿主半依赖的服务（agents：反向推送写会话通知用）。 */
const inject = [
	"webServer",
	"tools",
	"agents"
];
/** 进程级退出钩子只装一次（HMR/重复激活防重）。 */
let exitHooksInstalled = false;
function installExitHooks(halo) {
	if (exitHooksInstalled) return;
	exitHooksInstalled = true;
	const disposeOnce = () => {
		try {
			halo.dispose();
		} catch {}
	};
	process.on("exit", disposeOnce);
	for (const signal of ["SIGINT", "SIGTERM"]) {
		const handler = () => {
			disposeOnce();
			process.removeListener(signal, handler);
			process.kill(process.pid, signal);
		};
		process.on(signal, handler);
	}
}
/** Cordis 插件体。 */
function apply(ctx, _config = {}) {
	installBuiltinProviders();
	ctx.effect(() => registerRoutes(ctx), "music: routes");
	ctx.effect(() => registerTools(ctx), "music: tools");
	ctx.effect(() => startScheduler(), "music: scheduler");
	ctx.effect(() => {
		installExitHooks(getHaloSync());
		return () => {
			try {
				getHaloSync().dispose();
			} catch {}
		};
	}, "music: halo-lifecycle");
}
//#endregion
export { apply, inject, name };
