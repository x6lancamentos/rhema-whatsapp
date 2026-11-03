"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, ChevronDown } from "lucide-react";
import Link from "next/link";
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Settings,
    LogOut,
    QrCode,
    ImageIcon,
    Webhook,
    CalendarClock,
    Bot,
    Bell,
    FileText,
    Code,
    UserCheck,
    Megaphone,
    HardDrive,
    Activity,
    UserCircle,
    Tag,
    MessageCircleReply,
    UserPlus,
    Building2,
    Sparkles,
    Target,
    Brain,
    Compass,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import pkg from "../../../package.json";
import { useLanguage } from "@/components/language-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { TranslationKey } from "@/lib/i18n/translations";

interface NavGroup {
    label: string;
    labelKey: TranslationKey;
    items: { href: string; label: string; labelKey: TranslationKey; icon: React.ElementType; external?: boolean; superadminOnly?: boolean; allowedRoles?: string[] }[];
}

// Keep in sync with sidebar-nav.tsx
const navGroups: NavGroup[] = [
    {
        label: "Main",
        labelKey: "nav.group.main",
        items: [
            { href: "/dashboard", label: "Dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
            { href: "/dashboard/rhema-hub", label: "Rhema Hub (App do Corretor)", labelKey: "nav.rhema_hub", icon: Sparkles },
            { href: "/dashboard/sessions", label: "Sessions / QR", labelKey: "nav.sessions", icon: QrCode },
        ],
    },
    {
        label: "Messaging",
        labelKey: "nav.group.messaging",
        items: [
            { href: "/dashboard/chat", label: "Chat WhatsApp", labelKey: "nav.chat", icon: MessageSquare },
            { href: "/dashboard/broker-radar", label: "Radar de Oportunidades", labelKey: "nav.broker_radar", icon: Compass },
            { href: "/dashboard/broadcast", label: "Broadcast", labelKey: "nav.broadcast", icon: Megaphone },
            { href: "/dashboard/templates", label: "Modelos", labelKey: "nav.templates", icon: FileText },
            { href: "/dashboard/imoview", label: "Imoview CRM", labelKey: "nav.imoview", icon: Building2 },
            { href: "/dashboard/interactive", label: "Botões Interativos", labelKey: "nav.interactive" as any, icon: Sparkles },
            { href: "/dashboard/sticker", label: "Sticker Maker", labelKey: "nav.sticker", icon: ImageIcon },
        ],
    },
    {
        label: "Contacts",
        labelKey: "nav.group.contacts",
        items: [
            { href: "/dashboard/contacts", label: "Contacts", labelKey: "nav.contacts", icon: UserCheck },
            { href: "/dashboard/groups", label: "Groups", labelKey: "nav.groups", icon: Users },
            { href: "/dashboard/labels", label: "Labels", labelKey: "nav.labels", icon: Tag },
        ],
    },
    {
        label: "Automation",
        labelKey: "nav.group.automation",
        items: [
            { href: "/dashboard/sdr", label: "SDR Autônomo & Pré-Vendas", labelKey: "nav.sdr_kanban", icon: LayoutDashboard },
            { href: "/dashboard/hunter", label: "Rhema Hunter (Captação)", labelKey: "nav.hunter" as any, icon: Target },
            { href: "/dashboard/learning", label: "Laboratório de Auto-Evolução", labelKey: "nav.learning" as any, icon: Brain },
            { href: "/dashboard/rhema-os", label: "Rhema OS (Diretoria IA)", labelKey: "nav.rhema_os" as any, icon: Sparkles },
            { href: "/dashboard/ai-agent", label: "Camila AI", labelKey: "nav.ai_agent", icon: Sparkles },
            { href: "/dashboard/bot-settings", label: "Bot Settings", labelKey: "nav.bot_settings", icon: Bot },
            { href: "/dashboard/autoreply", label: "Auto Reply", labelKey: "nav.autoreply", icon: MessageCircleReply },
            { href: "/dashboard/profile", label: "Bot Profile", labelKey: "nav.profile", icon: UserCircle },
            { href: "/dashboard/scheduler", label: "Scheduler", labelKey: "nav.scheduler", icon: CalendarClock },
            { href: "/dashboard/webhooks", label: "Webhooks & API", labelKey: "nav.webhooks", icon: Webhook },
        ],
    },
    {
        label: "Developer",
        labelKey: "nav.group.developer",
        items: [
            { href: "/docs", label: "API Docs", labelKey: "nav.docs", icon: FileText },
            { href: "/swagger", label: "Swagger UI", labelKey: "nav.swagger", icon: Code, external: true },
        ],
    },
    {
        label: "Administration",
        labelKey: "nav.group.administration",
        items: [
            { href: "/dashboard/media", label: "Media Manager", labelKey: "nav.media", icon: HardDrive },
            { href: "/dashboard/sessions/access", label: "Session Access", labelKey: "nav.session_access", icon: UserPlus },
            { href: "/dashboard/users", label: "Equipe & Permissões", labelKey: "nav.team", icon: Users },
            { href: "/dashboard/settings", label: "Settings", labelKey: "nav.settings", icon: Settings },
            { href: "/dashboard/system-monitor", label: "System Monitor", labelKey: "nav.system_monitor", icon: Activity, superadminOnly: true },
            { href: "/dashboard/notifications", label: "Notifications", labelKey: "nav.notifications", icon: Bell, superadminOnly: true },
        ],
    },
];

export function MobileNav({ appName = "Rhema OS" }: { appName?: string }) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const { data: session } = useSession();
    const { t } = useLanguage();
    // @ts-ignore
    const userRole = session?.user?.role;

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(href);
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] sm:w-[320px] p-0 flex flex-col bg-background/95 backdrop-blur-2xl border-r border-border/60">
                <SheetHeader className="px-5 py-4 text-left border-b border-border/60 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="bg-white dark:bg-slate-900 px-2 py-1.5 rounded-xl shadow-xs border border-border/60 flex items-center justify-center shrink-0">
                            <img src="/rhema-logo.png" alt="Rhema OS" className="h-6 w-auto object-contain" />
                        </div>
                        <div>
                            <SheetTitle className="text-base font-black text-foreground">Rhema OS</SheetTitle>
                            <SheetDescription className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider -mt-0.5">Diretoria & Vendas</SheetDescription>
                        </div>
                    </div>
                    <LanguageToggle variant="pill" />
                </SheetHeader>

                <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1 styled-scrollbar">
                    {navGroups.map((group) => {
                        const visibleItems = group.items.filter(
                            (item) => !item.superadminOnly || userRole === "SUPERADMIN"
                        );
                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={group.label} className="mb-1">
                                {group.label !== "Main" && (
                                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                        {t(group.labelKey)}
                                    </p>
                                )}
                                <div className="space-y-0.5">
                                    {visibleItems.map(({ href, labelKey, icon: Icon, external }) => (
                                        <Link
                                            key={href}
                                            href={href}
                                            target={external ? "_blank" : undefined}
                                            onClick={() => setOpen(false)}
                                            className={`
                                                flex items-center rounded-lg text-sm font-medium
                                                transition-all duration-200 group relative
                                                gap-3 px-3 py-2
                                                ${isActive(href)
                                                    ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 shadow-xs font-bold"
                                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                }
                                            `}
                                        >
                                            {isActive(href) && (
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-5 bg-amber-500 rounded-r-full shadow-[0_0_8px_1px_rgba(212,175,55,0.7)]" />
                                            )}
                                            <Icon
                                                size={17}
                                                className={`flex-shrink-0 transition-colors duration-200 ${isActive(href) ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground/70 group-hover:text-foreground"}`}
                                            />
                                            <span className="truncate">{t(labelKey)}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-border bg-muted/30 dark:bg-card/40">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                            {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{session?.user?.name || "User"}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{session?.user?.email}</p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center justify-center gap-2 text-xs h-8"
                        onClick={async () => {
                            setOpen(false);
                            await signOut({ callbackUrl: "/auth/login" });
                        }}
                    >
                        <LogOut size={14} /> {t("common.sign_out")}
                    </Button>
                    <p className="text-[10px] text-muted-foreground/60 text-center mt-2 font-mono">v{pkg.version}</p>
                </div>
            </SheetContent>
        </Sheet>
    );
}
