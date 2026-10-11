import { Badge } from "#/components/ui/badge";

// Shared semantic status tones built on the --success/--warning theme tokens
// (they flip per theme, so no dark: variants are needed). red stays raw: the
// danger text role needs red-700, which --destructive (red-600) can't serve.
const TONES: Record<string, string> = {
	approved: "border-success-tint/40 bg-success-tint/10 text-success",
	paid: "border-success-tint/40 bg-success-tint/10 text-success",
	active: "border-success-tint/40 bg-success-tint/10 text-success",
	pending: "border-warning-tint/40 bg-warning-tint/10 text-warning",
	warning: "border-warning-tint/40 bg-warning-tint/10 text-warning",
	grace: "border-warning-tint/40 bg-warning-tint/10 text-warning",
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
