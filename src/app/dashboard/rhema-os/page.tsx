"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Sparkles, Clock, Terminal, CheckCircle2, Lock, Send, RefreshCw, Award } from "lucide-react";

interface LearnCard {
  id: string;
  criadoEm: string;
  autor: string;
  gargaloIdentificado: string;
  acaoProposta: string;
  impactoEsperado: string;
  status: "AGUARDANDO_APROVACAO" | "APROVADO_E_APLICADO";
  aprovadoEm?: string;
}

interface BrokerItem {
  id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
}

const ROTINAS_CRON = [
  {
    id: "BRIEFING_MATINAL_0730",
    horario: "07:30 (Seg–Sex)",
    titulo: "Briefing Matinal do Gestor",
    escopo: "🔒 Exclusivo Brunno",
    descricao: "Resumo do Placar de ontem, auditoria de SLA Imoview (>15min e >24h) e 3 pautas da matinal.",
  },
  {
    id: "ONBOARDING_CORRETORES_0800",
    horario: "08:00 (Seg–Sex)",
    titulo: "Onboarding Matinal Calibrado",
    escopo: "👥 9 Corretores (Individual)",
    descricao: "3 perguntas de foco diário calibradas pelo perfil comportamental de cada corretor (AGENTS.md).",
  },
  {
    id: "SLA_DEAD_DEAL_CPR_1400",
    horario: "14:00 (Seg–Sex)",
    titulo: "Radar Dead-Deal CPR (>3 dias)",
    escopo: "👥 Corretores + Gestor",
    descricao: "Envia scripts prontos de ressuscitação para clientes parados há >3 dias (+2 pts Resgate).",
  },
  {
    id: "COLETA_FECHAMENTO_1730",
    horario: "17:30 (Seg–Sex)",
    titulo: "Coleta de Check-out por Voz (30s)",
    escopo: "👥 9 Corretores (Individual)",
    descricao: "Solicita áudio de 30s com números do dia, o que travou hoje e prioridade nº 1 de amanhã.",
  },
  {
    id: "FECHAMENTO_EXECUTIVO_1815",
    horario: "18:15 (Seg–Sex)",
    titulo: "Fechamento Executivo & Homologação",
    escopo: "🔒 Exclusivo Brunno",
    descricao: "VGV em mesa, cálculo de comissões (6%: 30/15/7/48%) e homologação do Placar em 1 clique.",
  },
  {
    id: "DOSSIE_PDI_OKR_SEXTA_1700",
    horario: "17:00 (Sextas-feiras)",
    titulo: "Dossiê Semanal de PDI & OKR 90 Dias",
    escopo: "🔒 Exclusivo Brunno",
    descricao: "Diagnóstico das 4 taxas de conversão + Capítulos 08 a 11 da Universidade Rhema para as 1:1.",
  },
];

export default function RhemaOsCommandCenterPage() {
  const [commanderPhones, setCommanderPhones] = useState<string>("");
  const [learnCards, setLearnCards] = useState<LearnCard[]>([]);
  const [brokers, setBrokers] = useState<BrokerItem[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [comandoInput, setComandoInput] = useState<string>("DIAGNÓSTICO GERAL");
  const [roleTeste, setRoleTeste] = useState<"COMMANDER_GESTOR" | "BROKER_CORRETOR">("COMMANDER_GESTOR");
  const [respostaConsole, setRespostaConsole] = useState<string>("");
  const [loadingCmd, setLoadingCmd] = useState(false);
  const [rotinaExecutando, setRotinaExecutando] = useState<string | null>(null);
  const [dispararReal, setDispararReal] = useState(false);
  const [rotinasAtivas, setRotinasAtivas] = useState(false);

  async function carregarDados() {
    try {
      const [resCmd, resRoutines] = await Promise.all([
        fetch("/api/ai-agent/commander"),
        fetch("/api/ai-agent/daily-routines"),
      ]);
      const json = await resCmd.json();
      if (json.sucesso) {
        setCommanderPhones((json.commanderPhones || []).join(", "));
        setLearnCards(json.learnCards || []);
        setBrokers(json.brokers || []);
        const connected = (json.sessions || []).find((s: any) => s.status === "CONNECTED");
        if (connected) setSessionId(connected.sessionId);
      }
      const jsonR = await resRoutines.json();
      if (jsonR.sucesso) {
        setRotinasAtivas(Boolean(jsonR.rotinasAtivas));
      }
    } catch {
      // ignore
    }
  }

  async function alternarStatusRotinas() {
    const novo = !rotinasAtivas;
    try {
      const res = await fetch("/api/ai-agent/daily-routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "TOGGLE", ativas: novo }),
      });
      const json = await res.json();
      if (json.sucesso) {
        setRotinasAtivas(json.rotinasAtivas);
        setRespostaConsole(json.mensagem);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void carregarDados();
  }, []);

  async function salvarPhonesGestor() {
    const res = await fetch("/api/ai-agent/commander", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "ATUALIZAR_PHONES",
        phones: commanderPhones,
      }),
    });
    const json = await res.json();
    if (json.sucesso) {
      setCommanderPhones((json.commanderPhones || []).join(", "));
      setRespostaConsole(`✅ Whitelist RBAC do Gestor Comandante atualizada: ${(json.commanderPhones || []).join(", ") || "Padrão .env"}`);
    }
  }

  async function executarComando(cmdTexto?: string) {
    const texto = cmdTexto || comandoInput;
    setLoadingCmd(true);
    try {
      const res = await fetch("/api/ai-agent/commander", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comandoTexto: texto,
          roleSimulado: roleTeste,
          remetenteNome: roleTeste === "COMMANDER_GESTOR" ? "Brunno Anastácio" : brokers[0]?.nome || "Corretor Rhema",
        }),
      });
      const json = await res.json();
      if (json.respostaWhatsApp) {
        setRespostaConsole(json.respostaWhatsApp);
      }
      if (json.learnCards) {
        setLearnCards(json.learnCards);
      }
    } finally {
      setLoadingCmd(false);
    }
  }

  async function dispararRotinaManual(rotinaId: string) {
    setRotinaExecutando(rotinaId);
    try {
      const res = await fetch("/api/ai-agent/daily-routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rotina: rotinaId,
          sessionId: sessionId || undefined,
          gestorPhone: commanderPhones.split(",")[0]?.trim() || undefined,
          dispararWhatsApp: dispararReal,
        }),
      });
      const json = await res.json();
      if (json.sucesso && json.mensagensGeradas?.length > 0) {
        const preview = json.mensagensGeradas
          .map((m: any) => `Para: ${m.destinatario} (${m.enviado ? "ENVIADO NO WHATSAPP" : "SIMULAÇÃO"})\n\n${m.texto}`)
          .join("\n\n====================================\n\n");
        setRespostaConsole(preview);
      }
    } finally {
      setRotinaExecutando(null);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/60 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary mb-1">
            <ShieldCheck size={15} /> Diretoria Agêntica v3.5 · Cloud 24/7 no Coolify
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            Central de Comando do Gestor — Rhema OS
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Orquestração 24/7 dos 8 Agentes, Blindagem RBAC de Superpoderes (Brunno) e Governança <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/learn</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rotinasAtivas ? (
            <button
              onClick={alternarStatusRotinas}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition cursor-pointer"
              title="Clique para pausar todas as rotinas autônomas"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              ▶️ Rotinas Autônomas: ATIVAS (Clique p/ Pausar)
            </button>
          ) : (
            <button
              onClick={alternarStatusRotinas}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition cursor-pointer"
              title="Clique para ativar as rotinas autônomas"
            >
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              ⏸️ Rotinas Autônomas: PAUSADAS (Clique p/ Ativar)
            </button>
          )}
          <button
            onClick={() => carregarDados()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-border hover:bg-muted transition-colors"
          >
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>
      </div>

      {/* Blindagem RBAC + Simulador de Comandos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-card border border-border/60 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <Lock size={16} className="text-primary" />
            Blindagem RBAC de 3 Níveis (Segurança do Gestor)
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Apenas os números listados abaixo têm permissão de <strong>Nível 1 (Gestor Comandante)</strong> para executar{" "}
            <code>HOMOLOGAR</code>, <code>DIAGNÓSTICO</code>, <code>STATUS OKR</code>, <code>PDI</code>, <code>COMISSÕES</code> e{" "}
            <code>APROVAR #LEARN</code> no WhatsApp.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">
              WhatsApp(s) do Gestor Comandante (Brunno Anastácio)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: 5513999999999, 5513988888888"
                value={commanderPhones}
                onChange={(e) => setCommanderPhones(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs"
              />
              <button
                onClick={salvarPhonesGestor}
                className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
              >
                Salvar RBAC
              </button>
            </div>
          </div>

          <div className="border-t border-border/50 pt-3 space-y-2">
            <div className="text-xs font-semibold text-foreground">
              Resumo de Permissões Ativas no Baileys:
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <span className="font-bold text-emerald-500">Nível 1 · Gestor Comandante (Brunno):</span> Acesso total aos 8 agentes, homologação do Placar, diagnóstico de qualquer corretor, PDI, comissões (6%) e aprovação <code>/learn</code>.
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <span className="font-bold text-blue-400">Nível 2 · Corretores Autenticados ({brokers.filter((b) => b.ativo).length} ativos):</span> Escopo individual isolado (<code>#meuplacar</code>, <code>#meusleads</code> e áudios de visita/captação/fechamento). Bloqueio total a dados de colegas.
              </div>
            </div>
          </div>
        </div>

        {/* Console de Superpoderes */}
        <div className="lg:col-span-7 bg-card border border-border/60 rounded-2xl p-5 space-y-4 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <Terminal size={16} className="text-primary" />
              Console de Superpoderes & Teste de Blindagem RBAC
            </div>
            <select
              value={roleTeste}
              onChange={(e) => setRoleTeste(e.target.value as any)}
              className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium"
            >
              <option value="COMMANDER_GESTOR">Simular como: 👑 Brunno (Gestor Nível 1)</option>
              <option value="BROKER_CORRETOR">Simular como: 👤 Corretor (Nível 2 — Testar Bloqueio)</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              "HOMOLOGAR",
              "DIAGNÓSTICO GERAL",
              "DIAGNÓSTICO Tatiana",
              "DIAGNÓSTICO André",
              "PDI Flávia",
              "STATUS OKR",
              "CELEBRAR Tatiana R$ 920.000",
              "#meuplacar",
              "#meusleads",
            ].map((atalho) => (
              <button
                key={atalho}
                type="button"
                onClick={() => {
                  setComandoInput(atalho);
                  void executarComando(atalho);
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-muted hover:bg-primary/15 hover:text-primary border border-border/60 transition"
              >
                {atalho}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={comandoInput}
              onChange={(e) => setComandoInput(e.target.value)}
              placeholder="Digite um comando (ex: DIAGNÓSTICO Tatiana, STATUS OKR, HOMOLOGAR, #learn ...)"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
            />
            <button
              onClick={() => executarComando()}
              disabled={loadingCmd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
            >
              <Send size={13} />
              {loadingCmd ? "Executando…" : "Executar"}
            </button>
          </div>

          <div className="flex-1 min-h-[180px] rounded-xl bg-black/90 text-emerald-300 font-mono text-xs p-4 whitespace-pre-wrap overflow-y-auto border border-border/40">
            {respostaConsole ||
              "Selecione um atalho acima ou clique em 'Executar' para testar os Superpoderes do Gestor ou validar o bloqueio RBAC para corretores."}
          </div>
        </div>
      </div>

      {/* As 6 Rotinas Autônomas 24/7 no Coolify */}
      <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <Clock size={16} className="text-primary" />
              6 Rotinas Autônomas Diárias & Semanais (Coolify 24/7)
            </div>
            <p className="text-xs text-muted-foreground">
              Executadas automaticamente pelo <code>scheduler.ts</code> (fuso <code>America/Sao_Paulo</code>) sem depender do computador local ligado.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={dispararReal}
              onChange={(e) => setDispararReal(e.target.checked)}
              className="rounded border-border"
            />
            Enviar mensagem real no WhatsApp ao clicar em Testar
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ROTINAS_CRON.map((r) => (
            <div key={r.id} className="rounded-xl border border-border/60 p-4 flex flex-col justify-between gap-3 bg-background/50">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {r.horario}
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground">{r.escopo}</span>
                </div>
                <div className="font-bold text-sm text-foreground">{r.titulo}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{r.descricao}</p>
              </div>
              <button
                onClick={() => dispararRotinaManual(r.id)}
                disabled={rotinaExecutando === r.id}
                className="w-full py-1.5 px-3 rounded-lg border border-border hover:bg-primary/10 hover:text-primary text-xs font-semibold transition"
              >
                {rotinaExecutando === r.id ? "Processando…" : "⚡ Executar / Visualizar Agora"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Governança /learn (Agente 8) */}
      <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <Sparkles size={16} className="text-primary" />
              Agente 8 — Governança de Auto-Evolução (<code>/learn</code>)
            </div>
            <p className="text-xs text-muted-foreground">
              Nenhuma melhoria altera pesos do Placar ou regras de produção sem a aprovação explícita do Brunno.
            </p>
          </div>
          <Award size={20} className="text-primary/70" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {learnCards.map((card) => (
            <div
              key={card.id}
              className="rounded-xl border border-border/60 p-4 space-y-2.5 bg-background/40 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-primary">#{card.id}</span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      card.status === "APROVADO_E_APLICADO"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {card.status === "APROVADO_E_APLICADO" ? "✅ APROVADO PELO BRUNNO" : "⏳ AGUARDANDO APROVAÇÃO"}
                  </span>
                </div>
                <div className="text-xs">
                  <strong>Gargalo:</strong> {card.gargaloIdentificado}
                </div>
                <div className="text-xs">
                  <strong>Ação Proposta:</strong> {card.acaoProposta}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  <strong>Impacto Esperado:</strong> {card.impactoEsperado}
                </div>
              </div>

              {card.status === "AGUARDANDO_APROVACAO" && (
                <button
                  onClick={() => executarComando(`APROVAR #${card.id}`)}
                  className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                >
                  <CheckCircle2 size={14} /> Aprovar #{card.id} em 1 Clique
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

