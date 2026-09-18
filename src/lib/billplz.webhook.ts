import { eq } from "drizzle-orm";
import { getDb } from "#/db";
import {
	creditLedger,
	organization,
	platformSettings,
	topupRequest,
} from "#/db/schema";
import { verifyXSignature } from "./billplz";
import { logAudit } from "./audit.functions";
import { notifyOrgAdmins } from "./notify";
import { addMonths, formatRm } from "./subscription";

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
	if (!topup) {
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

	// The bill was created for credit + fee pass-through; fall back to the
	// credit amount for rows created before fee handling existed.
	const expectedSen = topup.billAmountSen ?? topup.amountSen;
	if (Number.isInteger(amountSen) && amountSen !== expectedSen) {
		// Never credit an amount that does not match the created bill.
		console.error(
			`[billplz] bill ${billId} amount mismatch: got ${amountSen}, expected ${expectedSen}`,
		);
		return new Response("Amount mismatch", { status: 422 });
	}

	try {
		await finalizePaidBill(topup, billId);
	} catch (error) {
		console.error(`[billplz] finalize failed for bill ${billId}:`, error);
		// 500 makes Billplz retry; the pending request is still open so the
		// retry (or a manual check-status) can complete it.
		return new Response("Finalize failed", { status: 500 });
	}
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

/**
 * Idempotent completion for a paid Billplz request: marks it approved and
 * applies the purpose-specific effect (credit balance or plan renewal).
 * Shared by the gateway callback and the manual check-status reconciliation.
 */
export async function finalizePaidBill(
	topup: typeof topupRequest.$inferSelect,
	billId: string,
): Promise<"credit" | "plan_renewal"> {
	if (topup.purpose === "plan_renewal") {
		await finalizeRenewal(topup, billId);
		return "plan_renewal";
	}
	await finalizeCredit(topup, billId);
	return "credit";
}

async function finalizeCredit(
	topup: typeof topupRequest.$inferSelect,
	billId: string,
): Promise<void> {
	const db = getDb();
	const now = new Date();
	const [org] = await db
		.select({ balanceSen: organization.balanceSen })
		.from(organization)
		.where(eq(organization.id, topup.organizationId))
		.limit(1);
	if (!org) {
		throw new Error(`Organization ${topup.organizationId} missing`);
	}
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
	const feeSen = topup.billAmountSen
		? topup.billAmountSen - topup.amountSen
		: 0;
	try {
		await notifyOrgAdmins(
			topup.organizationId,
			`Top-up received — ${formatRm(topup.amountSen)}`,
			`<p>Your credit top-up of <strong>${formatRm(topup.amountSen)}</strong> was paid via Billplz and added to your organization balance.</p>${
				feeSen > 0
					? `<p style="color:#555;">Total charged: ${formatRm(topup.billAmountSen ?? 0)} (includes ${formatRm(feeSen)} Billplz fee)</p>`
					: ""
			}`,
			"/billing",
			"Paid via Billplz",
		);
	} catch (error) {
		console.error("[billplz] receipt notification failed:", error);
	}
}

async function finalizeRenewal(
	topup: typeof topupRequest.$inferSelect,
	billId: string,
): Promise<void> {
	const db = getDb();
	const now = new Date();
	const months = topup.months ?? 1;
	const [org] = await db
		.select({ paidUntil: organization.paidUntil })
		.from(organization)
		.where(eq(organization.id, topup.organizationId))
		.limit(1);
	if (!org) {
		throw new Error(`Organization ${topup.organizationId} missing`);
	}
	// extend from the current expiry while it is still in the future
	const from =
		org.paidUntil && org.paidUntil.getTime() > now.getTime()
			? org.paidUntil
			: now;
	const paidUntil = addMonths(from, months);
	await db
		.update(organization)
		.set({ paidUntil })
		.where(eq(organization.id, topup.organizationId));
	await db
		.update(topupRequest)
		.set({
			status: "approved",
			decidedAt: now,
			decisionNote: "Renewal paid via Billplz",
			paidAt: now,
			updatedAt: now,
		})
		.where(eq(topupRequest.id, topup.id));
	await logAudit({
		organizationId: topup.organizationId,
		userId: topup.requestedBy,
		action: "billing.renewal_paid_via_billplz",
		detail: `${topup.planId ?? "plan"} × ${months} month(s), paid until ${paidUntil.toISOString().slice(0, 10)} (bill: ${billId})`,
	});
	console.log(
		`[billplz] renewed ${topup.planId ?? "plan"} ×${months}m for org ${topup.organizationId} until ${paidUntil.toISOString().slice(0, 10)} (bill ${billId})`,
	);
	try {
		await notifyOrgAdmins(
			topup.organizationId,
			`Renewal received — ${topup.planId ?? "plan"} × ${months} month(s)`,
			`<p>Your <strong>${topup.planId ?? "plan"}</strong> plan was renewed for <strong>${months} month(s)</strong> via Billplz.</p><p>Paid until <strong>${paidUntil.toISOString().slice(0, 10)}</strong> — total charged ${formatRm(topup.billAmountSen ?? topup.amountSen)}.</p>`,
			"/billing",
			"Renewed via Billplz",
		);
	} catch (error) {
		console.error("[billplz] receipt notification failed:", error);
	}
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
