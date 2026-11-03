"use client";

import React, { useState, useEffect } from "react";
import {
  Target,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  MessageSquare,
  Building2,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  MapPin,
  Clock,
  DollarSign,
  TrendingDown,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

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

const COLUNAS_HUNTER = [
  { id: "DISCOVERED", label: "Descobertos (eEmovel)", cor: "border-amber-500/40 bg-amber-500/5" },
  { id: "QUEUED", label: "Fila Anti-Spam", cor: "border-blue-500/40 bg-blue-500/5" },
  { id: "APPROACHING", label: "Em Abordagem", cor: "border-yellow-500/40 bg-yellow-500/5" },
  { id: "NEGOTIATING", label: "Interessados / Negociando", cor: "border-orange-500/40 bg-orange-500/5" },
  { id: "VISIT_ACCEPTED", label: "Aceite / Enviado ao Brunno", cor: "border-emerald-500/40 bg-emerald-500/5" },
  { id: "CAPTURED_EXCLUSIVE", label: "Rhema Premium (90d)", cor: "border-purple-500/40 bg-purple-500/5" },
  { id: "REJECTED", label: "Descartados", cor: "border-rose-500/40 bg-rose-500/5" },
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

  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [search, setSearch] = useState("");
  const [filterBairro, setFilterBairro] = useState("");

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [resOpp, resConfig] = await Promise.all([
        fetch(`/api/hunter/opportunities?search=${encodeURIComponent(search)}&bairro=${encodeURIComponent(filterBairro)}`),
        fetch("/api/hunter/config"),
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
        if (c.ativo !== undefined) setAtivoHunter(c.ativo);
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
      const res = await fetch("/api/hunter/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await carregarDados();
      }
    } catch (err) {
      console.error("Erro ao sincronizar EEmovel:", err);
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
      await carregarDados();
    } catch (e) {
      console.error("Erro ao salvar config:", e);
    } finally {
      setSavingConfig(false);
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

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-slate-950/40 text-foreground">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-amber-500/20">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
              <Target className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Rhema Hunter <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">eEmovel Big Data</span>
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Motor Autônomo de Captação Ativa, Reverse Hunting e Abordagem com Jitter Anti-Spam
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-amber-500/30 text-amber-300 hover:bg-slate-800 transition"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Seletor de Bairros & Preço
          </button>

          <button
            onClick={dispararSincronizacaoEemovel}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-lg shadow-amber-500/25 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar eEmovel"}
          </button>
        </div>
      </div>

      {/* Painel Expansível de Filtros (Bairros & Preço) */}
      {showConfigPanel && (
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" /> Parâmetros de Varredura no eEmovel (Santos/SP)
            </h3>
            <button onClick={selecionarTodosOrla} className="text-xs text-amber-400 hover:underline">
              + Selecionar Todos da Orla
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Seletor de Bairros */}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-300 mb-2 block">
                Bairros Ativos para Garimpar ({bairrosSelecionados.length} selecionados):
              </label>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                {BAIRROS_SANTOS_PRESET.map((b) => {
                  const sel = bairrosSelecionados.includes(b);
                  return (
                    <button
                      key={b}
                      onClick={() => toggleBairro(b)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                        sel
                          ? "bg-amber-500/20 border-amber-500/60 text-amber-200"
                          : "bg-slate-900/80 border-slate-700 text-slate-400 hover:border-slate-600"
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
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Faixa de Preço (R$):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={valorMin}
                    onChange={(e) => setValorMin(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    placeholder="Min"
                  />
                  <span className="text-slate-500">até</span>
                  <input
                    type="number"
                    value={valorMax}
                    onChange={(e) => setValorMax(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    placeholder="Max"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Limite Diário (Novos Leads):</label>
                <input
                  type="number"
                  value={limiteDiario}
                  onChange={(e) => setLimiteDiario(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  onClick={salvarConfiguracoes}
                  disabled={savingConfig}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition"
                >
                  {savingConfig ? "Salvando..." : "Salvar Parâmetros"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-[11px] font-medium text-slate-400">Total Mapeado</p>
          <p className="text-2xl font-bold text-white mt-0.5">{stats.total}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-amber-500/20">
          <p className="text-[11px] font-medium text-amber-400">Em Abordagem</p>
          <p className="text-2xl font-bold text-amber-300 mt-0.5">{stats.emAbordagem + stats.negociando}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-emerald-500/20">
          <p className="text-[11px] font-medium text-emerald-400">Aceites / Brunno</p>
          <p className="text-2xl font-bold text-emerald-300 mt-0.5">{stats.visitaAceita}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-purple-500/20">
          <p className="text-[11px] font-medium text-purple-400">Exclusividades Rhema</p>
          <p className="text-2xl font-bold text-purple-300 mt-0.5">{stats.captadosExclusivos}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-[11px] font-medium text-slate-400">VGV Potencial</p>
          <p className="text-xl font-bold text-white mt-0.5">
            {(stats.vgvMapeado / 1000000).toFixed(1)}M <span className="text-xs font-normal text-slate-500">R$</span>
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && carregarDados()}
            placeholder="Buscar por proprietário, telefone, edifício ou rua..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <select
          value={filterBairro}
          onChange={(e) => setFilterBairro(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
        >
          <option value="">Todos os Bairros</option>
          {BAIRROS_SANTOS_PRESET.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {/* Kanban Board em 7 Colunas */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3.5 overflow-x-auto pb-6">
        {COLUNAS_HUNTER.map((col) => {
          const cardsDaColuna = opportunities.filter((op) => op.status === col.id);

          return (
            <div key={col.id} className={`flex flex-col rounded-2xl border ${col.cor} p-3 min-w-[260px] h-[720px]`}>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60">
                <span className="text-xs font-bold text-white tracking-tight">{col.label}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {cardsDaColuna.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 styled-scrollbar">
                {cardsDaColuna.map((item) => {
                  const valorFmt = item.valorPretendido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                  const badgeColor =
                    item.tipoOportunidade === "REDUCAO_PRECO"
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                      : item.tipoOportunidade === "REVERSE_DEMAND"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-blue-500/20 text-blue-300 border-blue-500/30";

                  const badgeLabel =
                    item.tipoOportunidade === "REDUCAO_PRECO"
                      ? "Redução de Preço"
                      : item.tipoOportunidade === "REVERSE_DEMAND"
                      ? "Reverse Hunter"
                      : item.tipoOportunidade === "PARADO_LONGO_PRAZO"
                      ? "Parado >120d"
                      : "FSBO Novo";

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-xl p-3 shadow-md transition group"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                        <span className="text-[11px] font-bold text-amber-300">{valorFmt}</span>
                      </div>

                      <h4 className="text-xs font-semibold text-white line-clamp-2 mb-1 group-hover:text-amber-200 transition">
                        {item.titulo || `${item.tipoImovel} no ${item.bairro}`}
                      </h4>

                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mb-2">
                        <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                        <span className="truncate">{item.bairro} · {item.quartos || "?"}d · {item.vagas || "?"}v</span>
                      </p>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <div>
                          <p className="font-semibold text-slate-300 truncate max-w-[130px]">{item.proprietarioNome}</p>
                          <p className="text-[10px] text-slate-500">{item.proprietarioTelefone}</p>
                        </div>

                        <div className="flex items-center gap-1">
                          <a
                            href={`https://wa.me/${item.proprietarioTelefone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition"
                            title="Abrir no WhatsApp"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {cardsDaColuna.length === 0 && (
                  <div className="h-32 flex items-center justify-center text-center text-slate-600 text-xs italic">
                    Nenhum imóvel nesta etapa
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
