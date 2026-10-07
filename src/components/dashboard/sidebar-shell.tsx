"use client";

import { SidebarNav } from "./sidebar-nav";
import { useSidebar } from "./sidebar-context";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

interface SidebarShellProps {
    appName: string;
    logoUrl?: string | null;
    userName?: string | null;
    userEmail?: string | null;
    version: string;
}

export function SidebarShell({ appName, logoUrl, userName, userEmail, version }: SidebarShellProps) {
    const { isCollapsed } = useSidebar();

    return (
        <aside
            className={`
                bg-background/80 backdrop-blur-xl border-r border-border/40
                hidden md:flex flex-col h-full sticky left-0 top-0 z-20
                shadow-[1px_0_12px_-4px_rgba(0,0,0,0.08)]
                transition-all duration-300 ease-in-out
                ${isCollapsed ? "w-[72px]" : "w-[260px]"}
            `}
        >
            {/* Logo / Brand */}
            <div className={`border-b border-border/30 transition-all duration-300 ${isCollapsed ? "px-3 py-4" : "px-5 py-4"}`}>
                {isCollapsed ? (
                    <div className="flex justify-center">
                        {logoUrl ? (
                            <div className="h-10 w-10 bg-white rounded-lg p-1.5 shadow-sm border border-border/20 flex items-center justify-center">
                                <img src={logoUrl} alt={appName} className="h-full w-full object-contain" />
                            </div>
                        ) : (
                            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                {appName.charAt(0)}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        {logoUrl ? (
                            <div className="bg-white px-2 py-1.5 rounded-lg shadow-sm border border-border/20 flex items-center justify-center">
                                <img src={logoUrl} alt={appName} className="h-8 max-w-[110px] object-contain" />
                            </div>
                        ) : null}
                        <div className="flex flex-col min-w-0">
                            <h1 className="text-sm font-bold tracking-tight text-foreground truncate">
                                {appName}
                            </h1>
                            <p className="text-[10px] text-muted-foreground font-medium">WhatsApp Gateway</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <SidebarNav />

            {/* User Footer */}
            <div 
                suppressHydrationWarning={true}
                className={`border-t border-border/30 bg-background/40 transition-all duration-300 ${isCollapsed ? "p-2" : "p-4"}`}
            >
                {isCollapsed ? (
                    <div suppressHydrationWarning={true} className="flex flex-col items-center gap-2">
                        <div suppressHydrationWarning={true} className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center text-xs font-bold text-primary">
                            {userName?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <button
                            onClick={() => signOut({ callbackUrl: "/auth/login" })}
                            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                ) : (
                    <>
                        <div suppressHydrationWarning={true} className="flex items-center gap-2.5 mb-3">
                            <div 
                                suppressHydrationWarning={true}
                                className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center text-xs font-bold text-primary border border-primary/10"
                            >
                                {userName?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                            <div suppressHydrationWarning={true} className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{userName || "User"}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full flex items-center justify-center gap-2 text-xs h-8 rounded-lg border-border/40 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                            onClick={() => signOut({ callbackUrl: "/auth/login" })}
                        >
                            <LogOut size={14} /> Sign Out
                        </Button>
                        <p className="text-[9px] text-muted-foreground/50 text-center mt-2 font-mono">v{version}</p>
                    </>
                )}
            </div>
        </aside>
    );
}
