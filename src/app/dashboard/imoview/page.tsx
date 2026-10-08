"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Send,
  Building2,
  Users,
  Clock,
  Key,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Calendar,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Search,
  Filter,
  CheckSquare,
  Square,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { SessionGuard } from "@/components/dashboard/session-guard";

interface ImoviewLead {
  atendimentoId: string;
  clienteId?: string;
  clienteNome: string;
  telefone: string;
  corretorNome?: string;
  corretorId?: string;
  codigoImovel?: string;
  tipoImovel?: string;
  bairroInteresse?: string;
  valorInteresse?: string;
  diasSemContato: number;
  ultimoHistorico?: string;
  dataUltimoContato?: string;
  statusAtendimento?: string;
}

interface ImoviewBroker {
  id: string;
  nome: string;
  email?: string;
}

export default function ImoviewIntegrationPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"resgate" | "config">("resgate");

  // Config State
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.imoview.com.br");
  const [isActive, setIsActive] = useState(true);
  const [autoRecordInteraction, setAutoRecordInteraction] = useState(true);
  const [autoRecordResponse, setAutoRecordResponse] = useState(true);
  const [autoNotifyBroker, setAutoNotifyBroker] = useState(true);
  const [configLoading, setConfigLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const [maskedKey, setMaskedKey] = useState("");

  // Leads & Resgate State
  const [leads, setLeads] = useState<ImoviewLead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [brokers, setBrokers] = useState<ImoviewBroker[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  // Filters State
  const [diasFiltro, setDiasFiltro] = useState(15);
  const [corretorFiltro, setCorretorFiltro] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch Config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/imoview/config");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setBaseUrl(json.data.baseUrl || "https://api.imoview.com.br");
          setIsActive(json.data.isActive ?? true);
          setAutoRecordInteraction(json.data.autoRecordInteraction ?? true);
          setAutoRecordResponse(json.data.autoRecordResponse ?? true);
          setAutoNotifyBroker(json.data.autoNotifyBroker ?? true);
          setMaskedKey(json.data.maskedKey || "");

          if (json.data.hasKey) {
            setConnectionStatus("connected");
          } else {
            setConnectionStatus("disconnected");
          }
        }
      }
    } catch (e) {
      setConnectionStatus("disconnected");
    }
  }, []);

  // Fetch Brokers for filtering
  const fetchBrokers = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/imoview/corretores");
      if (res.ok) {
        const json = await res.json();
        setBrokers(json.data || []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch Stalled Leads
  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("dias", String(diasFiltro));
      if (corretorFiltro) params.set("corretorId", corretorFiltro);

      const res = await fetch(`/api/integrations/imoview/leads-parados?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setLeads(json.data || []);
        // Select all by default
        setSelectedLeadIds((json.data || []).map((l: ImoviewLead) => l.atendimentoId));
        if (json.configured === false) {
          setActiveTab("config");
          toast.warning("Configure a Chave de API do Imoview para buscar os leads.");
        }
      }
    } catch (e: any) {
      toast.error("Erro ao carregar leads do Imoview");
    } finally {
      setLeadsLoading(false);
    }
  }, [diasFiltro, corretorFiltro]);

  useEffect(() => {
    fetchConfig();
    fetchBrokers();
  }, [fetchConfig, fetchBrokers]);

  useEffect(() => {
    if (activeTab === "resgate" && connectionStatus === "connected") {
      fetchLeads();
    }
  }, [activeTab, connectionStatus, fetchLeads]);

  // Save Config
  const handleSaveConfig = async () => {
    if (!apiKey.trim() && !maskedKey) {
      return toast.error("Informe a Chave de API do Imoview");
    }

    setConfigLoading(true);
    try {
      const payload = {
        apiKey: apiKey.trim() || undefined,
        baseUrl: baseUrl.trim(),
        isActive,
        autoRecordInteraction,
        autoRecordResponse,
        autoNotifyBroker,
      };

      const res = await fetch("/api/integrations/imoview/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Configurações salvas com sucesso!");
        fetchConfig();
        setApiKey("");
        if (data.testResult?.success) {
          setConnectionStatus("connected");
          setActiveTab("resgate");
          fetchLeads();
        }
      } else {
        toast.error(data.message || "Erro ao salvar configurações");
      }
    } catch (e: any) {
      toast.error("Falha ao conectar com o servidor");
    } finally {
      setConfigLoading(false);
    }
  };

  // Toggle selection
  const toggleSelectLead = (atendimentoId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(atendimentoId)
        ? prev.filter((id) => id !== atendimentoId)
        : [...prev, atendimentoId]
    );
  };

  const selectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map((l) => l.atendimentoId));
    }
  };

  // Send Selected Leads to Broadcast Screen
  const handleSendToBroadcast = () => {
    const selected = leads.filter((l) => selectedLeadIds.includes(l.atendimentoId));
    if (selected.length === 0) {
      return toast.error("Selecione pelo menos um lead para resgate");
    }

    // Format recipients for broadcast storage
    const broadcastContacts = selected.map((l) => {
      const cleanPhone = l.telefone.replace(/\D/g, "");
      const jidPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      const primeiroNome = l.clienteNome.trim().split(" ")[0];

      return {
        phone: jidPhone,
        jid: `${jidPhone}@s.whatsapp.net`,
        name: l.clienteNome,
        isValid: true,
        originalPhone: l.telefone,
        variables: {
          nome: l.clienteNome,
          primeiro_nome: primeiroNome,
          telefone: jidPhone,
          corretor: l.corretorNome || "Rhema Imóveis",
          codigo_imovel: l.codigoImovel || "",
          tipo_imovel: l.tipoImovel || "imóvel",
          bairro: l.bairroInteresse || "",
          valor: l.valorInteresse || "",
          atendimentoId: l.atendimentoId,
          codigo_atendimento: l.atendimentoId,
        },
      };
    });

    // Save temporary in localStorage for the Broadcast page to pick up seamlessly
    localStorage.setItem("imoview_resgate_leads", JSON.stringify(broadcastContacts));
    toast.success(`${broadcastContacts.length} leads preparados! Redirecionando para o Disparador...`);
    router.push("/dashboard/broadcast?source=imoview");
  };

  // Filtered leads
  const filteredLeads = leads.filter((l) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      l.clienteNome.toLowerCase().includes(term) ||
      l.telefone.includes(term) ||
      (l.corretorNome && l.corretorNome.toLowerCase().includes(term)) ||
      (l.codigoImovel && l.codigoImovel.toLowerCase().includes(term)) ||
      (l.bairroInteresse && l.bairroInteresse.toLowerCase().includes(term))
    );
  });

  return (
    <SessionGuard>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
              <Building2 className="h-7 w-7 text-primary" />
              Imoview CRM & Resgate de Leads
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Reativação automática de clientes parados, auditoria de tentativas de contato e sincronização com o Imoview.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-muted/60 p-1 rounded-xl w-fit border border-border/40 shadow-xs">
            <button
              onClick={() => setActiveTab("resgate")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === "resgate"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-4 w-4 text-primary" />
              Resgate de Leads ({leads.length})
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === "config"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Key className="h-4 w-4 text-amber-500" />
              Configuração da Conexão
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: RESGATE DE LEADS PARADOS */}
        {/* ========================================================================= */}
        {activeTab === "resgate" && (
          <div className="space-y-4">
            {/* Banner de Status de Conexão */}
            {connectionStatus === "disconnected" && (
              <Card className="border-amber-500/40 bg-amber-500/10">
                <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                    <span>
                      A conexão com o Imoview ainda não foi configurada ou a chave precisa ser validada.
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs font-semibold"
                    onClick={() => setActiveTab("config")}
                  >
                    Configurar Chave do Imoview
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Painel de Filtros */}
            <Card className="border-border/60 shadow-xs">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* Tempo sem Contato */}
                  <div className="sm:col-span-4 space-y-1">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <Clock className="h-3.5 w-3.5 text-primary" /> Parados sem Interação há:
                    </Label>
                    <select
                      className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={diasFiltro}
                      onChange={(e) => setDiasFiltro(Number(e.target.value))}
                    >
                      <option value={7}>Mais de 7 dias sem contato</option>
                      <option value={15}>Mais de 15 dias sem contato</option>
                      <option value={30}>Mais de 30 dias (Esfriados)</option>
                      <option value={60}>Mais de 60 dias (Leads Zumbis)</option>
                      <option value={90}>Mais de 90 dias (Base Antiga)</option>
                    </select>
                  </div>

                  {/* Corretor */}
                  <div className="sm:col-span-4 space-y-1">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <UserCheck className="h-3.5 w-3.5 text-primary" /> Corretor Responsável:
                    </Label>
                    <select
                      className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={corretorFiltro}
                      onChange={(e) => setCorretorFiltro(e.target.value)}
                    >
                      <option value="">Todos os Corretores</option>
                      {brokers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Botão de Busca */}
                  <div className="sm:col-span-4 flex gap-2">
                    <Button
                      className="flex-1 h-9 text-xs font-bold"
                      onClick={fetchLeads}
                      disabled={leadsLoading}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${leadsLoading ? "animate-spin" : ""}`} />
                      {leadsLoading ? "Buscando no Imoview..." : "Filtrar Leads"}
                    </Button>
                  </div>
                </div>

                {/* Barra de Busca de Texto e Seleção */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-3 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, telefone, imóvel..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8 text-xs pl-8"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-medium"
                      onClick={selectAll}
                      disabled={filteredLeads.length === 0}
                    >
                      {selectedLeadIds.length === filteredLeads.length ? (
                        <>
                          <CheckSquare className="h-3.5 w-3.5 mr-1 text-primary" /> Desmarcar Todos
                        </>
                      ) : (
                        <>
                          <Square className="h-3.5 w-3.5 mr-1" /> Selecionar Todos ({filteredLeads.length})
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      onClick={handleSendToBroadcast}
                      disabled={selectedLeadIds.length === 0}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Disparar Resgate para {selectedLeadIds.length} Leads
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabela de Leads */}
            {filteredLeads.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed">
                <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30 text-primary" />
                <p className="text-sm font-semibold">Nenhum lead parado encontrado com estes filtros.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Verifique a chave de API na aba de configuração ou ajuste o filtro de dias sem contato.
                </p>
              </Card>
            ) : (
              <div className="border border-border/60 rounded-xl overflow-hidden shadow-xs bg-card">
                <div className="max-h-[550px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground sticky top-0 border-b border-border/40">
                      <tr>
                        <th className="p-3 text-left w-10">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                            onChange={selectAll}
                          />
                        </th>
                        <th className="p-3 text-left font-semibold">Cliente / Lead</th>
                        <th className="p-3 text-left font-semibold">Corretor</th>
                        <th className="p-3 text-left font-semibold">Interesse / Imóvel</th>
                        <th className="p-3 text-center font-semibold">Tempo Parado</th>
                        <th className="p-3 text-left font-semibold">Último Histórico no Imoview</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredLeads.map((lead) => {
                        const isSelected = selectedLeadIds.includes(lead.atendimentoId);
                        return (
                          <tr
                            key={lead.atendimentoId}
                            className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                              isSelected ? "bg-primary/5" : ""
                            }`}
                            onClick={() => toggleSelectLead(lead.atendimentoId)}
                          >
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="rounded"
                                checked={isSelected}
                                onChange={() => toggleSelectLead(lead.atendimentoId)}
                              />
                            </td>
                            <td className="p-3 font-mono">
                              <div className="font-semibold text-foreground text-xs">{lead.clienteNome}</div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                📱 {lead.telefone}
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {lead.corretorNome || "Rhema"}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="font-medium text-foreground">
                                {lead.tipoImovel || "Imóvel"}{" "}
                                {lead.codigoImovel && (
                                  <span className="font-mono text-[10px] text-primary">#{lead.codigoImovel}</span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {lead.bairroInteresse || "Sem bairro"} {lead.valorInteresse && `• ${lead.valorInteresse}`}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <Badge
                                variant={
                                  lead.diasSemContato >= 60
                                    ? "destructive"
                                    : lead.diasSemContato >= 30
                                    ? "secondary"
                                    : "outline"
                                }
                                className="text-[10px] font-mono font-semibold"
                              >
                                {lead.diasSemContato} dias
                              </Badge>
                            </td>
                            <td className="p-3 max-w-xs truncate text-[11px] text-muted-foreground font-mono">
                              {lead.ultimoHistorico || "Sem histórico recente"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CONFIGURAÇÃO DA INTEGRAÇÃO COM IMOVIEW */}
        {/* ========================================================================= */}
        {activeTab === "config" && (
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3 bg-muted/20 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Key className="h-4 w-4 text-amber-500" />
                        Conexão com a API do Imoview
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Insira a chave de integração fornecida pelo Imoview / Universal Software.
                      </CardDescription>
                    </div>

                    <Badge
                      variant={connectionStatus === "connected" ? "default" : "destructive"}
                      className="text-[10px] uppercase font-semibold"
                    >
                      {connectionStatus === "connected" ? "Conectado" : "Não Conectado"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {/* Chave de API */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-semibold">Chave de API / Token de Acesso:</Label>
                      {maskedKey && (
                        <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                          Chave Ativa: {maskedKey}
                        </span>
                      )}
                    </div>
                    <Input
                      type="password"
                      placeholder={maskedKey ? "Substituir chave existente..." : "Ex: imo_live_a1b2c3d4e5f6..."}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="text-xs font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Essa chave é mantida em segurança e utilizada para consultar atendimentos e injetar histórico de WhatsApp.
                    </p>
                  </div>

                  {/* URL Base */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">URL Base da API:</Label>
                    <Input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      className="text-xs font-mono"
                      placeholder="https://api.imoview.com.br"
                    />
                  </div>

                  {/* Automações Bidirecionais */}
                  <div className="pt-2 border-t border-border/40 space-y-3">
                    <Label className="text-xs font-bold text-foreground block">
                      Automações de Acompanhamento (CRM Bidirecional):
                    </Label>

                    {/* Auto Record Outbound */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-medium">Registrar Tentativas de Contato no Imoview</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Grava automaticamente uma ocorrência no atendimento do Imoview com data/hora e o texto enviado.
                        </p>
                      </div>
                      <Switch
                        checked={autoRecordInteraction}
                        onCheckedChange={setAutoRecordInteraction}
                      />
                    </div>

                    {/* Auto Record Inbound */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-medium">Registrar Resposta do Cliente no Imoview</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Quando o cliente responder no WhatsApp, o sistema adiciona a resposta no histórico do atendimento.
                        </p>
                      </div>
                      <Switch
                        checked={autoRecordResponse}
                        onCheckedChange={setAutoRecordResponse}
                      />
                    </div>
                  </div>

                  {/* Botão de Salvar */}
                  <Button
                    className="w-full h-11 text-xs font-bold mt-2 shadow-xs"
                    onClick={handleSaveConfig}
                    disabled={configLoading}
                  >
                    {configLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Testando e Salvando...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-2 h-4 w-4" /> Salvar e Validar Conexão com Imoview
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Coluna Direita: Guia e Variáveis */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-border/60 shadow-xs bg-muted/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Como funciona o Resgate Automático:
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                  <p>
                    <strong>1. Filtro dos Leads:</strong> O sistema puxa em tempo real do Imoview os clientes que estão sem interação há mais de X dias.
                  </p>
                  <p>
                    <strong>2. Disparo Humanizado:</strong> Os contatos são enviados para a tela de Broadcast com todas as variáveis preenchidas:
                  </p>
                  <div className="bg-background p-2.5 rounded-lg border border-border/60 font-mono text-[11px] space-y-1">
                    <div><code className="text-primary font-bold">{"{{primeiro_nome}}"}</code>: Primeiro nome do lead</div>
                    <div><code className="text-primary font-bold">{"{{corretor}}"}</code>: Corretor responsável no Imoview</div>
                    <div><code className="text-primary font-bold">{"{{codigo_imovel}}"}</code>: Código do imóvel de interesse</div>
                    <div><code className="text-primary font-bold">{"{{bairro}}"}</code>: Bairro pesquisado pelo lead</div>
                  </div>
                  <p>
                    <strong>3. Feedback no Imoview:</strong> Toda mensagem enviada e cada resposta recebida atualiza a linha do tempo do atendimento no Imoview, mantendo os corretores e a diretoria 100% informados!
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </SessionGuard>
  );
}
