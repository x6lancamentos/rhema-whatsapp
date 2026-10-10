"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, PanelLeftClose, PanelLeft } from "lucide-react";
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Settings,
    QrCode,
    ImageIcon,
    Webhook,
    CalendarClock,
    Bot,
    Bell,
    FileText,
    Code,
    Send,
    UserCheck,
    Megaphone,
    HardDrive,
    Activity,
    UserCircle,
    Tag,
    MessageCircleReply,
    Contact,
    UserPlus,
    Building2,
} from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { useLanguage } from "@/components/language-provider";
import { TranslationKey } from "@/lib/i18n/translations";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavGroup {
    label: string;
    labelKey: TranslationKey;
    items: NavItem[];
}

interface NavItem {
    href: string;
    label: string;
    labelKey: TranslationKey;
    icon: React.ElementType;
    external?: boolean;
    superadminOnly?: boolean;
    allowedRoles?: string[];
}

const navGroups: NavGroup[] = [
    {
        label: "Main",
        labelKey: "nav.group.main",
        items: [
            { href: "/dashboard", label: "Dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
            { href: "/dashboard/sessions", label: "Sessions / QR", labelKey: "nav.sessions", icon: QrCode },
        ],
    },
    {
        label: "Messaging",
        labelKey: "nav.group.messaging",
        items: [
            { href: "/dashboard/chat", label: "Chat", labelKey: "nav.chat", icon: MessageSquare },
            { href: "/dashboard/broadcast", label: "Broadcast", labelKey: "nav.broadcast", icon: Megaphone },
            { href: "/dashboard/templates", label: "Modelos", labelKey: "nav.templates", icon: FileText },
            { href: "/dashboard/imoview", label: "Imoview CRM", labelKey: "nav.imoview", icon: Building2 },
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
            { href: "/dashboard/users", label: "Equipe & Permissões", labelKey: "nav.team", icon: Users, allowedRoles: ["SUPERADMIN", "ADMIN", "OWNER"] },
            { href: "/dashboard/settings", label: "Settings", labelKey: "nav.settings", icon: Settings },
            { href: "/dashboard/system-monitor", label: "System Monitor", labelKey: "nav.system_monitor", icon: Activity, superadminOnly: true },
            { href: "/dashboard/notifications", label: "Notifications", labelKey: "nav.notifications", icon: Bell, superadminOnly: true },
        ],
    },
];

export function SidebarNav() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { isCollapsed, toggleCollapse } = useSidebar();
    const { t } = useLanguage();
    // @ts-ignore
    const userRole = session?.user?.role;

    // Track collapsed groups — all expanded by default
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = (label: string) => {
        setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(href);
    };

    return (
        <TooltipProvider delayDuration={0}>
            <nav className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden space-y-0.5 styled-scrollbar">
                {navGroups.map((group) => {
                    const visibleItems = group.items.filter((item) => {
                        if (item.superadminOnly && userRole !== "SUPERADMIN") return false;
                        if (item.allowedRoles && (!userRole || !item.allowedRoles.includes(userRole))) return false;
                        return true;
                    });
                    if (visibleItems.length === 0) return null;

                    const isGroupCollapsed = collapsedGroups[group.label] ?? false;

                    // "Main" group doesn't show a collapsible header
                    if (group.label === "Main") {
                        return (
                            <div key={group.label} className="mb-1">
                                {visibleItems.map((item) => (
                                    <NavLink
                                        key={item.href}
                                        item={item}
                                        active={isActive(item.href)}
                                        isCollapsed={isCollapsed}
                                    />
                                ))}
                            </div>
                        );
                    }

                    return (
                        <div key={group.label} className="mb-1">
                            {/* Group header — hidden when sidebar collapsed */}
                            {!isCollapsed && (
                                <button
                                    onClick={() => toggleGroup(group.label)}
                                    className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-foreground/80 transition-colors group"
                                >
                                    {t(group.labelKey)}
                                    <ChevronDown
                                        size={12}
                                        className={`transition-transform duration-200 ${isGroupCollapsed ? "-rotate-90" : ""}`}
                                    />
                                </button>
                            )}

                            {/* Collapsed sidebar: show a thin divider between groups */}
                            {isCollapsed && (
                                <div className="mx-3 my-2 border-t border-border/30" />
                            )}

                            {(!isGroupCollapsed || isCollapsed) && (
                                <div className="space-y-0.5">
                                    {visibleItems.map((item) => (
                                        <NavLink
                                            key={item.href}
                                            item={item}
                                            active={isActive(item.href)}
                                            isCollapsed={isCollapsed}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* Collapse Toggle Button */}
            <div className="px-2 py-2 border-t border-border/30">
                <button
                    onClick={toggleCollapse}
                    className="flex items-center justify-center w-full gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
                >
                    {isCollapsed ? (
                        <PanelLeft size={18} />
                    ) : (
                        <>
                            <PanelLeftClose size={16} />
                            <span>{t("nav.collapse")}</span>
                        </>
                    )}
                </button>
            </div>
        </TooltipProvider>
    );
}

function NavLink({ item, active, isCollapsed }: { item: NavItem; active: boolean; isCollapsed: boolean }) {
    const Icon = item.icon;
    const { t } = useLanguage();
    const label = t(item.labelKey);

    const linkContent = (
        <Link
            href={item.href}
            target={item.external ? "_blank" : undefined}
            className={`
                flex items-center rounded-xl text-sm font-medium
                transition-all duration-200 group relative
                ${isCollapsed ? "justify-center px-2 py-2.5 mx-1" : "gap-3 px-3 py-2"}
                ${active
                    ? "text-primary dark:text-emerald-300 bg-primary/10 dark:bg-primary/15 font-semibold shadow-2xs"
                    : "text-muted-foreground hover:bg-muted/60 dark:hover:bg-muted/40 hover:text-foreground"
                }
            `}
        >
            {active && !isCollapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-5 bg-primary rounded-r-full shadow-[0_0_8px_1px_rgba(16,185,129,0.7)]" />
            )}
            <Icon
                size={isCollapsed ? 20 : 17}
                className={`flex-shrink-0 transition-colors duration-200 ${active ? "text-primary dark:text-emerald-400" : "text-muted-foreground/70 group-hover:text-foreground"}`}
            />
            {!isCollapsed && <span className="truncate">{label}</span>}
        </Link>
    );

    if (isCollapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                    <p className="text-xs font-medium">{label}</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    return linkContent;
}
