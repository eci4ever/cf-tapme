import { describe, expect, it } from "vitest";
import {
	buildXSignatureSource,
	computeXSignature,
	verifyXSignatureWithKey,
} from "./billplz-signature";

// Parameter set from the official Billplz "X Signature verification" docs.
// The docs' printed digest is illustrative (not reproducible from the shown
// key), so these tests pin the SOURCE STRING — whose exact ordering the docs
// spell out (Step 3) — plus sign/verify self-consistency.
const CALLBACK_KEY = "S-s7b4yWpp9h7rrkNM1i3Z_g";
const CALLBACK_PARAMS = {
	id: "zq0tm2wc",
	collection_id: "yhx5t1pp",
	paid: "true",
	state: "paid",
	amount: "100",
	paid_amount: "100",
	due_at: "2018-9-27",
	email: "tester@test.com",
	mobile: "",
	name: "TESTER",
	url: "https://www.billplz.com/bills/zq0tm2wc",
	paid_at: "2018-09-27 15:15:09 +0800",
};

// Exactly the Step 3 source string from the docs.
const CALLBACK_SOURCE =
	"amount100|collection_idyhx5t1pp|due_at2018-9-27|emailtester@test.com|idzq0tm2wc|mobile|nameTESTER|paid_amount100|paid_at2018-09-27 15:15:09 +0800|paidtrue|statepaid|urlhttps://www.billplz.com/bills/zq0tm2wc";

// The redirect query arrives as billplz[id]=… etc.; the handler strips the
// brackets before verification — the docs' source string uses billplzid.
const REDIRECT_PARAMS = {
	billplzid: "zq0tm2wc",
	billplzpaid: "true",
	billplzpaid_at: "2018-09-27 15:15:09 +0800",
};

// Redirect example source from the docs (billplz[*] query keys).
const REDIRECT_SOURCE =
	"billplzidzq0tm2wc|billplzpaid_at2018-09-27 15:15:09 +0800|billplzpaidtrue";

describe("Billplz X-Signature", () => {
	it("builds the callback source string exactly as the docs show", () => {
		// paid_amount < paid_at < paid: combined key+value sort, not key sort
		expect(buildXSignatureSource(CALLBACK_PARAMS)).toBe(CALLBACK_SOURCE);
	});

	it("builds the redirect source string exactly as the docs show", () => {
		expect(buildXSignatureSource(REDIRECT_PARAMS)).toBe(REDIRECT_SOURCE);
	});

	it("verifies its own signature and rejects tampering", async () => {
		const signature = await computeXSignature(CALLBACK_KEY, CALLBACK_PARAMS);
		expect(
			await verifyXSignatureWithKey(CALLBACK_KEY, CALLBACK_PARAMS, signature),
		).toBe(true);
		expect(
			await verifyXSignatureWithKey(
				CALLBACK_KEY,
				{ ...CALLBACK_PARAMS, amount: "101" },
				signature,
			),
		).toBe(false);
	});

	it("rejects a wrong key, wrong signature, or missing inputs", async () => {
		const signature = await computeXSignature(CALLBACK_KEY, CALLBACK_PARAMS);
		expect(
			await verifyXSignatureWithKey("wrong-key", CALLBACK_PARAMS, signature),
		).toBe(false);
		expect(
			await verifyXSignatureWithKey(
				CALLBACK_KEY,
				CALLBACK_PARAMS,
				`f${signature.slice(1)}`,
			),
		).toBe(false);
		expect(
			await verifyXSignatureWithKey(CALLBACK_KEY, CALLBACK_PARAMS, null),
		).toBe(false);
		expect(await verifyXSignatureWithKey("", CALLBACK_PARAMS, signature)).toBe(
			false,
		);
	});

	it("is deterministic for identical params regardless of key order", async () => {
		const reversed = Object.fromEntries(
			Object.entries(CALLBACK_PARAMS).reverse(),
		);
		expect(await computeXSignature(CALLBACK_KEY, reversed)).toBe(
			await computeXSignature(CALLBACK_KEY, CALLBACK_PARAMS),
		);
	});
});
