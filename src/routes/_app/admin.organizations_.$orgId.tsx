import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { RoleBadge } from "#/components/role-badge";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
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
import { getOrgAdminDetail, listOrgLedger } from "#/lib/admin.functions";
import { adminAdjustCredit } from "#/lib/billing.functions";
import { formatDate } from "#/lib/dates";
import { formatRm, parseRmToSen } from "#/lib/subscription";

export const Route = createFileRoute("/_app/admin/organizations_/$orgId")({
	staticData: { title: "Organization detail" },
	component: OrgDetailPage,
});

function OrgDetailPage() {
	const { orgId } = Route.useParams();
	const queryClient = useQueryClient();
	const [amount, setAmount] = useState("");
	const [type, setType] = useState<"topup" | "adjustment">("topup");
	const [note, setNote] = useState("");
	const [pendingAdjust, setPendingAdjust] = useState<{
		amountSen: number;
		type: "topup" | "adjustment";
		note: string;
	} | null>(null);

	const detailQuery = useQuery({
		queryKey: ["admin", "org-detail", orgId],
		queryFn: async () => {
			const detail = await getOrgAdminDetail({ data: { orgId } });
			if (!detail) {
				throw new Error("Organization not found");
			}
			return detail;
		},
	});

	const ledgerQuery = useQuery({
		queryKey: ["admin", "ledger", orgId],
		queryFn: async () => {
			const rows = await listOrgLedger({ data: { organizationId: orgId } });
			return rows;
		},
	});

	const adjustMutation = useMutation({
		mutationFn: async (input: {
			organizationId: string;
			amountSen: number;
			type: "topup" | "adjustment";
			note: string;
		}) => {
			const result = await adminAdjustCredit({ data: input });
			if (!result.ok) {
				throw new Error(result.reason);
			}
			return result;
		},
		onSuccess: (result) => {
			toast.success(`Balance updated to ${formatRm(result.balanceSen)}`);
			queryClient.invalidateQueries({
				queryKey: ["admin", "org-detail", orgId],
			});
			queryClient.invalidateQueries({ queryKey: ["admin", "ledger", orgId] });
			queryClient.invalidateQueries({ queryKey: ["admin", "orgs"] });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	if (detailQuery.isPending) {
		return <p className="text-sm text-muted-foreground">Loading…</p>;
	}
	if (detailQuery.isError || !detailQuery.data) {
		return (
			<Card>
				<CardContent className="py-10 text-center">
					<p className="text-sm text-muted-foreground">
						Organization not found.{" "}
						<Button
							variant="link"
							className="px-0"
							onClick={() => detailQuery.refetch()}
						>
							Retry
						</Button>
					</p>
				</CardContent>
			</Card>
		);
	}

	const { org, status, members, employees } = detailQuery.data;
	const activeEmployees = employees.filter((employee) => employee.isActive);

	return (
		<div className="flex flex-col gap-4">
			<AlertDialog
				open={pendingAdjust !== null}
				onOpenChange={(open) => {
					if (!open) {
						setPendingAdjust(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Apply negative adjustment?</AlertDialogTitle>
						<AlertDialogDescription>
							This deducts {formatRm(pendingAdjust?.amountSen ?? 0)} from{" "}
							{org.name}&apos;s credit balance. The organization will see the
							change in its ledger immediately.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (pendingAdjust) {
									adjustMutation.mutate({
										organizationId: org.id,
										...pendingAdjust,
									});
								}
								setPendingAdjust(null);
								setAmount("");
								setNote("");
							}}
						>
							Apply deduction
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<Card>
				<CardHeader>
					<CardTitle className="flex flex-wrap items-center gap-2">
						{org.name}
						<Badge variant="outline">{org.plan}</Badge>
						<Badge variant={status === "grace" ? "destructive" : "secondary"}>
							{status}
						</Badge>
					</CardTitle>
					<CardDescription>
						Paid until {org.paidUntil ? formatDate(org.paidUntil) : "—"} ·
						created {formatDate(org.createdAt)} · {members.length} member
						{members.length === 1 ? "" : "s"} · {activeEmployees.length} active
						employee
						{activeEmployees.length === 1 ? "" : "s"}
					</CardDescription>
				</CardHeader>
			</Card>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Credits</CardTitle>
						<CardDescription>
							Current balance: {formatRm(org.balanceSen)}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="flex flex-col gap-3"
							onSubmit={(event) => {
								event.preventDefault();
								const amountSen = parseRmToSen(amount);
								if (amountSen === null || amountSen === 0) {
									toast.error("Enter a valid amount, e.g. 29.00");
									return;
								}
								if (type === "topup" && amountSen < 0) {
									toast.error(
										"Top up amount must be positive — use adjustment to deduct",
									);
									return;
								}
								const payload = {
									organizationId: org.id,
									amountSen,
									type,
									note,
								};
								if (amountSen < 0) {
									setPendingAdjust({
										amountSen,
										type,
										note,
									});
									return;
								}
								adjustMutation.mutate(payload);
								setAmount("");
								setNote("");
							}}
						>
							<div className="flex flex-col gap-2">
								<Label htmlFor="credit-amount">Amount (RM)</Label>
								<Input
									id="credit-amount"
									name="amount"
									inputMode="decimal"
									placeholder="29.00"
									value={amount}
									onChange={(event) => setAmount(event.target.value)}
									required
								/>
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="credit-type">Type</Label>
								<Select
									value={type}
									onValueChange={(value) =>
										setType(value as "topup" | "adjustment")
									}
								>
									<SelectTrigger id="credit-type" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											<SelectItem value="topup">
												Top up (add credits)
											</SelectItem>
											<SelectItem value="adjustment">
												Adjustment (positive or negative)
											</SelectItem>
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="credit-note">Note</Label>
								<Input
									id="credit-note"
									placeholder="Bank transfer #12345"
									value={note}
									onChange={(event) => setNote(event.target.value)}
								/>
							</div>
							<Button
								type="submit"
								disabled={adjustMutation.isPending}
								className="w-fit"
							>
								{adjustMutation.isPending ? "Applying…" : "Apply to balance"}
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Ledger</CardTitle>
						<CardDescription>Latest 50 credit movements</CardDescription>
					</CardHeader>
					<CardContent>
						{ledgerQuery.isPending ? (
							<p className="text-sm text-muted-foreground">Loading…</p>
						) : (ledgerQuery.data ?? []).length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No credit movements yet.
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Date</TableHead>
										<TableHead>Type</TableHead>
										<TableHead>Amount</TableHead>
										<TableHead>Balance</TableHead>
										<TableHead>Note</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(ledgerQuery.data ?? []).map((entry) => (
										<TableRow key={entry.id}>
											<TableCell>{formatDate(entry.createdAt)}</TableCell>
											<TableCell>{entry.type}</TableCell>
											<TableCell
												className={
													entry.amountSen < 0 ? "text-destructive" : undefined
												}
											>
												{entry.amountSen > 0 ? "+" : ""}
												{formatRm(entry.amountSen)}
											</TableCell>
											<TableCell className="tabular-nums">
												{formatRm(entry.balanceAfterSen)}
											</TableCell>
											<TableCell className="max-w-48 truncate">
												{entry.note ?? "—"}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Members</CardTitle>
						<CardDescription>Accounts belonging to this org</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Joined</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{members.map((entry) => (
									<TableRow key={entry.userId}>
										<TableCell className="max-w-48 truncate font-medium">
											{entry.name}
										</TableCell>
										<TableCell className="max-w-56 truncate">
											{entry.email}
										</TableCell>
										<TableCell>
											<RoleBadge roleKey={entry.role} />
										</TableCell>
										<TableCell>{formatDate(entry.joinedAt)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Employees</CardTitle>
						<CardDescription>
							{activeEmployees.length} active of {employees.length} total
						</CardDescription>
					</CardHeader>
					<CardContent>
						{employees.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No employee records.
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>No.</TableHead>
										<TableHead>Name</TableHead>
										<TableHead>Position</TableHead>
										<TableHead>Supervisor</TableHead>
										<TableHead>Status</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{employees.map((employee) => (
										<TableRow key={employee.id}>
											<TableCell>{employee.employeeNo}</TableCell>
											<TableCell className="max-w-48 truncate font-medium">
												{employee.name}
											</TableCell>
											<TableCell>{employee.position ?? "—"}</TableCell>
											<TableCell>{employee.supervisorName ?? "—"}</TableCell>
											<TableCell>
												<Badge
													variant={
														employee.isActive ? "outline" : "destructive"
													}
												>
													{employee.isActive ? "Active" : "Inactive"}
												</Badge>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
