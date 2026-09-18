import { eq } from "drizzle-orm";
import { getDb } from "#/db";
import {
	creditLedger,
	organization,
	platformSettings,
	topupRequest,
} from "#/db/schema";
import { verifyXSignature } from "./billplz";

/**
 * Billplz callback + redirect endpoints. Handled directly in the Worker
 * entry (before TanStack Start) because they are raw HTTP endpoints called
 * by the Billplz gateway, not app pages or server functions.
 *
 * Callback is the ONLY place credit is granted — the redirect is UX-only.
 * Callback must stay idempotent: Billplz retries non-200 responses.
 */

export function isBillplzPath(pathname: string): boolean {
	return (
		pathname === "/api/billplz/callback" || pathname === "/api/billplz/redirect"
	);
}

export async function handleBillplzCallback(
	request: Request,
): Promise<Response> {
	const form = await request.formData();
	const params: Record<string, string> = {};
	for (const [key, value] of form.entries()) {
		params[key] = String(value);
	}
	const signature = params.x_signature ?? null;
	if (!(await verifyXSignature(params, signature))) {
		console.warn("[billplz] callback rejected: invalid X-Signature");
		return new Response("Invalid signature", { status: 401 });
	}

	const billId = params.id ?? "";
	const paid = params.paid === "true";
	const state = params.state ?? "";
	const amountSen = Number(params.amount ?? "0");

	const db = getDb();
	const [topup] = await db
		.select()
		.from(topupRequest)
		.where(eq(topupRequest.billId, billId))
		.limit(1);
	if (!request) {
		// Unknown bill — 404 so Billplz retries while we reconcile manually.
		console.warn(`[billplz] callback for unknown bill ${billId}`);
		return new Response("Unknown bill", { status: 404 });
	}

	if (!paid || state !== "paid") {
		// Due, deleted, or unpaid bill states: nothing to credit. 200 stops
		// retries; the pending request stays for admin follow-up.
		console.log(
			`[billplz] bill ${billId} callback state=${state} paid=${params.paid}`,
		);
		return new Response("OK", { status: 200 });
	}

	if (topup.status !== "pending") {
		// Already processed — idempotent ack.
		return new Response("OK", { status: 200 });
	}

	if (Number.isInteger(amountSen) && amountSen !== topup.amountSen) {
		// Never credit an amount that does not match the created bill.
		console.error(
			`[billplz] bill ${billId} amount mismatch: got ${amountSen}, expected ${topup.amountSen}`,
		);
		return new Response("Amount mismatch", { status: 422 });
	}

	const [org] = await db
		.select({ balanceSen: organization.balanceSen })
		.from(organization)
		.where(eq(organization.id, topup.organizationId))
		.limit(1);
	if (!org) {
		console.error(
			`[billplz] bill ${billId} org ${topup.organizationId} missing`,
		);
		return new Response("Organization missing", { status: 404 });
	}

	const now = new Date();
	const balanceSen = org.balanceSen + topup.amountSen;
	await db
		.update(organization)
		.set({ balanceSen })
		.where(eq(organization.id, topup.organizationId));
	await db.insert(creditLedger).values({
		id: crypto.randomUUID(),
		organizationId: topup.organizationId,
		type: "topup",
		amountSen: topup.amountSen,
		balanceAfterSen: balanceSen,
		note: `Billplz top-up (bill: ${billId})`,
		createdBy: null,
		createdAt: now,
	});
	await db
		.update(topupRequest)
		.set({
			status: "approved",
			decidedAt: now,
			decisionNote: "Paid via Billplz",
			paidAt: now,
			updatedAt: now,
		})
		.where(eq(topupRequest.id, topup.id));

	console.log(
		`[billplz] credited ${topup.amountSen} sen to org ${topup.organizationId} (bill ${billId})`,
	);
	return new Response("OK", { status: 200 });
}

export async function handleBillplzRedirect(
	request: Request,
): Promise<Response> {
	const url = new URL(request.url);
	// Query arrives as billplz[id]=… — strip brackets before verification.
	const params: Record<string, string> = {};
	const signature = url.searchParams.get("billplz[x_signature]");
	for (const [key, value] of url.searchParams.entries()) {
		if (key === "billplz[x_signature]") {
			continue;
		}
		if (key.startsWith("billplz[") && key.endsWith("]")) {
			params[`billplz${key.slice(8, -1)}`] = value;
		}
	}
	if (!(await verifyXSignature(params, signature))) {
		return Response.redirect(new URL("/billing", url.origin), 302);
	}
	const paid = params.billplzpaid === "true";
	return Response.redirect(
		new URL(`/billing?topup=${paid ? "paid" : "pending"}`, url.origin),
		302,
	);
}

/** Collection ID for bill creation from platform settings (null = unset). */
export async function getBillplzCollectionId(): Promise<string | null> {
	const [row] = await getDb()
		.select({ collectionId: platformSettings.billplzCollectionId })
		.from(platformSettings)
		.where(eq(platformSettings.id, "platform"))
		.limit(1);
	return row?.collectionId ?? null;
}
