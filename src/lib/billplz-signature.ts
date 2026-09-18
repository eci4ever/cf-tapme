/**
 * Pure Billplz X-Signature helpers (no server-only imports so this is
 * unit-testable). See "X Signature verification" in the Billplz API docs:
 * the source string is every key+value pair except x_signature itself,
 * SORTED AS THE COMBINED key+value STRINGS case-insensitively (the official
 * example orders paid_amount before paid_at before paid), joined with "|",
 * then HMAC-SHA256'd with the X-Signature key (hex output).
 */

export type BillplzParams = Record<string, string>;

export function buildXSignatureSource(params: BillplzParams): string {
	return Object.keys(params)
		.filter((name) => name !== "x_signature")
		.map((name) => `${name}${params[name] ?? ""}`)
		.sort((a, b) => {
			const lowerA = a.toLowerCase();
			const lowerB = b.toLowerCase();
			return lowerA < lowerB ? -1 : lowerA > lowerB ? 1 : 0;
		})
		.join("|");
}

export async function computeXSignature(
	key: string,
	params: BillplzParams,
): Promise<string> {
	const source = buildXSignatureSource(params);
	const encoder = new TextEncoder();
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		encoder.encode(key),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign(
		"HMAC",
		cryptoKey,
		encoder.encode(source),
	);
	return [...new Uint8Array(mac)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	let mismatch = 0;
	for (let i = 0; i < a.length; i += 1) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}

export async function verifyXSignatureWithKey(
	key: string,
	params: BillplzParams,
	signature: string | null | undefined,
): Promise<boolean> {
	if (!key || !signature) {
		return false;
	}
	const digest = await computeXSignature(key, params);
	return timingSafeEqual(digest, signature.toLowerCase());
}
