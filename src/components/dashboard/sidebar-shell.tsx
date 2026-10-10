"use client";

import { SidebarNav } from "./sidebar-nav";
import { useSidebar } from "./sidebar-context";
import { useLanguage } from "@/components/language-provider";
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
    const { t } = useLanguage();

    return (
        <aside
            className={`
                bg-sidebar/95 dark:bg-sidebar/90 backdrop-blur-2xl border-r border-sidebar-border/60
                hidden md:flex flex-col h-full sticky left-0 top-0 z-20
                shadow-[1px_0_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[1px_0_30px_-6px_rgba(0,0,0,0.5)]
                transition-all duration-300 ease-in-out
                ${isCollapsed ? "w-[72px]" : "w-[260px]"}
            `}
        >
            {/* Logo / Brand */}
            <div className={`border-b border-sidebar-border/40 transition-all duration-300 ${isCollapsed ? "px-3 py-4" : "px-5 py-4"}`}>
                {isCollapsed ? (
                    <div className="flex justify-center">
                        {logoUrl ? (
                            <div className="h-10 w-10 bg-white/95 dark:bg-card/90 rounded-xl p-1.5 shadow-2xs border border-border/40 flex items-center justify-center">
                                <img src={logoUrl} alt={appName} className="h-full w-full object-contain" />
                            </div>
                        ) : (
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary via-emerald-500 to-teal-500 flex items-center justify-center text-primary-foreground font-bold text-sm shadow-md shadow-primary/20">
                                {appName.charAt(0)}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        {logoUrl ? (
                            <div className="bg-white/95 dark:bg-card/90 px-2 py-1.5 rounded-xl shadow-2xs border border-border/40 flex items-center justify-center">
                                <img src={logoUrl} alt={appName} className="h-8 max-w-[110px] object-contain" />
                            </div>
                        ) : (
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary via-emerald-500 to-teal-500 flex items-center justify-center text-primary-foreground font-bold text-sm shadow-md shadow-primary/20 shrink-0">
                                {appName.charAt(0)}
                            </div>
                        )}
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
                className={`border-t border-sidebar-border/40 bg-sidebar/50 transition-all duration-300 ${isCollapsed ? "p-2" : "p-3"}`}
            >
                {isCollapsed ? (
                    <div suppressHydrationWarning={true} className="flex flex-col items-center gap-2">
                        <div suppressHydrationWarning={true} className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary dark:text-emerald-400">
                            {userName?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <button
                            onClick={() => signOut({ callbackUrl: "/auth/login" })}
                            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title={t("common.sign_out")}
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="bg-card/70 dark:bg-card/40 border border-border/60 rounded-xl p-2.5 shadow-2xs space-y-2.5">
                        <div suppressHydrationWarning={true} className="flex items-center gap-2.5">
                            <div 
                                suppressHydrationWarning={true}
                                className="h-8 w-8 rounded-lg bg-primary/10 dark:bg-primary/20 border border-primary/25 flex items-center justify-center text-xs font-bold text-primary dark:text-emerald-400 shrink-0"
                            >
                                {userName?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                            <div suppressHydrationWarning={true} className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-foreground truncate">{userName || "User"}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full flex items-center justify-center gap-2 text-xs h-7.5 rounded-lg border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                            onClick={() => signOut({ callbackUrl: "/auth/login" })}
                        >
                            <LogOut size={13} /> {t("common.sign_out")}
                        </Button>
                        <p className="text-[9px] text-muted-foreground/50 text-center font-mono">v{version}</p>
                    </div>
                )}
            </div>
        </aside>
    );
}
