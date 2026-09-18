// Custom Cloudflare Worker entrypoint for the TanStack Start app.
//
// wrangler.jsonc sets `main` to this file. `fetch` delegates to the TanStack
// Start default server entry (SSR, routes, server functions) except for the
// raw Billplz gateway endpoints (callback + redirect), which are handled
// directly. `scheduled` runs the cron jobs (absent sweep + clock-in/out
// reminders) that the */15 cron trigger invokes. Cron logic itself lives in
// lib/cron.jobs.ts.
import serverEntry from "@tanstack/react-start/server-entry";
import {
	handleBillplzCallback,
	handleBillplzRedirect,
	isBillplzPath,
} from "./lib/billplz.webhook";
import { runCron } from "./lib/cron.jobs";

// Baseline hardening for every response the worker sends. The CSP allows the
// Turnstile widget (script + iframe + its API calls) and inline bootstrap
// scripts emitted by TanStack Start SSR; ws:/wss: keeps Vite HMR working in
// local dev. `geolocation=(self) is what lets the tap-in geolocation prompt.
const SECURITY_HEADERS: Record<string, string> = {
	"x-frame-options": "DENY",
	"x-content-type-options": "nosniff",
	"referrer-policy": "strict-origin-when-cross-origin",
	"permissions-policy": "camera=(), microphone=(), geolocation=(self)",
	"content-security-policy": [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob:",
		"font-src 'self' data:",
		"connect-src 'self' https://challenges.cloudflare.com ws: wss:",
		"frame-src https://challenges.cloudflare.com",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"object-src 'none'",
		"form-action 'self'",
	].join("; "),
};

async function withSecurityHeaders(
	response: Response | Promise<Response>,
): Promise<Response> {
	const resolved = await response;
	const wrapped = new Response(resolved.body, resolved);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		wrapped.headers.set(name, value);
	}
	return wrapped;
}

export default {
	// TanStack's fetch takes (request, requestOptions) while the Worker
	// runtime supplies (request, env, ctx) — forward only the request.
	fetch: (request, _env, _ctx) => {
		const { pathname } = new URL(request.url);
		if (isBillplzPath(pathname)) {
			return withSecurityHeaders(
				pathname === "/api/billplz/callback"
					? handleBillplzCallback(request)
					: handleBillplzRedirect(request),
			);
		}
		return withSecurityHeaders(serverEntry.fetch(request));
	},

	async scheduled(
		controller: ScheduledController,
		_env: Cloudflare.Env,
		ctx: ExecutionContext,
	) {
		console.log(`Cron triggered: ${controller.cron}`);
		ctx.waitUntil(
			runCron(new Date())
				.then((result) => {
					console.log(
						`[cron] sweep=${result.sweepOrgs} clockIn=${result.clockIn} clockOut=${result.clockOut}`,
					);
				})
				.catch((error) => {
					console.error(
						"[cron] failed:",
						error instanceof Error ? error.message : error,
					);
				}),
		);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
