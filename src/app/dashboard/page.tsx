import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
    Plus,
    Wifi,
    WifiOff,
    MessageSquare,
    Bot,
    Send,
    Settings,
    QrCode,
    ArrowRight,
    Activity,
    Zap,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { getAccessibleSessions } from "@/lib/api-auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    const sessions = await getAccessibleSessions(session.user.id!, session.user.role || "OWNER");

    const totalSessions = sessions.length;
    const connectedSessions = sessions.filter(s => s.status === 'CONNECTED').length;
    const disconnectedSessions = totalSessions - connectedSessions; // Anything not connected is disconnected
    const otherSessions = 0;

    // Fetch auto-reply count for accessible sessions
    let autoReplyCount = 0;
    try {
        const sessionIds = sessions.map(s => s.sessionId);
        if (sessionIds.length > 0) {
            autoReplyCount = await prisma.autoReply.count({
                where: { sessionId: { in: sessionIds } }
            });
        }
    } catch {
        // If auto-reply table doesn't exist yet, just show 0
    }

    const stats = [
        {
            title: "Total de Sessões",
            value: totalSessions,
            icon: QrCode,
            description: "Linhas cadastradas",
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-500/10 border-blue-500/25",
            gradient: "from-blue-500/5 to-transparent",
        },
        {
            title: "Conectadas",
            value: connectedSessions,
            icon: Wifi,
            description: "Online e prontas para disparo",
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/25",
            gradient: "from-emerald-500/5 to-transparent",
        },
        {
            title: "Desconectadas",
            value: disconnectedSessions,
            icon: WifiOff,
            description: "Aguardando leitura de QR",
            color: "text-rose-600 dark:text-rose-400",
            bg: "bg-rose-500/10 border-rose-500/25",
            gradient: "from-rose-500/5 to-transparent",
        },
        {
            title: "Regras Auto-Reply",
            value: autoReplyCount,
            icon: Zap,
            description: "Respostas automáticas ativas",
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-500/10 border-amber-500/25",
            gradient: "from-amber-500/5 to-transparent",
        },
    ];

    const quickActions = [
        { href: "/dashboard/sessions", label: "Nova Sessão", icon: Plus, description: "Conectar dispositivo QR" },
        { href: "/dashboard/chat", label: "Atendimento Chat", icon: Send, description: "Painel de mensagens" },
        { href: "/dashboard/broadcast", label: "Disparador em Massa", icon: MessageSquare, description: "Campanhas com wizard" },
        { href: "/dashboard/imoview", label: "Imoview CRM", icon: Bot, description: "Proprietários e leads" },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Dashboard</h2>
                    <p className="text-sm text-muted-foreground mt-1">Visão geral e monitoramento das sessões WhatsApp</p>
                </div>
                <Link href="/dashboard/sessions">
                    <Button size="sm" className="gap-2 shadow-sm hover:shadow-primary/20">
                        <Plus className="h-4 w-4" /> Nova Sessão
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
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Ações Rápidas</h3>
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
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sessões Recentes</h3>
                    <Link href="/dashboard/sessions" className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
                        Ver todas <ArrowRight size={14} />
                    </Link>
                </div>

                {sessions.length === 0 ? (
                    <Card className="border-dashed border-2 border-border/80 shadow-none bg-muted/20 dark:bg-card/40">
                        <CardContent className="py-12 text-center">
                            <div className="bg-muted dark:bg-card h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-border/60">
                                <QrCode className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-semibold text-foreground mb-1">Nenhuma sessão conectada</p>
                            <p className="text-xs text-muted-foreground mb-4">Conecte o seu primeiro WhatsApp via QR Code para começar</p>
                            <Link href="/dashboard/sessions">
                                <Button size="sm" variant="outline" className="gap-2">
                                    <Plus className="h-4 w-4" /> Conectar Dispositivo
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
