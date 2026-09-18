import { Badge } from "#/components/ui/badge";

// Shared semantic status tones — green = good/active, amber = waiting/caution,
// red = rejected/failed. Anything unmapped falls back to a neutral outline.
const TONES: Record<string, string> = {
	approved:
		"border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-400",
	paid: "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-400",
	active:
		"border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-400",
	pending:
		"border-amber-600/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-400",
	warning:
		"border-amber-600/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-400",
	grace:
		"border-amber-600/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-400",
	rejected:
		"border-red-600/40 bg-red-500/10 text-red-700 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-400",
	cancelled:
		"border-red-600/40 bg-red-500/10 text-red-700 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-400",
};

export function StatusBadge({
	status,
	className,
}: {
	status: string;
	className?: string;
}) {
	const tone = TONES[status] ?? "";
	return (
		<Badge
			variant="outline"
			className={className ? `${tone} ${className}` : tone}
		>
			{status}
		</Badge>
	);
}
