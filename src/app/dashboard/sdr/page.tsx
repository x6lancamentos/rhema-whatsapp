"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Sparkles,
  Phone,
  ExternalLink,
  MessageSquare,
  Calendar,
  User,
  Home,
  Flame,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  Plus,
  Send,
  UserCheck,
  Check,
  Copy,
  ChevronRight,
  MapPin,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface SdrMessage {
  id: string;
  direction: "IN" | "OUT";
  content: string;
  modelUsed?: string;
  createdAt: string;
}

interface SdrConversation {
  id: string;
  role: "LEAD" | "OWNER";
  jid: string;
  phone: string;
  status: string;
  messages: SdrMessage[];
}

interface SdrLead {
  id: string;
  status: string;
  leadNome: string;
  leadPhone: string;
  leadJid: string;
  origem: string | null;
  codigoImovel: string | null;
  imovelSnapshot: any;
  observacoesCamila: string | null;
  pilares: any;
  temperatura: string | null;
  perfilExtraido: any;
  ownerPhone: string | null;
  ownerStatus: string | null;
  visitaDataHora: string | null;
  visitaImovel: string | null;
  imoviewAtendimento: number | null;
  corretorId: number | null;
  corretorNome: string | null;
  criterioDistribuicao: string | null;
  followupCount: number;
  nextFollowupAt: string | null;
  createdAt: string;
  updatedAt: string;
  conversations?: SdrConversation[];
}

interface SdrStats {
  totalHoje: number;
  emQualificacao: number;
  visitasAgendadas: number;
  contingencia: number;
  noShowsPrevenidos: number;
  taxaConversao: number;
}

const COLUNAS_KANBAN = [
  {
    id: "NOVOS",
    titulo: "Novos no Grupo",
    subtitulo: "Aguardando 1º contato ou fila matinal",
    statusList: ["NEW", "QUEUED_FOR_MORNING"],
    cor: "from-blue-500/10 to-indigo-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  {
    id: "QUALIFICANDO",
    titulo: "Em Qualificação",
    subtitulo: "4 Pilares no WhatsApp (Split + Digitação)",
    statusList: ["CONTACTED", "QUALIFYING"],
    cor: "from-amber-500/10 to-yellow-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  {
    id: "CONSULTA_PROPRIETARIO",
    titulo: "Consulta Proprietário",
    subtitulo: "Aguardando janelas de visita",
    statusList: ["AWAITING_OWNER"],
    cor: "from-purple-500/10 to-pink-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
    badge: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  },
  {
    id: "VISITA_AGENDADA",
    titulo: "Visita Agendada",
    subtitulo: "Horário marcado / Anti-No-Show ativo",
    statusList: ["SCHEDULING", "VISIT_CONFIRMED"],
    cor: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  {
    id: "COM_CORRETOR",
    titulo: "Com Corretor",
    subtitulo: "Imoview registrado + Transferido",
    statusList: ["CRM_REGISTERED", "HANDED_OFF"],
    cor: "from-cyan-500/10 to-blue-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400",
    badge: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  },
  {
    id: "CONTINGENCIA",
    titulo: "Contingência / Fim",
    subtitulo: "Alternativas ofertadas ou Dead-Deal CPR",
    statusList: ["NURTURE", "NO_RESPONSE", "HUMAN_TAKEOVER", "OPTED_OUT"],
    cor: "from-rose-500/10 to-red-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
    badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  },
];

export default function SdrKanbanPage() {
  const [leads, setLeads] = useState<SdrLead[]>([]);
  const [stats, setStats] = useState<SdrStats>({
    totalHoje: 0,
    emQualificacao: 0,
    visitasAgendadas: 0,
    contingencia: 0,
    noShowsPrevenidos: 0,
    taxaConversao: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroTemperatura, setFiltroTemperatura] = useState("ALL");
  const [filtroCorretor, setFiltroCorretor] = useState("ALL");
  const [selectedLead, setSelectedLead] = useState<SdrLead | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Carrega leads e métricas
  const carregarDados = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sdr/leads");
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
        if (data.stats) setStats(data.stats);
      } else {
        toast.error("Erro ao carregar leads: " + data.error);
      }
    } catch (err: any) {
      toast.error("Falha de conexão com a API do SDR.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    // Auto-refresh suave a cada 20 segundos
    const timer = setInterval(carregarDados, 20000);
    return () => clearInterval(timer);
  }, []);

  // Filtra leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchSearch =
        searchTerm === "" ||
        lead.leadNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.leadPhone.includes(searchTerm) ||
        (lead.codigoImovel && lead.codigoImovel.includes(searchTerm)) ||
        (lead.corretorNome && lead.corretorNome.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchTemp = filtroTemperatura === "ALL" || lead.temperatura === filtroTemperatura;
      const matchCorretor =
        filtroCorretor === "ALL" ||
        (lead.corretorNome && lead.corretorNome.toLowerCase().includes(filtroCorretor.toLowerCase()));

      return matchSearch && matchTemp && matchCorretor;
    });
  }, [leads, searchTerm, filtroTemperatura, filtroCorretor]);

  // Lista única de corretores para o filtro
  const listaCorretores = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.corretorNome) set.add(l.corretorNome);
    });
    return Array.from(set);
  }, [leads]);

  // Ação de mover status
  const moverStatus = async (leadId: string, novoStatus: string) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/sdr/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Status atualizado!");
        setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: novoStatus } : l)));
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead((prev) => (prev ? { ...prev, status: novoStatus } : null));
        }
      }
    } catch (e) {
      toast.error("Falha ao mover status.");
    } finally {
      setActionLoading(false);
    }
  };

  // Ação de forçar follow-up agora
  const forcarFollowup = async (leadId: string) => {
    try {
      setActionLoading(true);
      toast.info("Disparando toque de follow-up via WhatsApp...");
      const res = await fetch(`/api/sdr/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceFollowup: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Follow-up enviado com sucesso!");
        carregarDados();
      }
    } catch {
      toast.error("Erro ao forçar follow-up.");
    } finally {
      setActionLoading(false);
    }
  };

  const getTemperaturaColor = (temp: string | null) => {
    if (temp === "QUENTE") return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
    if (temp === "FRIO") return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
  };

  return (
    <div className="space-y-5 max-w-[1700px] mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Kanban Agêntico — Rhema SDR Autônomo
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  Online Coolify
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground">
                Qualificação humanizada nos 4 Pilares, agendamento com chave na mão, follow-up ativo e anti-no-show.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="gap-2 border-border/80 hover:bg-muted"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Atualizar
          </Button>
          <a
            href="https://web.whatsapp.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <Phone size={14} />
            WhatsApp Web
          </a>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <User size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Leads Hoje</p>
              <p className="text-xl font-black text-foreground">{stats.totalHoje}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <MessageSquare size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Qualificando</p>
              <p className="text-xl font-black text-foreground">{stats.emQualificacao}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Visitas Marcadas</p>
              <p className="text-xl font-black text-foreground">{stats.visitasAgendadas}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <Compass size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Conversão Visita</p>
              <p className="text-xl font-black text-foreground">{stats.taxaConversao}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Anti-No-Show</p>
              <p className="text-xl font-black text-foreground">{stats.noShowsPrevenidos}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Contingência/Fim</p>
              <p className="text-xl font-black text-foreground">{stats.contingencia}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card/50 p-3 rounded-xl border border-border/60">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, telefone, código de imóvel ou corretor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-background/80"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={filtroTemperatura} onValueChange={setFiltroTemperatura}>
            <SelectTrigger className="h-9 text-xs w-[130px]">
              <SelectValue placeholder="Temperatura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas Temp.</SelectItem>
              <SelectItem value="QUENTE">🔥 Quente</SelectItem>
              <SelectItem value="MORNO">🟡 Morno</SelectItem>
              <SelectItem value="FRIO">❄️ Frio</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroCorretor} onValueChange={setFiltroCorretor}>
            <SelectTrigger className="h-9 text-xs w-[140px]">
              <SelectValue placeholder="Corretor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos Corretores</SelectItem>
              {listaCorretores.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 6 Colunas do Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 items-start">
        {COLUNAS_KANBAN.map((col) => {
          const leadsDaColuna = filteredLeads.filter((l) => col.statusList.includes(l.status));

          return (
            <div key={col.id} className="flex flex-col rounded-xl bg-muted/40 border border-border/60 p-2.5 min-h-[600px]">
              {/* Cabeçalho da Coluna */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
                <div>
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    {col.titulo}
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-black ${col.badge}`}>
                      {leadsDaColuna.length}
                    </Badge>
                  </h3>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{col.subtitulo}</p>
                </div>
              </div>

              {/* Cards Container */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[750px] pr-1 styled-scrollbar">
                {leadsDaColuna.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-border/60 rounded-xl my-4 text-muted-foreground/60">
                    <p className="text-xs font-medium">Nenhum lead nesta etapa</p>
                  </div>
                ) : (
                  leadsDaColuna.map((lead) => {
                    const snap = lead.imovelSnapshot as any;
                    const pilares = lead.pilares || {};
                    const urlImovel = `https://www.rhemaimoveis.com.br/imovel/detalhes/${lead.codigoImovel || "6430"}`;
                    const whatsappDirectUrl = `https://wa.me/${lead.leadPhone.replace(/\D/g, "")}`;

                    return (
                      <div
                        key={lead.id}
                        className="bg-card hover:bg-card/90 transition-all duration-200 border border-border/70 rounded-xl p-3 shadow-2xs hover:shadow-xs group cursor-pointer flex flex-col gap-2 relative overflow-hidden"
                        onClick={() => {
                          setSelectedLead(lead);
                          setDetailModalOpen(true);
                        }}
                      >
                        {/* Top Card: Nome + Origem + Temperatura */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-foreground truncate group-hover:text-primary transition-colors">
                              {lead.leadNome}
                            </p>
                            <a
                              href={whatsappDirectUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1 mt-0.5"
                            >
                              <Phone size={10} />
                              {lead.leadPhone}
                            </a>
                          </div>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 uppercase ${getTemperaturaColor(lead.temperatura)}`}>
                            {lead.temperatura || "MORNO"}
                          </Badge>
                        </div>

                        {/* Imóvel Referência */}
                        <div className="bg-muted/50 rounded-lg p-2 text-[10px] flex items-center justify-between gap-1">
                          <div className="min-w-0 flex items-center gap-1.5 truncate">
                            <Home size={12} className="text-muted-foreground shrink-0" />
                            <span className="font-bold text-foreground truncate">#{lead.codigoImovel || "N/A"}</span>
                            <span className="text-muted-foreground truncate">{snap?.bairro || "Santos"}</span>
                          </div>
                          {lead.codigoImovel && (
                            <a
                              href={urlImovel}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline font-semibold shrink-0 inline-flex items-center gap-0.5 text-[9px]"
                              title="Abrir no portal Rhema"
                            >
                              Ver <ExternalLink size={10} />
                            </a>
                          )}
                        </div>

                        {/* Indicador dos 4 Pilares */}
                        <div className="grid grid-cols-4 gap-1 text-[8px] font-bold text-center">
                          <span
                            className={`rounded px-1 py-0.5 ${
                              pilares.finalidadeCompra ? "bg-emerald-500/20 text-emerald-600" : "bg-muted text-muted-foreground"
                            }`}
                            title="Pilar 1: Finalidade da Compra"
                          >
                            Fin. {pilares.finalidadeCompra ? "✓" : "–"}
                          </span>
                          <span
                            className={`rounded px-1 py-0.5 ${
                              pilares.aderenciaLocalizacao ? "bg-emerald-500/20 text-emerald-600" : "bg-muted text-muted-foreground"
                            }`}
                            title="Pilar 2: Aderência de Localização"
                          >
                            Bairro {pilares.aderenciaLocalizacao ? "✓" : "–"}
                          </span>
                          <span
                            className={`rounded px-1 py-0.5 ${
                              pilares.momentoCompraPrazo ? "bg-emerald-500/20 text-emerald-600" : "bg-muted text-muted-foreground"
                            }`}
                            title="Pilar 3: Prazo / Momento"
                          >
                            Prazo {pilares.momentoCompraPrazo ? "✓" : "–"}
                          </span>
                          <span
                            className={`rounded px-1 py-0.5 ${
                              pilares.condicaoFinanceira ? "bg-emerald-500/20 text-emerald-600" : "bg-muted text-muted-foreground"
                            }`}
                            title="Pilar 4: Condição Financeira / Crédito"
                          >
                            Créd. {pilares.condicaoFinanceira ? "✓" : "–"}
                          </span>
                        </div>

                        {/* Footer Card: Corretor + Follow-up Count */}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/40 pt-1.5 mt-0.5">
                          <span className="truncate max-w-[110px] font-medium text-foreground/80 flex items-center gap-1">
                            <UserCheck size={11} className="text-primary shrink-0" />
                            {lead.corretorNome ? lead.corretorNome.split(" ")[0] : "Fila..."}
                          </span>

                          <span className="shrink-0 text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {lead.followupCount > 0 ? `Follow ${lead.followupCount}/3` : "Ativo"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Raio-X Detalhado do Lead */}
      {selectedLead && (
        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
            <DialogHeader className="border-b border-border/60 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
                    {selectedLead.leadNome}
                    <Badge variant="outline" className={`text-xs ${getTemperaturaColor(selectedLead.temperatura)}`}>
                      {selectedLead.temperatura || "MORNO"}
                    </Badge>
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Origem: <span className="font-semibold text-foreground">{selectedLead.origem || "Portal"}</span> · Telefone:{" "}
                    <span className="font-semibold text-foreground">{selectedLead.leadPhone}</span>
                  </p>
                </div>

                <a
                  href={`https://wa.me/${selectedLead.leadPhone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shrink-0"
                >
                  <Phone size={13} />
                  Abrir WhatsApp
                </a>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1 styled-scrollbar">
              {/* Imóvel e Link Oficial */}
              <div className="bg-muted/40 p-3 rounded-xl border border-border/60 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Home size={14} className="text-primary" />
                    Imóvel de Interesse: #{selectedLead.codigoImovel || "N/A"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {(selectedLead.imovelSnapshot as any)?.tipo || "Apartamento"} no{" "}
                    {(selectedLead.imovelSnapshot as any)?.bairro || "Santos"} · Valor:{" "}
                    {(selectedLead.imovelSnapshot as any)?.valor || "Consulte"}
                  </p>
                </div>

                {selectedLead.codigoImovel && (
                  <a
                    href={`https://www.rhemaimoveis.com.br/imovel/detalhes/${selectedLead.codigoImovel}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-lg border border-primary/20 shrink-0"
                  >
                    Ver Imóvel Rhema <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {/* Status de Fila e Corretor Titular */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border/60 rounded-xl p-3 bg-card/40">
                  <p className="text-[11px] font-medium text-muted-foreground">Corretor Atribuído</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">
                    {selectedLead.corretorNome || "Ainda na fila"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Critério: {selectedLead.criterioDistribuicao || "RODÍZIO"}</p>
                </div>

                <div className="border border-border/60 rounded-xl p-3 bg-card/40">
                  <p className="text-[11px] font-medium text-muted-foreground">Status Atual no Pipeline</p>
                  <Select
                    value={selectedLead.status}
                    onValueChange={(val) => moverStatus(selectedLead.id, val)}
                    disabled={actionLoading}
                  >
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">Novo no Grupo</SelectItem>
                      <SelectItem value="QUEUED_FOR_MORNING">Fila Matinal (07:45)</SelectItem>
                      <SelectItem value="CONTACTED">Contato Inicial Feito</SelectItem>
                      <SelectItem value="QUALIFYING">Em Qualificação</SelectItem>
                      <SelectItem value="AWAITING_OWNER">Consulta Proprietário</SelectItem>
                      <SelectItem value="SCHEDULING">Agendando Visita</SelectItem>
                      <SelectItem value="VISIT_CONFIRMED">Visita Confirmada</SelectItem>
                      <SelectItem value="HANDED_OFF">Entregue ao Corretor</SelectItem>
                      <SelectItem value="NURTURE">Contingência / Alternativas</SelectItem>
                      <SelectItem value="NO_RESPONSE">Sem Resposta (CPR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Histórico Recente de Mensagens WhatsApp */}
              <div className="border border-border/60 rounded-xl p-3 bg-muted/20 space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>💬 Histórico de Mensagens WhatsApp</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => forcarFollowup(selectedLead.id)}
                    disabled={actionLoading}
                  >
                    ⚡ Forçar Follow-up Agora
                  </Button>
                </h4>

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 styled-scrollbar">
                  {selectedLead.conversations && selectedLead.conversations.length > 0 ? (
                    selectedLead.conversations[0]?.messages?.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-2 rounded-lg text-xs ${
                          msg.direction === "OUT"
                            ? "bg-primary/10 border border-primary/20 ml-6 text-foreground"
                            : "bg-card border border-border/60 mr-6 text-foreground"
                        }`}
                      >
                        <p className="font-medium">{msg.content}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5 text-right">
                          {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">Sem mensagens gravadas ainda.</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border/60 pt-3 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">ID: {selectedLead.id}</span>
              <Button variant="outline" size="sm" onClick={() => setDetailModalOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

