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
            <div className={`border-b border-sidebar-border/40 transition-all duration-300 ${isCollapsed ? "px-2 py-4" : "px-4 py-3.5"}`}>
                {isCollapsed ? (
                    <div className="flex justify-center">
                        <div className="h-10 w-10 bg-white dark:bg-card rounded-xl p-1 shadow-xs border border-border/60 flex items-center justify-center">
                            <img src={logoUrl || "/rhema-logo.png"} alt="Rhema OS" className="h-full w-full object-contain" />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2.5">
                        <div className="bg-white dark:bg-slate-900 px-2 py-1.5 rounded-xl shadow-xs border border-border/60 flex items-center justify-center shrink-0">
                            <img src={logoUrl || "/rhema-logo.png"} alt="Rhema Imóveis" className="h-7 max-w-[110px] object-contain" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-sm font-black tracking-tight text-foreground">
                                    Rhema OS
                                </h1>
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                    v5.1
                                </span>
                            </div>
                            <p className="text-[10px] text-amber-600/90 dark:text-amber-400 font-bold uppercase tracking-wider">
                                Diretoria & Vendas
                            </p>
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
                        <div suppressHydrationWarning={true} className="h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-600 dark:text-amber-400">
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
                                className="h-8 w-8 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0"
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
