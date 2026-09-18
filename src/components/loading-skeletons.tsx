import { Skeleton } from "#/components/ui/skeleton";
import { TableCell, TableRow } from "#/components/ui/table";

/** Page-level placeholder: title bar plus two content blocks. */
export function PageSkeleton() {
	return (
		<div className="flex flex-col gap-4" aria-busy="true">
			<Skeleton className="h-6 w-48" />
			<div className="flex flex-col gap-2 rounded-lg border p-4">
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
			</div>
			<div className="flex flex-col gap-2 rounded-lg border p-4">
				<Skeleton className="h-5 w-52" />
				<Skeleton className="h-4 w-3/4" />
				<Skeleton className="h-4 w-1/2" />
			</div>
		</div>
	);
}

/** Card-content placeholder: a few shimmering lines. */
export function LinesSkeleton({ rows = 3 }: { rows?: number }) {
	return (
		<div className="flex flex-col gap-2" aria-busy="true">
			{Array.from({ length: rows }, (_, i) => (
				<Skeleton
					key={i}
					className={`h-4 ${i === rows - 1 ? "w-2/3" : "w-full"}`}
				/>
			))}
		</div>
	);
}

/** Table placeholder: shimmering rows spanning the table columns. */
export function TableRowsSkeleton({
	colSpan,
	rows = 3,
}: {
	colSpan: number;
	rows?: number;
}) {
	return (
		<>
			{Array.from({ length: rows }, (_, i) => (
				<TableRow key={i}>
					<TableCell colSpan={colSpan}>
						<Skeleton className="h-4 w-full" />
					</TableCell>
				</TableRow>
			))}
		</>
	);
}
