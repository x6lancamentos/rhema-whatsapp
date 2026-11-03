"use client";

import React, { useState, useEffect } from "react";
import {
  Brain,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  MessageSquare,
  BarChart3,
  RefreshCw,
  Sliders,
  Check,
  X,
  Eye,
  FileCode,
  Zap,
  Award,
  Layers,
  HeartHandshake,
  Compass,
  AlertCircle,
} from "lucide-react";

interface Proposal {
  id: string;
  learnId: string;
  modulo: string;
  titulo: string;
  motivoAprimoramento: string;
  promptAntes: string;
  promptDepois: string;
  diffResumo: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  aprovadoPor: string | null;
  aprovadoEm: string | null;
  createdAt: string;
}

interface DebateMessage {
  id: string;
  proposalId?: string | null;
  remetente: string;
  conteudo: string;
  metadados?: any;
  createdAt: string;
}

export default function LearningLabPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [debateMessages, setDebateMessages] = useState<DebateMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningDebate, setRunningDebate] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"proposals" | "debate" | "framework">("proposals");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED">("ALL");
  const [expandedDiffId, setExpandedDiffId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [resProp, resDebate] = await Promise.all([
        fetch("/api/learning/proposals"),
        fetch("/api/learning/debate"),
      ]);

      const dataProp = await resProp.json();
      const dataDebate = await resDebate.json();

      if (dataProp.success) {
        setProposals(dataProp.proposals || []);
      }
      if (dataDebate.success) {
        setDebateMessages(dataDebate.messages || []);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do Learning Lab:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleTriggerDebate = async (modulo = "HUNTER_CAPTACAO") => {
    try {
      setRunningDebate(true);
      const res = await fetch("/api/learning/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulo }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Sessão de debate concluída! Nova proposta #LEARN gerada com sucesso.");
        await carregarDados();
        setActiveTab("proposals");
      } else {
        alert("Erro no debate: " + (data.error || "Desconhecido"));
      }
    } catch (err: any) {
      alert("Falha de rede ao disparar debate: " + err.message);
    } finally {
      setRunningDebate(false);
    }
  };

  const handleAprovarProposta = async (id: string, learnId: string) => {
    if (!confirm("Confirma a aprovação e implantação imediata do card " + learnId + " em produção?")) {
      return;
    }
    try {
      setApprovingId(id);
      const res = await fetch("/api/learning/proposals/" + id + "/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gestorNome: "Brunno Anastácio (Gerente)" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ " + learnId + " aprovado! Prompt recarregado em produção com sucesso.");
        await carregarDados();
      } else {
        alert("Erro ao aprovar proposta: " + data.error);
      }
    } catch (err: any) {
      alert("Erro ao conectar à API: " + err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const filteredProposals = proposals.filter((p) => {
    if (statusFilter === "ALL") return true;
    return p.status === statusFilter;
  });

  const pendingCount = proposals.filter((p) => p.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-8">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-amber-500 text-slate-950 px-5 py-3 rounded-xl shadow-2xl font-semibold flex items-center gap-3 border border-amber-300 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-slate-950" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Principal */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 text-amber-400">
              <Brain className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                  Learning Lab & Auto-Evolução Contínua
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  v5.1 Agêntica
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Debate autônomo entre Master Coach (Big Five, DISC, PNL, SPIN Selling) e Data Analyst para otimização contínua de conversão
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleTriggerDebate("HUNTER_CAPTACAO")}
            disabled={runningDebate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 disabled:opacity-50 text-sm"
          >
            {runningDebate ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Debatendo em tempo real...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Disparar Debate Agêntico</span>
              </>
            )}
          </button>

          <button
            onClick={carregarDados}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 transition text-sm flex items-center justify-center"
            title="Recarregar Dados"
          >
            <RefreshCw className={loading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
          </button>
        </div>
      </div>

      {/* KPI & Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Propostas Totais</div>
            <div className="text-2xl font-bold text-white mt-1">{proposals.length}</div>
            <div className="text-xs text-amber-400 mt-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Aprendizado cumulativo
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800 text-amber-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Aguardando Brunno</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{pendingCount}</div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Trava de governança ativa
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Aprovadas em Produção</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {proposals.filter((p) => p.status === "APPROVED").length}
            </div>
            <div className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Prompts aprimorados
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Interações no Debate</div>
            <div className="text-2xl font-bold text-cyan-400 mt-1">{debateMessages.length}</div>
            <div className="text-xs text-cyan-400/80 mt-1 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Diálogo contínuo
            </div>
          </div>
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("proposals")}
          className={
            activeTab === "proposals"
              ? "px-5 py-3 font-medium text-sm rounded-t-xl transition flex items-center gap-2 border-b-2 border-amber-400 text-amber-400 bg-amber-500/10"
              : "px-5 py-3 font-medium text-sm rounded-t-xl transition flex items-center gap-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }
        >
          <Sparkles className="w-4 h-4" />
          <span>Cards de Evolução (#LEARN-ID)</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500 text-slate-950 font-bold ml-1">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("debate")}
          className={
            activeTab === "debate"
              ? "px-5 py-3 font-medium text-sm rounded-t-xl transition flex items-center gap-2 border-b-2 border-amber-400 text-amber-400 bg-amber-500/10"
              : "px-5 py-3 font-medium text-sm rounded-t-xl transition flex items-center gap-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }
        >
          <MessageSquare className="w-4 h-4" />
          <span>Feed do Debate ao Vivo</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300 font-medium ml-1">
            {debateMessages.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("framework")}
          className={
            activeTab === "framework"
              ? "px-5 py-3 font-medium text-sm rounded-t-xl transition flex items-center gap-2 border-b-2 border-amber-400 text-amber-400 bg-amber-500/10"
              : "px-5 py-3 font-medium text-sm rounded-t-xl transition flex items-center gap-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }
        >
          <HeartHandshake className="w-4 h-4" />
          <span>Framework Psicométrico (Big Five, DISC & PNL)</span>
        </button>
      </div>

      {/* TAB 1: CARDS DE EVOLUÇÃO */}
      {activeTab === "proposals" && (
        <div className="space-y-6">
          {/* Sub-Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={
                  statusFilter === "ALL"
                    ? "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition bg-slate-800 text-white border border-slate-700"
                    : "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition bg-slate-900/60 text-slate-400 hover:text-white"
                }
              >
                Todas ({proposals.length})
              </button>
              <button
                onClick={() => setStatusFilter("PENDING")}
                className={
                  statusFilter === "PENDING"
                    ? "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 bg-slate-900/60 text-slate-400 hover:text-amber-400"
                }
              >
                <Clock className="w-3 h-3" />
                Pendentes ({pendingCount})
              </button>
              <button
                onClick={() => setStatusFilter("APPROVED")}
                className={
                  statusFilter === "APPROVED"
                    ? "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 bg-slate-900/60 text-slate-400 hover:text-emerald-400"
                }
              >
                <CheckCircle2 className="w-3 h-3" />
                Aprovadas ({proposals.filter((p) => p.status === "APPROVED").length})
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Mostrando <strong className="text-slate-200">{filteredProposals.length}</strong> propostas de evolução
            </div>
          </div>

          {/* List of Proposals */}
          {filteredProposals.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
              <Brain className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <h3 className="text-lg font-medium text-slate-300">Nenhuma proposta encontrada neste filtro</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Clique em &quot;Disparar Debate Agêntico&quot; para que o Master Coach e o Data Analyst analisem os dados reais e criem um novo card.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredProposals.map((proposal) => {
                const isPending = proposal.status === "PENDING";
                const isApproved = proposal.status === "APPROVED";
                const isExpanded = expandedDiffId === proposal.id;

                return (
                  <div
                    key={proposal.id}
                    className={
                      isPending
                        ? "rounded-2xl border transition shadow-xl overflow-hidden bg-slate-900/90 border-amber-500/30 hover:border-amber-500/50"
                        : "rounded-2xl border transition shadow-xl overflow-hidden bg-slate-900/50 border-slate-800"
                    }
                  >
                    {/* Proposal Card Header */}
                    <div className="p-6 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            {proposal.learnId}
                          </span>
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                            {proposal.modulo}
                          </span>
                          {isPending && (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 animate-pulse">
                              <Clock className="w-3 h-3" />
                              Aguardando Aprovação de Brunno
                            </span>
                          )}
                          {isApproved && (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3 h-3" />
                              Ativo em Produção
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg md:text-xl font-bold text-white">{proposal.titulo}</h3>
                      </div>

                      {/* Right Action / Status Details */}
                      <div className="flex items-center gap-3">
                        {isPending && (
                          <button
                            onClick={() => handleAprovarProposta(proposal.id, proposal.learnId)}
                            disabled={approvingId === proposal.id}
                            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50"
                          >
                            {approvingId === proposal.id ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Publicando...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>Aprovar e Publicar em Produção</span>
                              </>
                            )}
                          </button>
                        )}
                        {isApproved && (
                          <div className="text-right text-xs text-slate-400">
                            <div className="text-emerald-400 font-semibold flex items-center gap-1 justify-end">
                              <ShieldCheck className="w-3.5 h-3.5" /> Homologado
                            </div>
                            <div>{proposal.aprovadoPor || "Brunno Anastácio"}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Proposal Details Body */}
                    <div className="p-6 space-y-4">
                      {/* Motivo do Aprimoramento / Big Five Insight */}
                      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-sm space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5" /> Diagnóstico Psicométrico & Comercial (Master Coach PNL/SPIN)
                        </div>
                        <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                          {proposal.motivoAprimoramento}
                        </p>
                      </div>

                      {/* Diff Resumo */}
                      {proposal.diffResumo && (
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            <strong>Resumo das Modificações:</strong> {proposal.diffResumo}
                          </span>
                        </div>
                      )}

                      {/* Diff Toggle Button */}
                      <div>
                        <button
                          onClick={() => setExpandedDiffId(isExpanded ? null : proposal.id)}
                          className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1.5 font-medium transition py-1"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          <span>{isExpanded ? "Ocultar Comparativo de Prompt" : "Ver Comparativo Completo (Antes vs. Depois)"}</span>
                        </button>
                      </div>

                      {/* Side-by-side Prompt Comparison */}
                      {isExpanded && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                          {/* Prompt Anterior */}
                          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 space-y-2">
                            <div className="text-xs font-semibold text-rose-400 flex items-center gap-1.5 uppercase">
                              <X className="w-3.5 h-3.5" /> Versão Anterior / Linha Base
                            </div>
                            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-72 overflow-y-auto p-3 rounded-lg bg-slate-950/80 border border-rose-500/10 leading-relaxed">
                              {proposal.promptAntes}
                            </pre>
                          </div>

                          {/* Prompt Otimizado */}
                          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                            <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase">
                              <Check className="w-3.5 h-3.5" /> Versão Otimizada (Proposta)
                            </div>
                            <pre className="text-xs text-emerald-200/90 font-mono whitespace-pre-wrap max-h-72 overflow-y-auto p-3 rounded-lg bg-slate-950/80 border border-emerald-500/20 leading-relaxed">
                              {proposal.promptDepois}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FEED DO DEBATE AO VIVO */}
      {activeTab === "debate" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-400" />
                Sessão de Debate Multiagente Contínua
              </h3>
              <p className="text-xs text-slate-400">
                Registro transparente das discussões entre os agentes especialistas antes de gerar cada proposta de melhoria.
              </p>
            </div>
            <button
              onClick={() => handleTriggerDebate("HUNTER_CAPTACAO")}
              disabled={runningDebate}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-2 transition disabled:opacity-50"
            >
              <RefreshCw className={runningDebate ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} />
              <span>Nova Rodada de Debate</span>
            </button>
          </div>

          <div className="space-y-4">
            {debateMessages.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
                <MessageSquare className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                <h4 className="text-base font-medium text-slate-300">Nenhuma mensagem de debate registrada</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Clique em &quot;Disparar Debate Agêntico&quot; para iniciar a primeira interação entre o Master Coach e o Data Analyst.
                </p>
              </div>
            ) : (
              debateMessages.map((msg) => {
                const isCoach = msg.remetente === "MASTER_COACH";
                const isAnalyst = msg.remetente === "DATA_ANALYST";
                const isGestor = msg.remetente === "GESTOR";

                return (
                  <div
                    key={msg.id}
                    className={
                      isCoach
                        ? "p-5 rounded-2xl border transition bg-gradient-to-r from-amber-950/20 to-slate-900 border-amber-500/30"
                        : isAnalyst
                        ? "p-5 rounded-2xl border transition bg-gradient-to-r from-cyan-950/20 to-slate-900 border-cyan-500/30"
                        : "p-5 rounded-2xl border transition bg-slate-900 border-slate-700"
                    }
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        {isCoach && (
                          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <Brain className="w-4 h-4" />
                          </div>
                        )}
                        {isAnalyst && (
                          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            <BarChart3 className="w-4 h-4" />
                          </div>
                        )}
                        {isGestor && (
                          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            <Award className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            {isCoach && "Master Coach Psicométrico & Persuasão"}
                            {isAnalyst && "Data Analyst de Performance & Conversão"}
                            {isGestor && "Brunno Anastácio (Gestor)"}
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                              {isCoach ? "Big Five / PNL / SPIN" : isAnalyst ? "Métricas / SLA / Sentimento" : "Comando Oficial"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(msg.createdAt).toLocaleString("pt-BR")}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-slate-300 whitespace-pre-line leading-relaxed pl-10">
                      {msg.conteudo}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FRAMEWORK PSICOMÉTRICO (BIG FIVE, DISC & PNL) */}
      {activeTab === "framework" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Big Five (OCEAN) */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Compass className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Big Five (OCEAN)</h3>
                <p className="text-xs text-slate-400">Calibração comportamental profunda</p>
              </div>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <strong className="text-amber-400 block mb-0.5">Openness (Abertura):</strong>
                Adapta a abordagem para perfis curiosos vs. tradicionais (detalhes de arquitetura vs. solidez do bairro).
              </li>
              <li className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <strong className="text-amber-400 block mb-0.5">Conscientiousness (Conscienciosidade):</strong>
                Fornece dados objetivos de liquidez, valor/m² e previsibilidade para proprietários focados em segurança.
              </li>
              <li className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <strong className="text-amber-400 block mb-0.5">Extraversion (Extroversão):</strong>
                Dinamismo na cadência: tom entusiasta e direto com alto dinamismo social.
              </li>
              <li className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <strong className="text-amber-400 block mb-0.5">Agreeableness (Amabilidade):</strong>
                Comunicação cordial, focada em parceria, sem agressividade comercial.
              </li>
              <li className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <strong className="text-amber-400 block mb-0.5">Neuroticism (Reatividade Emocional):</strong>
                Redução de ansiedade com clareza cristalina, sem pressão ou ultimatos.
              </li>
            </ul>
          </div>

          {/* Card 2: DISC & SPIN Selling */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">DISC & SPIN Selling</h3>
                <p className="text-xs text-slate-400">Condução e quebra de objeções</p>
              </div>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <strong className="text-cyan-400 block mb-0.5">Perfil D (Dominante):</strong>
                Mensagens ultra curtas, foco no resultado e comprador pronto sem enrolação.
              </li>
              <li className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <strong className="text-cyan-400 block mb-0.5">Perfil I (Influente):</strong>
                Abordagem calorosa, valorizando o bom gosto do proprietário e o status do imóvel.
              </li>
              <li className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <strong className="text-cyan-400 block mb-0.5">SPIN Selling (Problema / Implicação):</strong>
                Expõe o custo de oportunidade de manter o imóvel parado pagando IPTU/condomínio sem visita qualificada.
              </li>
              <li className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <strong className="text-cyan-400 block mb-0.5">Necessidade de Solução:</strong>
                Posiciona a visita de fotos com fotógrafo profissional Rhema como o passo sem risco para o proprietário.
              </li>
            </ul>
          </div>

          {/* Card 3: PNL & Gatilhos Cialdini */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">PNL & Gatilhos Mentais</h3>
                <p className="text-xs text-slate-400">Rapport e persuasão sutil</p>
              </div>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <strong className="text-purple-400 block mb-0.5">Espelhamento de Linguagem:</strong>
                O agente detecta o estilo de escrita do lead (formal, casual, rápido) e replica o tom instantaneamente.
              </li>
              <li className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <strong className="text-purple-400 block mb-0.5">Gatilho da Reciprocidade:</strong>
                Entrega valor antes de pedir: diagnóstico de mercado gratuito e indicação de comprador qualificado.
              </li>
              <li className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <strong className="text-purple-400 block mb-0.5">Escassez Real:</strong>
                Agenda de visitas limitada por turno (manhã ou tarde) com o fotógrafo oficial.
              </li>
              <li className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <strong className="text-purple-400 block mb-0.5">Autoridade Comprovada:</strong>
                Rhema Imóveis com 25 anos de tradição em Santos/SP e domínio na Baixada Santista.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
