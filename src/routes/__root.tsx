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
				title: "TapMe",
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
