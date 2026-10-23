"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sparkles,
    Send,
    Plus,
    Trash2,
    ExternalLink,
    PhoneCall,
    Copy,
    ListFilter,
    MousePointerClick,
    Zap,
    CheckCircle2,
    XCircle,
    Loader2,
    History,
    Phone,
    Layers,
    Info,
    ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/dashboard/session-provider";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { ButtonType, InteractiveButtonItem } from "@/components/chat/interactive-message-dialog";

interface TriggerLog {
    id: string;
    timestamp: string;
    target: string;
    type: string;
    status: "success" | "error";
    error?: string;
}

export default function InteractivePage() {
    return (
        <SessionGuard>
            <InteractiveContent />
        </SessionGuard>
    );
}

function InteractiveContent() {
    const { sessionId } = useSession();
    const [targetPhone, setTargetPhone] = useState("");
    const [activeTab, setActiveTab] = useState("presets");
    const [triggerLogs, setTriggerLogs] = useState<TriggerLog[]>([]);

    // 1-Click preset sending state
    const [sendingPreset, setSendingPreset] = useState<string | null>(null);

    // Custom composer state
    const [title, setTitle] = useState("Oportunidade Rhema Imóveis");
    const [body, setBody] = useState("Olá! Temos um imóvel exclusivo com o perfil exato do que você procura em Santos. Gostaria de receber mais fotos ou agendar uma visita?");
    const [footer, setFooter] = useState("Rhema Imóveis • Atendimento WhatsApp");
    const [buttons, setButtons] = useState<InteractiveButtonItem[]>([
        { id: "1", type: "quick_reply", displayText: "✅ Agendar Visita", value: "agendar_visita" },
        { id: "2", type: "cta_url", displayText: "🌐 Ver no Site", value: "https://rhemagestor.com.br" },
        { id: "3", type: "cta_call", displayText: "📞 Falar com Corretor", value: "+5513991488850" },
    ]);
    const [submittingCustom, setSubmittingCustom] = useState(false);

    // Clean phone number helper
    const getCleanJid = (phone: string) => {
        let clean = phone.replace(/\D/g, "");
        if (clean.length === 10 || clean.length === 11) {
            clean = "55" + clean;
        }
        return `${clean}@s.whatsapp.net`;
    };

    // 4 Preset templates
    const presets = [
        {
            id: "quick_reply",
            title: "Botões de Resposta Rápida",
            subtitle: "3 Botões com 1 toque instantâneo",
            description: "O destinatário pode tocar na resposta sem precisar digitar nada.",
            badge: "Mais Usado",
            payload: {
                title: "Confirmação de Atendimento",
                body: "Olá! Gostaria de confirmar seu agendamento de visita para amanhã com nossa equipe?",
                footer: "Toque em um dos botões abaixo",
                buttons: [
                    { type: "quick_reply", displayText: "✅ Confirmar Visita", id: "btn_confirmar" },
                    { type: "quick_reply", displayText: "📅 Remarcar Horário", id: "btn_remarcar" },
                    { type: "quick_reply", displayText: "❌ Cancelar", id: "btn_cancelar" }
                ]
            }
        },
        {
            id: "cta_actions",
            title: "Chamada para Ação (Links / Telefone / Cópia)",
            subtitle: "Link Web, Ligação Telefônica e Copiar Código",
            description: "Botões nativos que abrem o navegador, discador ou copiam código/chave PIX.",
            badge: "Multi-Ação",
            payload: {
                title: "Lançamento Exclusivo Rhema 🎉",
                body: "Confira a ficha completa, valores e condições especiais deste imóvel em nosso site:",
                footer: "Rhema Imóveis • Santos",
                buttons: [
                    { type: "cta_url", displayText: "🌐 Ver Imóvel no Site", url: "https://rhemagestor.com.br" },
                    { type: "cta_call", displayText: "📞 Ligar Agora", phoneNumber: "+5513991488850" },
                    { type: "cta_copy", displayText: "📋 Copiar Código Imóvel", copyCode: "RHEMA-2026" }
                ]
            }
        },
        {
            id: "single_select",
            title: "Menu de Lista Interativa (Catálogo)",
            subtitle: "Menu gaveta com seções e itens selecionáveis",
            description: "Abre uma gaveta nativa no WhatsApp com lista organizada de opções.",
            badge: "Catálogo",
            payload: {
                title: "Como podemos ajudar você hoje?",
                body: "Selecione no menu abaixo o tipo de imóvel ou atendimento que você procura:",
                footer: "Toque no botão para abrir as opções",
                buttons: [
                    {
                        type: "single_select",
                        title: "Menu de Atendimento",
                        buttonText: "📋 Abrir Opções",
                        sections: [
                            {
                                title: "Imóveis à Venda",
                                rows: [
                                    { id: "imv_apartamento", title: "Apartamentos", description: "Apartamentos de 1 a 4 dormitórios" },
                                    { id: "imv_casa", title: "Casas & Sobrados", description: "Imóveis isolados e em condomínio" },
                                    { id: "imv_cobertura", title: "Coberturas & Alto Padrão", description: "Vista para o mar e lazer privativo" }
                                ]
                            },
                            {
                                title: "Serviços & Suporte",
                                rows: [
                                    { id: "srv_proprietario", title: "Quero Cadastrar/Vender meu Imóvel", description: "Avaliação gratuita com nossos especialistas" },
                                    { id: "srv_corretor", title: "Falar com Corretor de Plantão", description: "Atendimento imediato pelo WhatsApp" }
                                ]
                            }
                        ]
                    }
                ]
            }
        },
        {
            id: "announcement",
            title: "Comunicado Oficial com Ação",
            subtitle: "Informativo estruturado com confirmação",
            description: "Perfeito para comunicados de diretoria, plantões ou alinhamentos.",
            badge: "Comunicado",
            payload: {
                title: "📢 COMUNICADO RHEMA IMÓVEIS",
                body: "Informamos a todos os parceiros e clientes a atualização em nossos horários de atendimento no plantão de vendas.",
                footer: "Diretoria Rhema Imóveis",
                buttons: [
                    { type: "quick_reply", displayText: "👍 Ciente / Confirmado", id: "ack_ok" },
                    { type: "cta_url", displayText: "📖 Ver Diretrizes", url: "https://rhemagestor.com.br" }
                ]
            }
        }
    ];

    const addLog = (log: Omit<TriggerLog, "id" | "timestamp">) => {
        const newLog: TriggerLog = {
            id: String(Date.now()),
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            ...log
        };
        setTriggerLogs((prev) => [newLog, ...prev.slice(0, 49)]);
    };

    // Handle sending a preset
    const handleSendPreset = async (preset: typeof presets[0]) => {
        if (!targetPhone.trim()) {
            toast.error("Por favor, digite o número do WhatsApp de destino.");
            return;
        }

        const jid = getCleanJid(targetPhone);
        setSendingPreset(preset.id);

        try {
            toast.info(`Enviando modelo "${preset.title}" para ${targetPhone}...`);
            const res = await fetch(`/api/messages/${sessionId}/${encodeURIComponent(jid)}/interactive`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(preset.payload)
            });

            const data = await res.json();
            if (!res.ok || !data.status) {
                throw new Error(data.message || data.error || "Falha ao enviar mensagem interativa");
            }

            toast.success(`Mensagem com botões enviada com sucesso para ${targetPhone}!`);
            addLog({ target: targetPhone, type: preset.title, status: "success" });
        } catch (error: any) {
            console.error("Test trigger error:", error);
            toast.error(error.message || "Erro no envio interativo");
            addLog({ target: targetPhone, type: preset.title, status: "error", error: error.message });
        } finally {
            setSendingPreset(null);
        }
    };

    const handleAddButton = () => {
        if (buttons.length >= 10) {
            toast.warning("Limite máximo de 10 botões atingido.");
            return;
        }
        const newId = String(Date.now());
        setButtons((prev) => [
            ...prev,
            { id: newId, type: "quick_reply", displayText: `Opção ${prev.length + 1}`, value: `action_${newId}` }
        ]);
    };

    const handleRemoveButton = (id: string) => {
        setButtons((prev) => prev.filter((b) => b.id !== id));
    };

    const handleUpdateButton = (id: string, field: keyof InteractiveButtonItem, value: any) => {
        setButtons((prev) =>
            prev.map((b) => {
                if (b.id !== id) return b;
                const updated = { ...b, [field]: value };
                if (field === "type") {
                    if (value === "cta_url" && !b.value.startsWith("http")) updated.value = "https://";
                    else if (value === "cta_call" && !b.value.startsWith("+")) updated.value = "+55";
                    else if (value === "cta_copy") updated.value = "CODIGO123";
                    else if (value === "single_select") updated.value = "Opção 1, Opção 2";
                }
                return updated;
            })
        );
    };

    // Handle custom interactive message send
    const handleSendCustom = async () => {
        if (!targetPhone.trim()) {
            toast.error("Por favor, digite o número do WhatsApp de destino.");
            return;
        }

        if (!body.trim() && !title.trim()) {
            toast.error("O texto da mensagem ou título é obrigatório.");
            return;
        }

        const jid = getCleanJid(targetPhone);
        setSubmittingCustom(true);

        try {
            const formattedButtons = buttons.map((b, idx) => {
                if (b.type === "cta_url") {
                    return { type: "cta_url", displayText: b.displayText || `Link ${idx + 1}`, url: b.value || "https://google.com" };
                } else if (b.type === "cta_call") {
                    return { type: "cta_call", displayText: b.displayText || `Ligar ${idx + 1}`, phoneNumber: b.value || "+5513991488850" };
                } else if (b.type === "cta_copy") {
                    return { type: "cta_copy", displayText: b.displayText || `Copiar`, copyCode: b.value || "CODE" };
                } else if (b.type === "single_select") {
                    const items = (b.value || "Opção 1, Opção 2").split(",").map((s) => s.trim()).filter(Boolean);
                    return {
                        type: "single_select",
                        title: b.displayText || "Opções",
                        buttonText: b.displayText || "Abrir Menu",
                        sections: [
                            {
                                title: "Selecione uma opção",
                                rows: items.map((it, i) => ({ id: `row_${i}`, title: it, description: "" }))
                            }
                        ]
                    };
                } else {
                    return {
                        type: "quick_reply",
                        displayText: b.displayText || `Botão ${idx + 1}`,
                        id: b.value || `btn_${idx + 1}`
                    };
                }
            });

            const res = await fetch(`/api/messages/${sessionId}/${encodeURIComponent(jid)}/interactive`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim() || undefined,
                    body: body.trim(),
                    footer: footer.trim() || undefined,
                    buttons: formattedButtons
                })
            });

            const data = await res.json();
            if (!res.ok || !data.status) {
                throw new Error(data.message || data.error || "Erro ao enviar mensagem personalizada");
            }

            toast.success(`Mensagem personalizada enviada com sucesso para ${targetPhone}!`);
            addLog({ target: targetPhone, type: "Personalizado", status: "success" });
        } catch (error: any) {
            console.error("Custom interactive send error:", error);
            toast.error(error.message || "Erro no envio");
            addLog({ target: targetPhone, type: "Personalizado", status: "error", error: error.message });
        } finally {
            setSubmittingCustom(false);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                Laboratório de Mensagens Interativas (Botões WhatsApp)
                            </h1>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Crie e teste botões nativos (Respostas Rápidas, Links URL, Chamada, Copiar Código e Menus de Lista) compatíveis com WhatsApp Web, Android e iOS.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Target Phone Input Bar */}
                <div className="flex items-center gap-2 bg-card border border-border/80 p-2 rounded-xl shadow-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
                    <Input
                        value={targetPhone}
                        onChange={(e) => setTargetPhone(e.target.value)}
                        placeholder="Telefone Destino (ex: 5513999998888)"
                        className="h-8 text-xs w-64 border-0 shadow-none focus-visible:ring-0 bg-transparent"
                    />
                </div>
            </div>

            {/* Main Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-3 max-w-md">
                    <TabsTrigger value="presets" className="text-xs flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-amber-500" /> Modelos (1-Clique)
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="text-xs flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-blue-500" /> Compositor Livre
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs flex items-center gap-2">
                        <History className="h-3.5 w-3.5 text-emerald-500" /> Histórico ({triggerLogs.length})
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: Presets */}
                <TabsContent value="presets" className="space-y-4 m-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {presets.map((preset) => (
                            <Card key={preset.id} className="flex flex-col justify-between hover:border-amber-500/40 hover:shadow-md transition-all">
                                <CardHeader className="p-5 pb-3">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <CardTitle className="text-sm font-semibold">{preset.title}</CardTitle>
                                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                            {preset.badge}
                                        </span>
                                    </div>
                                    <CardDescription className="text-xs">{preset.subtitle}</CardDescription>
                                </CardHeader>
                                <CardContent className="p-5 pt-0 space-y-3">
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {preset.description}
                                    </p>

                                    {/* Buttons preview tags */}
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {preset.payload.buttons.map((b: any, i: number) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-muted text-foreground/80 border border-border/40 font-mono"
                                            >
                                                {b.type === "quick_reply" && <MousePointerClick className="h-2.5 w-2.5 text-amber-500" />}
                                                {b.type === "cta_url" && <ExternalLink className="h-2.5 w-2.5 text-blue-500" />}
                                                {b.type === "cta_call" && <PhoneCall className="h-2.5 w-2.5 text-emerald-500" />}
                                                {b.type === "cta_copy" && <Copy className="h-2.5 w-2.5 text-purple-500" />}
                                                {b.type === "single_select" && <ListFilter className="h-2.5 w-2.5 text-pink-500" />}
                                                {b.displayText || b.buttonText || b.title}
                                            </span>
                                        ))}
                                    </div>

                                    <Button
                                        size="sm"
                                        disabled={sendingPreset === preset.id}
                                        onClick={() => handleSendPreset(preset)}
                                        className="w-full text-xs font-semibold gap-2 mt-2 bg-amber-600 hover:bg-amber-500 text-white"
                                    >
                                        {sendingPreset === preset.id ? (
                                            <>
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Enviando para {targetPhone || "destino"}...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-3.5 w-3.5" />
                                                Disparar Teste para {targetPhone || "Número Digitado"}
                                            </>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* TAB 2: Custom Composer */}
                <TabsContent value="custom" className="space-y-4 m-0">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Editor Column (7 cols) */}
                        <div className="lg:col-span-7 space-y-4">
                            <Card className="p-5 space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Título do Cabeçalho (Opcional)</Label>
                                    <Input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Ex: Oportunidade Rhema Imóveis"
                                        className="h-8 text-xs"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Corpo da Mensagem (Obrigatório)</Label>
                                    <Textarea
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        placeholder="Digite a mensagem que aparecerá acima dos botões..."
                                        rows={4}
                                        className="text-xs resize-none"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Rodapé / Assinatura (Opcional)</Label>
                                    <Input
                                        value={footer}
                                        onChange={(e) => setFooter(e.target.value)}
                                        placeholder="Ex: Rhema Imóveis • Santos"
                                        className="h-8 text-xs"
                                    />
                                </div>

                                {/* Buttons builder */}
                                <div className="pt-3 border-t space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                                            <MousePointerClick className="h-3.5 w-3.5 text-amber-500" />
                                            Botões Interativos ({buttons.length}/10)
                                        </Label>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={handleAddButton}
                                            className="h-7 text-xs gap-1"
                                        >
                                            <Plus className="h-3 w-3" /> Adicionar Botão
                                        </Button>
                                    </div>

                                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                                        {buttons.map((btn, idx) => (
                                            <div
                                                key={btn.id}
                                                className="p-2.5 rounded-lg border border-border/70 bg-muted/20 space-y-2 text-xs"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[10px] text-muted-foreground font-bold">
                                                        #{idx + 1}
                                                    </span>
                                                    <Select
                                                        value={btn.type}
                                                        onValueChange={(val: ButtonType) =>
                                                            handleUpdateButton(btn.id, "type", val)
                                                        }
                                                    >
                                                        <SelectTrigger className="h-7 text-[11px] w-36">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="quick_reply">Resposta Rápida</SelectItem>
                                                            <SelectItem value="cta_url">Link Web (URL)</SelectItem>
                                                            <SelectItem value="cta_call">Ligar (Telefone)</SelectItem>
                                                            <SelectItem value="cta_copy">Copiar Código</SelectItem>
                                                            <SelectItem value="single_select">Lista Seleção</SelectItem>
                                                        </SelectContent>
                                                    </Select>

                                                    <Input
                                                        value={btn.displayText}
                                                        onChange={(e) =>
                                                            handleUpdateButton(btn.id, "displayText", e.target.value)
                                                        }
                                                        placeholder="Texto do Botão"
                                                        className="h-7 text-[11px] flex-1"
                                                    />

                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveButton(btn.id)}
                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>

                                                <div className="pl-6">
                                                    {btn.type === "cta_url" && (
                                                        <Input
                                                            value={btn.value}
                                                            onChange={(e) =>
                                                                handleUpdateButton(btn.id, "value", e.target.value)
                                                            }
                                                            placeholder="https://exemplo.com.br"
                                                            className="h-7 text-[11px]"
                                                        />
                                                    )}
                                                    {btn.type === "cta_call" && (
                                                        <Input
                                                            value={btn.value}
                                                            onChange={(e) =>
                                                                handleUpdateButton(btn.id, "value", e.target.value)
                                                            }
                                                            placeholder="+5513991488850"
                                                            className="h-7 text-[11px]"
                                                        />
                                                    )}
                                                    {btn.type === "cta_copy" && (
                                                        <Input
                                                            value={btn.value}
                                                            onChange={(e) =>
                                                                handleUpdateButton(btn.id, "value", e.target.value)
                                                            }
                                                            placeholder="Texto para copiar (ex: CHAVE-PIX ou CODIGO)"
                                                            className="h-7 text-[11px]"
                                                        />
                                                    )}
                                                    {btn.type === "quick_reply" && (
                                                        <Input
                                                            value={btn.value}
                                                            onChange={(e) =>
                                                                handleUpdateButton(btn.id, "value", e.target.value)
                                                            }
                                                            placeholder="Identificador da Ação (ex: btn_confirmar)"
                                                            className="h-7 text-[11px]"
                                                        />
                                                    )}
                                                    {btn.type === "single_select" && (
                                                        <Input
                                                            value={btn.value}
                                                            onChange={(e) =>
                                                                handleUpdateButton(btn.id, "value", e.target.value)
                                                            }
                                                            placeholder="Itens da Lista (separados por vírgula: Opção 1, Opção 2)"
                                                            className="h-7 text-[11px]"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Preview Right Column (5 cols) */}
                        <div className="lg:col-span-5 flex flex-col">
                            <Card className="p-5 flex-1 flex flex-col">
                                <Label className="text-xs font-semibold mb-3 flex items-center gap-1.5 text-muted-foreground">
                                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                    Simulação de Renderização no WhatsApp
                                </Label>

                                {/* WhatsApp bubble mockup */}
                                <div className="flex-1 bg-[#efeae2] dark:bg-[#0b141a] p-4 rounded-xl border border-border/50 flex flex-col justify-center items-center shadow-inner relative overflow-hidden min-h-[320px]">
                                    <div className="w-full max-w-xs bg-white dark:bg-[#1f2c34] rounded-2xl shadow-md border border-border/20 overflow-hidden text-left">
                                        <div className="p-3.5 space-y-1.5">
                                            {title && (
                                                <h4 className="text-xs font-bold text-foreground leading-tight">
                                                    {title}
                                                </h4>
                                            )}
                                            <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                                {body || "Digite a mensagem..."}
                                            </p>
                                            {footer && (
                                                <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/20">
                                                    {footer}
                                                </p>
                                            )}
                                            <div className="text-[9px] text-muted-foreground text-right mt-1">
                                                12:00 ✓✓
                                            </div>
                                        </div>

                                        {/* Buttons attached at bottom */}
                                        {buttons.length > 0 && (
                                            <div className="border-t border-border/30 divide-y divide-border/30 bg-muted/10">
                                                {buttons.map((btn, idx) => (
                                                    <div
                                                        key={btn.id}
                                                        className="py-2.5 px-3 text-center text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                                                    >
                                                        {btn.type === "cta_url" && <ExternalLink className="h-3.5 w-3.5" />}
                                                        {btn.type === "cta_call" && <PhoneCall className="h-3.5 w-3.5" />}
                                                        {btn.type === "cta_copy" && <Copy className="h-3.5 w-3.5" />}
                                                        {btn.type === "single_select" && <ListFilter className="h-3.5 w-3.5" />}
                                                        {btn.type === "quick_reply" && <MousePointerClick className="h-3.5 w-3.5" />}
                                                        <span className="truncate">{btn.displayText || `Opção ${idx + 1}`}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <span className="text-[10px] text-muted-foreground mt-3">
                                        Compatível com WhatsApp Web, Android e iOS
                                    </span>
                                </div>

                                <Button
                                    onClick={handleSendCustom}
                                    disabled={submittingCustom}
                                    className="w-full mt-4 font-semibold text-xs gap-2 bg-amber-600 hover:bg-amber-500 text-white"
                                >
                                    {submittingCustom ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Enviando mensagem...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="h-4 w-4" />
                                            Enviar Mensagem com Botões
                                        </>
                                    )}
                                </Button>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* TAB 3: History */}
                <TabsContent value="history" className="m-0">
                    <Card className="p-5">
                        <CardTitle className="text-sm font-semibold mb-3">Histórico de Disparos de Teste (Sessão Atual)</CardTitle>
                        {triggerLogs.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-8">
                                Nenhum disparo de teste realizado ainda nesta sessão.
                            </p>
                        ) : (
                            <div className="divide-y text-xs">
                                {triggerLogs.map((log) => (
                                    <div key={log.id} className="py-2.5 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            {log.status === "success" ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                                            )}
                                            <div>
                                                <span className="font-semibold text-foreground">{log.type}</span>
                                                <span className="text-muted-foreground ml-2">→ {log.target}</span>
                                                {log.error && (
                                                    <p className="text-[11px] text-red-500 mt-0.5">{log.error}</p>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground font-mono">{log.timestamp}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
