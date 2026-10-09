"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Send,
  Building2,
  Users,
  Clock,
  Key,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Search,
  CheckSquare,
  Square,
  UserCheck,
  Phone,
  Home,
  Pencil,
  Trash2,
  Eye,
  FileText,
  Calendar,
  DollarSign,
  AlertCircle,
  X,
  FilterX,
  SlidersHorizontal,
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
  cidadeInteresse?: string;
  valorInteresse?: string;
  quartos?: string;
  vagas?: string;
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

interface ImoviewProperty {
  codigo: string;
  titulo: string;
  tipo: string;
  finalidade: string;
  valor: string;
  bairro: string;
  cidade: string;
  quartos?: string;
  vagas?: string;
  dataUltimaAlteracao?: string;
  diasSemAtualizacao: number;
  proprietarioNome: string;
  proprietarioTelefone: string;
  fotoPrincipal?: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
}

export default function ImoviewIntegrationPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"resgate" | "proprietarios" | "config">("resgate");

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
  const [diasFiltroLeads, setDiasFiltroLeads] = useState(15);
  const [corretorFiltro, setCorretorFiltro] = useState("");
  const [searchLeadTerm, setSearchLeadTerm] = useState("");

  // Properties & Owners State
  const [properties, setProperties] = useState<ImoviewProperty[]>([]);
  const [selectedPropertyCodes, setSelectedPropertyCodes] = useState<string[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [hasSearchedProps, setHasSearchedProps] = useState(false);
  const abortPropsRef = useRef<AbortController | null>(null);

  const [origemFiltro, setOrigemFiltro] = useState<"proprietarios" | "imoveis">("proprietarios");
  const [periodoModo, setPeriodoModo] = useState<"presets" | "custom_days" | "custom_range">("presets");
  const [diasFiltroProps, setDiasFiltroProps] = useState(0); // 0 = todos, 15, 30, 60, 90, 180
  const [diasMinimosCustom, setDiasMinimosCustom] = useState("");
  const [diasMaximosCustom, setDiasMaximosCustom] = useState("");
  const [dataInicioCustom, setDataInicioCustom] = useState("");
  const [dataFimCustom, setDataFimCustom] = useState("");
  const [limiteFiltroProps, setLimiteFiltroProps] = useState(100);
  const [apenasComTelefoneFiltro, setApenasComTelefoneFiltro] = useState(true);
  const [finalidadeFiltro, setFinalidadeFiltro] = useState("0"); // 0 = todos, 2 = Venda, 1 = Locacao
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [searchPropTerm, setSearchPropTerm] = useState("");

  // Templates list from API
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  // Modal: Quick Edit Single Contact (Lead or Property Owner)
  const [editContactModal, setEditContactModal] = useState<{
    open: boolean;
    type: "lead" | "property";
    id: string; // atendimentoId or property codigo
    name: string;
    phone: string;
  }>({
    open: false,
    type: "lead",
    id: "",
    name: "",
    phone: "",
  });

  // Modal: Review Recipients & Template Before Broadcast
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewType, setReviewType] = useState<"leads" | "proprietarios">("leads");
  const [reviewRecipients, setReviewRecipients] = useState<
    Array<{
      id: string;
      name: string;
      phone: string;
      extraInfo: string;
      originalData: any;
    }>
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

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
    } catch {
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

  // Fetch Templates for Broadcast selection
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data || []);
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
      params.set("dias", String(diasFiltroLeads));
      if (corretorFiltro) params.set("corretorId", corretorFiltro);

      const res = await fetch(`/api/integrations/imoview/leads-parados?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || [];
        setLeads(data);
        setSelectedLeadIds(data.map((l: ImoviewLead) => l.atendimentoId));
        if (json.configured === false) {
          setActiveTab("config");
          toast.warning("Configure a Chave de API do Imoview para buscar os leads.");
        }
      }
    } catch {
      toast.error("Erro ao carregar leads do Imoview");
    } finally {
      setLeadsLoading(false);
    }
  }, [diasFiltroLeads, corretorFiltro]);

  // Fetch Properties & Owners (Triggered ONLY on user action)
  const fetchProperties = useCallback(async () => {
    // Cancela requisição anterior se houver
    if (abortPropsRef.current) {
      abortPropsRef.current.abort();
    }
    const controller = new AbortController();
    abortPropsRef.current = controller;

    setPropertiesLoading(true);
    setHasSearchedProps(true);

    try {
      const params = new URLSearchParams();
      params.set("origem", origemFiltro);
      params.set("limite", String(limiteFiltroProps));
      params.set("apenasComTelefone", apenasComTelefoneFiltro ? "true" : "false");

      if (periodoModo === "presets") {
        if (diasFiltroProps > 0) params.set("dias", String(diasFiltroProps));
      } else if (periodoModo === "custom_days") {
        if (diasMinimosCustom) params.set("dias", diasMinimosCustom);
        if (diasMaximosCustom) params.set("diasMax", diasMaximosCustom);
      } else if (periodoModo === "custom_range") {
        if (dataInicioCustom) params.set("dataInicio", dataInicioCustom);
        if (dataFimCustom) params.set("dataFim", dataFimCustom);
      }

      if (finalidadeFiltro && finalidadeFiltro !== "0") params.set("finalidade", finalidadeFiltro);
      if (tipoFiltro) params.set("tipo", tipoFiltro);
      if (searchPropTerm) params.set("termo", searchPropTerm);

      const res = await fetch(`/api/integrations/imoview/proprietarios?${params.toString()}`, {
        signal: controller.signal,
      });

      if (res.ok) {
        const json = await res.json();
        const data = json.data || [];
        setProperties(data);
        // Seleciona por padrão contatos com telefone válido
        const withPhones = data
          .filter((p: ImoviewProperty) => p.proprietarioTelefone && p.proprietarioTelefone.replace(/\D/g, "").length >= 8)
          .map((p: ImoviewProperty) => p.codigo);
        setSelectedPropertyCodes(withPhones);

        if (json.configured === false) {
          setActiveTab("config");
          toast.warning("Configure a Chave de API do Imoview para buscar os contatos.");
        } else {
          toast.success(`${data.length} contatos encontrados no Imoview!`);
        }
      } else {
        toast.error("Erro ao carregar contatos do Imoview");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // Usuário cancelou a busca voluntariamente
        return;
      }
      toast.error("Erro ao carregar proprietários do Imoview");
    } finally {
      setPropertiesLoading(false);
      abortPropsRef.current = null;
    }
  }, [
    origemFiltro,
    limiteFiltroProps,
    apenasComTelefoneFiltro,
    periodoModo,
    diasFiltroProps,
    diasMinimosCustom,
    diasMaximosCustom,
    dataInicioCustom,
    dataFimCustom,
    finalidadeFiltro,
    tipoFiltro,
    searchPropTerm,
  ]);

  const handleCancelSearch = () => {
    if (abortPropsRef.current) {
      abortPropsRef.current.abort();
      abortPropsRef.current = null;
    }
    setPropertiesLoading(false);
    toast.info("Busca de proprietários interrompida.");
  };

  const handleResetFilters = () => {
    setOrigemFiltro("proprietarios");
    setPeriodoModo("presets");
    setDiasFiltroProps(0);
    setDiasMinimosCustom("");
    setDiasMaximosCustom("");
    setDataInicioCustom("");
    setDataFimCustom("");
    setFinalidadeFiltro("0");
    setLimiteFiltroProps(100);
    setApenasComTelefoneFiltro(true);
    setSearchPropTerm("");
    toast.info("Filtros redefinidos");
  };

  useEffect(() => {
    fetchConfig();
    fetchBrokers();
    fetchTemplates();
  }, [fetchConfig, fetchBrokers, fetchTemplates]);

  useEffect(() => {
    if (connectionStatus === "connected") {
      if (activeTab === "resgate" && leads.length === 0) {
        fetchLeads();
      }
      // NOTA: fetchProperties() NÃO é chamado automaticamente ao entrar na aba! O usuário tem controle manual.
    }
  }, [activeTab, connectionStatus, fetchLeads, leads.length]);

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
    } catch {
      toast.error("Falha ao conectar com o servidor");
    } finally {
      setConfigLoading(false);
    }
  };

  // Toggle selection for Leads
  const toggleSelectLead = (atendimentoId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(atendimentoId) ? prev.filter((id) => id !== atendimentoId) : [...prev, atendimentoId]
    );
  };

  const selectAllLeads = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map((l) => l.atendimentoId));
    }
  };

  // Toggle selection for Properties
  const toggleSelectProperty = (codigo: string) => {
    setSelectedPropertyCodes((prev) =>
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]
    );
  };

  const selectAllProperties = () => {
    if (selectedPropertyCodes.length === filteredProperties.length) {
      setSelectedPropertyCodes([]);
    } else {
      setSelectedPropertyCodes(filteredProperties.map((p) => p.codigo));
    }
  };

  // Filtered Leads
  const filteredLeads = leads.filter((l) => {
    if (!searchLeadTerm) return true;
    const term = searchLeadTerm.toLowerCase();
    return (
      l.clienteNome.toLowerCase().includes(term) ||
      l.telefone.includes(term) ||
      (l.corretorNome && l.corretorNome.toLowerCase().includes(term)) ||
      (l.codigoImovel && l.codigoImovel.toLowerCase().includes(term)) ||
      (l.bairroInteresse && l.bairroInteresse.toLowerCase().includes(term))
    );
  });

  // Filtered Properties
  const filteredProperties = properties.filter((p) => {
    if (apenasComTelefoneFiltro) {
      const hasPhone = p.proprietarioTelefone && p.proprietarioTelefone.replace(/\D/g, "").length >= 8;
      if (!hasPhone) return false;
    }
    if (!searchPropTerm) return true;
    const term = searchPropTerm.toLowerCase();
    return (
      p.codigo.includes(term) ||
      p.titulo.toLowerCase().includes(term) ||
      p.proprietarioNome.toLowerCase().includes(term) ||
      p.proprietarioTelefone.includes(term) ||
      p.bairro.toLowerCase().includes(term) ||
      p.cidade.toLowerCase().includes(term)
    );
  });

  // Quick Edit Contact Handler
  const handleSaveContactEdit = () => {
    if (!editContactModal.name.trim()) {
      return toast.error("O nome não pode ser vazio");
    }
    if (!editContactModal.phone.trim()) {
      return toast.error("O telefone não pode ser vazio");
    }

    if (editContactModal.type === "lead") {
      setLeads((prev) =>
        prev.map((item) =>
          item.atendimentoId === editContactModal.id
            ? { ...item, clienteNome: editContactModal.name.trim(), telefone: editContactModal.phone.trim() }
            : item
        )
      );
      toast.success("Dados do lead atualizados!");
    } else {
      setProperties((prev) =>
        prev.map((item) =>
          item.codigo === editContactModal.id
            ? {
                ...item,
                proprietarioNome: editContactModal.name.trim(),
                proprietarioTelefone: editContactModal.phone.trim(),
              }
            : item
        )
      );
      toast.success("Dados do proprietário atualizados!");
    }

    setEditContactModal((prev) => ({ ...prev, open: false }));
  };

  // Open Review Dialog for Leads
  const handleOpenLeadsReview = () => {
    const selected = leads.filter((l) => selectedLeadIds.includes(l.atendimentoId));
    if (selected.length === 0) {
      return toast.error("Selecione pelo menos um lead para resgate");
    }

    const items = selected.map((l) => ({
      id: l.atendimentoId,
      name: l.clienteNome,
      phone: l.telefone,
      extraInfo: `${l.tipoImovel || "Imóvel"} • ${l.bairroInteresse || "Sem bairro"} (${l.diasSemContato}d parado)`,
      originalData: l,
    }));

    setReviewRecipients(items);
    setReviewType("leads");

    // Suggest lead template if exists
    const defaultLeadTpl = templates.find((t) => t.category === "recuperacao" || t.id.includes("lead_parado"));
    if (defaultLeadTpl) setSelectedTemplateId(defaultLeadTpl.id);

    setReviewModalOpen(true);
  };

  // Open Review Dialog for Owners
  const handleOpenOwnersReview = () => {
    const selected = properties.filter((p) => selectedPropertyCodes.includes(p.codigo));
    if (selected.length === 0) {
      return toast.error("Selecione pelo menos um imóvel/proprietário");
    }

    const items = selected.map((p) => ({
      id: p.codigo,
      name: p.proprietarioNome || "Proprietário",
      phone: p.proprietarioTelefone,
      extraInfo: `Cód. ${p.codigo} • ${p.tipo} em ${p.bairro} (${p.diasSemAtualizacao}d sem atualização)`,
      originalData: p,
    }));

    setReviewRecipients(items);
    setReviewType("proprietarios");

    // Suggest owner template if exists
    const defaultOwnerTpl = templates.find(
      (t) => t.category === "proprietarios" || t.id.includes("proprietario_confirmacao")
    );
    if (defaultOwnerTpl) setSelectedTemplateId(defaultOwnerTpl.id);

    setReviewModalOpen(true);
  };

  // Remove recipient inside Review Dialog
  const handleRemoveReviewItem = (id: string) => {
    setReviewRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  // Update recipient phone/name inside Review Dialog
  const handleUpdateReviewItem = (id: string, field: "name" | "phone", value: string) => {
    setReviewRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Final Action: Send to Broadcast Screen
  const handleProceedToBroadcast = () => {
    if (reviewRecipients.length === 0) {
      return toast.error("Nenhum destinatário selecionado");
    }

    if (reviewType === "leads") {
      const broadcastContacts = reviewRecipients.map((r) => {
        const cleanPhone = r.phone.replace(/\D/g, "");
        const jidPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        const primeiroNome = r.name.trim().split(" ")[0];
        const l = r.originalData as ImoviewLead;

        return {
          phone: jidPhone,
          jid: `${jidPhone}@s.whatsapp.net`,
          name: r.name,
          isValid: true,
          originalPhone: r.phone,
          variables: {
            nome: r.name,
            primeiro_nome: primeiroNome,
            telefone: jidPhone,
            corretor: l.corretorNome || "Rhema Imóveis",
            codigo_imovel: l.codigoImovel || "",
            tipo_imovel: l.tipoImovel || "imóvel",
            bairro: l.bairroInteresse || "",
            cidade: l.cidadeInteresse || "",
            valor: l.valorInteresse || "",
            quartos: l.quartos || "",
            vagas: l.vagas || "",
            atendimentoId: l.atendimentoId,
            codigo_atendimento: l.atendimentoId,
          },
        };
      });

      localStorage.setItem("imoview_resgate_leads", JSON.stringify(broadcastContacts));
      toast.success(`${broadcastContacts.length} leads preparados! Redirecionando para o Disparador...`);
      setReviewModalOpen(false);

      const targetUrl = selectedTemplateId
        ? `/dashboard/broadcast?source=imoview&template=${encodeURIComponent(selectedTemplateId)}`
        : `/dashboard/broadcast?source=imoview`;
      router.push(targetUrl);
    } else {
      const broadcastContacts = reviewRecipients.map((r) => {
        const cleanPhone = r.phone.replace(/\D/g, "");
        const jidPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        const primeiroNome = r.name.trim().split(" ")[0];
        const p = r.originalData as ImoviewProperty;

        return {
          phone: jidPhone,
          jid: `${jidPhone}@s.whatsapp.net`,
          name: r.name,
          isValid: true,
          originalPhone: r.phone,
          variables: {
            nome: r.name,
            nome_proprietario: r.name,
            primeiro_nome: primeiroNome,
            telefone: jidPhone,
            codigo_imovel: p.codigo,
            titulo_imovel: p.titulo,
            tipo_imovel: p.tipo,
            finalidade: p.finalidade,
            valor: p.valor,
            bairro: p.bairro,
            cidade: p.cidade,
            quartos: p.quartos || "",
            vagas: p.vagas || "",
            dias_sem_atualizacao: String(p.diasSemAtualizacao),
            data_ultima_alteracao: p.dataUltimaAlteracao || "",
          },
        };
      });

      localStorage.setItem("imoview_proprietarios_leads", JSON.stringify(broadcastContacts));
      toast.success(`${broadcastContacts.length} proprietários preparados! Redirecionando para o Disparador...`);
      setReviewModalOpen(false);

      const targetUrl = selectedTemplateId
        ? `/dashboard/broadcast?source=proprietarios&template=${encodeURIComponent(selectedTemplateId)}`
        : `/dashboard/broadcast?source=proprietarios`;
      router.push(targetUrl);
    }
  };

  // Metrics for Properties
  const propsWith30Days = properties.filter((p) => p.diasSemAtualizacao >= 30).length;
  const propsWith60Days = properties.filter((p) => p.diasSemAtualizacao >= 60).length;
  const propsWith90Days = properties.filter((p) => p.diasSemAtualizacao >= 90).length;
  const propsWithPhone = properties.filter(
    (p) => p.proprietarioTelefone && p.proprietarioTelefone.replace(/\D/g, "").length >= 8
  ).length;

  return (
    <SessionGuard>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
              <Building2 className="h-7 w-7 text-primary" />
              Imoview CRM & Gestão Imobiliária
            </h2>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              Reativação de leads parados, contato em massa com proprietários de imóveis e sincronização bidirecional.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-muted/60 p-1 rounded-xl w-fit border border-border/40 shadow-xs flex-wrap">
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
              onClick={() => setActiveTab("proprietarios")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === "proprietarios"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Home className="h-4 w-4 text-emerald-600" />
              Proprietários de Imóveis ({properties.length})
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

        {/* Banner de Conexão se Desconectado */}
        {connectionStatus === "disconnected" && activeTab !== "config" && (
          <Card className="border-amber-500/40 bg-amber-500/10">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <span>A conexão com o Imoview ainda não foi configurada ou a chave precisa ser validada.</span>
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

        {/* ========================================================================= */}
        {/* TAB 1: RESGATE DE LEADS PARADOS */}
        {/* ========================================================================= */}
        {activeTab === "resgate" && (
          <div className="space-y-4">
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
                      value={diasFiltroLeads}
                      onChange={(e) => setDiasFiltroLeads(Number(e.target.value))}
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
                    <Button className="flex-1 h-9 text-xs font-bold" onClick={fetchLeads} disabled={leadsLoading}>
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
                      value={searchLeadTerm}
                      onChange={(e) => setSearchLeadTerm(e.target.value)}
                      className="h-8 text-xs pl-8"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-medium"
                      onClick={selectAllLeads}
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
                      onClick={handleOpenLeadsReview}
                      disabled={selectedLeadIds.length === 0}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      Conferir e Disparar para {selectedLeadIds.length} Leads
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
                            onChange={selectAllLeads}
                          />
                        </th>
                        <th className="p-3 text-left font-semibold">Cliente / Lead</th>
                        <th className="p-3 text-left font-semibold">Corretor</th>
                        <th className="p-3 text-left font-semibold">Interesse / Imóvel</th>
                        <th className="p-3 text-center font-semibold">Tempo Parado</th>
                        <th className="p-3 text-left font-semibold">Último Histórico no Imoview</th>
                        <th className="p-3 text-center font-semibold w-16">Ação</th>
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
                            <td className="p-3">
                              <div className="font-semibold text-foreground text-xs">{lead.clienteNome}</div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
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
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Editar dados do lead"
                                onClick={() =>
                                  setEditContactModal({
                                    open: true,
                                    type: "lead",
                                    id: lead.atendimentoId,
                                    name: lead.clienteNome,
                                    phone: lead.telefone,
                                  })
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
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
        {/* TAB 2: GESTÃO DE PROPRIETÁRIOS & ATUALIZAÇÃO DE IMÓVEIS */}
        {/* ========================================================================= */}
        {activeTab === "proprietarios" && (
          <div className="space-y-4">
            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-3.5 border-border/60 shadow-xs bg-card">
                <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                  <span>{origemFiltro === "proprietarios" ? "Proprietários no CRM" : "Imóveis no Catálogo"}</span>
                  <Home className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="text-xl font-bold mt-1 text-foreground">{properties.length}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                  {propsWithPhone} com WhatsApp válido
                </div>
              </Card>

              <Card className="p-3.5 border-border/60 shadow-xs bg-card">
                <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                  <span>Sem Contato &gt; 30d</span>
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <div className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">{propsWith30Days}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Necessitam checagem</div>
              </Card>

              <Card className="p-3.5 border-border/60 shadow-xs bg-card">
                <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                  <span>Sem Contato &gt; 60d</span>
                  <Clock className="h-3.5 w-3.5 text-orange-500" />
                </div>
                <div className="text-xl font-bold mt-1 text-orange-600 dark:text-orange-400">{propsWith60Days}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Risco de venda/esfriamento</div>
              </Card>

              <Card className="p-3.5 border-border/60 shadow-xs bg-card">
                <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                  <span>Sem Contato &gt; 90d</span>
                  <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                </div>
                <div className="text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{propsWith90Days}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Prioridade máxima de contato</div>
              </Card>
            </div>

            {/* Painel de Filtros dos Proprietários */}
            <Card className="border-border/60 shadow-xs">
              <CardContent className="p-4 space-y-4">
                {/* Linha Superior: Origem, Finalidade, Quantidade Máxima e Ações Principais */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* Origem dos Dados */}
                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <Users className="h-3.5 w-3.5 text-primary" /> Origem dos Dados:
                    </Label>
                    <select
                      className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={origemFiltro}
                      onChange={(e) => setOrigemFiltro(e.target.value as "proprietarios" | "imoveis")}
                    >
                      <option value="proprietarios">Proprietários (Base CRM - WhatsApp)</option>
                      <option value="imoveis">Catálogo de Imóveis (Portfólio)</option>
                    </select>
                  </div>

                  {/* Finalidade / Carteira */}
                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <DollarSign className="h-3.5 w-3.5 text-primary" /> Finalidade / Carteira:
                    </Label>
                    <select
                      className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={finalidadeFiltro}
                      onChange={(e) => setFinalidadeFiltro(e.target.value)}
                    >
                      <option value="0">Venda e Locação (Todos)</option>
                      <option value="2">Apenas Venda</option>
                      <option value="1">Apenas Locação</option>
                    </select>
                  </div>

                  {/* Limite de Registros */}
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Quantidade Máx.:
                    </Label>
                    <select
                      className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={limiteFiltroProps}
                      onChange={(e) => setLimiteFiltroProps(Number(e.target.value))}
                    >
                      <option value={50}>50 contatos (Rápido)</option>
                      <option value={100}>100 contatos (Padrão)</option>
                      <option value={200}>200 contatos</option>
                      <option value={500}>500 contatos</option>
                    </select>
                  </div>

                  {/* Botões de Ação da Busca: Filtrar ou Interromper */}
                  <div className="sm:col-span-4 flex items-center gap-2">
                    {propertiesLoading ? (
                      <Button
                        className="flex-1 h-9 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs animate-pulse"
                        onClick={handleCancelSearch}
                      >
                        <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
                        Interromper Busca
                      </Button>
                    ) : (
                      <Button
                        className="flex-1 h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        onClick={fetchProperties}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Filtrar Contatos
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                      title="Redefinir todos os filtros"
                      onClick={handleResetFilters}
                      disabled={propertiesLoading}
                    >
                      <FilterX className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Linha Inferior: Personalização de Período & Filtro de WhatsApp */}
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Seletor de Modo de Período */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" /> Período sem Contato:
                      </span>
                      <div className="flex items-center gap-1 bg-background p-0.5 rounded-md border border-input text-xs">
                        <button
                          type="button"
                          onClick={() => setPeriodoModo("presets")}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                            periodoModo === "presets"
                              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Predefinições
                        </button>
                        <button
                          type="button"
                          onClick={() => setPeriodoModo("custom_days")}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                            periodoModo === "custom_days"
                              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Dias Personalizados
                        </button>
                        <button
                          type="button"
                          onClick={() => setPeriodoModo("custom_range")}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                            periodoModo === "custom_range"
                              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Intervalo de Datas
                        </button>
                      </div>
                    </div>

                    {/* Toggle: Apenas com WhatsApp */}
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
                      <input
                        type="checkbox"
                        checked={apenasComTelefoneFiltro}
                        onChange={(e) => setApenasComTelefoneFiltro(e.target.checked)}
                        className="rounded border-input text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Apenas com WhatsApp válido</span>
                    </label>
                  </div>

                  {/* Inputs específicos do modo de período */}
                  {periodoModo === "presets" && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {[
                        { label: "Todos os contatos", val: 0 },
                        { label: "> 15 dias", val: 15 },
                        { label: "> 30 dias (Recomendado)", val: 30 },
                        { label: "> 60 dias (Esfriando)", val: 60 },
                        { label: "> 90 dias (Urgente)", val: 90 },
                        { label: "> 180 dias (+6 meses)", val: 180 },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setDiasFiltroProps(item.val)}
                          className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer border ${
                            diasFiltroProps === item.val
                              ? "bg-emerald-600/15 border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
                              : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {periodoModo === "custom_days" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 max-w-md">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Mínimo de dias sem alteração:</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Ex: 45 dias"
                          value={diasMinimosCustom}
                          onChange={(e) => setDiasMinimosCustom(e.target.value)}
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Máximo de dias (opcional):</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Ex: 120 dias"
                          value={diasMaximosCustom}
                          onChange={(e) => setDiasMaximosCustom(e.target.value)}
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                    </div>
                  )}

                  {periodoModo === "custom_range" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 max-w-md">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Data Inicial (Desde):</Label>
                        <Input
                          type="date"
                          value={dataInicioCustom}
                          onChange={(e) => setDataInicioCustom(e.target.value)}
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Data Final (Até):</Label>
                        <Input
                          type="date"
                          value={dataFimCustom}
                          onChange={(e) => setDataFimCustom(e.target.value)}
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Barra de Busca de Texto Instantânea e Ações em Massa */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por código, proprietário, bairro, telefone..."
                      value={searchPropTerm}
                      onChange={(e) => setSearchPropTerm(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchProperties()}
                      className="h-8 text-xs pl-8"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-medium"
                      onClick={selectAllProperties}
                      disabled={filteredProperties.length === 0}
                    >
                      {selectedPropertyCodes.length === filteredProperties.length && filteredProperties.length > 0 ? (
                        <>
                          <CheckSquare className="h-3.5 w-3.5 mr-1 text-primary" /> Desmarcar Todos
                        </>
                      ) : (
                        <>
                          <Square className="h-3.5 w-3.5 mr-1" /> Selecionar Todos ({filteredProperties.length})
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      onClick={handleOpenOwnersReview}
                      disabled={selectedPropertyCodes.length === 0}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      Conferir e Disparar para {selectedPropertyCodes.length} Proprietários
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Banner de Carregamento com Botão de Interromper */}
            {propertiesLoading && (
              <Card className="border-emerald-500/40 bg-emerald-500/10 p-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 text-emerald-900 dark:text-emerald-200">
                    <RefreshCw className="h-4 w-4 animate-spin text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-semibold">Consultando proprietários no Imoview CRM...</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Esta consulta pode levar alguns segundos dependendo da quantidade de contatos.
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                    onClick={handleCancelSearch}
                  >
                    <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
                    Interromper Busca
                  </Button>
                </div>
              </Card>
            )}

            {/* Empty State Inicial: Antes da primeira busca */}
            {!propertiesLoading && !hasSearchedProps && properties.length === 0 && (
              <Card className="p-10 text-center border-dashed bg-card/60">
                <Users className="h-12 w-12 mx-auto mb-3 text-emerald-600 opacity-70" />
                <h3 className="text-base font-bold text-foreground">
                  Pronto para consultar proprietários no Imoview
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                  Ajuste os filtros de período e carteira acima e clique no botão verde para carregar a lista de proprietários da sua base.
                </p>
                <Button
                  className="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  onClick={fetchProperties}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Filtrar Contatos Agora
                </Button>
              </Card>
            )}

            {/* Empty State: Busca realizada mas sem resultados */}
            {!propertiesLoading && hasSearchedProps && filteredProperties.length === 0 && (
              <Card className="p-10 text-center border-dashed bg-card/60">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-amber-500 opacity-70" />
                <h3 className="text-base font-bold text-foreground">
                  Nenhum proprietário encontrado com os filtros selecionados
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                  Tente alterar os dias sem contato, mudar para &quot;Todos os contatos&quot; ou selecionar outra carteira.
                </p>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={handleResetFilters}>
                    <FilterX className="h-3.5 w-3.5 mr-1.5" />
                    Limpar Filtros
                  </Button>
                  <Button size="sm" className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white" onClick={fetchProperties}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Tentar Novamente
                  </Button>
                </div>
              </Card>
            )}

            {filteredProperties.length > 0 && (
              <div className="border border-border/60 rounded-xl overflow-hidden shadow-xs bg-card">
                <div className="max-h-[550px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground sticky top-0 border-b border-border/40">
                      <tr>
                        <th className="p-3 text-left w-10">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={
                              selectedPropertyCodes.length === filteredProperties.length &&
                              filteredProperties.length > 0
                            }
                            onChange={selectAllProperties}
                          />
                        </th>
                        <th className="p-3 text-left font-semibold">Imóvel & Código</th>
                        <th className="p-3 text-left font-semibold">Localização</th>
                        <th className="p-3 text-left font-semibold">Finalidade / Valor</th>
                        <th className="p-3 text-center font-semibold">Sem Atualização</th>
                        <th className="p-3 text-left font-semibold">Proprietário & Contato</th>
                        <th className="p-3 text-center font-semibold w-16">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredProperties.map((prop) => {
                        const isSelected = selectedPropertyCodes.includes(prop.codigo);
                        const hasPhone =
                          prop.proprietarioTelefone &&
                          prop.proprietarioTelefone.replace(/\D/g, "").length >= 8;

                        return (
                          <tr
                            key={prop.codigo}
                            className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                              isSelected ? "bg-primary/5" : ""
                            }`}
                            onClick={() => toggleSelectProperty(prop.codigo)}
                          >
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="rounded"
                                checked={isSelected}
                                onChange={() => toggleSelectProperty(prop.codigo)}
                              />
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div>
                                  <div className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                                    <span className="font-mono text-primary font-bold">#{prop.codigo}</span>
                                    <span>{prop.tipo}</span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                                    {prop.titulo}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="font-medium text-foreground">{prop.bairro || "Santos"}</div>
                              <div className="text-[10px] text-muted-foreground">{prop.cidade || "SP"}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {prop.valor}
                              </div>
                              <Badge variant="outline" className="text-[9px] mt-0.5">
                                {prop.finalidade}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              <Badge
                                variant={
                                  prop.diasSemAtualizacao >= 90
                                    ? "destructive"
                                    : prop.diasSemAtualizacao >= 60
                                    ? "secondary"
                                    : prop.diasSemAtualizacao >= 30
                                    ? "outline"
                                    : "outline"
                                }
                                className={`text-[10px] font-mono font-semibold ${
                                  prop.diasSemAtualizacao >= 90
                                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                    : prop.diasSemAtualizacao >= 60
                                    ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30"
                                    : prop.diasSemAtualizacao >= 30
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                }`}
                              >
                                {prop.diasSemAtualizacao} dias
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-foreground text-xs">
                                {prop.proprietarioNome || "Não informado"}
                              </div>
                              <div className="text-[11px] font-mono flex items-center gap-1">
                                {hasPhone ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <Phone className="h-3 w-3" /> {prop.proprietarioTelefone}
                                  </span>
                                ) : (
                                  <span className="text-rose-500 text-[10px] flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> Sem telefone (Clique em editar)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Editar dados do proprietário"
                                onClick={() =>
                                  setEditContactModal({
                                    open: true,
                                    type: "property",
                                    id: prop.codigo,
                                    name: prop.proprietarioNome,
                                    phone: prop.proprietarioTelefone,
                                  })
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
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
        {/* TAB 3: CONFIGURAÇÃO DA CONEXÃO IMOVIEW */}
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
                      Essa chave é mantida em segurança e utilizada para consultar atendimentos e imóveis.
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
                      <Switch checked={autoRecordInteraction} onCheckedChange={setAutoRecordInteraction} />
                    </div>

                    {/* Auto Record Inbound */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-medium">Registrar Resposta do Cliente no Imoview</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Quando o cliente responder no WhatsApp, o sistema adiciona a resposta no histórico do
                          atendimento.
                        </p>
                      </div>
                      <Switch checked={autoRecordResponse} onCheckedChange={setAutoRecordResponse} />
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
                    Como funciona a Integração com Imoview:
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                  <p>
                    <strong>1. Resgate de Leads:</strong> Puxa atendimentos parados sem interação há mais de X dias,
                    permitindo reconectar com interessados.
                  </p>
                  <p>
                    <strong>2. Gestão de Proprietários:</strong> Filtra imóveis sem atualização cadastral há 30, 60 ou 90
                    dias para checar se o imóvel continua à venda/locação e se o preço foi alterado.
                  </p>
                  <div className="bg-background p-2.5 rounded-lg border border-border/60 font-mono text-[11px] space-y-1">
                    <div>
                      <code className="text-primary font-bold">{"{{nome_proprietario}}"}</code>: Nome do dono do imóvel
                    </div>
                    <div>
                      <code className="text-primary font-bold">{"{{codigo_imovel}}"}</code>: Código cadastral no CRM
                    </div>
                    <div>
                      <code className="text-primary font-bold">{"{{tipo_imovel}}"}</code>: Ex: Apartamento, Casa
                    </div>
                    <div>
                      <code className="text-primary font-bold">{"{{valor}}"}</code>: Valor atual no Imoview
                    </div>
                    <div>
                      <code className="text-primary font-bold">{"{{bairro}}"}</code>: Bairro onde fica o imóvel
                    </div>
                  </div>
                  <p>
                    <strong>3. Feedback no CRM:</strong> O histórico de envios e respostas alimenta diretamente a linha
                    do tempo do Imoview.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: EDIÇÃO RÁPIDA DE CONTATO (LEAD OU PROPRIETÁRIO) */}
        {/* ========================================================================= */}
        <Dialog
          open={editContactModal.open}
          onOpenChange={(open) => setEditContactModal((prev) => ({ ...prev, open }))}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                Editar Contato {editContactModal.type === "lead" ? "do Lead" : "do Proprietário"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ajuste o nome ou número de WhatsApp antes de disparar.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nome Completo:</Label>
                <Input
                  value={editContactModal.name}
                  onChange={(e) => setEditContactModal((prev) => ({ ...prev, name: e.target.value }))}
                  className="text-xs h-9"
                  placeholder="Nome do cliente ou proprietário"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Telefone / WhatsApp (com DDD):</Label>
                <Input
                  value={editContactModal.phone}
                  onChange={(e) => setEditContactModal((prev) => ({ ...prev, phone: e.target.value }))}
                  className="text-xs h-9 font-mono"
                  placeholder="Ex: 13997778899 ou 5513997778899"
                />
                <p className="text-[10px] text-muted-foreground">
                  O código DDI 55 será formatado automaticamente no envio.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditContactModal((prev) => ({ ...prev, open: false }))}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveContactEdit}>
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL: CONFERÊNCIA DOS DESTINATÁRIOS ANTES DO DISPARO */}
        {/* ========================================================================= */}
        <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-emerald-600" />
                  Conferir Destinatários & Modelo ({reviewRecipients.length})
                </span>
                <Badge variant="outline" className="text-xs font-mono">
                  {reviewType === "leads" ? "Resgate de Leads" : "Proprietários de Imóveis"}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Revise os números que receberão a mensagem, remova ou edite qualquer contato antes de prosseguir.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
              {/* Seleção do Modelo de Mensagem */}
              <div className="bg-muted/40 p-3 rounded-lg border border-border/40 space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Modelo de Mensagem Sugerido:
                </Label>
                <select
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <option value="">Mensagem Padrão do Sistema</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      [{tpl.category.toUpperCase()}] {tpl.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Você poderá editar o texto completo, spintax e intervalos na tela de disparo.
                </p>
              </div>

              {/* Lista dos Destinatários com Edição Inline */}
              <div className="border border-border/60 rounded-lg overflow-hidden flex-1 flex flex-col bg-card">
                <div className="bg-muted/60 p-2.5 text-[11px] font-semibold text-muted-foreground flex items-center justify-between border-b border-border/40">
                  <span>Lista de Telefones ({reviewRecipients.length})</span>
                  <span className="text-[10px] font-normal">Edite diretamente ou remova clicando no X</span>
                </div>
                <div className="overflow-y-auto max-h-[300px] divide-y divide-border/40 text-xs">
                  {reviewRecipients.map((rec) => (
                    <div key={rec.id} className="p-2.5 flex items-center gap-3 hover:bg-muted/20">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-4">
                          <Input
                            value={rec.name}
                            onChange={(e) => handleUpdateReviewItem(rec.id, "name", e.target.value)}
                            className="h-7 text-xs font-semibold"
                            placeholder="Nome"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <Input
                            value={rec.phone}
                            onChange={(e) => handleUpdateReviewItem(rec.id, "phone", e.target.value)}
                            className="h-7 text-xs font-mono"
                            placeholder="Telefone"
                          />
                        </div>
                        <div className="sm:col-span-4 text-[11px] text-muted-foreground truncate">
                          {rec.extraInfo}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 shrink-0"
                        title="Remover destinatário"
                        onClick={() => handleRemoveReviewItem(rec.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
              <Button variant="outline" size="sm" onClick={() => setReviewModalOpen(false)}>
                Voltar
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={handleProceedToBroadcast}
                disabled={reviewRecipients.length === 0}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Prosseguir para o Disparador ({reviewRecipients.length})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SessionGuard>
  );
}
