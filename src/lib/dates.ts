// Client-safe date formatting. One fixed, locale-stable style everywhere:
// "25 Sep 2026" — unambiguous for a Malaysian (DD/MM) audience and stable
// across server and client rendering, unlike toLocaleDateString().
const DAY_FMT = new Intl.DateTimeFormat("en-GB", {
	day: "2-digit",
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});
const DAY_MONTH_FMT = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
});
const TIME_FMT = new Intl.DateTimeFormat("en-GB", {
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
});

function asDate(value: Date | string | number | null | undefined): Date | null {
	if (value === null || value === undefined || value === "") {
		return null;
	}
	if (value instanceof Date) {
		return value;
	}
	if (typeof value === "string") {
		// "YYYY-MM-DD" is a calendar date — parse as UTC midnight so the
		// formatted day is stable in every timezone.
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			return new Date(`${value}T00:00:00Z`);
		}
		return new Date(value);
	}
	return new Date(value);
}

export function formatDate(
	value: Date | string | number | null | undefined,
): string {
	const date = asDate(value);
	if (!date || Number.isNaN(date.getTime())) {
		return "—";
	}
	return DAY_FMT.format(date);
}

/** "12 Sept, 07:11 am" style short label for mixed date+time lists. */
export function formatDateShort(
	value: Date | string | number | null | undefined,
): string {
	const date = asDate(value);
	if (!date || Number.isNaN(date.getTime())) {
		return "—";
	}
	return `${DAY_MONTH_FMT.format(date)}, ${TIME_FMT.format(date)}`;
}

export function formatTime(
	value: Date | string | number | null | undefined,
): string {
	const date = asDate(value);
	if (!date || Number.isNaN(date.getTime())) {
		return "—";
	}
	return TIME_FMT.format(date);
}
