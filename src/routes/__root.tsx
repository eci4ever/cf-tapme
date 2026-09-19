import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { NotFound } from "../components/not-found";
import { ThemeProvider } from "../components/theme-provider";
import { Toaster } from "../components/ui/sonner";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

// Adds the theme class before first paint and keeps a single
// theme-color meta in sync with the resolved theme (system or
// toggled) so mobile browser chrome matches the background.
const SEO_JSON_LD = JSON.stringify({
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "TapMe",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	description:
		"Attendance tracking, leave approvals, and payroll-ready reports for Malaysian SMEs.",
	url: "https://tapme.nimfi.dev/",
	offers: {
		"@type": "Offer",
		price: "0",
		priceCurrency: "MYR",
		description: "Free for up to 5 employees. Pro from RM29/month.",
	},
});

const THEME_BOOTSTRAP = `(function(){try{
var d=localStorage.getItem("tapme-theme")==="dark"||(localStorage.getItem("tapme-theme")!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);
if(d)document.documentElement.classList.add("dark");
var m=document.createElement("meta");m.name="theme-color";document.head.appendChild(m);
var sync=function(){m.content=document.documentElement.classList.contains("dark")?"#09090b":"#ffffff";};
sync();
new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:["class"]});
}catch(e){}})();`;

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover",
			},
			{
				title: "TapMe — Attendance Tracking for Malaysian SMEs",
			},
			{
				name: "description",
				content:
					"Clock-ins, shifts, leave approvals, and payroll-ready reports in one place. Mobile-first attendance tracking for Malaysian SMEs — free for your first 5 employees.",
			},
			{
				rel: "canonical",
				href: "https://tapme.nimfi.dev/",
			},
			{
				property: "og:type",
				content: "website",
			},
			{
				property: "og:site_name",
				content: "TapMe",
			},
			{
				property: "og:title",
				content: "TapMe — Attendance Tracking for Malaysian SMEs",
			},
			{
				property: "og:description",
				content:
					"Clock-ins, shifts, leave approvals, and payroll-ready reports in one place. Free for your first 5 employees.",
			},
			{
				property: "og:url",
				content: "https://tapme.nimfi.dev/",
			},
			{
				property: "og:image",
				content: "https://tapme.nimfi.dev/icons/og-image.png",
			},
			{
				property: "og:image:width",
				content: "1200",
			},
			{
				property: "og:image:height",
				content: "630",
			},
			{
				name: "twitter:card",
				content: "summary_large_image",
			},
			{
				name: "twitter:title",
				content: "TapMe — Attendance Tracking for Malaysian SMEs",
			},
			{
				name: "twitter:description",
				content:
					"Clock-ins, shifts, leave approvals, and payroll-ready reports in one place. Free for your first 5 employees.",
			},
			{
				name: "twitter:image",
				content: "https://tapme.nimfi.dev/icons/og-image.png",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				href: "/favicon.ico",
				sizes: "48x48",
			},
			{
				rel: "manifest",
				href: "/manifest.webmanifest",
			},
			{
				rel: "apple-touch-icon",
				href: "/icons/apple-touch-icon.png",
				sizes: "180x180",
			},
		],
	}),
	shellComponent: RootDocument,
	notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: static bootstrap script, no user input
					dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}
				/>
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: static structured data, no user input
					dangerouslySetInnerHTML={{ __html: SEO_JSON_LD }}
				/>
			</head>
			<body>
				<ThemeProvider>{children}</ThemeProvider>
				<Toaster position="top-right" richColors />
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
