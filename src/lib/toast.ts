import { toast as sonnerToast } from "sonner";

// Error toasts carry information the user just acted on, so they stay until
// dismissed (WCAG 2.2.2 auto-updating content) — success/info keep the short
// default lifetime. The Toaster renders a close button for dismissal.
export const toast = Object.assign(sonnerToast, {
	error: (...args: Parameters<typeof sonnerToast.error>) => {
		const [message, data] = args;
		return sonnerToast.error(message, { duration: Infinity, ...data });
	},
});
