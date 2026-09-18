import { env } from "cloudflare:workers";
import { verifyXSignatureWithKey } from "./billplz-signature";

/**
 * Minimal Billplz v3 API client (https://billplz.com/api/).
 *
 * Sandbox is the default so a missing/empty BILLPLZ_MODE can never point at
 * the live gateway. Keys come from the environment:
 *  - BILLPLZ_SECRET_KEY       Basic-auth secret (sandbox key for sandbox mode)
 *  - BILLPLZ_X_SIGNATURE_KEY  used to verify callback/redirect signatures
 * Amounts are integer sen everywhere, matching Billplz's smallest-unit rule
 * and TapMe's balanceSen.
 */

export type BillplzMode = "sandbox" | "live";

export function billplzMode(): BillplzMode {
	return env.BILLPLZ_MODE === "live" ? "live" : "sandbox";
}

export function billplzApiBase(): string {
	return billplzMode() === "live"
		? "https://www.billplz.com/api"
		: "https://www.billplz-sandbox.com/api";
}

export function billplzConfigured(): boolean {
	return Boolean(env.BILLPLZ_SECRET_KEY && env.BILLPLZ_X_SIGNATURE_KEY);
}

type CreateBillInput = {
	collectionId: string;
	email: string;
	name: string;
	// integer sen
	amountSen: number;
	description: string;
	callbackUrl: string;
	redirectUrl: string;
	// shows the "Pay" screen immediately instead of the bill detail page
	skipDetails?: boolean;
};

export type CreatedBill = {
	id: string;
	url: string;
};

async function basicAuthHeader(): Promise<string> {
	const secret = env.BILLPLZ_SECRET_KEY;
	if (!secret) {
		throw new Error("BILLPLZ_SECRET_KEY is not set");
	}
	// Basic auth: secret key as username, empty password
	const encoded = btoa(`${secret}:`);
	return `Basic ${encoded}`;
}

async function apiRequest(
	method: "GET" | "POST",
	path: string,
	body?: Record<string, string | number | boolean | undefined>,
): Promise<Response> {
	const headers: Record<string, string> = {
		Authorization: await basicAuthHeader(),
	};
	let payload: string | undefined;
	if (body) {
		headers["Content-Type"] = "application/x-www-form-urlencoded";
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(body)) {
			if (value !== undefined) {
				params.set(key, String(value));
			}
		}
		payload = params.toString();
	}
	return fetch(`${billplzApiBase()}${path}`, {
		method,
		headers,
		body: payload,
	});
}

/** Create a bill. Throws with the API's error message when the call fails. */
export async function createBill(input: CreateBillInput): Promise<CreatedBill> {
	const response = await apiRequest("POST", "/v3/bills", {
		collection_id: input.collectionId,
		email: input.email,
		mobile: undefined,
		name: input.name,
		amount: input.amountSen,
		callback_url: input.callbackUrl,
		redirect_url: input.redirectUrl,
		description: input.description,
		reference_1_label: undefined,
		reference_1: undefined,
		reference_2_label: undefined,
		reference_2: undefined,
		skip_details: input.skipDetails ? "true" : undefined,
	});
	const text = await response.text();
	let parsed: unknown = null;
	try {
		parsed = JSON.parse(text);
	} catch {
		// fall through with raw text below
	}
	if (!response.ok) {
		const detail =
			parsed && typeof parsed === "object" && "error" in parsed
				? JSON.stringify((parsed as { error: unknown }).error)
				: text.slice(0, 200);
		throw new Error(`Billplz create bill failed: ${detail}`);
	}
	const bill = parsed as { id?: string; url?: string };
	if (!bill.id || !bill.url) {
		throw new Error("Billplz create bill returned an unexpected payload");
	}
	return { id: bill.id, url: bill.url };
}

export type BillplzCallbackParams = Record<string, string>;

/**
 * Verify an X-Signature header over callback/redirect parameters using the
 * configured BILLPLZ_X_SIGNATURE_KEY. See billplz-signature.ts for the
 * algorithm (official-docs sample vectors live in billplz-signature.test.ts).
 */
export async function verifyXSignature(
	params: BillplzCallbackParams,
	signature: string | null,
): Promise<boolean> {
	const key = env.BILLPLZ_X_SIGNATURE_KEY;
	if (!key || !signature) {
		return false;
	}
	return verifyXSignatureWithKey(key, params, signature);
}
