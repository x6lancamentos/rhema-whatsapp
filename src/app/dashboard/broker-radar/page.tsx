"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Compass,
  RefreshCw,
  Send,
  Building2,
  Users,
  Clock,
  Sparkles,
  Search,
  Phone,
  Home,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Flame,
  CheckCheck,
  Calendar,
  Layers,
  ArrowRight,
  User,
  Activity,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { formatPhone } from "@/lib/phone-formatter";

interface RadarProperty {
  codigo: string;
  titulo: string;
  tipo: string;
  finalidade: string;
  valor: string;
  valorNumerico: number;
  valorCondominio?: string;
  valorIptu?: string;
  bairro: string;
  cidade: string;
  quartos?: number;
  vagas?: number;
  suites?: number;
  diasNoEstoque: number;
  captadorNome?: string;
  captadorCodigo?: string;
  fotoPrincipal?: string;
  linkImovel?: string;
}

interface RadarLead {
  atendimentoId: string;
  clienteId?: string;
  clienteNome: string;
  telefone: string;
  corretorNome?: string;
  corretorCodigo?: string;
  tipoImovel?: string;
  bairroInteresse?: string;
  cidadeInteresse?: string;
  valorInteresse?: string;
  valorNumerico?: number;
  quartos?: number;
  termometro?: string;
  diasSemContato: number;
  dataUltimoContato?: string;
  ultimoHistorico?: string;
  statusAtendimento?: string;
  temVisitaAgendada?: boolean;
  temProposta?: boolean;
}

interface RadarMatch {
  id: string;
  score: number;
  reasons: string[];
  property: RadarProperty;
  lead: RadarLead;
  corretorNome: string;
  corretorCodigo: string;
}

interface BrokerCadenceItem {
  corretorCodigo: string;
  corretorNome: string;
  corretorTelefone?: string;
  atendimentosAtivos: number;
  atividadesVencidas: number;
  atividadesHoje: number;
  atividadesFuturas: number;
  atividadesConcluidas: number;
  leadsSemContatoMais7Dias: number;
  statusSla: "CRITICO" | "ATENCAO" | "EM_DIA";
  ultimasAtividades: Array<{
    codigo: number;
    titulo: string;
    tipo: string;
    dataHora: string;
    leadNome?: string;
    imovelCodigo?: number;
    realizada: boolean;
    atrasada: boolean;
  }>;
}

interface BrokerContact {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  imoviewCodigo?: string | null;
  equipe?: string | null;
  ativo: boolean;
  observacoes?: string | null;
  createdAt: string;
}

interface SessionOption {
  id: string;
  sessionId: string;
  name: string;
  status: string;
  userName?: string;
}

export default function BrokerRadarPage() {
  const { data: authSession } = useSession();
  // @ts-ignore
  const userRole = authSession?.user?.role || "CORRETOR";
  const isManager = userRole === "SUPERADMIN" || userRole === "ADMIN" || userRole === "OWNER";

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"matches" | "corretores" | "cadencia" | "lista">("matches");

  // Filter States
  const [diasEstoque, setDiasEstoque] = useState(7);
  const [leadMode, setLeadMode] = useState<"hot_7days" | "all_active">("hot_7days");
  const [bairroFiltro, setBairroFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [corretorFiltro, setCorretorFiltro] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Data States
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingCadence, setLoadingCadence] = useState(false);
  const [loadingBrokers, setLoadingBrokers] = useState(false);
  const [matches, setMatches] = useState<RadarMatch[]>([]);
  const [properties, setProperties] = useState<RadarProperty[]>([]);
  const [leads, setLeads] = useState<RadarLead[]>([]);
  const [cadenceList, setCadenceList] = useState<BrokerCadenceItem[]>([]);
  const [cadenceSummary, setCadenceSummary] = useState<any>(null);
  const [brokerContacts, setBrokerContacts] = useState<BrokerContact[]>([]);

  // WhatsApp Sessions State
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // WhatsApp Dispatch Modal State
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchTargetBroker, setDispatchTargetBroker] = useState<{ nome: string; telefone: string } | null>(null);
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [dispatchType, setDispatchType] = useState<"radar" | "cadence" | "custom">("radar");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Broker Contact Modal State (Create / Edit)
  const [brokerModalOpen, setBrokerModalOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState<BrokerContact | null>(null);
  const [brokerForm, setBrokerForm] = useState({
    nome: "",
    telefone: "",
    email: "",
    imoviewCodigo: "",
    equipe: "Vendas",
    ativo: true,
    observacoes: "",
  });
  const [savingBroker, setSavingBroker] = useState(false);
  const [syncingImoview, setSyncingImoview] = useState(false);

  // 1. Carregar Sessões de WhatsApp disponíveis e definir a padrão (Brunno)
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const d = await res.json();
        const list: SessionOption[] = d.data || [];
        setSessions(list);

        // Identificar sessão padrão do Brunno
        const brunnoSession = list.find(
          (s) =>
            s.name.toLowerCase().includes("brunno") ||
            (s.userName && s.userName.toLowerCase().includes("brunno"))
        );
        const connectedSession = list.find((s) => s.status === "CONNECTED");

        if (brunnoSession) {
          setSelectedSessionId(brunnoSession.sessionId);
        } else if (connectedSession) {
          setSelectedSessionId(connectedSession.sessionId);
        } else if (list.length > 0) {
          setSelectedSessionId(list[0].sessionId);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar sessões:", err);
    }
  }, []);

  // 2. Carregar Lista Específica de Corretores
  const loadBrokerContacts = useCallback(async () => {
    try {
      setLoadingBrokers(true);
      const res = await fetch("/api/broker-contacts");
      if (res.ok) {
        const d = await res.json();
        setBrokerContacts(d.data || []);
      }
    } catch (err) {
      console.error("Erro ao carregar lista de corretores:", err);
    } finally {
      setLoadingBrokers(false);
    }
  }, []);

  // 3. Carregar Matches de Estoque e Leads
  const loadMatches = useCallback(async () => {
    try {
      setLoadingMatches(true);
      const params = new URLSearchParams();
      params.set("diasEstoque", String(diasEstoque));
      params.set("leadMode", leadMode);
      if (bairroFiltro) params.set("bairro", bairroFiltro);
      if (tipoFiltro) params.set("tipo", tipoFiltro);
      if (corretorFiltro) params.set("corretorCodigo", corretorFiltro);

      const res = await fetch(`/api/integrations/imoview/broker-radar/matches?${params.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setMatches(d.data?.matches || []);
        setProperties(d.data?.properties || []);
        setLeads(d.data?.leads || []);
      } else {
        toast.error("Não foi possível carregar os dados da API do Imoview.");
      }
    } catch (err: any) {
      toast.error(`Erro ao carregar matches: ${err.message}`);
    } finally {
      setLoadingMatches(false);
    }
  }, [diasEstoque, leadMode, bairroFiltro, tipoFiltro, corretorFiltro]);

  // 4. Carregar Cadência e SLA de Atividades
  const loadCadence = useCallback(async () => {
    try {
      setLoadingCadence(true);
      const res = await fetch("/api/integrations/imoview/broker-radar/cadence");
      if (res.ok) {
        const d = await res.json();
        setCadenceList(d.data?.cadence || []);
        setCadenceSummary(d.data?.summary || null);
      }
    } catch (err: any) {
      console.error("Erro ao carregar cadência:", err);
    } finally {
      setLoadingCadence(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadBrokerContacts();
    loadMatches();
    loadCadence();
  }, [loadSessions, loadBrokerContacts, loadMatches, loadCadence]);

  // Mapa de telefones de corretores cadastrados para lookup rápido
  const brokerPhoneMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of brokerContacts) {
      if (b.telefone) {
        if (b.imoviewCodigo) map.set(b.imoviewCodigo, b.telefone);
        map.set(b.nome.toLowerCase().trim(), b.telefone);
      }
    }
    return map;
  }, [brokerContacts]);

  // Resolver telefone do corretor
  const getBrokerPhone = useCallback(
    (corretorNome: string, corretorCodigo?: string) => {
      if (corretorCodigo && brokerPhoneMap.has(corretorCodigo)) {
        return brokerPhoneMap.get(corretorCodigo)!;
      }
      const lower = corretorNome.toLowerCase().trim();
      if (brokerPhoneMap.has(lower)) {
        return brokerPhoneMap.get(lower)!;
      }
      return "";
    },
    [brokerPhoneMap]
  );

  // Lista única de corretores presentes nos matches
  const uniqueBrokersInMatches = useMemo(() => {
    const map = new Map<string, { nome: string; codigo: string; count: number }>();
    for (const m of matches) {
      const cod = m.corretorCodigo || m.corretorNome;
      if (!map.has(cod)) {
        map.set(cod, { nome: m.corretorNome, codigo: m.corretorCodigo, count: 0 });
      }
      map.get(cod)!.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [matches]);

  // Filtragem de Matches pela barra de pesquisa
  const filteredMatches = useMemo(() => {
    if (!searchTerm) return matches;
    const q = searchTerm.toLowerCase();
    return matches.filter(
      (m) =>
        m.property.codigo.includes(q) ||
        m.property.bairro.toLowerCase().includes(q) ||
        m.property.tipo.toLowerCase().includes(q) ||
        m.lead.clienteNome.toLowerCase().includes(q) ||
        m.corretorNome.toLowerCase().includes(q)
    );
  }, [matches, searchTerm]);

  // Abertura do modal de envio de Match individual
  const handleOpenDispatchMatch = (match: RadarMatch) => {
    const phone = getBrokerPhone(match.corretorNome, match.corretorCodigo);
    setDispatchTargetBroker({
      nome: match.corretorNome,
      telefone: phone,
    });
    setDispatchType("radar");

    const firstName = match.corretorNome.split(" ")[0];
    const text = `🎯 *Radar de Oportunidades Rhema* - Fala ${firstName}!\n\n` +
      `Acabou de entrar uma novidade no estoque com *${match.score}% de afinidade* com o seu cliente quente:\n\n` +
      `🏢 *Imóvel #${match.property.codigo} - ${match.property.tipo} em ${match.property.bairro}*\n` +
      `💰 *Valor:* ${match.property.valor}${match.property.valorCondominio ? ` | Cond: ${match.property.valorCondominio}` : ""}\n` +
      `🛏️ *Dormitórios:* ${match.property.quartos || "Sob consulta"}\n` +
      `👤 *Lead Compatível:* *${match.lead.clienteNome}* (${match.lead.telefone})\n` +
      `🔗 *Link do Imóvel:* ${match.property.linkImovel}\n\n` +
      `💡 *Por que faz sentido:* ${match.reasons.join(" • ")}\n\n` +
      `Bora acionar esse cliente agora em primeira mão? Qualquer apoio na negociação, conta comigo! 👊`;

    setDispatchMessage(text);
    setDispatchModalOpen(true);
  };

  // Abertura do modal de envio de Dossiê Completo de um Corretor
  const handleOpenDispatchBrokerPipeline = (corretor: { nome: string; codigo: string }) => {
    const brokerMatches = matches.filter(
      (m) => (m.corretorCodigo && m.corretorCodigo === corretor.codigo) || m.corretorNome === corretor.nome
    );
    const phone = getBrokerPhone(corretor.nome, corretor.codigo);

    setDispatchTargetBroker({
      nome: corretor.nome,
      telefone: phone,
    });
    setDispatchType("radar");

    const firstName = corretor.nome.split(" ")[0];
    let text = `🚀 *Radar do Dia Rhema* - Bom dia, ${firstName}!\n\n` +
      `Analisei as novidades do estoque e temos *${brokerMatches.length} matches perfeitos* para a sua carteira quente:\n\n`;

    brokerMatches.slice(0, 4).forEach((m, idx) => {
      text += `🔥 *${idx + 1}. Imóvel #${m.property.codigo} - ${m.property.bairro} (${m.property.valor})*\n` +
        `   • Match: *${m.score}%* com seu cliente *${m.lead.clienteNome}*\n` +
        `   • Link: ${m.property.linkImovel}\n\n`;
    });

    text += `Bora focar nesses contatos pela manhã? Se precisar de apoio na visita ou proposta, só me chamar! 👊`;

    setDispatchMessage(text);
    setDispatchModalOpen(true);
  };

  // Abertura do modal de cobrança/suporte de cadência
  const handleOpenDispatchCadence = (cadenceItem: BrokerCadenceItem) => {
    const phone = cadenceItem.corretorTelefone || getBrokerPhone(cadenceItem.corretorNome, cadenceItem.corretorCodigo);
    setDispatchTargetBroker({
      nome: cadenceItem.corretorNome,
      telefone: phone,
    });
    setDispatchType("cadence");

    const firstName = cadenceItem.corretorNome.split(" ")[0];
    let text = `👋 Fala *${firstName}*, tudo bem?\n\n` +
      `Passando pelo alinhamento diário de atividades no CRM Imoview:\n\n`;

    if (cadenceItem.atividadesVencidas > 0) {
      text += `⚠️ Temos *${cadenceItem.atividadesVencidas} atividade(s) pendente(s)/atrasada(s)* aguardando atualização na sua agenda.\n`;
    }
    if (cadenceItem.leadsSemContatoMais7Dias > 0) {
      text += `⏳ Identifiquei *${cadenceItem.leadsSemContatoMais7Dias} lead(s) em atendimento* sem registro de contato há mais de 7 dias.\n`;
    }

    if (cadenceItem.ultimasAtividades && cadenceItem.ultimasAtividades.length > 0) {
      text += `\n📌 *Destaques de retorno:*\n`;
      cadenceItem.ultimasAtividades.slice(0, 3).forEach((atv) => {
        text += ` • ${atv.titulo}${atv.leadNome ? ` (${atv.leadNome})` : ""}\n`;
      });
    }

    text += `\nBora atualizar esses retornos hoje até as 14h? Se precisar de alguma ajuda em qualquer negociação, estou por aqui! 🚀`;

    setDispatchMessage(text);
    setDispatchModalOpen(true);
  };

  // Envio da mensagem via WhatsApp
  const handleSendMessage = async () => {
    if (!dispatchTargetBroker?.telefone) {
      toast.error("O corretor não possui telefone cadastrado. Cadastre o telefone na aba 'Lista de Corretores'.");
      return;
    }
    if (!selectedSessionId) {
      toast.error("Selecione uma sessão do WhatsApp para enviar.");
      return;
    }

    try {
      setSendingMessage(true);
      const res = await fetch("/api/integrations/imoview/broker-radar/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          telefone: dispatchTargetBroker.telefone,
          corretorNome: dispatchTargetBroker.nome,
          mensagem: dispatchMessage,
          tipo: dispatchType,
        }),
      });

      const d = await res.json();
      if (res.ok && d.status) {
        toast.success(`Mensagem enviada com sucesso para ${dispatchTargetBroker.nome}!`);
        setDispatchModalOpen(false);
      } else {
        toast.error(d.message || "Erro ao enviar mensagem pelo WhatsApp.");
      }
    } catch (err: any) {
      toast.error(`Falha no envio: ${err.message}`);
    } finally {
      setSendingMessage(false);
    }
  };

  // Criar ou Editar Corretor na Lista
  const handleSaveBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brokerForm.nome || !brokerForm.telefone) {
      toast.error("Nome e Telefone são obrigatórios!");
      return;
    }

    try {
      setSavingBroker(true);
      const url = editingBroker ? `/api/broker-contacts/${editingBroker.id}` : "/api/broker-contacts";
      const method = editingBroker ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brokerForm),
      });

      const d = await res.json();
      if (res.ok && d.status) {
        toast.success(editingBroker ? "Corretor atualizado!" : "Corretor cadastrado com sucesso!");
        setBrokerModalOpen(false);
        loadBrokerContacts();
      } else {
        toast.error(d.message || "Erro ao salvar corretor.");
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSavingBroker(false);
    }
  };

  // Excluir Corretor
  const handleDeleteBroker = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja remover ${nome} da lista de contatos de corretores?`)) return;

    try {
      const res = await fetch(`/api/broker-contacts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Corretor removido.");
        loadBrokerContacts();
      } else {
        toast.error("Erro ao excluir corretor.");
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  // Sincronizar Corretores da API do Imoview
  const handleSyncImoview = async () => {
    try {
      setSyncingImoview(true);
      const res = await fetch("/api/broker-contacts/sync-imoview", { method: "POST" });
      const d = await res.json();
      if (res.ok && d.status) {
        toast.success(d.message);
        loadBrokerContacts();
      } else {
        toast.error(d.message || "Falha na sincronização.");
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSyncingImoview(false);
    }
  };

  // Bloqueio de Segurança para Não-Gestores
  if (!isManager) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center p-6 text-center">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 max-w-md shadow-2xl backdrop-blur-md">
          <ShieldCheck className="h-16 w-16 text-red-500 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-foreground">Acesso Exclusivo à Gestão</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            O <strong>Cockpit de Suporte ao Corretor & Radar de Negócios</strong> é de acesso estrito do Gestor
            Comercial (Brunno / Administradores). Caso necessite de apoio, consulte seu gestor de equipe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      {/* Top Header Executive Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white">
              <Compass className="h-5 w-5 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
                Suporte a Corretores & Radar de Oportunidades
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Inteligência de estoque, cruzamento em tempo real de leads quentes e cadência de corretores via API Imoview.
              </p>
            </div>
          </div>
        </div>

        {/* Header Quick Controls & Session Picker */}
        <div className="flex flex-wrap items-center gap-3">
          {/* WhatsApp Session Selector */}
          <div className="flex items-center gap-2 bg-card/60 backdrop-blur-md border border-border/60 rounded-lg px-3 py-1.5 shadow-sm">
            <Phone className="h-4 w-4 text-emerald-500" />
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                WhatsApp de Disparo:
              </span>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                {sessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId} className="bg-popover text-foreground">
                    {s.name} ({s.status === "CONNECTED" ? "Online" : "Offline"})
                    {s.name.toLowerCase().includes("brunno") ? " ⭐ (Brunno Padrão)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadMatches();
              loadCadence();
              loadBrokerContacts();
            }}
            disabled={loadingMatches || loadingCadence}
            className="gap-2 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loadingMatches || loadingCadence ? "animate-spin text-amber-500" : ""}`} />
            Sincronizar API
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Matches de Ouro</p>
              <h3 className="text-2xl font-black text-amber-500 mt-1">{matches.length}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Estoque Novo ⟷ Leads</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-card to-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Novos Imóveis</p>
              <h3 className="text-2xl font-black text-blue-500 mt-1">{properties.length}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Últimos {diasEstoque} dias no estoque</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {leadMode === "hot_7days" ? "Leads Quentes (7d)" : "Leads em Andamento"}
              </p>
              <h3 className="text-2xl font-black text-emerald-500 mt-1">{leads.length}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Aptos a comprar</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Flame className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-red-500/20 bg-gradient-to-br from-red-500/10 via-card to-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Atividades Vencidas</p>
              <h3 className="text-2xl font-black text-red-500 mt-1">
                {cadenceSummary?.totalAtividadesVencidas ?? 0}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Pendências no CRM Imoview</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-xl border border-border/50 grid grid-cols-2 md:grid-cols-4 max-w-3xl">
          <TabsTrigger value="matches" className="gap-2 rounded-lg data-[state=active]:bg-background shadow-sm">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Radar de Matches</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {matches.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger value="corretores" className="gap-2 rounded-lg data-[state=active]:bg-background shadow-sm">
            <Users className="h-4 w-4 text-blue-500" />
            <span>Por Corretor</span>
          </TabsTrigger>

          <TabsTrigger value="cadencia" className="gap-2 rounded-lg data-[state=active]:bg-background shadow-sm">
            <Clock className="h-4 w-4 text-emerald-500" />
            <span>Cadência & SLA</span>
            {cadenceSummary?.criticos > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0 h-4 animate-pulse">
                {cadenceSummary.criticos}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="lista" className="gap-2 rounded-lg data-[state=active]:bg-background shadow-sm">
            <UserCheck className="h-4 w-4 text-purple-500" />
            <span>Lista de Corretores</span>
            <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {brokerContacts.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* TAB 1: RADAR DE MATCHES (ESTOQUE NOVO ⟷ LEADS QUENTES)        */}
        {/* ============================================================== */}
        <TabsContent value="matches" className="space-y-6">
          {/* Filtros da Barra Superior */}
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Modos de Leads: 7 Dias vs Todos em Andamento */}
                <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-lg border border-border/50">
                  <button
                    onClick={() => setLeadMode("hot_7days")}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      leadMode === "hot_7days"
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Flame className="h-3.5 w-3.5" />
                    🔥 Quentes (últimos 7 dias)
                  </button>
                  <button
                    onClick={() => setLeadMode("all_active")}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      leadMode === "all_active"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    ⚡ Todos em Andamento (Pipeline)
                  </button>
                </div>

                {/* Filtro Janela de Dias de Estoque */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Janela do Estoque:</span>
                  <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/40">
                    {[3, 7, 15, 30].map((d) => (
                      <button
                        key={d}
                        onClick={() => setDiasEstoque(d)}
                        className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                          diasEstoque === d
                            ? "bg-foreground text-background font-bold shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Filtros de Busca Textual e Bairro */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-border/40">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por código do imóvel, bairro, cliente ou corretor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>

                <div>
                  <Input
                    placeholder="Filtrar Bairro (ex: Gonzaga)..."
                    value={bairroFiltro}
                    onChange={(e) => setBairroFiltro(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div>
                  <select
                    value={corretorFiltro}
                    onChange={(e) => setCorretorFiltro(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none"
                  >
                    <option value="">Todos os Corretores</option>
                    {uniqueBrokersInMatches.map((b) => (
                      <option key={b.codigo} value={b.codigo}>
                        {b.nome} ({b.count} matches)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Matches */}
          {loadingMatches ? (
            <div className="flex flex-col items-center justify-center p-16 space-y-4">
              <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
              <p className="text-sm font-medium text-muted-foreground">
                Cruzando novos imóveis do estoque com leads quentes no CRM Imoview...
              </p>
            </div>
          ) : filteredMatches.length === 0 ? (
            <Card className="border border-dashed border-border/70 p-12 text-center">
              <Compass className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="text-lg font-semibold text-foreground">Nenhuma combinação encontrada</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                Tente alterar a janela de dias de estoque ou alternar para o modo "Todos em Andamento" para ampliar a
                busca.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredMatches.map((match) => {
                const brokerPhone = getBrokerPhone(match.corretorNome, match.corretorCodigo);

                return (
                  <Card
                    key={match.id}
                    className="border border-border/60 hover:border-amber-500/40 transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md bg-card/90"
                  >
                    {/* Header do Card com Score */}
                    <div className="bg-muted/40 px-4 py-2.5 border-b border-border/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide ${
                            match.score >= 90
                              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              : match.score >= 75
                              ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                              : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>{match.score}% MATCH</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                          Entrou há {match.property.diasNoEstoque}d no estoque
                        </span>
                      </div>

                      <Badge variant="outline" className="text-[11px] gap-1 font-semibold">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {match.corretorNome}
                      </Badge>
                    </div>

                    <CardContent className="p-4 space-y-4">
                      {/* Split Grid: Imóvel vs Lead */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-border/60">
                        {/* Lado Esquerdo: Imóvel Novo */}
                        <div className="space-y-2 pr-0 md:pr-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <Badge className="bg-amber-500 text-white font-bold text-[10px] mb-1">
                                Imóvel #{match.property.codigo}
                              </Badge>
                              <h4 className="text-sm font-bold text-foreground leading-snug">
                                {match.property.tipo} em {match.property.bairro}
                              </h4>
                            </div>
                            <span className="text-sm font-extrabold text-foreground">{match.property.valor}</span>
                          </div>

                          <div className="text-xs text-muted-foreground space-y-1">
                            {match.property.quartos && (
                              <p className="flex items-center gap-1.5">
                                <Home className="h-3.5 w-3.5 text-muted-foreground" />
                                {match.property.quartos} quartos
                                {match.property.vagas ? ` • ${match.property.vagas} vagas` : ""}
                              </p>
                            )}
                            {match.property.valorCondominio && (
                              <p className="text-[11px]">Cond: {match.property.valorCondominio}</p>
                            )}
                            {match.property.captadorNome && (
                              <p className="text-[10px] text-muted-foreground/80">
                                Captação: <strong>{match.property.captadorNome}</strong>
                              </p>
                            )}
                          </div>

                          {match.property.linkImovel && (
                            <a
                              href={match.property.linkImovel}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500 hover:underline pt-1"
                            >
                              Ver no Site Rhema <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>

                        {/* Lado Direito: Lead Quente */}
                        <div className="space-y-2 pt-3 md:pt-0 pl-0 md:pl-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <Badge variant="secondary" className="text-[10px] mb-1 font-semibold">
                                Lead Quente #{match.lead.atendimentoId}
                              </Badge>
                              <h4 className="text-sm font-bold text-foreground">{match.lead.clienteNome}</h4>
                            </div>
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {match.lead.diasSemContato === 0
                                ? "Contato Hoje"
                                : `${match.lead.diasSemContato}d sem contato`}
                            </span>
                          </div>

                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>
                              Interesse:{" "}
                              <strong>
                                {match.lead.tipoImovel || "Imóvel"} em {match.lead.bairroInteresse || "Santos"}
                              </strong>
                            </p>
                            {match.lead.valorInteresse && (
                              <p>
                                Orçamento: <strong>{match.lead.valorInteresse}</strong>
                              </p>
                            )}
                            <p className="text-[11px] truncate italic text-muted-foreground/90">
                              "{match.lead.ultimoHistorico}"
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Motivos do Match (Pills) */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {match.reasons.map((r, i) => (
                          <span
                            key={i}
                            className="bg-muted/70 text-muted-foreground text-[10px] font-medium px-2 py-0.5 rounded border border-border/50"
                          >
                            ✓ {r}
                          </span>
                        ))}
                      </div>

                      {/* Botão de Disparo para o Corretor */}
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          {brokerPhone ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              ✓ WhatsApp: {formatPhone(brokerPhone)}
                            </span>
                          ) : (
                            <span className="text-amber-500 font-medium">⚠️ Telefone do corretor não cadastrado</span>
                          )}
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleOpenDispatchMatch(match)}
                          className="gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-md shadow-amber-500/20"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Disparar para Corretor
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 2: PIPELINE INDIVIDUAL POR CORRETOR                       */}
        {/* ============================================================== */}
        <TabsContent value="corretores" className="space-y-6">
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Dossiês & Oportunidades por Corretor
              </CardTitle>
              <CardDescription className="text-xs">
                Selecione qualquer corretor do time para despachar um resumo completo com os melhores matches de hoje
                direto no WhatsApp dele.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uniqueBrokersInMatches.map((broker) => {
                  const brokerMatches = matches.filter(
                    (m) => (m.corretorCodigo && m.corretorCodigo === broker.codigo) || m.corretorNome === broker.nome
                  );
                  const phone = getBrokerPhone(broker.nome, broker.codigo);

                  return (
                    <Card key={broker.codigo} className="border border-border/60 hover:shadow-md transition-all">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-foreground">{broker.nome}</h4>
                            <p className="text-[11px] text-muted-foreground">
                              {phone ? formatPhone(phone) : "Sem telefone"}
                            </p>
                          </div>
                          <Badge className="bg-amber-500 text-white font-bold text-xs">
                            {brokerMatches.length} matches
                          </Badge>
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground pt-1 border-t border-border/40">
                          {brokerMatches.slice(0, 3).map((bm, i) => (
                            <p key={i} className="truncate">
                              • #{bm.property.codigo} ({bm.property.bairro}) ➔ {bm.lead.clienteNome}
                            </p>
                          ))}
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleOpenDispatchBrokerPipeline(broker)}
                          className="w-full gap-2 text-xs font-semibold bg-primary text-primary-foreground mt-2"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Enviar Dossiê via WhatsApp
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 3: CADÊNCIA & SLA DE ATIVIDADES (API IMOVIEW)              */}
        {/* ============================================================== */}
        <TabsContent value="cadencia" className="space-y-6">
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-emerald-500" />
                  Acompanhamento de Cadência & SLA dos Corretores
                </CardTitle>
                <CardDescription className="text-xs">
                  Dados em tempo real extraídos da API do Imoview (/Agenda/RetornarAtividades). Monitore atrasos e cobre
                  cadência com 1 clique.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadCadence} disabled={loadingCadence} className="gap-2">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingCadence ? "animate-spin text-emerald-500" : ""}`} />
                Atualizar Agenda
              </Button>
            </CardHeader>

            <CardContent>
              {loadingCadence ? (
                <div className="p-12 text-center text-muted-foreground">
                  <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin mx-auto mb-2" />
                  <p className="text-xs">Buscando atividades na agenda do Imoview...</p>
                </div>
              ) : cadenceList.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhuma atividade encontrada no período selecionado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-3">Corretor</th>
                        <th className="py-3 px-2 text-center">Atendimentos Ativos</th>
                        <th className="py-3 px-2 text-center text-red-500">Atividades Atrasadas</th>
                        <th className="py-3 px-2 text-center text-amber-500">Para Hoje</th>
                        <th className="py-3 px-2 text-center">Sem Contato (+7d)</th>
                        <th className="py-3 px-2 text-center">Status SLA</th>
                        <th className="py-3 px-3 text-right">Ação de Suporte</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {cadenceList.map((c) => {
                        return (
                          <tr key={c.corretorCodigo} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-3">
                              <p className="font-bold text-foreground text-xs">{c.corretorNome}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {c.corretorTelefone ? formatPhone(c.corretorTelefone) : "Sem telefone"}
                              </p>
                            </td>

                            <td className="py-3 px-2 text-center font-semibold">{c.atendimentosAtivos}</td>

                            <td className="py-3 px-2 text-center">
                              {c.atividadesVencidas > 0 ? (
                                <Badge variant="destructive" className="font-bold">
                                  {c.atividadesVencidas} ⚠️
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground font-medium">0</span>
                              )}
                            </td>

                            <td className="py-3 px-2 text-center font-semibold text-amber-500">{c.atividadesHoje}</td>

                            <td className="py-3 px-2 text-center">
                              {c.leadsSemContatoMais7Dias > 0 ? (
                                <span className="text-amber-500 font-bold">{c.leadsSemContatoMais7Dias}</span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </td>

                            <td className="py-3 px-2 text-center">
                              {c.statusSla === "CRITICO" ? (
                                <Badge className="bg-red-500 text-white font-bold text-[10px]">🔴 Crítico</Badge>
                              ) : c.statusSla === "ATENCAO" ? (
                                <Badge className="bg-amber-500 text-white font-bold text-[10px]">🟡 Atenção</Badge>
                              ) : (
                                <Badge className="bg-emerald-500 text-white font-bold text-[10px]">🟢 Em Dia</Badge>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenDispatchCadence(c)}
                                className="gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30"
                              >
                                <Send className="h-3 w-3" />
                                Cobrar Cadência
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 4: LISTA ESPECÍFICA DE CORRETORES (CADASTRO E CONTATOS)   */}
        {/* ============================================================== */}
        <TabsContent value="lista" className="space-y-6">
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-purple-500" />
                  Lista & Cadastro de Corretores
                </CardTitle>
                <CardDescription className="text-xs">
                  Cadastre e mantenha registrado o nome, telefone de WhatsApp e código Imoview de cada corretor da
                  equipe.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncImoview}
                  disabled={syncingImoview}
                  className="gap-2 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncingImoview ? "animate-spin" : ""}`} />
                  Sincronizar com Imoview
                </Button>

                <Button
                  size="sm"
                  onClick={() => {
                    setEditingBroker(null);
                    setBrokerForm({
                      nome: "",
                      telefone: "",
                      email: "",
                      imoviewCodigo: "",
                      equipe: "Vendas",
                      ativo: true,
                      observacoes: "",
                    });
                    setBrokerModalOpen(true);
                  }}
                  className="gap-2 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo Corretor
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {loadingBrokers ? (
                <div className="p-8 text-center text-muted-foreground">Carregando corretores...</div>
              ) : brokerContacts.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-border/60 rounded-xl">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <h4 className="text-sm font-semibold">Nenhum corretor cadastrado ainda</h4>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Clique em "Sincronizar com Imoview" para importar os corretores ativos do CRM ou adicione manualmente.
                  </p>
                  <Button size="sm" onClick={handleSyncImoview} disabled={syncingImoview} className="gap-2">
                    <RefreshCw className={`h-3.5 w-3.5 ${syncingImoview ? "animate-spin" : ""}`} />
                    Importar do Imoview
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-3">Nome</th>
                        <th className="py-3 px-3">Telefone WhatsApp</th>
                        <th className="py-3 px-3">Cód. Imoview</th>
                        <th className="py-3 px-3">Equipe</th>
                        <th className="py-3 px-2 text-center">Status</th>
                        <th className="py-3 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {brokerContacts.map((b) => (
                        <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 font-bold text-foreground">
                            {b.nome}
                            {b.email && <span className="block text-[11px] font-normal text-muted-foreground">{b.email}</span>}
                          </td>

                          <td className="py-3 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                            {b.telefone ? formatPhone(b.telefone) : <span className="text-amber-500 italic">Sem WhatsApp</span>}
                          </td>

                          <td className="py-3 px-3 font-mono text-muted-foreground">
                            {b.imoviewCodigo || "—"}
                          </td>

                          <td className="py-3 px-3">
                            <Badge variant="outline" className="text-[10px]">
                              {b.equipe || "Vendas"}
                            </Badge>
                          </td>

                          <td className="py-3 px-2 text-center">
                            {b.ativo ? (
                              <Badge className="bg-emerald-500 text-white text-[10px]">Ativo</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">Inativo</Badge>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingBroker(b);
                                setBrokerForm({
                                  nome: b.nome,
                                  telefone: b.telefone,
                                  email: b.email || "",
                                  imoviewCodigo: b.imoviewCodigo || "",
                                  equipe: b.equipe || "Vendas",
                                  ativo: b.ativo,
                                  observacoes: b.observacoes || "",
                                });
                                setBrokerModalOpen(true);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteBroker(b.id, b.nome)}
                              className="h-8 w-8 p-0 hover:text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============================================================== */}
      {/* MODAL: DISPARO WHATSAPP PARA O CORRETOR                         */}
      {/* ============================================================== */}
      <Dialog open={dispatchModalOpen} onOpenChange={setDispatchModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-amber-500" />
              Disparar Mensagem para o Corretor
            </DialogTitle>
            <DialogDescription className="text-xs">
              Envio direto via WhatsApp oficial da gestão. O corretor receberá o texto personalizado abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Destinatário:</span>
                <span className="font-bold text-foreground">{dispatchTargetBroker?.nome}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">WhatsApp:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {dispatchTargetBroker?.telefone ? formatPhone(dispatchTargetBroker.telefone) : "Não cadastrado"}
                </span>
              </div>
            </div>

            {/* Seletor de Sessão de Envio (Padrão: Brunno) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Sessão WhatsApp de Envio (Remetente):</Label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none"
              >
                {sessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {s.name} ({s.status === "CONNECTED" ? "Online" : "Desconectado"})
                    {s.name.toLowerCase().includes("brunno") ? " ⭐ (Brunno Padrão)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Textarea de Mensagem com Pré-visualização */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Mensagem Formatada (WhatsApp Copy):</Label>
              <Textarea
                rows={9}
                value={dispatchMessage}
                onChange={(e) => setDispatchMessage(e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDispatchModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSendMessage}
              disabled={sendingMessage || !dispatchTargetBroker?.telefone}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <Send className={`h-4 w-4 ${sendingMessage ? "animate-spin" : ""}`} />
              {sendingMessage ? "Enviando..." : "Enviar via WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL: CADASTRO / EDIÇÃO DE CORRETOR                           */}
      {/* ============================================================== */}
      <Dialog open={brokerModalOpen} onOpenChange={setBrokerModalOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveBroker}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-purple-500" />
                {editingBroker ? "Editar Corretor" : "Cadastrar Novo Corretor"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Mantenha as informações atualizadas para direcionamento dos disparos de radar e SLA.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-4 text-xs">
              <div className="space-y-1">
                <Label htmlFor="b-nome" className="text-xs font-semibold">
                  Nome Completo *
                </Label>
                <Input
                  id="b-nome"
                  required
                  placeholder="Ex: Lucas Ferreira"
                  value={brokerForm.nome}
                  onChange={(e) => setBrokerForm({ ...brokerForm, nome: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="b-tel" className="text-xs font-semibold">
                  WhatsApp (com DDD) *
                </Label>
                <Input
                  id="b-tel"
                  required
                  placeholder="Ex: 13 99999-8888 ou 5513999998888"
                  value={brokerForm.telefone}
                  onChange={(e) => setBrokerForm({ ...brokerForm, telefone: e.target.value })}
                  className="text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Número onde o corretor receberá o radar de clientes e imóveis.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="b-cod" className="text-xs font-semibold">
                    Cód. Imoview (Opcional)
                  </Label>
                  <Input
                    id="b-cod"
                    placeholder="Ex: 25"
                    value={brokerForm.imoviewCodigo}
                    onChange={(e) => setBrokerForm({ ...brokerForm, imoviewCodigo: e.target.value })}
                    className="text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="b-equipe" className="text-xs font-semibold">
                    Equipe
                  </Label>
                  <select
                    id="b-equipe"
                    value={brokerForm.equipe}
                    onChange={(e) => setBrokerForm({ ...brokerForm, equipe: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none"
                  >
                    <option value="Vendas">Vendas</option>
                    <option value="Locação">Locação</option>
                    <option value="Lançamentos">Lançamentos</option>
                    <option value="Geral">Geral</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="b-email" className="text-xs font-semibold">
                  E-mail (Opcional)
                </Label>
                <Input
                  id="b-email"
                  type="email"
                  placeholder="corretor@rhemaimoveis.com.br"
                  value={brokerForm.email}
                  onChange={(e) => setBrokerForm({ ...brokerForm, email: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label htmlFor="b-ativo" className="text-xs font-semibold cursor-pointer">
                  Corretor Ativo no Radar
                </Label>
                <Switch
                  id="b-ativo"
                  checked={brokerForm.ativo}
                  onCheckedChange={(checked) => setBrokerForm({ ...brokerForm, ativo: checked })}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setBrokerModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={savingBroker} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold">
                {savingBroker ? "Salvando..." : editingBroker ? "Salvar Alterações" : "Cadastrar Corretor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
