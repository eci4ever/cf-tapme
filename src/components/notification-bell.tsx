import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	listMyNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "#/lib/auth.functions";
import { formatDate } from "#/lib/dates";
import { cn } from "#/lib/utils";

function timeAgo(value: Date): string {
	const seconds = Math.floor((Date.now() - value.getTime()) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return formatDate(value);
}

export function NotificationBell() {
	const queryClient = useQueryClient();
	const { data } = useQuery({
		queryKey: ["notifications"],
		queryFn: listMyNotifications,
		refetchInterval: 30_000,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["notifications"] });

	const markReadMutation = useMutation({
		mutationFn: async (input: { id: string }) =>
			markNotificationRead({ data: input }),
		onSettled: invalidate,
	});
	const markAllRead = useMutation({
		mutationFn: async () => markAllNotificationsRead(),
		onSettled: invalidate,
	});

	const items = data?.items ?? [];
	const unread = data?.unread ?? 0;

	const markRead = (id: string) => markReadMutation.mutate({ id });

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative"
					aria-label="Notifications"
				>
					<Bell />
					{unread > 0 ? (
						<span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
							{unread > 9 ? "9+" : unread}
						</span>
					) : null}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-96 max-w-[calc(100vw-2rem)]"
			>
				<div className="flex items-center justify-between px-2 py-1.5">
					<span className="text-sm font-semibold">Notifications</span>
					{unread > 0 ? (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs"
							disabled={markAllRead.isPending}
							onClick={() => markAllRead.mutate()}
						>
							Mark all read
						</Button>
					) : null}
				</div>
				<DropdownMenuSeparator />
				{items.length === 0 ? (
					<p className="px-2 py-6 text-center text-sm text-muted-foreground">
						No notifications yet.
					</p>
				) : (
					<div className="max-h-96 overflow-y-auto overscroll-contain">
						{items.map((item) => {
							const markThisRead = () => {
								if (!item.readAt) {
									markRead(item.id);
								}
							};
							const rowClassName = cn(
								"flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-left",
								!item.readAt && "bg-accent/50",
							);
							return item.linkPath ? (
								<DropdownMenuItem asChild key={item.id} className="gap-0">
									<Link
										to={item.linkPath}
										onClick={markThisRead}
										className={cn(rowClassName, "cursor-pointer")}
									>
										<RowContent item={item} />
									</Link>
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem
									key={item.id}
									onSelect={markThisRead}
									className={cn(rowClassName, "gap-0")}
								>
									<RowContent item={item} />
								</DropdownMenuItem>
							);
						})}
					</div>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function RowContent({
	item,
}: {
	item: {
		title: string;
		body: string | null;
		readAt: Date | null;
		createdAt: Date | string;
	};
}) {
	return (
		<>
			<span className="flex w-full min-w-0 items-start gap-2">
				{!item.readAt ? (
					<span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
				) : (
					<span className="mt-1.5 h-2 w-2 shrink-0" />
				)}
				<span
					className={cn(
						"min-w-0 truncate text-sm",
						!item.readAt && "font-medium",
					)}
				>
					{item.title}
				</span>
			</span>
			{item.body ? (
				<span className="line-clamp-2 break-words pl-4 text-xs text-muted-foreground">
					{item.body}
				</span>
			) : null}
			<span className="pl-4 text-[11px] text-muted-foreground/70">
				{timeAgo(new Date(item.createdAt))}
			</span>
		</>
	);
}
