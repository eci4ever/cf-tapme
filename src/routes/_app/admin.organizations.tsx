import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	type ColumnDef,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, SortableHeader } from "#/components/data-table/data-table";
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
import { Textarea } from "#/components/ui/textarea";
import {
	decideTopupRequest,
	listOrgBilling,
	listPendingTopupRequests,
} from "#/lib/billing.functions";
import { formatDate } from "#/lib/dates";
import {
	formatRm,
	type PlanId,
	type SubscriptionStatus,
} from "#/lib/subscription";

export const Route = createFileRoute("/_app/admin/organizations")({
	staticData: { title: "Organization" },
	validateSearch: (
		search: Record<string, unknown>,
	): { q?: string; status?: string } => ({
		q:
			typeof search.q === "string"
				? search.q
				: typeof search.q === "number"
					? String(search.q)
					: undefined,
		status:
			typeof search.status === "string" &&
			["all", "active", "warning", "grace"].includes(search.status)
				? search.status
				: undefined,
	}),
	component: OrganizationsAdminPage,
});

type OrgBillingRow = {
	id: string;
	name: string;
	plan: PlanId;
	pendingPlan: PlanId | null;
	balanceSen: number;
	paidUntil: Date | null;
	status: SubscriptionStatus;
	memberCount: number;
};

function OrganizationsAdminPage() {
	const { q, status } = Route.useSearch();
	const navigate = Route.useNavigate();
	const [sorting, setSorting] = useState([{ id: "name", desc: false }]);
	const search = q ?? "";
	const statusFilter = status ?? "all";
	const setSearch = (value: string) =>
		navigate({
			search: (prev) => ({ ...prev, q: value || undefined }),
		});
	const setStatusFilter = (value: string) =>
		navigate({
			search: (prev) => ({ ...prev, status: value }),
		});
	const orgsQuery = useQuery({
		queryKey: ["admin", "orgs"],
		queryFn: async () => {
			const rows = await listOrgBilling();
			return rows as OrgBillingRow[];
		},
	});
	const orgs = (orgsQuery.data ?? []).filter((org) => {
		if (search && !org.name.toLowerCase().includes(search.toLowerCase())) {
			return false;
		}
		if (statusFilter !== "all" && org.status !== statusFilter) {
			return false;
		}
		return true;
	});
	const loading = orgsQuery.isPending;

	const columns: ColumnDef<OrgBillingRow>[] = [
		{
			accessorKey: "name",
			header: ({ column }) => (
				<SortableHeader column={column} title="Organization" />
			),
			cell: ({ row }) => (
				<Link
					to="/admin/organizations/$orgId"
					params={{ orgId: row.original.id }}
					className="font-medium hover:underline"
				>
					{row.original.name}
				</Link>
			),
		},
		{
			accessorKey: "plan",
			header: "Plan",
			cell: ({ row }) => (
				<div>
					<Badge variant="secondary">{row.original.plan}</Badge>
					{row.original.pendingPlan &&
					row.original.pendingPlan !== row.original.plan ? (
						<span className="ml-1 text-xs text-muted-foreground">
							→ {row.original.pendingPlan}
						</span>
					) : null}
				</div>
			),
		},
		{
			accessorKey: "balanceSen",
			header: ({ column }) => (
				<SortableHeader column={column} title="Balance" />
			),
			cell: ({ row }) => formatRm(row.original.balanceSen),
		},
		{
			accessorKey: "memberCount",
			header: ({ column }) => (
				<SortableHeader column={column} title="Members" />
			),
			cell: ({ row }) => row.original.memberCount,
		},
		{
			accessorKey: "paidUntil",
			header: "Paid until",
			cell: ({ row }) => {
				const paidUntil = row.original.paidUntil;
				if (!paidUntil) {
					return "—";
				}
				const days = Math.round(
					(new Date(paidUntil).getTime() - Date.now()) / 86_400_000,
				);
				const relative =
					days >= 0
						? `${days} day${days === 1 ? "" : "s"} left`
						: `expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
				return (
					<div>
						{formatDate(new Date(paidUntil))}
						<p
							className={`text-xs ${
								days < 0
									? "text-destructive"
									: days <= 7
										? "text-amber-600 dark:text-amber-400"
										: "text-muted-foreground"
							}`}
						>
							{relative}
						</p>
					</div>
				);
			},
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge
					variant={
						row.original.status === "grace"
							? "destructive"
							: row.original.status === "warning"
								? "secondary"
								: "outline"
					}
				>
					{row.original.status}
				</Badge>
			),
		},
		{
			id: "actions",
			header: "",
			cell: ({ row }) => (
				<Button
					variant="ghost"
					size="icon"
					aria-label={`View ${row.original.name}`}
					asChild
				>
					<Link
						to="/admin/organizations/$orgId"
						params={{ orgId: row.original.id }}
					>
						<Eye />
					</Link>
				</Button>
			),
		},
	];

	const table = useReactTable({
		data: orgs,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: setSorting,
		state: { sorting },
	});

	return (
		<div className="flex flex-col gap-4">
			<PendingTopupsCard />
			<Card>
				<CardHeader>
					<CardTitle>Organization billing</CardTitle>
					<CardDescription>
						Manual credit top ups and adjustments per organization
					</CardDescription>
				</CardHeader>
				<CardContent>
					<DataTable
						table={table}
						loading={loading}
						columnCount={columns.length}
						stickyColumn
						toolbar={
							<div className="flex items-center gap-2">
								<Input
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Search organization…"
									className="h-9 w-56"
								/>
								<Select value={statusFilter} onValueChange={setStatusFilter}>
									<SelectTrigger className="h-9 w-36">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											<SelectItem value="all">All statuses</SelectItem>
											<SelectItem value="active">Active</SelectItem>
											<SelectItem value="warning">Warning</SelectItem>
											<SelectItem value="grace">Grace</SelectItem>
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

type PendingTopupRow = {
	id: string;
	organizationId: string;
	orgName: string;
	amountSen: number;
	paymentRef: string;
	requestedByName: string;
	createdAt: Date | string;
};

function PendingTopupsCard() {
	const queryClient = useQueryClient();
	const [rejecting, setRejecting] = useState<PendingTopupRow | null>(null);
	const [rejectNote, setRejectNote] = useState("");
	const requestsQuery = useQuery({
		queryKey: ["admin", "topup-requests"],
		queryFn: listPendingTopupRequests,
	});
	const requests = (requestsQuery.data ?? []) as PendingTopupRow[];
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["admin"] });

	const decideMutation = useMutation({
		mutationFn: async (input: {
			requestId: string;
			decision: "approved" | "rejected";
			note?: string;
		}) => {
			const result = await decideTopupRequest({ data: input });
			if (!result.ok) {
				throw new Error(result.reason);
			}
			return result;
		},
		onSuccess: (_result, variables) => {
			toast.success(`Request ${variables.decision}`);
			setRejecting(null);
			setRejectNote("");
			invalidate();
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Top-up requests</CardTitle>
				<CardDescription>
					Approving adds the credit to the organization balance and records a
					ledger entry
				</CardDescription>
			</CardHeader>
			<CardContent>
				{requestsQuery.isPending ? (
					<p className="text-sm text-muted-foreground">Loading…</p>
				) : requests.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No pending top-up requests.
					</p>
				) : (
					<ul className="flex flex-col gap-2">
						{requests.map((request) => (
							<li
								key={request.id}
								className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
							>
								<div className="min-w-0">
									<p className="font-medium">{request.orgName}</p>
									<p className="text-xs text-muted-foreground">
										{formatRm(request.amountSen)} · ref {request.paymentRef} ·{" "}
										{request.requestedByName} ·{" "}
										{formatDate(new Date(request.createdAt))}
									</p>
								</div>
								<div className="flex gap-1">
									<Button
										size="sm"
										variant="outline"
										disabled={decideMutation.isPending}
										onClick={() =>
											decideMutation.mutate({
												requestId: request.id,
												decision: "approved",
											})
										}
									>
										Approve
									</Button>
									<Button
										size="sm"
										variant="ghost"
										className="text-destructive"
										onClick={() => {
											setRejecting(request);
											setRejectNote("");
										}}
									>
										Reject
									</Button>
								</div>
							</li>
						))}
					</ul>
				)}
			</CardContent>
			<Dialog
				open={rejecting !== null}
				onOpenChange={(open) => {
					if (!open) {
						setRejecting(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reject top-up request</DialogTitle>
						<DialogDescription>
							{rejecting
								? `${rejecting.orgName} — ${formatRm(rejecting.amountSen)} (ref ${rejecting.paymentRef})`
								: ""}
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-2">
						<Label htmlFor="reject-note">Reason (shown to the requester)</Label>
						<Textarea
							id="reject-note"
							value={rejectNote}
							onChange={(event) => setRejectNote(event.target.value)}
							placeholder="e.g. Payment reference not found in bank statement"
						/>
					</div>
					<DialogFooter>
						<Button
							variant="destructive"
							disabled={decideMutation.isPending}
							onClick={() => {
								if (rejecting) {
									decideMutation.mutate({
										requestId: rejecting.id,
										decision: "rejected",
										note: rejectNote,
									});
								}
							}}
						>
							{decideMutation.isPending ? "Rejecting…" : "Reject request"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
