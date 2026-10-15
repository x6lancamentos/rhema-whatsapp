"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Bot,
  Settings,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building,
  Key,
  MessageSquare,
  Copy,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  ListFilter,
  Check,
  RefreshCw,
  PhoneCall,
} from "lucide-react";

interface Notice {
  id: string;
  codigoImovel: string;
  proprietarioNome: string | null;
  proprietarioTelefone: string;
  valorAnterior: string | null;
  novoValor: string | null;
  condominioAnterior: string | null;
  novoCondominio: string | null;
  statusImovel: string;
  observacoes: string | null;
  enviadoRecepcao: boolean;
  statusProcessamento: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  latencyMs?: number;
  extracted?: any;
  rollingSummary?: string;
  receptionMessageText?: string;
}

export default function AiAgentPage() {
  const [activeTab, setActiveTab] = useState<"simulator" | "settings" | "notices">("simulator");

  // Config State
  const [config, setConfig] = useState<any>({
    enabled: false,
    apiKey: "",
    model: "nvidia/nemotron-3.5-lightning:free",
    fallbackModel: "nvidia/nemotron-3-super-120b-a12b:free",
    receptionPhone: "",
    temperature: 0.3,
    systemPrompt: "",
    notifyReceptionOnUpdate: true,
    autoRecordImoviewHistory: true,
    simulateTypingDelay: true,
    minTypingSeconds: 3,
    maxTypingSeconds: 6,
  });

  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    ok: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  // Simulator State
  const [testContactName, setTestContactName] = useState("Dr. Rogério Mendonça");
  const [testPhone, setTestPhone] = useState("13997123456");
  const [testCodigoImovel, setTestCodigoImovel] = useState("5942");
  const [inputMessage, setInputMessage] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentRollingSummary, setCurrentRollingSummary] = useState<string>("");
  const [latestExtracted, setLatestExtracted] = useState<any>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Notices State
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(false);
  const [filterStatus, setFilterStatus] = useState("ALL");

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Carregar Configurações Iniciais
  useEffect(() => {
    fetchConfig();
    fetchNotices();
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isSimulating]);

  async function fetchConfig() {
    try {
      const res = await fetch("/api/ai-agent/config");
      const data = await res.json();
      if (data.success && data.config) {
        setConfig((prev: any) => ({ ...prev, ...data.config }));
      }
    } catch (e) {
      console.error("Erro ao carregar config:", e);
    }
  }

  async function fetchNotices() {
    setLoadingNotices(true);
    try {
      const res = await fetch(`/api/ai-agent/notices?status=${filterStatus}`);
      const data = await res.json();
      if (data.success) {
        setNotices(data.notices || []);
      }
    } catch (e) {
      console.error("Erro ao carregar avisos:", e);
    } finally {
      setLoadingNotices(false);
    }
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/ai-agent/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        alert("Configurações do Agente de IA salvas com sucesso!");
      } else {
        alert("Erro ao salvar: " + data.error);
      }
    } catch (e: any) {
      alert("Erro ao conectar ao servidor: " + e.message);
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await fetch("/api/ai-agent/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: config.apiKey,
          model: config.model,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConnectionStatus({
          ok: true,
          message: `Conexão bem sucedida com ${data.modelUsed}!`,
          latencyMs: data.latencyMs,
        });
      } else {
        setConnectionStatus({
          ok: false,
          message: data.error || "Falha na conexão com OpenRouter.",
        });
      }
    } catch (e: any) {
      setConnectionStatus({
        ok: false,
        message: "Erro de rede: " + e.message,
      });
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSendMessage(overrideText?: string) {
    const textToSend = overrideText || inputMessage;
    if (!textToSend.trim() || isSimulating) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    const historyPayload = chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setIsSimulating(true);

    try {
      const res = await fetch("/api/ai-agent/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageText: textToSend.trim(),
          contactName: testContactName,
          phone: testPhone,
          codigoImovel: testCodigoImovel,
          history: historyPayload,
          rollingSummary: currentRollingSummary,
          collectedData: latestExtracted?.collectedData || latestExtracted,
        }),
      });

      const data = await res.json();

      if (data.success && data.data) {
        const out = data.data;
        const agentMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: out.replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          latencyMs: out.latencyMs,
          extracted: {
            isPropertyUpdate: out.isPropertyUpdate,
            propertyStatus: out.propertyStatus,
            newValue: out.newValue,
            newCondo: out.newCondo,
            visitingHours: out.visitingHours,
            referral: out.referral,
            notes: out.notes,
            needsReceptionAlert: out.needsReceptionAlert,
          },
          rollingSummary: out.rollingSummary,
          receptionMessageText: out.receptionMessageText,
        };

        setChatMessages((prev) => [...prev, agentMsg]);
        setCurrentRollingSummary(out.rollingSummary);
        setLatestExtracted(out.collectedData || out);
      } else {
        const errMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "❌ Ocorreu um erro ao processar: " + (data.error || "Erro desconhecido"),
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setChatMessages((prev) => [...prev, errMsg]);
      }
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "❌ Falha de comunicação com o servidor: " + e.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setChatMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSimulating(false);
    }
  }

  function handleQuickPrompt(text: string) {
    setInputMessage(text);
    handleSendMessage(text);
  }

  function handleResetChat() {
    setChatMessages([]);
    setCurrentRollingSummary("");
    setLatestExtracted(null);
  }

  async function handleMarkNoticeResolved(id: string) {
    try {
      const res = await fetch("/api/ai-agent/notices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          statusProcessamento: "CONCLUIDO_IMOVIEW",
          resolvidoPor: "Recepção / Painel",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotices((prev) =>
          prev.map((n) => (n.id === id ? { ...n, statusProcessamento: "CONCLUIDO_IMOVIEW" } : n))
        );
      }
    } catch (e) {
      alert("Erro ao marcar como concluído.");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl text-white shadow-md shadow-indigo-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                Camila AI
                <span className="text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                  OpenRouter & NVIDIA
                </span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Especialista autônoma em relacionamento com proprietários, qualificação ativa SPIN Selling e atualização cadastral.
              </p>
            </div>
          </div>
        </div>

        {/* Global Toggle Badge */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold ${
              config.enabled
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                config.enabled ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            {config.enabled ? "Agente Ativo no WhatsApp" : "Agente em Modo Sandbox / Pausado"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 space-x-2">
        <button
          onClick={() => setActiveTab("simulator")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            activeTab === "simulator"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Simulador Interativo (Playground)
        </button>

        <button
          onClick={() => setActiveTab("notices")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all relative ${
            activeTab === "notices"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building className="w-4 h-4" />
          Fila de Atualizações (Recepção)
          {notices.filter((n) => n.statusProcessamento === "PENDENTE").length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-rose-500 text-white rounded-full font-bold">
              {notices.filter((n) => n.statusProcessamento === "PENDENTE").length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            activeTab === "settings"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="w-4 h-4" />
          Configurações & OpenRouter
        </button>
      </div>

      {/* TAB 1: SIMULADOR INTERATIVO */}
      {activeTab === "simulator" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna Esquerda: Chat interativo */}
          <div className="lg:col-span-7 flex flex-col bg-white dark:bg-zinc-900 border rounded-2xl shadow-sm overflow-hidden h-[700px]">
            {/* Topo do Chat: Controles do Contato Simulado */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-b flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-muted-foreground">Contato:</span>
                <input
                  type="text"
                  value={testContactName}
                  onChange={(e) => setTestContactName(e.target.value)}
                  className="px-2 py-1 rounded bg-white dark:bg-zinc-900 border text-xs font-medium w-36"
                  placeholder="Nome do Proprietário"
                />
                <input
                  type="text"
                  value={testCodigoImovel}
                  onChange={(e) => setTestCodigoImovel(e.target.value)}
                  className="px-2 py-1 rounded bg-white dark:bg-zinc-900 border text-xs font-medium w-24 text-indigo-600 dark:text-indigo-400"
                  placeholder="Cód. Imóvel"
                />
              </div>

              <button
                onClick={handleResetChat}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground bg-white dark:bg-zinc-900 border rounded hover:bg-zinc-100 transition"
                title="Limpar histórico da simulação"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reiniciar Teste
              </button>
            </div>

            {/* Sugestões de Teste Rápido */}
            <div className="px-4 py-2 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center gap-2 overflow-x-auto text-xs whitespace-nowrap">
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3" /> Testes rápidos:
              </span>
              <button
                onClick={() =>
                  handleQuickPrompt(
                    "Oi Camila! O apto tá à venda sim, mas quero baixar pra 490 mil pra vender rápido. O condomínio agora foi pra 650."
                  )
                }
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 border rounded-full hover:border-indigo-500 text-xs transition"
              >
                💰 Preço (490k / Cond 650)
              </button>
              <button
                onClick={() =>
                  handleQuickPrompt(
                    "Sobre as visitas, fica melhor aos sábados das 10h às 15h ou dias de semana após as 18h, apenas avisando 24h antes."
                  )
                }
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 border rounded-full hover:border-indigo-500 text-xs transition"
              >
                🕒 Horários de Visitas
              </button>
              <button
                onClick={() =>
                  handleQuickPrompt(
                    "Ah Camila, inclusive meu vizinho do apto 42 comentou que quer vender o dele de 3 dormitórios também, o nome dele é Seu Mário."
                  )
                }
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 border rounded-full hover:border-indigo-500 text-xs transition"
              >
                🤝 Indicação de Novo Imóvel
              </button>
              <button
                onClick={() =>
                  handleQuickPrompt("Olá, já vendi esse imóvel mês passado através de outra imobiliária. Pode tirar do site.")
                }
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 border rounded-full hover:border-indigo-500 text-xs transition"
              >
                ❌ Já Vendeu por Outra
              </button>
              <button
                onClick={() =>
                  handleQuickPrompt("Não tenho mais interesse em vender agora, resolvi alugar para um familiar.")
                }
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 border rounded-full hover:border-indigo-500 text-xs transition"
              >
                ⏸️ Desistiu / Alugou
              </button>
            </div>

            {/* Área de Mensagens */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-zinc-50/30 dark:bg-zinc-950/20">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Simulador da Camila AI</h3>
                  <p className="text-xs max-w-sm">
                    Envie uma mensagem simulando ser o proprietário do imóvel Cód. {testCodigoImovel}. Veja como a Camila
                    conduz a conversa com SPIN Selling e extrai os dados!
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="text-[10px] text-muted-foreground mb-1 px-1 flex items-center gap-1.5">
                      {msg.role === "user" ? (
                        <span>{testContactName} (Proprietário)</span>
                      ) : (
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                          <Bot className="w-3 h-3" /> Camila (Rhema IA)
                          {msg.latencyMs && (
                            <span className="text-[9px] bg-indigo-500/10 px-1.5 py-0.2 rounded text-indigo-500">
                              {msg.latencyMs}ms
                            </span>
                          )}
                        </span>
                      )}
                      <span>• {msg.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-tr-none"
                          : "bg-white dark:bg-zinc-800 text-foreground border rounded-tl-none border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}

              {isSimulating && (
                <div className="flex flex-col items-start">
                  <div className="text-[10px] text-indigo-500 font-semibold mb-1 px-1 flex items-center gap-1">
                    <Bot className="w-3 h-3" /> Camila (Digitando...)
                  </div>
                  <div className="bg-white dark:bg-zinc-800 border rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input de Mensagem */}
            <div className="p-3 bg-white dark:bg-zinc-900 border-t flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={isSimulating}
                placeholder="Digite a resposta do proprietário aqui..."
                className="flex-1 px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isSimulating || !inputMessage.trim()}
                className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Coluna Direita: Inspetor de IA e Visualizador do Alerta da Recepção */}
          <div className="lg:col-span-5 space-y-5">
            {/* Card 1: Resumo Contínuo de Contexto (Rolling Summary) */}
            <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <RefreshCw className="w-4 h-4" />
                  Memória Cumulativa (Rolling Summary)
                </h3>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full font-semibold">
                  Sem limite de perda
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Este resumo é preservado e enriquecido a cada interação com o proprietário:
              </p>
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border text-xs text-foreground font-mono leading-relaxed min-h-[90px] whitespace-pre-wrap">
                {currentRollingSummary || "Nenhum contexto acumulado ainda. Envie uma mensagem no simulador."}
              </div>
            </div>

            {/* Card 2: Dados Estruturados Extraídos */}
            <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Dados Extraídos pela IA (JSON)
              </h3>
              {latestExtracted ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    <span className="text-muted-foreground block text-[10px]">Status do Imóvel:</span>
                    <span className="font-bold text-foreground">{latestExtracted.propertyStatus || "N/A"}</span>
                  </div>
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    <span className="text-muted-foreground block text-[10px]">Novo Valor:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {latestExtracted.newValue || "Não alterado"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    <span className="text-muted-foreground block text-[10px]">Novo Condomínio:</span>
                    <span className="font-bold text-foreground">{latestExtracted.newCondo || "Não alterado"}</span>
                  </div>
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    <span className="text-muted-foreground block text-[10px]">Alerta para Recepção:</span>
                    <span
                      className={`font-bold ${
                        latestExtracted.needsReceptionAlert ? "text-amber-500" : "text-muted-foreground"
                      }`}
                    >
                      {latestExtracted.needsReceptionAlert ? "SIM (Necessário)" : "Não"}
                    </span>
                  </div>
                  {latestExtracted.visitingHours && (
                    <div className="col-span-2 p-2.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-lg">
                      <span className="text-blue-600 dark:text-blue-400 block text-[10px] font-semibold">
                        🕒 Preferência de Visitas:
                      </span>
                      <span className="font-medium text-foreground">{latestExtracted.visitingHours}</span>
                    </div>
                  )}
                  {latestExtracted.referral && (
                    <div className="col-span-2 p-2.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg">
                      <span className="text-amber-600 dark:text-amber-400 block text-[10px] font-semibold">
                        🤝 Indicação de Novo Imóvel:
                      </span>
                      <span className="font-medium text-foreground">{latestExtracted.referral}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Envie uma mensagem para ver os dados decodificados.</p>
              )}
            </div>

            {/* Card 3: Prévia da Mensagem para a Recepção Rhema */}
            <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <PhoneCall className="w-4 h-4" />
                  WhatsApp para Recepção Rhema
                </h3>
                {latestExtracted?.receptionMessageText && (
                  <button
                    onClick={() => copyToClipboard(latestExtracted.receptionMessageText)}
                    className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {copiedNotice ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedNotice ? "Copiado!" : "Copiar"}
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Mensagem disparada automaticamente para o WhatsApp da recepção para atualização manual no Imoview:
              </p>

              <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 text-xs text-foreground font-mono leading-relaxed whitespace-pre-wrap min-h-[140px]">
                {latestExtracted?.receptionMessageText ||
                  "Aguardando alteração de dados para gerar mensagem formatada da recepção."}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FILA DE ATUALIZAÇÕES DA RECEPÇÃO */}
      {activeTab === "notices" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-zinc-900 p-4 border rounded-2xl">
            <div>
              <h2 className="text-base font-bold">Fila de Imóveis Atualizados pelos Proprietários</h2>
              <p className="text-xs text-muted-foreground">
                Imóveis cujos proprietários confirmaram alteração de valor, condomínio ou venda através do agente.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  fetchNotices();
                }}
                className="px-3 py-1.5 rounded-lg border bg-zinc-50 dark:bg-zinc-800 text-xs font-medium"
              >
                <option value="ALL">Todos os Avisos</option>
                <option value="PENDENTE">Apenas Pendentes</option>
                <option value="CONCLUIDO_IMOVIEW">Concluídos no Imoview</option>
              </select>

              <button
                onClick={fetchNotices}
                disabled={loadingNotices}
                className="p-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 transition"
              >
                <RefreshCw className={`w-4 h-4 ${loadingNotices ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {notices.length === 0 ? (
            <div className="p-12 text-center border rounded-2xl bg-white dark:bg-zinc-900 text-muted-foreground">
              <Building className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="font-semibold text-sm">Nenhum aviso de atualização registrado.</p>
              <p className="text-xs">Quando proprietários responderem ao agente, os avisos aparecerão aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    notice.statusProcessamento === "PENDENTE"
                      ? "bg-white dark:bg-zinc-900 border-amber-300 dark:border-amber-800/60 shadow-sm"
                      : "bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground">
                          Cód. {notice.codigoImovel}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            notice.statusProcessamento === "PENDENTE"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {notice.statusProcessamento === "PENDENTE" ? "PENDENTE NO IMOVIEW" : "ATUALIZADO"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {notice.proprietarioNome || "Proprietário"} • {notice.proprietarioTelefone}
                      </span>
                    </div>

                    <span className="text-[10px] text-muted-foreground">
                      {new Date(notice.createdAt).toLocaleDateString()} às{" "}
                      {new Date(notice.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="space-y-1.5 my-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status Detectado:</span>
                      <span className="font-semibold text-foreground">{notice.statusImovel}</span>
                    </div>
                    {notice.novoValor && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Novo Valor:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{notice.novoValor}</span>
                      </div>
                    )}
                    {notice.novoCondominio && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Novo Condomínio:</span>
                        <span className="font-semibold text-foreground">{notice.novoCondominio}</span>
                      </div>
                    )}
                    {notice.observacoes && (
                      <p className="pt-2 text-muted-foreground border-t mt-2 text-[11px] italic">
                        "{notice.observacoes}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      {notice.enviadoRecepcao ? (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Enviado à Recepção no WhatsApp
                        </span>
                      ) : (
                        <span>Não enviado por WA</span>
                      )}
                    </span>

                    {notice.statusProcessamento === "PENDENTE" ? (
                      <button
                        onClick={() => handleMarkNoticeResolved(notice.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Concluído no Imoview
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Finalizado
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONFIGURAÇÕES DO AGENTE */}
      {activeTab === "settings" && (
        <div className="max-w-4xl space-y-6">
          {/* Card Principal: Liga/Desliga */}
          <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Interruptor do Agente Autônomo</h3>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, o agente responderá autonomamente às respostas recebidas no WhatsApp.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-zinc-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Configurações do OpenRouter */}
          <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-500" />
              Credenciais & Modelos OpenRouter
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-muted-foreground">
                  Chave de API do OpenRouter:
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm font-mono"
                    placeholder="sk-or-v1-..."
                  />
                  <button
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold hover:bg-indigo-100 transition flex items-center gap-1.5"
                  >
                    {testingConnection ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    Testar Conexão
                  </button>
                </div>
              </div>

              {connectionStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    connectionStatus.ok
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {connectionStatus.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {connectionStatus.message}
                  </span>
                  {connectionStatus.latencyMs && (
                    <span className="font-mono font-bold">{connectionStatus.latencyMs}ms</span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-muted-foreground">
                    Modelo Principal (NVIDIA Gratuito):
                  </label>
                  <select
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-xs font-medium"
                  >
                    <option value="nvidia/nemotron-3.5-lightning:free">
                      NVIDIA Nemotron 3.5 Lightning (Gratuito / 1M Contexto)
                    </option>
                    <option value="nvidia/nemotron-3-super-120b-a12b:free">
                      NVIDIA Nemotron 3 Super 120B (Gratuito / 256k Contexto)
                    </option>
                    <option value="nvidia/nemotron-3-ultra-550b-a55b:free">
                      NVIDIA Nemotron 3 Ultra 550B (Gratuito)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-muted-foreground">
                    Modelo de Fallback Automático:
                  </label>
                  <select
                    value={config.fallbackModel}
                    onChange={(e) => setConfig({ ...config, fallbackModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-xs font-medium"
                  >
                    <option value="nvidia/nemotron-3-super-120b-a12b:free">
                      NVIDIA Nemotron 3 Super 120B (Gratuito)
                    </option>
                    <option value="nvidia/nemotron-3.5-lightning:free">
                      NVIDIA Nemotron 3.5 Lightning (Gratuito)
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Configurações da Recepção Rhema */}
          <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="text-base font-bold flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-purple-500" />
              Notificação para a Recepção (WhatsApp)
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-muted-foreground">
                  Número de WhatsApp da Recepção Rhema:
                </label>
                <input
                  type="text"
                  value={config.receptionPhone || ""}
                  onChange={(e) => setConfig({ ...config, receptionPhone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm font-mono"
                  placeholder="Ex: 5513997123456"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  O agente enviará a ficha formatada para este número assim que o proprietário responder com
                  alteração de valor ou status.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.notifyReceptionOnUpdate}
                    onChange={(e) => setConfig({ ...config, notifyReceptionOnUpdate: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Enviar mensagem automática de WhatsApp para a Recepção a cada atualização</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoRecordImoviewHistory}
                    onChange={(e) => setConfig({ ...config, autoRecordImoviewHistory: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Registrar ocorrência automática no histórico do Imoview</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.simulateTypingDelay}
                    onChange={(e) => setConfig({ ...config, simulateTypingDelay: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Simular digitação humana no WhatsApp (status 'composing' de 3 a 6 segundos)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
            >
              {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Salvar Configurações
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
