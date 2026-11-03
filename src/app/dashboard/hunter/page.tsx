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
  ChevronDown,
  ExternalLink,
  ShieldAlert,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    sub: "Sem interesse ou vendido",
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
        fetch(
          `/api/hunter/opportunities?search=${encodeURIComponent(search)}&bairro=${encodeURIComponent(filterBairro)}`
        ),
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
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 dark:text-amber-400 font-bold text-[11px] px-2 py-0.5">
                  eEmovel Big Data
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
                Motor Autônomo de Captação Ativa, Reverse Hunting e Abordagem com Jitter Anti-Spam
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
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
        </div>
      </div>

      {/* Kanban Board Horizontal Scrollable (7 Colunas de 300px) */}
      <div className="flex gap-4 overflow-x-auto pb-6 styled-scrollbar min-w-0">
        {COLUNAS_HUNTER.map((col) => {
          const cardsDaColuna = opportunities.filter((op) => op.status === col.id);

          return (
            <div
              key={col.id}
              className="flex flex-col rounded-2xl border border-border/70 bg-card/50 backdrop-blur-xs p-3.5 w-[300px] min-w-[300px] shrink-0 h-[720px] shadow-xs"
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
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-black shrink-0 ${col.badgeColor}`}>
                  {cardsDaColuna.length}
                </Badge>
              </div>

              {/* Lista de Cards com Scroll Interno */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 styled-scrollbar">
                {cardsDaColuna.map((item) => {
                  const valorFmt = item.valorPretendido.toLocaleString("pt-BR", {
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

                  return (
                    <div
                      key={item.id}
                      className="bg-background/90 border border-border/70 hover:border-amber-500/40 rounded-xl p-3 shadow-xs hover:shadow-md transition group"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeColor}`}
                        >
                          {badgeLabel}
                        </span>
                        <span className="text-xs font-black text-amber-500 dark:text-amber-400">{valorFmt}</span>
                      </div>

                      <h4 className="text-xs font-bold text-foreground line-clamp-2 mb-1 group-hover:text-amber-500 transition">
                        {item.titulo || `${item.tipoImovel} no ${item.bairro}`}
                      </h4>

                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-2">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {item.bairro} · {item.quartos || "?"}d · {item.vagas || "?"}v · {item.areaUtil ? `${item.areaUtil}m²` : ""}
                        </span>
                      </p>

                      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                        <div className="min-w-0 pr-1">
                          <p className="font-semibold text-foreground truncate">{item.proprietarioNome}</p>
                          <p className="text-[10px] text-muted-foreground">{item.proprietarioTelefone}</p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {item.proprietarioTelefone && (
                            <a
                              href={`https://wa.me/${item.proprietarioTelefone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition"
                              title="Abrir WhatsApp do Proprietário"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {item.linkAnuncio && (
                            <a
                              href={item.linkAnuncio}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition"
                              title="Ver anúncio original"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>

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
    </div>
  );
}
