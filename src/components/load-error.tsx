import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";

/** Shared error state for failed data loads, with a retry affordance. */
export function LoadError({
	message,
	onRetry,
}: {
	message: string;
	onRetry: () => void;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Something went wrong</CardTitle>
				<CardDescription>{message}</CardDescription>
			</CardHeader>
			<CardContent>
				<Button variant="outline" onClick={onRetry}>
					Try again
				</Button>
			</CardContent>
		</Card>
	);
}
