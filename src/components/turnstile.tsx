import { useEffect, useRef } from "react";

// Cloudflare Turnstile test site key — always passes. Used when
// VITE_TURNSTILE_SITE_KEY is not set at build time so local/dev
// environments aren't blocked. Set the real key for production builds.
const SITE_KEY =
	(import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ||
	"1x00000000000000000000AA";
const SCRIPT_SRC =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
	interface Window {
		turnstile?: {
			render: (
				element: HTMLElement,
				options: {
					sitekey: string;
					callback: (token: string) => void;
					"expired-callback"?: () => void;
					"error-callback"?: () => void;
					theme?: "auto" | "light" | "dark";
				},
			) => string;
			remove: (widgetId: string) => void;
		};
	}
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
	if (typeof window !== "undefined" && window.turnstile) {
		return Promise.resolve();
	}
	if (!scriptPromise) {
		scriptPromise = new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = SCRIPT_SRC;
			script.async = true;
			script.defer = true;
			script.onload = () => resolve();
			script.onerror = () => {
				scriptPromise = null;
				reject(new Error("Failed to load the Turnstile script"));
			};
			document.head.appendChild(script);
		});
	}
	return scriptPromise;
}

export function Turnstile({
	onToken,
}: {
	onToken: (token: string | null) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const widgetIdRef = useRef<string | null>(null);
	const onTokenRef = useRef(onToken);
	onTokenRef.current = onToken;

	useEffect(() => {
		let cancelled = false;
		loadTurnstileScript()
			.then(() => {
				if (cancelled || !containerRef.current || widgetIdRef.current) {
					return;
				}
				widgetIdRef.current =
					window.turnstile?.render(containerRef.current, {
						sitekey: SITE_KEY,
						callback: (token: string) => onTokenRef.current(token),
						"expired-callback": () => onTokenRef.current(null),
						"error-callback": () => onTokenRef.current(null),
						theme: "auto",
					}) ?? null;
			})
			.catch(() => onTokenRef.current(null));
		return () => {
			cancelled = true;
			if (widgetIdRef.current && window.turnstile) {
				window.turnstile.remove(widgetIdRef.current);
				widgetIdRef.current = null;
			}
		};
	}, []);

	return <div ref={containerRef} className="min-h-16" />;
}
