"use client";

import React, { useState, useEffect } from "react";
import {
  Target,
  RefreshCw,
  Search,
  SlidersHorizontal,
  MapPin,
  MessageSquare,
  Building2,
  Flame,
  UserCheck,
  Sparkles,
  DollarSign,
  ExternalLink,
  Pause,
  Send,
  Trash2,
  Edit3,
  RotateCcw,
  AlertTriangle,
  Rocket,
  CheckCircle2,
  MessageCircle,
  XCircle,
  Plus,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BAIRROS_SANTOS_PRESET = [
  "Embaré",
  "Gonzaga",
  "Ponta da Praia",
  "Boqueirão",
  "Aparecida",
  "Pompéia",
  "José Menino",
  "Campo Grande",
  "Marapé",
  "Encruzilhada",
  "Vila Belmiro",
  "Macuco",
  "Vila Mathias",
];

const TIPOS_IMOVEL_PRESET = ["Apartamento", "Casa", "Cobertura", "Sobrado", "Sala Comercial", "Terreno"];

const TIPOS_OPORTUNIDADE_PRESET = [
  { id: "FSBO_NOVO", label: "FSBO Novo" },
  { id: "REDUCAO_PRECO", label: "Redução de Preço" },
  { id: "PARADO_LONGO_PRAZO", label: "Parado >120d" },
  { id: "REVERSE_DEMAND", label: "Reverse Hunter" },
];

const COLUNAS_HUNTER = [
  {
    id: "DISCOVERED",
    label: "Descobertos (eEmovel)",
    sub: "FSBOs e captações brutas",
    dotColor: "bg-amber-500",
    badgeColor: "border-amber-500/30 text-amber-500 bg-amber-500/10",
  },
  {
    id: "QUEUED",
    label: "Fila Anti-Spam",
    sub: "Jitter randômico 45s-180s",
    dotColor: "bg-blue-500",
    badgeColor: "border-blue-500/30 text-blue-500 bg-blue-500/10",
  },
  {
    id: "APPROACHING",
    label: "Em Abordagem",
    sub: "Cadência ativa iniciada",
    dotColor: "bg-yellow-500",
    badgeColor: "border-yellow-500/30 text-yellow-500 bg-yellow-500/10",
  },
  {
    id: "NEGOTIATING",
    label: "Interessados / Negociando",
    sub: "Proprietário respondeu",
    dotColor: "bg-orange-500",
    badgeColor: "border-orange-500/30 text-orange-500 bg-orange-500/10",
  },
  {
    id: "VISIT_ACCEPTED",
    label: "Aceite / Enviado ao Brunno",
    sub: "Dossiê enviado ao WhatsApp",
    dotColor: "bg-emerald-500",
    badgeColor: "border-emerald-500/30 text-emerald-500 bg-emerald-500/10",
  },
  {
    id: "CAPTURED_EXCLUSIVE",
    label: "Rhema Premium (90d)",
    sub: "Contrato assinado",
    dotColor: "bg-purple-500",
    badgeColor: "border-purple-500/30 text-purple-500 bg-purple-500/10",
  },
  {
    id: "REJECTED",
    label: "Descartados",
    sub: "Sem interesse ou teste",
    dotColor: "bg-rose-500",
    badgeColor: "border-rose-500/30 text-rose-500 bg-rose-500/10",
  },
];

export default function HunterPage() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    total: 0,
    descobertos: 0,
    emFila: 0,
    emAbordagem: 0,
    negociando: 0,
    visitaAceita: 0,
    captadosExclusivos: 0,
    captadosGerais: 0,
    descartados: 0,
    vgvMapeado: 0,
  });

  // Config do Hunter (Seletor de Bairros e Preço)
  const [bairrosSelecionados, setBairrosSelecionados] = useState<string[]>([
    "Embaré",
    "Gonzaga",
    "Ponta da Praia",
    "Boqueirão",
    "Aparecida",
  ]);
  const [valorMin, setValorMin] = useState(350000);
  const [valorMax, setValorMax] = useState(2500000);
  const [limiteDiario, setLimiteDiario] = useState(15);
  const [ativoHunter, setAtivoHunter] = useState(true);

  // Estados de Fila e Disparo
  const [filaAtiva, setFilaAtiva] = useState(false);
  const [iniciandoFila, setIniciandoFila] = useState(false);
  const [abordandoId, setAbordandoId] = useState<string | null>(null);

  // Estados de UI gerais
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [search, setSearch] = useState("");
  const [filterBairro, setFilterBairro] = useState("");

  // Modal de Exclusão de Fictícios
  const [showPurgeMockDialog, setShowPurgeMockDialog] = useState(false);
  const [purgingMock, setPurgingMock] = useState(false);

  // Modal de Edição de Oportunidade
  const [editingOpp, setEditingOpp] = useState<any | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Drawer / Sheet de Histórico de Conversa
  const [selectedChatOpp, setSelectedChatOpp] = useState<any | null>(null);
  const [chatLogs, setChatLogs] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [newManualMessage, setNewManualMessage] = useState("");
  const [sendingManualMessage, setSendingManualMessage] = useState(false);

  // Ação de Descarte Individual
  const [discardingId, setDiscardingId] = useState<string | null>(null);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [resOpp, resConfig, resQueue] = await Promise.all([
        fetch(
          `/api/hunter/opportunities?search=${encodeURIComponent(search)}&bairro=${encodeURIComponent(filterBairro)}`
        ),
        fetch("/api/hunter/config"),
        fetch("/api/hunter/prospect/queue").catch(() => null),
      ]);

      const dataOpp = await resOpp.json();
      if (dataOpp.success) {
        setOpportunities(dataOpp.opportunities || []);
        setStats(dataOpp.stats || {});
      }

      const dataConfig = await resConfig.json();
      if (dataConfig.success && dataConfig.config) {
        const c = dataConfig.config;
        if (Array.isArray(c.bairrosSantos)) setBairrosSelecionados(c.bairrosSantos);
        if (c.valorMin) setValorMin(c.valorMin);
        if (c.valorMax) setValorMax(c.valorMax);
        if (c.limiteDiario) setLimiteDiario(c.limiteDiario);
        if (c.ativo !== undefined) {
          setAtivoHunter(c.ativo);
          setFilaAtiva(c.ativo);
        }
      }

      if (resQueue) {
        const dataQueue = await resQueue.json();
        if (dataQueue.success) {
          setFilaAtiva(dataQueue.ativo);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar dados do Hunter:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [filterBairro]);

  const dispararSincronizacaoEemovel = async () => {
    try {
      setSyncing(true);
      const res = await fetch("/api/hunter/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bairros: bairrosSelecionados,
          valorMin,
          valorMax,
          limite: limiteDiario,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Sincronização concluída com sucesso!");
        await carregarDados();
      } else {
        toast.error(data.error || "Erro ao sincronizar com eEmovel.");
      }
    } catch (err) {
      console.error("Erro ao sincronizar eEmovel:", err);
      toast.error("Erro de conexão ao sincronizar com eEmovel.");
    } finally {
      setSyncing(false);
    }
  };

  const salvarConfiguracoes = async () => {
    try {
      setSavingConfig(true);
      await fetch("/api/hunter/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bairrosSantos: bairrosSelecionados,
          valorMin,
          valorMax,
          limiteDiario,
          ativo: ativoHunter,
        }),
      });
      setShowConfigPanel(false);
      toast.success("Parâmetros do eEmovel atualizados com sucesso!");
      await carregarDados();
    } catch (e) {
      console.error("Erro ao salvar config:", e);
      toast.error("Erro ao salvar parâmetros.");
    } finally {
      setSavingConfig(false);
    }
  };

  // 🚀 Disparo da Fila Anti-Spam
  const toggleFila = async () => {
    try {
      setIniciandoFila(true);
      const action = filaAtiva ? "pause" : "start";
      const res = await fetch("/api/hunter/prospect/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setFilaAtiva(!filaAtiva);
        toast.success(data.message);
        await carregarDados();
      } else {
        toast.error(data.error || "Erro ao alterar estado da fila.");
      }
    } catch {
      toast.error("Falha ao comunicar com o servidor.");
    } finally {
      setIniciandoFila(false);
    }
  };

  // ▶ Abordar 1 Proprietário Agora
  const abordarAgora = async (opportunityId: string, proprietarioNome: string) => {
    try {
      setAbordandoId(opportunityId);
      const res = await fetch("/api/hunter/prospect/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Abordagem disparada para ${proprietarioNome}!`);
        await carregarDados();
      } else {
        toast.error(data.error || "Erro ao disparar abordagem.");
      }
    } catch {
      toast.error("Falha ao disparar abordagem para o WhatsApp.");
    } finally {
      setAbordandoId(null);
    }
  };

  // 🗑️ Descartar Card Individual (Move para REJECTED)
  const descartarOportunidade = async (id: string) => {
    try {
      setDiscardingId(id);
      const res = await fetch("/api/hunter/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "REJECTED" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Oportunidade movida para a coluna Descartados.");
        await carregarDados();
        if (selectedChatOpp?.id === id) {
          setSelectedChatOpp({ ...selectedChatOpp, status: "REJECTED" });
        }
      } else {
        toast.error(data.error || "Erro ao descartar oportunidade.");
      }
    } catch {
      toast.error("Erro ao comunicar com o servidor.");
    } finally {
      setDiscardingId(null);
    }
  };

  // 🔄 Restaurar Oportunidade Descartada (Retorna para DISCOVERED)
  const restaurarOportunidade = async (id: string) => {
    try {
      setDiscardingId(id);
      const res = await fetch("/api/hunter/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "DISCOVERED" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Oportunidade restaurada para Descobertos.");
        await carregarDados();
      } else {
        toast.error(data.error || "Erro ao restaurar oportunidade.");
      }
    } catch {
      toast.error("Erro ao comunicar com o servidor.");
    } finally {
      setDiscardingId(null);
    }
  };

  // ❌ Excluir Oportunidade Permanentemente do Banco
  const excluirOportunidadePermanente = async (id: string) => {
    try {
      setDiscardingId(id);
      const res = await fetch(`/api/hunter/opportunities?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Oportunidade excluída definitivamente!");
        if (editingOpp?.id === id) setEditingOpp(null);
        if (selectedChatOpp?.id === id) setSelectedChatOpp(null);
        await carregarDados();
      } else {
        toast.error(data.error || "Erro ao excluir oportunidade.");
      }
    } catch {
      toast.error("Erro de conexão ao excluir.");
    } finally {
      setDiscardingId(null);
    }
  };

  // 🧹 Limpar Todos os Dados Fictícios de Teste (Lote)
  const limparDadosFicticios = async () => {
    try {
      setPurgingMock(true);
      const res = await fetch("/api/hunter/opportunities?action=purge_mock", {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Dados fictícios de teste removidos!");
        setShowPurgeMockDialog(false);
        await carregarDados();
      } else {
        toast.error(data.error || "Erro ao remover dados fictícios.");
      }
    } catch {
      toast.error("Erro ao comunicar com o servidor.");
    } finally {
      setPurgingMock(false);
    }
  };

  // 🧹 Esvaziar Coluna de Descartados
  const esvaziarDescartados = async () => {
    try {
      const res = await fetch("/api/hunter/opportunities?action=purge_rejected", {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Lixeira esvaziada!");
        await carregarDados();
      } else {
        toast.error(data.error || "Erro ao esvaziar descartados.");
      }
    } catch {
      toast.error("Erro de comunicação ao esvaziar descartados.");
    }
  };

  // 💾 Salvar Alterações da Oportunidade (Edição)
  const salvarEdicaoOportunidade = async () => {
    if (!editingOpp) return;
    try {
      setSavingEdit(true);
      const res = await fetch("/api/hunter/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingOpp),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Oportunidade atualizada com sucesso!");
        setEditingOpp(null);
        await carregarDados();
      } else {
        toast.error(data.error || "Erro ao atualizar oportunidade.");
      }
    } catch {
      toast.error("Erro ao salvar alterações da oportunidade.");
    } finally {
      setSavingEdit(false);
    }
  };

  // 💬 Abrir Histórico de Conversas com o Prospect
  const abrirConversaProspect = async (opp: any) => {
    setSelectedChatOpp(opp);
    setChatLogs([]);
    setLoadingChat(true);
    try {
      const res = await fetch(`/api/hunter/messages?opportunityId=${encodeURIComponent(opp.id)}`);
      const data = await res.json();
      if (data.success) {
        setChatLogs(data.logs || []);
        if (data.opportunity) {
          setSelectedChatOpp(data.opportunity);
        }
      } else {
        toast.error(data.error || "Erro ao carregar mensagens.");
      }
    } catch {
      toast.error("Erro de conexão ao buscar histórico de mensagens.");
    } finally {
      setLoadingChat(false);
    }
  };

  // ✉️ Enviar Mensagem Manual para o Prospect no WhatsApp
  const enviarMensagemManual = async () => {
    if (!selectedChatOpp || !newManualMessage.trim()) return;
    try {
      setSendingManualMessage(true);
      const res = await fetch("/api/hunter/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: selectedChatOpp.id,
          text: newManualMessage.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Mensagem enviada!");
        setChatLogs((prev) => [...prev, data.log]);
        setNewManualMessage("");
        await carregarDados();
      } else {
        toast.error(data.error || "Erro ao enviar mensagem.");
      }
    } catch {
      toast.error("Erro ao enviar mensagem via WhatsApp.");
    } finally {
      setSendingManualMessage(false);
    }
  };

  // Mudar Status Rápido no Drawer
  const alterarStatusRapido = async (novoStatus: string) => {
    if (!selectedChatOpp) return;
    try {
      const res = await fetch("/api/hunter/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedChatOpp.id, status: novoStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Status alterado com sucesso!`);
        setSelectedChatOpp({ ...selectedChatOpp, status: novoStatus });
        await carregarDados();
      }
    } catch {
      toast.error("Erro ao atualizar status.");
    }
  };

  const toggleBairro = (b: string) => {
    if (bairrosSelecionados.includes(b)) {
      setBairrosSelecionados(bairrosSelecionados.filter((x) => x !== b));
    } else {
      setBairrosSelecionados([...bairrosSelecionados, b]);
    }
  };

  const selecionarTodosOrla = () => {
    const orla = ["Embaré", "Gonzaga", "Ponta da Praia", "Boqueirão", "Aparecida", "Pompéia", "José Menino"];
    setBairrosSelecionados(Array.from(new Set([...bairrosSelecionados, ...orla])));
  };

  const filaCount = opportunities.filter((op) => op.status === "QUEUED").length;
  const descartadosCount = opportunities.filter((op) => op.status === "REJECTED").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                  Rhema Hunter
                </h1>
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[11px] px-2 py-0.5">
                  eEmovel Big Data
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
                Motor Autônomo de Captação Ativa, Reverse Hunting e Abordagem com Jitter Anti-Spam
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Botão de Limpeza de Fictícios de Teste */}
          <Button
            variant="outline"
            onClick={() => setShowPurgeMockDialog(true)}
            className="flex items-center gap-2 text-xs font-semibold h-9 border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/10 text-rose-500"
            title="Remover cards de teste gerados pela suíte mock"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
            Limpar Fictícios
          </Button>

          {/* Botão de Fila Anti-Spam */}
          <Button
            onClick={toggleFila}
            disabled={iniciandoFila}
            variant={filaAtiva ? "outline" : "default"}
            className={`flex items-center gap-2 text-xs font-bold h-9 transition ${
              filaAtiva
                ? "border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                : "bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 shadow-md shadow-amber-500/20"
            }`}
          >
            {iniciandoFila ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : filaAtiva ? (
              <Pause className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Rocket className="h-3.5 w-3.5" />
            )}
            {filaAtiva ? "⏸ Pausar Fila Anti-Spam" : "🚀 Iniciar Fila de Prospecção"}
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className="flex items-center gap-2 text-xs font-semibold h-9 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5 text-foreground"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-amber-500" />
            Seletor de Bairros & Preço
          </Button>

          <Button
            onClick={dispararSincronizacaoEemovel}
            disabled={syncing}
            className="flex items-center gap-2 text-xs font-bold h-9 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md shadow-amber-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar eEmovel"}
          </Button>
        </div>
      </div>

      {/* Banner de Fila Anti-Spam Ativa */}
      {filaAtiva && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <div>
              <p className="text-xs font-black text-foreground">
                Fila de Prospecção Ativa · Intervalo Anti-Spam com Jitter (45s a 180s)
              </p>
              <p className="text-[11px] text-muted-foreground">
                {filaCount > 0
                  ? `${filaCount} imóveis aguardando disparo com simulação de digitação humana.`
                  : "Aguardando novos leads na fila para disparo seguro."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleFila}
            className="h-8 text-xs font-bold border-amber-500/40 text-foreground hover:bg-amber-500/10 shrink-0 self-start sm:self-auto"
          >
            <Pause className="h-3 w-3 mr-1.5 text-amber-500" /> Pausar Fila
          </Button>
        </div>
      )}

      {/* Painel Expansível de Filtros (Bairros & Preço) */}
      {showConfigPanel && (
        <Card className="border-amber-500/30 bg-card/90 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-amber-500" /> Parâmetros de Varredura no eEmovel (Santos/SP)
              </h3>
              <button onClick={selecionarTodosOrla} className="text-xs font-semibold text-amber-500 hover:underline">
                + Selecionar Todos da Orla
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Seletor de Bairros */}
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-foreground mb-2 block">
                  Bairros Ativos para Garimpar ({bairrosSelecionados.length} selecionados):
                </label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2.5 bg-muted/30 rounded-xl border border-border/70">
                  {BAIRROS_SANTOS_PRESET.map((b) => {
                    const sel = bairrosSelecionados.includes(b);
                    return (
                      <button
                        key={b}
                        onClick={() => toggleBairro(b)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                          sel
                            ? "bg-amber-500/20 border-amber-500/60 text-amber-600 dark:text-amber-300 font-bold"
                            : "bg-background/80 border-border text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {sel && "✓ "}
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Faixa de Preço & Limite Diário */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">Faixa de Preço (R$):</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={valorMin}
                      onChange={(e) => setValorMin(Number(e.target.value))}
                      className="h-8 text-xs bg-background"
                      placeholder="Min"
                    />
                    <span className="text-xs text-muted-foreground font-medium">até</span>
                    <Input
                      type="number"
                      value={valorMax}
                      onChange={(e) => setValorMax(Number(e.target.value))}
                      className="h-8 text-xs bg-background"
                      placeholder="Max"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">Limite Diário (Novos Leads):</label>
                  <Input
                    type="number"
                    value={limiteDiario}
                    onChange={(e) => setLimiteDiario(Number(e.target.value))}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="mt-2 flex justify-end">
                  <Button
                    onClick={salvarConfiguracoes}
                    disabled={savingConfig}
                    className="h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition"
                  >
                    {savingConfig ? "Salvando..." : "Salvar Parâmetros"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
              <Building2 size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Mapeado</p>
              <p className="text-2xl font-black text-foreground">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <Flame size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Em Abordagem</p>
              <p className="text-2xl font-black text-foreground">{stats.emAbordagem + stats.negociando}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
              <UserCheck size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Aceites / Brunno</p>
              <p className="text-2xl font-black text-foreground">{stats.visitaAceita}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-purple-600 dark:text-purple-400">Rhema Premium (90d)</p>
              <p className="text-2xl font-black text-foreground">{stats.captadosExclusivos}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xs col-span-2 sm:col-span-1">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0">
              <DollarSign size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">VGV Potencial</p>
              <p className="text-xl font-black text-foreground">
                {(stats.vgvMapeado / 1000000).toFixed(1)}M{" "}
                <span className="text-xs font-normal text-muted-foreground">R$</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card/50 p-3 rounded-xl border border-border/60">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && carregarDados()}
            placeholder="Buscar por proprietário, telefone, edifício ou rua..."
            className="pl-9 h-9 text-xs bg-background/80"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterBairro}
            onChange={(e) => setFilterBairro(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">Todos os Bairros</option>
            {BAIRROS_SANTOS_PRESET.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            variant="outline"
            onClick={carregarDados}
            className="h-9 text-xs font-semibold shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Kanban Board Horizontal Scrollable (7 Colunas de 315px) */}
      <div className="flex gap-4 overflow-x-auto pb-6 styled-scrollbar min-w-0">
        {COLUNAS_HUNTER.map((col) => {
          const cardsDaColuna = opportunities.filter((op) => op.status === col.id);

          return (
            <div
              key={col.id}
              className="flex flex-col rounded-2xl border border-border/70 bg-card/50 backdrop-blur-xs p-3.5 w-[315px] min-w-[315px] shrink-0 h-[760px] shadow-xs"
            >
              {/* Header da Coluna */}
              <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-border/50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${col.dotColor}`} />
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-foreground truncate" title={col.label}>
                      {col.label}
                    </h3>
                    <p className="text-[10px] text-muted-foreground truncate">{col.sub}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {col.id === "REJECTED" && cardsDaColuna.length > 0 && (
                    <button
                      onClick={esvaziarDescartados}
                      className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition"
                      title="Esvaziar todos os descartados"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-black shrink-0 ${col.badgeColor}`}>
                    {cardsDaColuna.length}
                  </Badge>
                </div>
              </div>

              {/* Lista de Cards com Scroll Interno */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 styled-scrollbar">
                {cardsDaColuna.map((item) => {
                  const valorFmt = (item.valorPretendido || 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  });

                  const badgeColor =
                    item.tipoOportunidade === "REDUCAO_PRECO"
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      : item.tipoOportunidade === "REVERSE_DEMAND"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";

                  const badgeLabel =
                    item.tipoOportunidade === "REDUCAO_PRECO"
                      ? "Redução de Preço"
                      : item.tipoOportunidade === "REVERSE_DEMAND"
                      ? "Reverse Hunter"
                      : item.tipoOportunidade === "PARADO_LONGO_PRAZO"
                      ? "Parado >120d"
                      : "FSBO Novo";

                  // Verifica se houve resposta recente do proprietário
                  const hasInboundReply = (item.cadenceLogs || []).some(
                    (l: any) => l.direcao === "IN"
                  );
                  const totalLogs = (item.cadenceLogs || []).length;

                  return (
                    <div
                      key={item.id}
                      className="bg-background/90 border border-border/70 hover:border-amber-500/40 rounded-xl p-3 shadow-xs hover:shadow-md transition group relative"
                    >
                      {/* Top Badges & Actions */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeColor}`}
                          >
                            {badgeLabel}
                          </span>
                          {hasInboundReply && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Respondeu
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-black text-amber-500 dark:text-amber-400">{valorFmt}</span>
                      </div>

                      {/* Título & Detalhes */}
                      <h4
                        onClick={() => setEditingOpp(item)}
                        className="text-xs font-bold text-foreground line-clamp-2 mb-1 group-hover:text-amber-500 transition cursor-pointer"
                        title="Clique para editar este card"
                      >
                        {item.titulo || `${item.tipoImovel} no ${item.bairro}`}
                      </h4>

                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-2">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {item.bairro} · {item.quartos || "?"}d · {item.vagas || "?"}v · {item.areaM2 ? `${item.areaM2}m²` : ""}
                        </span>
                      </p>

                      {/* Informações do Proprietário e Ações Principais */}
                      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                        <div className="min-w-0 pr-1">
                          <p className="font-semibold text-foreground truncate">{item.proprietarioNome}</p>
                          <p className="text-[10px] text-muted-foreground">{item.proprietarioTelefone}</p>
                        </div>

                        {/* Botões de Ação do Card */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* 💬 Ver Conversa / Histórico (Abre Drawer Lateral) */}
                          <button
                            onClick={() => abrirConversaProspect(item)}
                            className={`p-1.5 rounded-lg transition relative ${
                              hasInboundReply
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30 font-bold"
                                : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                            }`}
                            title="Ver histórico de mensagens e responder"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {totalLogs > 0 && (
                              <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-amber-500 text-[8px] font-black text-slate-950 flex items-center justify-center">
                                {totalLogs}
                              </span>
                            )}
                          </button>

                          {/* ✏️ Editar Card */}
                          <button
                            onClick={() => setEditingOpp(item)}
                            className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition"
                            title="Editar detalhes do imóvel ou proprietário"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          {/* 🗑️ Descartar ou Restaurar */}
                          {item.status === "REJECTED" ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => restaurarOportunidade(item.id)}
                                disabled={discardingId === item.id}
                                className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition"
                                title="Restaurar para Descobertos"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => excluirOportunidadePermanente(item.id)}
                                disabled={discardingId === item.id}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition"
                                title="Excluir definitivamente"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => descartarOportunidade(item.id)}
                              disabled={discardingId === item.id}
                              className="p-1.5 rounded-lg bg-muted hover:bg-rose-500/20 text-muted-foreground hover:text-rose-500 transition"
                              title="Descartar oportunidade"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Botão ▶ Abordar Agora (Para leads Descobertos ou em Fila) */}
                      {(item.status === "DISCOVERED" || item.status === "QUEUED") && (
                        <button
                          onClick={() => abordarAgora(item.id, item.proprietarioNome)}
                          disabled={abordandoId === item.id}
                          className="w-full mt-2.5 py-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
                        >
                          <Send className="h-3 w-3" />
                          {abordandoId === item.id ? "Disparando..." : "▶ Abordar Agora"}
                        </button>
                      )}

                      {item.status === "VISIT_ACCEPTED" && (
                        <div className="mt-2 pt-1.5 border-t border-emerald-500/20 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Dossiê enviado ao Brunno</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {cardsDaColuna.length === 0 && (
                  <div className="h-40 flex items-center justify-center text-center text-muted-foreground text-xs italic">
                    Nenhum imóvel nesta etapa
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* 1. MODAL DE CONFIRMAÇÃO: LIMPAR DADOS FICTÍCIOS DE TESTE        */}
      {/* ============================================================== */}
      <AlertDialog open={showPurgeMockDialog} onOpenChange={setShowPurgeMockDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-rose-500 font-bold mb-1">
              <AlertTriangle className="h-5 w-5" />
              <span>Limpar Dados Fictícios de Teste</span>
            </div>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Deseja remover todos os cards fictícios do quadro?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Esta ação excluirá permanentemente os cards gerados pelos testes integrados e pelo fallback do eEmovel (ex: Dr. Roberto Martins, Eng. Marcelo Siqueira, Dona Regina Duarte). O painel do Rhema Hunter ficará limpo e pronto para suas prospecções reais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3">
            <AlertDialogCancel disabled={purgingMock} className="text-xs h-9">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={limparDadosFicticios}
              disabled={purgingMock}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold h-9 flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {purgingMock ? "Excluindo..." : "Sim, Limpar Fictícios"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============================================================== */}
      {/* 2. MODAL DE EDIÇÃO DE OPORTUNIDADE (ALTERAR DADOS)              */}
      {/* ============================================================== */}
      <Dialog open={!!editingOpp} onOpenChange={(open) => !open && setEditingOpp(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Edit3 className="h-4 w-4 text-amber-500" />
              Editar Oportunidade Hunter
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Altere os dados do imóvel, proprietário ou mova a oportunidade de etapa no funil.
            </DialogDescription>
          </DialogHeader>

          {editingOpp && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 py-2 text-xs">
              {/* Título do Anúncio */}
              <div className="sm:col-span-2">
                <label className="font-semibold text-foreground mb-1 block">Título do Imóvel:</label>
                <Input
                  value={editingOpp.titulo || ""}
                  onChange={(e) => setEditingOpp({ ...editingOpp, titulo: e.target.value })}
                  placeholder="Ex: Apartamento 3 Dormitórios no Embaré"
                  className="h-8 text-xs bg-background"
                />
              </div>

              {/* Nome do Proprietário */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">Nome do Proprietário:</label>
                <Input
                  value={editingOpp.proprietarioNome || ""}
                  onChange={(e) => setEditingOpp({ ...editingOpp, proprietarioNome: e.target.value })}
                  placeholder="Nome completo"
                  className="h-8 text-xs bg-background"
                />
              </div>

              {/* Telefone / WhatsApp */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">WhatsApp do Proprietário:</label>
                <Input
                  value={editingOpp.proprietarioTelefone || ""}
                  onChange={(e) => setEditingOpp({ ...editingOpp, proprietarioTelefone: e.target.value })}
                  placeholder="13998586168"
                  className="h-8 text-xs bg-background"
                />
              </div>

              {/* Valor Pretendido (R$) */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">Valor Pretendido (R$):</label>
                <Input
                  type="number"
                  value={editingOpp.valorPretendido || 0}
                  onChange={(e) => setEditingOpp({ ...editingOpp, valorPretendido: Number(e.target.value) })}
                  className="h-8 text-xs bg-background"
                />
              </div>

              {/* Bairro */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">Bairro:</label>
                <select
                  value={editingOpp.bairro || ""}
                  onChange={(e) => setEditingOpp({ ...editingOpp, bairro: e.target.value })}
                  className="h-8 w-full px-2 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">Selecione um bairro...</option>
                  {BAIRROS_SANTOS_PRESET.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Imóvel */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">Tipo de Imóvel:</label>
                <select
                  value={editingOpp.tipoImovel || "Apartamento"}
                  onChange={(e) => setEditingOpp({ ...editingOpp, tipoImovel: e.target.value })}
                  className="h-8 w-full px-2 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {TIPOS_IMOVEL_PRESET.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Oportunidade */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">Gatilho Hunter:</label>
                <select
                  value={editingOpp.tipoOportunidade || "FSBO_NOVO"}
                  onChange={(e) => setEditingOpp({ ...editingOpp, tipoOportunidade: e.target.value })}
                  className="h-8 w-full px-2 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {TIPOS_OPORTUNIDADE_PRESET.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quartos, Vagas e Área */}
              <div className="sm:col-span-2 grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-foreground mb-1 block">Quartos:</label>
                  <Input
                    type="number"
                    value={editingOpp.quartos || ""}
                    onChange={(e) => setEditingOpp({ ...editingOpp, quartos: Number(e.target.value) })}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground mb-1 block">Vagas:</label>
                  <Input
                    type="number"
                    value={editingOpp.vagas || ""}
                    onChange={(e) => setEditingOpp({ ...editingOpp, vagas: Number(e.target.value) })}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground mb-1 block">Área (m²):</label>
                  <Input
                    type="number"
                    value={editingOpp.areaM2 || ""}
                    onChange={(e) => setEditingOpp({ ...editingOpp, areaM2: Number(e.target.value) })}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              {/* Etapa do Funil (Status) */}
              <div className="sm:col-span-2">
                <label className="font-semibold text-foreground mb-1 block">Etapa no Kanban:</label>
                <select
                  value={editingOpp.status || "DISCOVERED"}
                  onChange={(e) => setEditingOpp({ ...editingOpp, status: e.target.value })}
                  className="h-8 w-full px-2 rounded-md border border-border bg-background text-xs text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {COLUNAS_HUNTER.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Endereço Aproximado */}
              <div className="sm:col-span-2">
                <label className="font-semibold text-foreground mb-1 block">Endereço / Edifício:</label>
                <Input
                  value={editingOpp.enderecoAprox || ""}
                  onChange={(e) => setEditingOpp({ ...editingOpp, enderecoAprox: e.target.value })}
                  placeholder="Ex: Av. Bartolomeu de Gusmão, 45 - Edifício Saint Germain"
                  className="h-8 text-xs bg-background"
                />
              </div>

              {/* Link do Anúncio Original */}
              <div className="sm:col-span-2">
                <label className="font-semibold text-foreground mb-1 block">Link do Anúncio Original:</label>
                <Input
                  value={editingOpp.dadosEemovel?.linkAnuncio || editingOpp.linkAnuncio || ""}
                  onChange={(e) =>
                    setEditingOpp({
                      ...editingOpp,
                      linkAnuncio: e.target.value,
                    })
                  }
                  placeholder="https://..."
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex sm:justify-between items-center gap-2 border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (editingOpp?.id) {
                  excluirOportunidadePermanente(editingOpp.id);
                }
              }}
              disabled={savingEdit}
              className="text-xs h-8 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 font-semibold"
            >
              <Trash2 className="h-3 w-3 mr-1" /> Excluir Card
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingOpp(null)}
                disabled={savingEdit}
                className="text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={salvarEdicaoOportunidade}
                disabled={savingEdit}
                className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
              >
                {savingEdit ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* 3. DRAWER / SHEET DE HISTÓRICO DE MENSAGENS COM O PROSPECT      */}
      {/* ============================================================== */}
      <Sheet open={!!selectedChatOpp} onOpenChange={(open) => !open && setSelectedChatOpp(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0 bg-background border-l border-border">
          {/* Header do Chat */}
          <div className="p-4 border-b border-border/70 bg-card/60 backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-foreground truncate">
                    {selectedChatOpp?.proprietarioNome || "Proprietário"}
                  </h3>
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500 bg-amber-500/10">
                    {COLUNAS_HUNTER.find((c) => c.id === selectedChatOpp?.status)?.label || selectedChatOpp?.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <span>{selectedChatOpp?.proprietarioTelefone}</span>
                  {selectedChatOpp?.proprietarioTelefone && (
                    <a
                      href={`https://wa.me/${selectedChatOpp.proprietarioTelefone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-500 hover:underline inline-flex items-center gap-0.5 ml-1 font-semibold"
                    >
                      <MessageCircle className="h-3 w-3" /> Abrir no WhatsApp Web
                    </a>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium mt-1 truncate">
                  {selectedChatOpp?.titulo} · {selectedChatOpp?.bairro} ·{" "}
                  <span className="text-amber-500 font-bold">
                    {(selectedChatOpp?.valorPretendido || 0).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </p>
              </div>
            </div>

            {/* Barra de Mudança de Etapa Rápida */}
            <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/50 overflow-x-auto pb-1 styled-scrollbar">
              <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">Etapa:</span>
              <button
                onClick={() => alterarStatusRapido("NEGOTIATING")}
                className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-orange-500/10 border border-orange-500/30 text-orange-500 hover:bg-orange-500/20 shrink-0 transition"
              >
                Interessado
              </button>
              <button
                onClick={() => alterarStatusRapido("VISIT_ACCEPTED")}
                className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 shrink-0 transition"
              >
                Aceite Visita
              </button>
              <button
                onClick={() => alterarStatusRapido("CAPTURED_EXCLUSIVE")}
                className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-purple-500/10 border border-purple-500/30 text-purple-500 hover:bg-purple-500/20 shrink-0 transition"
              >
                Rhema Premium (90d)
              </button>
              <button
                onClick={() => descartarOportunidade(selectedChatOpp?.id)}
                className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-rose-500/10 border border-rose-500/30 text-rose-500 hover:bg-rose-500/20 shrink-0 transition"
              >
                Descartar
              </button>
            </div>
          </div>

          {/* Área de Mensagens / Linha do Tempo (Scroll Interno) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-background/50 styled-scrollbar">
            {loadingChat ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
                <span className="text-xs font-medium">Carregando histórico do proprietário...</span>
              </div>
            ) : chatLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-2">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h4 className="text-xs font-bold text-foreground mb-1">Nenhuma mensagem registrada ainda</h4>
                <p className="text-[11px] text-muted-foreground max-w-xs">
                  Você pode disparar a abordagem com Anti-Spam pelo botão "Abordar Agora" ou enviar uma mensagem manual pelo campo abaixo.
                </p>
              </div>
            ) : (
              chatLogs.map((msg: any) => {
                const isOut = msg.direcao === "OUT";
                const dateFmt = new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                });

                return (
                  <div key={msg.id} className={`flex flex-col ${isOut ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 shadow-xs text-xs relative ${
                        isOut
                          ? "bg-amber-500/15 border border-amber-500/30 text-foreground rounded-tr-xs"
                          : "bg-muted/80 border border-border text-foreground rounded-tl-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1 border-b border-border/40 pb-1 text-[10px]">
                        <span className={`font-bold ${isOut ? "text-amber-500" : "text-emerald-500"}`}>
                          {isOut
                            ? msg.tipo === "MANUAL_REPLY"
                              ? "Você (Manual via WhatsApp)"
                              : "Rhema Hunter (Autônomo)"
                            : "Proprietário"}
                        </span>
                        <span className="text-muted-foreground text-[9px]">{dateFmt}</span>
                      </div>

                      <p className="whitespace-pre-line leading-relaxed text-foreground">{msg.conteudo}</p>

                      {/* Card de Análise do Coach / Jitter se disponível */}
                      {msg.analiseCoach && (
                        <div className="mt-2 pt-1.5 border-t border-border/30 text-[9px] text-muted-foreground flex flex-wrap items-center gap-1.5 font-medium">
                          {msg.analiseCoach.jitterSegundos && (
                            <span className="px-1.5 py-0.5 rounded bg-background/60 border border-border">
                              🛡️ Jitter: {msg.analiseCoach.jitterSegundos}s
                            </span>
                          )}
                          {msg.analiseCoach.tipoAbordagem && (
                            <span className="px-1.5 py-0.5 rounded bg-background/60 border border-border">
                              Gatilho: {msg.analiseCoach.tipoAbordagem}
                            </span>
                          )}
                          {msg.analiseCoach.ownerIntent && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold border border-amber-500/30">
                              Intenção: {msg.analiseCoach.ownerIntent}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Barra Inferior de Envio Manual */}
          <div className="p-3 border-t border-border/70 bg-card/60 backdrop-blur-md">
            <div className="flex gap-2">
              <Textarea
                value={newManualMessage}
                onChange={(e) => setNewManualMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviarMensagemManual();
                  }
                }}
                placeholder="Digite uma mensagem direta para o proprietário via WhatsApp..."
                className="text-xs bg-background min-h-[55px] max-h-28 resize-none"
              />
              <Button
                onClick={enviarMensagemManual}
                disabled={sendingManualMessage || !newManualMessage.trim()}
                className="self-end h-[55px] px-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition disabled:opacity-50"
              >
                {sendingManualMessage ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center justify-between">
              <span>Pressione Enter para enviar</span>
              <span className="text-amber-500 font-medium">Envia direto pelo WhatsApp conectado</span>
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
