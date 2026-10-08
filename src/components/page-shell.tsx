import { useEffect, useRef } from "react";
import { AppSidebar } from "#/components/app-sidebar";
import { MobileNavRail } from "#/components/mobile-nav-rail";
import { NotificationBell } from "#/components/notification-bell";
import { ThemeToggle } from "#/components/theme-toggle";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "#/components/ui/breadcrumb";
import { Separator } from "#/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "#/components/ui/sidebar";

export function PageShell({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	const headingRef = useRef<HTMLHeadingElement>(null);
	const mounted = useRef(false);
	useEffect(() => {
		document.title = `${title} · TapMe`;
		// after a client-side navigation focus stays on the link that triggered
		// it — move it to the new page's heading so AT announces the new view
		if (!mounted.current) {
			mounted.current = true;
			return;
		}
		headingRef.current?.focus();
	}, [title]);
	return (
		<SidebarProvider>
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
			>
				Skip to content
			</a>
			<MobileNavRail />
			<AppSidebar />
			<SidebarInset
				id="main-content"
				tabIndex={-1}
				className="max-md:pl-12 min-w-0 focus:outline-none"
			>
				<div className="mx-auto w-full max-w-6xl min-w-0">
					<header className="flex h-16 shrink-0 items-center gap-2 max-md:mt-[env(safe-area-inset-top)]">
						{/* sr-only route target — a focus ring can never be visible on it */}
						<h1 ref={headingRef} tabIndex={-1} className="sr-only outline-none">
							{title}
						</h1>
						<div className="flex min-w-0 items-center gap-1.5 px-2 sm:gap-2 sm:px-4">
							<SidebarTrigger className="-ml-1 size-11" />
							<Separator
								orientation="vertical"
								className="mr-2 data-[orientation=vertical]:h-4"
							/>
							<Breadcrumb>
								<BreadcrumbList>
									<BreadcrumbItem>
										<BreadcrumbPage>{title}</BreadcrumbPage>
									</BreadcrumbItem>
								</BreadcrumbList>
							</Breadcrumb>
						</div>
						<div className="ml-auto flex items-center gap-0.5 px-2 sm:gap-1 sm:px-4">
							<NotificationBell />
							<ThemeToggle />
						</div>
					</header>
					<div className="flex flex-1 flex-col gap-4 p-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
						{children}
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
