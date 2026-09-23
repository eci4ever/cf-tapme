import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// billplz.webhook imports modules that need the Workers runtime
// (cloudflare:workers). Swap the database for an in-memory SQLite driven
// through drizzle's sqlite-proxy, and no-op the side-effect modules.
const hoisted = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("#/db", () => ({ getDb: () => hoisted.db }));
vi.mock("./notify", () => ({
	notifyOrgAdmins: async () => {},
	notifyPlatformAdmins: async () => {},
}));
vi.mock("./audit.functions", () => ({ logAudit: async () => {} }));
vi.mock("./billplz", () => ({ verifyXSignature: async () => true }));

import { eq } from "drizzle-orm";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";
import * as schema from "#/db/schema";
import { creditLedger, organization, topupRequest, user } from "#/db/schema";
import { finalizePaidBill } from "./billplz.webhook";
import { addMonths } from "./subscription";

const rootDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);

let sqlite: DatabaseSync;
let db: ReturnType<typeof makeDb>;

function makeDb(database: DatabaseSync) {
	return drizzleProxy(
		async (sql, params, method) => {
			const stmt = database.prepare(sql);
			if (method === "run") {
				stmt.run(...params);
				return { rows: [] };
			}
			// drizzle's sqlite-proxy maps result columns by POSITION, so the
			// object rows from node:sqlite must be reshaped into arrays using
			// the statement's column order.
			const columns = stmt.columns().map((column) => column.name);
			const rawRows =
				method === "get" ? [stmt.get(...params)] : stmt.all(...params);
			const rows = rawRows.flatMap((row) =>
				row == null ? [] : [columns.map((c) => row[c])],
			);
			return { rows: rows as unknown as Record<string, unknown>[] };
		},
		{ schema },
	);
}

beforeAll(async () => {
	sqlite = new DatabaseSync(":memory:");
	// Apply the real drizzle migrations in journal order (filenames alone are
	// not enough — two migrations can share a number).
	const journal = JSON.parse(
		await fs.readFile(
			path.join(rootDir, "migration", "meta", "_journal.json"),
			"utf8",
		),
	) as { entries: Array<{ idx: number; tag: string }> };
	for (const { tag } of journal.entries.sort((a, b) => a.idx - b.idx)) {
		const content = await fs.readFile(
			path.join(rootDir, "migration", `${tag}.sql`),
			"utf8",
		);
		for (const statement of content.split("--> statement-breakpoint")) {
			const trimmed = statement.trim();
			if (trimmed) {
				sqlite.exec(trimmed);
			}
		}
	}
	db = makeDb(sqlite);
	hoisted.db = db;
});

afterAll(() => {
	sqlite?.close();
});

beforeEach(async () => {
	for (const table of [creditLedger, topupRequest, organization, user]) {
		await db.delete(table);
	}
	await db.insert(user).values({
		id: "u1",
		name: "Requester",
		email: "u1@test.dev",
		emailVerified: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	await db.insert(organization).values({
		id: "org1",
		name: "Org",
		slug: "org",
		balanceSen: 1000,
		createdAt: new Date(),
	});
});

async function seedTopup(
	values: Partial<typeof topupRequest.$inferInsert> & { id: string },
): Promise<typeof topupRequest.$inferSelect> {
	const now = new Date();
	const [row] = await db
		.insert(topupRequest)
		.values({
			organizationId: "org1",
			amountSen: 500,
			paymentRef: `ref-${values.id}`,
			requestedBy: "u1",
			createdAt: now,
			updatedAt: now,
			...values,
		})
		.returning();
	if (!row) {
		throw new Error("seedTopup failed");
	}
	return row;
}

describe("finalizePaidBill idempotency", () => {
	it("credits a credit top-up exactly once across duplicate calls", async () => {
		const topup = await seedTopup({
			id: "t1",
			method: "billplz",
			billId: "bill-a",
		});

		expect(await finalizePaidBill(topup, "bill-a")).toBe("credit");
		expect(await finalizePaidBill(topup, "bill-a")).toBe("already_processed");

		const [org] = await db
			.select({ balanceSen: organization.balanceSen })
			.from(organization)
			.where(eq(organization.id, "org1"));
		expect(org?.balanceSen).toBe(1500);

		const ledger = await db
			.select()
			.from(creditLedger)
			.where(eq(creditLedger.organizationId, "org1"));
		expect(ledger).toHaveLength(1);
		expect(ledger[0]?.amountSen).toBe(500);
		expect(ledger[0]?.balanceAfterSen).toBe(1500);

		const [request] = await db
			.select({ status: topupRequest.status })
			.from(topupRequest)
			.where(eq(topupRequest.id, "t1"));
		expect(request?.status).toBe("approved");
	});

	it("extends renewal from the existing expiry exactly once, without crediting", async () => {
		// timestamp columns store whole seconds — keep the expected value in
		// the same precision so the equality below is exact
		const base = new Date(
			Math.floor((Date.now() + 60 * 24 * 60 * 60 * 1000) / 1000) * 1000,
		);
		await db
			.update(organization)
			.set({ paidUntil: base })
			.where(eq(organization.id, "org1"));
		const topup = await seedTopup({
			id: "t2",
			method: "billplz",
			purpose: "plan_renewal",
			planId: "pro",
			months: 1,
			amountSen: 2900,
			billAmountSen: 3025,
			billId: "bill-b",
		});

		expect(await finalizePaidBill(topup, "bill-b")).toBe("plan_renewal");
		expect(await finalizePaidBill(topup, "bill-b")).toBe("already_processed");

		const [org] = await db
			.select({
				paidUntil: organization.paidUntil,
				balanceSen: organization.balanceSen,
			})
			.from(organization)
			.where(eq(organization.id, "org1"));
		expect(org?.paidUntil?.getTime()).toBe(addMonths(base, 1).getTime());
		// renewal extends the plan but must not touch the credit balance
		expect(org?.balanceSen).toBe(1000);
	});

	it("does nothing when another path already approved the request", async () => {
		const topup = await seedTopup({
			id: "t3",
			method: "billplz",
			billId: "bill-c",
		});
		await db
			.update(topupRequest)
			.set({ status: "approved", decisionNote: "Already handled" })
			.where(eq(topupRequest.id, "t3"));

		expect(await finalizePaidBill(topup, "bill-c")).toBe("already_processed");

		const [org] = await db
			.select({ balanceSen: organization.balanceSen })
			.from(organization)
			.where(eq(organization.id, "org1"));
		expect(org?.balanceSen).toBe(1000);
		const ledger = await db.select().from(creditLedger);
		expect(ledger).toHaveLength(0);
	});

	it("applies two separate top-ups sequentially without losing an increment", async () => {
		await seedTopup({ id: "t4", method: "billplz", billId: "bill-d" });
		const [first] = await db
			.select()
			.from(topupRequest)
			.where(eq(topupRequest.id, "t4"));
		await finalizePaidBill(first, "bill-d");
		// the partial unique index allows only ONE pending request per org, so
		// the second request can only be created after the first is approved
		const second = await seedTopup({
			id: "t5",
			method: "billplz",
			amountSen: 300,
			billId: "bill-e",
		});
		await finalizePaidBill(second, "bill-e");

		const [org] = await db
			.select({ balanceSen: organization.balanceSen })
			.from(organization)
			.where(eq(organization.id, "org1"));
		expect(org?.balanceSen).toBe(1800);
	});
});
