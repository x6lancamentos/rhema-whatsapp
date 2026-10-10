"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Plus,
    Wifi,
    WifiOff,
    MessageSquare,
    Bot,
    Send,
    QrCode,
    ArrowRight,
    Zap,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";

interface SessionItem {
    id: string;
    sessionId: string;
    name: string;
    status: string;
}

interface DashboardClientViewProps {
    totalSessions: number;
    connectedSessions: number;
    disconnectedSessions: number;
    autoReplyCount: number;
    sessions: SessionItem[];
}

export function DashboardClientView({
    totalSessions,
    connectedSessions,
    disconnectedSessions,
    autoReplyCount,
    sessions,
}: DashboardClientViewProps) {
    const { t } = useLanguage();

    const stats = [
        {
            title: t("dashboard.total_sessions"),
            value: totalSessions,
            icon: QrCode,
            description: t("dashboard.total_sessions_desc"),
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-500/10 border-blue-500/25",
            gradient: "from-blue-500/5 to-transparent",
        },
        {
            title: t("dashboard.connected"),
            value: connectedSessions,
            icon: Wifi,
            description: t("dashboard.connected_desc"),
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/25",
            gradient: "from-emerald-500/5 to-transparent",
        },
        {
            title: t("dashboard.disconnected"),
            value: disconnectedSessions,
            icon: WifiOff,
            description: t("dashboard.disconnected_desc"),
            color: "text-rose-600 dark:text-rose-400",
            bg: "bg-rose-500/10 border-rose-500/25",
            gradient: "from-rose-500/5 to-transparent",
        },
        {
            title: t("dashboard.autoreply"),
            value: autoReplyCount,
            icon: Zap,
            description: t("dashboard.autoreply_desc"),
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-500/10 border-amber-500/25",
            gradient: "from-amber-500/5 to-transparent",
        },
    ];

    const quickActions = [
        { href: "/dashboard/sessions", label: t("dashboard.new_session"), icon: Plus, description: t("dashboard.connect_device") },
        { href: "/dashboard/chat", label: t("nav.chat"), icon: Send, description: t("nav.group.messaging") },
        { href: "/dashboard/broadcast", label: t("nav.broadcast"), icon: MessageSquare, description: t("dashboard.quick_actions") },
        { href: "/dashboard/imoview", label: t("nav.imoview"), icon: Bot, description: "CRM" },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">{t("dashboard.title")}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
                </div>
                <Link href="/dashboard/sessions">
                    <Button size="sm" className="gap-2 shadow-sm hover:shadow-primary/20">
                        <Plus className="h-4 w-4" /> {t("dashboard.new_session")}
                    </Button>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.title} className="glass-panel card-sheen hover-lift border-border/60 shadow-xs relative overflow-hidden group">
                            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-50 pointer-events-none`} />
                            <CardContent className="p-4 sm:p-5 relative z-10">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{stat.title}</p>
                                        <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{stat.value}</p>
                                        <p className="text-xs text-muted-foreground/80">{stat.description}</p>
                                    </div>
                                    <div className={`${stat.bg} p-2.5 rounded-xl border shadow-xs transition-transform duration-300 group-hover:scale-105`}>
                                        <Icon className={`h-5 w-5 ${stat.color}`} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">{t("dashboard.quick_actions")}</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <Link key={action.href} href={action.href}>
                                <Card className="glass-panel card-sheen hover-lift border-border/60 shadow-xs group cursor-pointer h-full">
                                    <CardContent className="p-4 flex items-center gap-3">
                                        <div className="bg-muted/60 dark:bg-card/90 p-2.5 rounded-xl border border-border/60 group-hover:bg-primary group-hover:border-primary/50 transition-colors shadow-2xs">
                                            <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary-foreground transition-colors" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{action.label}</p>
                                            <p className="text-xs text-muted-foreground/80 truncate">{action.description}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Sessions List */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("dashboard.recent_sessions")}</h3>
                    <Link href="/dashboard/sessions" className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
                        {t("dashboard.view_all")} <ArrowRight size={14} />
                    </Link>
                </div>

                {sessions.length === 0 ? (
                    <Card className="border-dashed border-2 border-border/80 shadow-none bg-muted/20 dark:bg-card/40">
                        <CardContent className="py-12 text-center">
                            <div className="bg-muted dark:bg-card h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-border/60">
                                <QrCode className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-semibold text-foreground mb-1">{t("dashboard.no_sessions")}</p>
                            <p className="text-xs text-muted-foreground mb-4">{t("dashboard.no_sessions_desc")}</p>
                            <Link href="/dashboard/sessions">
                                <Button size="sm" variant="outline" className="gap-2">
                                    <Plus className="h-4 w-4" /> {t("dashboard.connect_device")}
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {sessions.map(s => {
                            const isConnected = s.status === 'CONNECTED';
                            const isDisconnected = !isConnected;

                            return (
                                <Link key={s.id} href={`/dashboard/sessions/${s.sessionId}`}>
                                    <Card className="glass-panel card-sheen hover-lift border-border/60 shadow-xs cursor-pointer h-full group">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{s.name}</p>
                                                    <p className="text-xs text-muted-foreground font-mono truncate mt-1">{s.sessionId}</p>
                                                </div>
                                                <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 transition-colors
                                                    ${isConnected 
                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' 
                                                        : isDisconnected 
                                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25' 
                                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'}
                                                `}>
                                                    <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : isDisconnected ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                                    {s.status}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
