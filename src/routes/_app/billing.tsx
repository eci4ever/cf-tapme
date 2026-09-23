import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, CreditCard, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LoadError } from "#/components/load-error";
import { PageSkeleton } from "#/components/loading-skeletons";
import { StatusBadge } from "#/components/status-badge";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import {
	checkBillplzStatus,
	createBillplzRenewal,
	createBillplzTopup,
	getBillingOverview,
	getPaymentInstructions,
	listLedgerPage,
	listMyTopupRequests,
	type PageCursor,
	requestTopup,
	type SubscriptionState,
	subscribePlan,
} from "#/lib/billing.functions";
import { formatDate } from "#/lib/dates";
import { getMyOrgRole } from "#/lib/org.functions";
import {
	formatRm,
	type LedgerType,
	PAID_PLANS,
	PLANS,
	type PlanId,
	parseRmToSen,
	planTermPriceSen,
	SUBSCRIPTION_MONTHS,
	termDiscountLabel,
} from "#/lib/subscription";

export const Route = createFileRoute("/_app/billing")({
	staticData: { title: "Billing" },
	beforeLoad: async () => {
		const role = await getMyOrgRole();
		if (role !== "admin" && role !== "owner") {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: BillingPage,
});

type LedgerRow = {
	id: string;
	type: LedgerType;
	amountSen: number;
	balanceAfterSen: number;
	note: string | null;
	createdAt: Date;
};

function BillingPage() {
	const queryClient = useQueryClient();
	const overviewQuery = useQuery({
		queryKey: ["billing", "overview"],
		queryFn: getBillingOverview,
	});
	// Must stay above the early returns below: a hook skipped on the first
	// (loading) render breaks the hook order once data arrives.
	const instructionsQuery = useQuery({
		queryKey: ["billing", "payment-instructions"],
		queryFn: getPaymentInstructions,
	});

	if (overviewQuery.isError) {
		return (
			<LoadError
				message="Could not load your billing data."
				onRetry={() => overviewQuery.refetch()}
			/>
		);
	}
	if (overviewQuery.isPending || !overviewQuery.data) {
		return <PageSkeleton />;
	}

	const { state } = overviewQuery.data as { state: SubscriptionState };
	const billplzEnabled = instructionsQuery.data?.billplzEnabled ?? false;

	return (
		<div className="flex flex-col gap-4">
			<div className="grid gap-4 sm:grid-cols-2">
				<Card>
					<CardHeader className="flex-row items-center justify-between space-y-0">
						<CardDescription>Credit balance</CardDescription>
						<Wallet className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<CardTitle className="text-3xl tabular-nums">
							{formatRm(state.balanceSen)}
						</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">
							Top up manually — see payment instructions below
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex-row items-center justify-between space-y-0">
						<CardDescription>Current plan</CardDescription>
						<Badge variant={state.plan === "free" ? "secondary" : "outline"}>
							{PLANS[state.plan].name}
						</Badge>
					</CardHeader>
					<CardContent>
						<CardTitle className="text-3xl">
							{state.paidUntil ? formatDate(state.paidUntil) : "—"}
						</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">
							{state.plan === "free" ? "Free plan — no expiry" : "Paid until"}
						</p>
						{state.pendingPlan ? (
							<p className="mt-1 text-xs text-muted-foreground">
								Pending change to {PLANS[state.pendingPlan].name} at next
								renewal
							</p>
						) : null}
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Plans</CardTitle>
					<CardDescription>
						{state.pendingPlan
							? "Your plan change takes effect at the next renewal."
							: "Plan changes made while a subscription is active take effect at the next renewal."}
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-3">
					{(["free", ...PAID_PLANS] as PlanId[]).map((planId) => (
						<PlanCard
							key={planId}
							planId={planId}
							state={state}
							billplzEnabled={billplzEnabled}
							billplzFeeSen={instructionsQuery.data?.billplzFeeSen ?? 125}
							onDone={() =>
								queryClient.invalidateQueries({ queryKey: ["billing"] })
							}
						/>
					))}
				</CardContent>
			</Card>

			<PaymentInstructionsCard />
			<TopupRequestsCard />

			<TransactionsCard />
		</div>
	);
}

function TransactionsCard() {
	const query = useInfiniteQuery({
		queryKey: ["billing", "ledger"],
		queryFn: ({ pageParam }) => listLedgerPage({ data: { before: pageParam } }),
		initialPageParam: undefined as PageCursor | undefined,
		getNextPageParam: (lastPage) => {
			const rows = lastPage.rows as LedgerRow[];
			if (!lastPage.hasMore || rows.length === 0) {
				return undefined;
			}
			const last = rows[rows.length - 1];
			return { at: new Date(last.createdAt).getTime(), id: last.id };
		},
	});
	const ledger = (query.data?.pages.flatMap((page) => page.rows) ??
		[]) as LedgerRow[];
	return (
		<Card>
			<CardHeader>
				<CardTitle>Transactions</CardTitle>
			</CardHeader>
			<CardContent>
				{ledger.length === 0 ? (
					<p className="text-sm text-muted-foreground">No transactions yet.</p>
				) : (
					<>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Amount</TableHead>
									<TableHead>Balance after</TableHead>
									<TableHead>Note</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{ledger.map((entry) => (
									<TableRow key={entry.id}>
										<TableCell>
											{formatDate(new Date(entry.createdAt))}
										</TableCell>
										<TableCell>
											<Badge
												variant={entry.amountSen > 0 ? "outline" : "secondary"}
											>
												{entry.type.replace(/_/g, " ")}
											</Badge>
										</TableCell>
										<TableCell
											className={
												entry.amountSen > 0
													? "font-medium"
													: "font-medium text-destructive"
											}
										>
											<span className="flex items-center gap-1">
												{entry.amountSen > 0 ? (
													<ArrowUpRight className="size-3" />
												) : (
													<ArrowDownRight className="size-3" />
												)}
												{formatRm(Math.abs(entry.amountSen))}
											</span>
										</TableCell>
										<TableCell className="tabular-nums">
											{formatRm(entry.balanceAfterSen)}
										</TableCell>
										<TableCell className="max-w-48 truncate text-muted-foreground">
											{entry.note ?? "—"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						{query.hasNextPage ? (
							<Button
								variant="outline"
								size="sm"
								className="mt-3 w-full"
								disabled={query.isFetchingNextPage}
								onClick={() => query.fetchNextPage()}
							>
								{query.isFetchingNextPage ? "Loading…" : "Load more"}
							</Button>
						) : null}
					</>
				)}
			</CardContent>
		</Card>
	);
}

function PlanCard({
	planId,
	state,
	billplzEnabled,
	billplzFeeSen,
	onDone,
}: {
	planId: PlanId;
	state: SubscriptionState;
	billplzEnabled: boolean;
	billplzFeeSen: number;
	onDone: () => void;
}) {
	const queryClient = useQueryClient();
	const plan = PLANS[planId];
	const isCurrent = state.plan === planId;
	const isPending = state.pendingPlan === planId;
	const isActive =
		state.plan !== "free" &&
		state.paidUntil !== null &&
		state.paidUntil.getTime() > Date.now();
	const [months, setMonths] = useState<number>(1);
	const subscribeMutation = useMutation({
		mutationFn: async (input: { planId: PlanId; months: number }) => {
			const result = await subscribePlan({ data: input });
			if (!result.ok) {
				throw new Error(result.reason);
			}
			return result;
		},
		onSuccess: (result) => {
			if (result.scheduled) {
				toast.success(`${plan.name} scheduled — takes effect at next renewal`);
			} else {
				toast.success(
					`${plan.name} active for ${months} month${months > 1 ? "s" : ""}`,
				);
			}
			queryClient.invalidateQueries({ queryKey: ["billing"] });
			onDone();
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});
	const renewalMutation = useMutation({
		mutationFn: async (input: { planId: PlanId; months: number }) => {
			const result = await createBillplzRenewal({ data: input });
			if (!result.ok) {
				throw new Error(result.reason);
			}
			return result;
		},
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ["billing"] });
			// Hand off to the Billplz payment page; the callback extends
			// paid_until directly — no balance movement.
			window.location.href = result.billUrl;
		},
		onError: (error) => toast.error(error.message),
	});

	function handleRenewViaBillplz() {
		renewalMutation.mutate({ planId, months });
	}

	function handleSubscribe() {
		subscribeMutation.mutate({ planId, months });
	}

	const pending = subscribeMutation.isPending;

	const buttonLabel = (() => {
		if (pending) {
			return "Processing…";
		}
		if (planId === "free") {
			return isActive ? "Downgrade at renewal" : "Current plan";
		}
		if (isPending) {
			return "Scheduled";
		}
		if (isActive && isCurrent) {
			return "Extend";
		}
		if (isActive) {
			return "Schedule at renewal";
		}
		return "Subscribe";
	})();

	const canAct =
		!pending &&
		!isPending &&
		!(planId === "free" && !isActive) &&
		!(isCurrent && planId === "free");

	return (
		<div
			className={`flex flex-col gap-3 rounded-lg border p-4 ${
				isCurrent || isPending ? "border-primary" : ""
			}`}
		>
			<div className="flex items-center justify-between">
				<p className="font-semibold">{plan.name}</p>
				{isCurrent ? <Badge variant="outline">Current</Badge> : null}
				{isPending ? <Badge variant="secondary">Scheduled</Badge> : null}
			</div>
			<p className="text-2xl font-semibold">
				{plan.priceSen === 0 ? "Free" : formatRm(plan.priceSen)}
				{plan.priceSen > 0 ? (
					<span className="text-sm font-normal text-muted-foreground">
						{" "}
						/month
					</span>
				) : null}
			</p>
			<p className="text-sm text-muted-foreground">
				{plan.maxEmployees === null
					? "Unlimited employees"
					: `Up to ${plan.maxEmployees} employees`}
			</p>
			{planId === "free" ? null : (
				<Select
					value={String(months)}
					onValueChange={(value) => setMonths(Number(value))}
				>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{SUBSCRIPTION_MONTHS.map((count) => {
								const save = termDiscountLabel(count);
								return (
									<SelectItem key={count} value={String(count)}>
										{count} month{count > 1 ? "s" : ""} —{" "}
										{formatRm(planTermPriceSen(planId, count))}
										{save ? ` (${save})` : ""}
									</SelectItem>
								);
							})}
						</SelectGroup>
					</SelectContent>
				</Select>
			)}
			<Button
				variant={isCurrent && planId === "free" ? "secondary" : "default"}
				disabled={!canAct}
				onClick={handleSubscribe}
			>
				{buttonLabel}
			</Button>
			{billplzEnabled && isCurrent && planId !== "free" ? (
				<Button
					type="button"
					variant="outline"
					disabled={renewalMutation.isPending || subscribeMutation.isPending}
					onClick={handleRenewViaBillplz}
				>
					<CreditCard />
					{renewalMutation.isPending
						? "Opening Billplz…"
						: (() => {
								const total = planTermPriceSen(planId, months) + billplzFeeSen;
								return `Renew via Billplz — ${formatRm(total)}`;
							})()}
				</Button>
			) : null}
		</div>
	);
}

type TopupRequestRow = {
	id: string;
	amountSen: number;
	paymentRef: string;
	status: string;
	method: string;
	purpose: string;
	planId: string | null;
	months: number | null;
	billUrl: string | null;
	decisionNote: string | null;
	createdAt: Date | string;
};

function RequestTopupButton() {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [amount, setAmount] = useState("");
	const [paymentRef, setPaymentRef] = useState("");
	const instructionsQuery = useQuery({
		queryKey: ["billing", "payment-instructions"],
		queryFn: getPaymentInstructions,
		enabled: open,
	});
	const requestMutation = useMutation({
		mutationFn: async (input: { amountSen: number; paymentRef: string }) => {
			const result = await requestTopup({ data: input });
			if (!result.ok) {
				throw new Error(result.reason);
			}
			return result;
		},
		onSuccess: () => {
			toast.success("Top-up request submitted");
			setOpen(false);
			setAmount("");
			setPaymentRef("");
			queryClient.invalidateQueries({ queryKey: ["billing"] });
		},
		onError: (error) => toast.error(error.message),
	});
	const billplzMutation = useMutation({
		mutationFn: async (input: { amountSen: number }) => {
			const result = await createBillplzTopup({ data: input });
			if (!result.ok) {
				throw new Error(result.reason);
			}
			return result;
		},
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ["billing"] });
			// Hand off to the Billplz payment page in the same tab; the
			// gateway redirects back to /api/billplz/redirect on completion.
			window.location.href = result.billUrl;
		},
		onError: (error) => toast.error(error.message),
	});

	function handleBillplzPay() {
		const amountSen = parseRmToSen(amount);
		if (amountSen === null || amountSen < 100) {
			toast.error("Minimum top-up is RM1");
			return;
		}
		billplzMutation.mutate({ amountSen });
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const amountSen = parseRmToSen(amount);
		if (amountSen === null || amountSen < 1000) {
			toast.error("Minimum top-up is RM10");
			return;
		}
		requestMutation.mutate({ amountSen, paymentRef });
	}

	const instructions = instructionsQuery.data ?? null;
	const billplzEnabled = instructions?.billplzEnabled ?? false;

	return (
		<>
			<Button size="sm" onClick={() => setOpen(true)}>
				<Wallet />
				Request top-up
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Request credit top-up</DialogTitle>
						<DialogDescription>
							{billplzEnabled
								? "Pay instantly with FPX via Billplz — credit is added automatically once the payment goes through — or transfer manually and submit the reference below."
								: "Transfer the amount by manual bank transfer, then submit this request with your payment reference. The platform administrator will verify it against the bank statement and approve."}
						</DialogDescription>
					</DialogHeader>
					{instructions ? (
						<div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
							<p className="text-sm font-medium">Payment instructions</p>
							<div className="grid gap-1 text-sm">
								{instructions.bankName ? (
									<p>
										<span className="text-muted-foreground">Bank: </span>
										{instructions.bankName}
									</p>
								) : null}
								{instructions.bankAccount ? (
									<p>
										<span className="text-muted-foreground">Account no: </span>
										<span className="font-mono">
											{instructions.bankAccount}
										</span>
									</p>
								) : null}
								{instructions.accountHolder ? (
									<p>
										<span className="text-muted-foreground">Holder: </span>
										{instructions.accountHolder}
									</p>
								) : null}
							</div>
							{instructions.qrBase64 ? (
								<img
									src={instructions.qrBase64}
									alt="DuitNow QR"
									className="h-40 w-40 self-center rounded border bg-white object-contain p-1"
								/>
							) : null}
							{instructions.contactEmail ? (
								<p className="text-xs text-muted-foreground">
									After transferring, email your payment proof to{" "}
									<span className="font-medium text-foreground">
										{instructions.contactEmail}
									</span>{" "}
									— include your organization name and the payment reference you
									enter below.
								</p>
							) : null}
						</div>
					) : null}
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="topup-amount">Amount (RM)</Label>
							<Input
								id="topup-amount"
								inputMode="decimal"
								placeholder="100.00"
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
								required
							/>
							{billplzEnabled ? (
								<p className="text-xs text-muted-foreground">
									A {formatRm(instructions?.billplzFeeSen ?? 125)} Billplz fee
									is added at checkout · RM10 minimum for manual transfer
								</p>
							) : null}
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="topup-ref">Payment reference</Label>
							<Input
								id="topup-ref"
								value={paymentRef}
								onChange={(event) => setPaymentRef(event.target.value)}
								placeholder="e.g. FT1234567890 or your company name"
								required
								minLength={3}
								maxLength={60}
							/>
						</div>
						<DialogFooter className="flex-row items-center justify-end gap-2 sm:justify-end">
							{billplzEnabled ? (
								<Button
									type="button"
									onClick={handleBillplzPay}
									disabled={
										billplzMutation.isPending || requestMutation.isPending
									}
								>
									<CreditCard />
									{billplzMutation.isPending
										? "Opening Billplz…"
										: (() => {
												const credit = parseRmToSen(amount);
												const feeSen = instructions?.billplzFeeSen ?? 125;
												return credit !== null && credit >= 100
													? `Pay RM${((credit + feeSen) / 100).toFixed(2)} via Billplz`
													: "Pay via Billplz (FPX)";
											})()}
								</Button>
							) : null}
							<Button
								type="submit"
								variant={billplzEnabled ? "outline" : "default"}
								disabled={
									requestMutation.isPending || billplzMutation.isPending
								}
							>
								{requestMutation.isPending ? "Submitting…" : "Submit request"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}

function PaymentInstructionsCard() {
	const instructionsQuery = useQuery({
		queryKey: ["billing", "payment-instructions"],
		queryFn: getPaymentInstructions,
	});
	const instructions = instructionsQuery.data ?? null;
	return (
		<Card>
			<CardHeader className="flex-row items-start justify-between gap-2">
				<div className="space-y-1.5">
					<CardTitle>Payment instructions</CardTitle>
					<CardDescription>
						Transfer by manual bank transfer, then submit a top-up request with
						your payment reference
					</CardDescription>
					{instructions?.billplzEnabled && instructions?.billplzSandbox ? (
						<Badge className="border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-400">
							🧪 Sandbox — payments are simulated
						</Badge>
					) : null}
				</div>
				<RequestTopupButton />
			</CardHeader>
			<CardContent className="text-sm">
				{instructions && (instructions.bankAccount || instructions.bankName) ? (
					<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
						<div className="grid gap-1">
							{instructions.bankName ? (
								<p>
									<span className="text-muted-foreground">Bank: </span>
									{instructions.bankName}
								</p>
							) : null}
							{instructions.bankAccount ? (
								<p>
									<span className="text-muted-foreground">Account no: </span>
									<span className="font-mono">{instructions.bankAccount}</span>
								</p>
							) : null}
							{instructions.accountHolder ? (
								<p>
									<span className="text-muted-foreground">Holder: </span>
									{instructions.accountHolder}
								</p>
							) : null}
						</div>
						{instructions.qrBase64 ? (
							<img
								src={instructions.qrBase64}
								alt="DuitNow QR"
								className="size-28 rounded border bg-white object-contain p-1"
							/>
						) : null}
					</div>
				) : (
					<p className="text-muted-foreground">
						Bank account details will appear here once the platform
						administrator configures them.
					</p>
				)}
				{instructions?.contactEmail ? (
					<p className="mt-3 text-xs text-muted-foreground">
						Email your payment proof to{" "}
						<span className="font-medium text-foreground">
							{instructions.contactEmail}
						</span>{" "}
						with your organization name and payment reference. The platform
						administrator will verify and approve — your balance updates
						automatically once approved.
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}

function TopupRequestsCard() {
	const queryClient = useQueryClient();
	const requestsQuery = useInfiniteQuery({
		queryKey: ["billing", "topup-requests"],
		queryFn: ({ pageParam }) =>
			listMyTopupRequests({ data: { before: pageParam } }),
		initialPageParam: undefined as PageCursor | undefined,
		getNextPageParam: (lastPage) => {
			const rows = lastPage.rows as TopupRequestRow[];
			if (!lastPage.hasMore || rows.length === 0) {
				return undefined;
			}
			const last = rows[rows.length - 1];
			return { at: new Date(last.createdAt).getTime(), id: last.id };
		},
	});
	const requests = (requestsQuery.data?.pages.flatMap((page) => page.rows) ??
		[]) as TopupRequestRow[];
	const checkStatusMutation = useMutation({
		mutationFn: async (requestId: string) => {
			const result = await checkBillplzStatus({ data: { requestId } });
			if (!result.ok) {
				throw new Error(result.reason);
			}
			return result;
		},
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ["billing"] });
			if (result.paid) {
				toast.success("Payment confirmed — applied");
			} else {
				toast.info(`Not paid yet (state: ${result.state || "unknown"})`);
			}
		},
		onError: (error) => toast.error(error.message),
	});
	const checkingId = checkStatusMutation.isPending
		? checkStatusMutation.variables
		: null;
	const checkStatus = (requestId: string) =>
		checkStatusMutation.mutate(requestId);
	if (requestsQuery.isPending) {
		return null;
	}
	return (
		<Card>
			<CardHeader>
				<CardTitle>My top-up requests</CardTitle>
				<CardDescription>Latest requests and their outcomes</CardDescription>
			</CardHeader>
			<CardContent>
				{requests.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No top-up requests yet.
					</p>
				) : (
					<>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Amount</TableHead>
									<TableHead>Reference</TableHead>
									<TableHead>Method</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Note</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{requests.map((request) => (
									<TableRow key={request.id}>
										<TableCell>
											{formatDate(new Date(request.createdAt))}
										</TableCell>
										<TableCell>{formatRm(request.amountSen)}</TableCell>
										<TableCell className="max-w-40 truncate">
											{request.paymentRef}
										</TableCell>
										<TableCell>
											{request.method === "billplz"
												? request.purpose === "plan_renewal"
													? `Billplz — ${request.planId ?? "plan"} × ${request.months ?? 1}m`
													: "Billplz"
												: "Manual"}
										</TableCell>
										<TableCell>
											<StatusBadge status={request.status} />
											{request.method === "billplz" &&
											request.status === "pending" &&
											request.billUrl ? (
												<a
													href={request.billUrl}
													className="block text-xs text-primary underline underline-offset-2"
												>
													Resume payment
												</a>
											) : null}
											{request.method === "billplz" &&
											request.status === "pending" ? (
												<Button
													variant="ghost"
													size="xs"
													className="mt-1 -ml-2"
													disabled={checkingId === request.id}
													onClick={() => checkStatus(request.id)}
												>
													{checkingId === request.id
														? "Checking…"
														: "Check status"}
												</Button>
											) : null}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{request.decisionNote ?? "—"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						{requestsQuery.hasNextPage ? (
							<Button
								variant="outline"
								size="sm"
								className="mt-3 w-full"
								disabled={requestsQuery.isFetchingNextPage}
								onClick={() => requestsQuery.fetchNextPage()}
							>
								{requestsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
							</Button>
						) : null}
					</>
				)}
			</CardContent>
		</Card>
	);
}
