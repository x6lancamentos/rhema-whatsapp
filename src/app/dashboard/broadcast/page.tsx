"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
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
  CheckCircle2,
  XCircle,
  Radio,
  Clock,
  History,
  Eye,
  FileSpreadsheet,
  Tag,
  Users,
  Edit3,
  Bookmark,
  Sparkles,
  Download,
  Trash2,
  Pause,
  Play,
  RotateCcw,
  Plus,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/dashboard/session-provider";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { useSocket } from "@/components/chat/socket-context";
import { parseSpreadsheet, ParsedContactRow } from "@/lib/spreadsheet-parser";
import { processPersonalizedMessage, sanitizePhoneNumber } from "@/lib/spintax";
import * as XLSX from "xlsx";

interface BroadcastProgress {
  broadcastId: string;
  status: "running" | "completed" | "paused" | "cancelled";
  total: number;
  sent: number;
  failed: number;
  current?: string | null;
  currentName?: string | null;
  currentMessage?: string | null;
  progress?: number;
  errors?: { jid: string; error: string }[];
  startedAt?: string;
  completedAt?: string;
}

interface BroadcastLog {
  id: string;
  sessionId: string;
  message: string;
  total: number;
  sent: number;
  failed: number;
  status: string;
  delay: number;
  minDelay?: number;
  maxDelay?: number;
  startedAt: string;
  completedAt: string | null;
  recipients?: BroadcastRecipient[];
}

interface BroadcastRecipient {
  id: string;
  jid: string;
  name?: string | null;
  resolvedMessage?: string | null;
  status: string;
  error?: string | null;
  sentAt?: string | null;
}

interface LabelOption {
  id: string;
  name: string;
  colorHex?: string;
  _count?: { chatLabels: number };
}

interface TemplateOption {
  id: string;
  name: string;
  category?: string | null;
  content: string;
}

interface ContactListOption {
  id: string;
  name: string;
  totalCount: number;
  createdAt: string;
}

export default function BroadcastPage() {
  const { sessionId } = useSession();
  const { getSocket, joinSession } = useSocket();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"new" | "templates" | "lists" | "history">("new");

  // Recipient Mode: "file" | "label" | "list" | "manual"
  const [recipientSource, setRecipientSource] = useState<"file" | "label" | "list" | "manual">("file");

  // Contacts State
  const [contactsList, setContactsList] = useState<ParsedContactRow[]>([]);
  const [manualText, setManualText] = useState("");
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [fileStats, setFileStats] = useState<{ name: string; total: number; valid: number; duplicates: number } | null>(null);

  // Message & Editor State
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Delay & Anti-Ban Configuration
  const [minDelaySec, setMinDelaySec] = useState(15);
  const [maxDelaySec, setMaxDelaySec] = useState(45);
  const [enableBatchPause, setEnableBatchPause] = useState(true);
  const [batchSize, setBatchSize] = useState(20);
  const [batchPauseMin, setBatchPauseMin] = useState(3);

  // Real-time progress and control
  const [loading, setLoading] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<BroadcastProgress | null>(null);

  // Labels & Saved Lists Data
  const [labels, setLabels] = useState<LabelOption[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState("");
  const [savedLists, setSavedLists] = useState<ContactListOption[]>([]);
  const [selectedListId, setSelectedListId] = useState("");

  // Templates Data
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [newTemplateDialogOpen, setNewTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saveListDialogOpen, setSaveListDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  // History Tab
  const [history, setHistory] = useState<BroadcastLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<BroadcastLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Preview simulation
  const [previewSample, setPreviewSample] = useState<string>("");

  // 1. Socket.IO connection for real-time broadcast updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !sessionId) return;

    const onConnect = () => joinSession(sessionId);
    if (socket.connected) joinSession(sessionId);
    socket.on("connect", onConnect);

    const progressHandler = (data: BroadcastProgress) => {
      setBroadcastProgress(data);
      if (data.status === "completed" || data.status === "cancelled") {
        setLoading(false);
        fetchHistory();
        if (data.status === "completed") {
          if (data.failed === 0) {
            toast.success(`Disparo concluído com sucesso! ${data.sent} mensagens enviadas.`);
          } else {
            toast.warning(`Disparo finalizado: ${data.sent} enviadas, ${data.failed} falhas.`);
          }
        }
      }
    };

    const controlHandler = (data: { broadcastId: string; status: any }) => {
      setBroadcastProgress((prev) => (prev ? { ...prev, status: data.status } : null));
      if (data.status === "cancelled") setLoading(false);
    };

    socket.on("broadcast.progress", progressHandler);
    socket.on("broadcast.control", controlHandler);

    return () => {
      socket.off("connect", onConnect);
      socket.off("broadcast.progress", progressHandler);
      socket.off("broadcast.control", controlHandler);
    };
  }, [sessionId, getSocket, joinSession]);

  // 2. Load Labels, Templates, and Saved Lists
  const fetchLabels = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/labels?sessionId=${sessionId}`);
      if (res.ok) {
        const json = await res.json();
        setLabels(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch labels", e);
    }
  }, [sessionId]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/templates`);
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch templates", e);
    }
  }, []);

  const fetchSavedLists = useCallback(async () => {
    try {
      const res = await fetch(`/api/contact-lists`);
      if (res.ok) {
        const json = await res.json();
        setSavedLists(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch contact lists", e);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!sessionId) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/messages/${sessionId}/broadcast/history?limit=30`);
      if (res.ok) {
        const json = await res.json();
        setHistory(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch broadcast history", e);
    } finally {
      setHistoryLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchTemplates();
    fetchSavedLists();
  }, [fetchTemplates, fetchSavedLists]);

  useEffect(() => {
    if (sessionId) {
      fetchLabels();
      if (activeTab === "history") fetchHistory();
    }
  }, [sessionId, activeTab, fetchLabels, fetchHistory]);

  // 3. File Upload Handler (Excel/CSV)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info("Processando planilha...");
      const result = await parseSpreadsheet(file);
      setContactsList(result.validContacts);
      setDetectedColumns(result.columns);
      setFileStats({
        name: file.name,
        total: result.totalRows,
        valid: result.validContacts.length,
        duplicates: result.duplicateCount,
      });
      toast.success(`${result.validContacts.length} contatos válidos identificados na planilha!`);
      updatePreview(message, result.validContacts);
    } catch (err: any) {
      toast.error(`Erro ao ler arquivo: ${err.message}`);
    }
  };

  // 4. Label Selection Handler
  const handleSelectLabel = async (labelId: string) => {
    setSelectedLabelId(labelId);
    if (!labelId || !sessionId) return;

    try {
      toast.info("Carregando contatos da etiqueta...");
      const res = await fetch(`/api/chats/${sessionId}/by-label/${labelId}`);
      if (!res.ok) throw new Error("Falha ao buscar contatos da etiqueta");
      const json = await res.json();

      const mapped: ParsedContactRow[] = (json.contacts || []).map((c: any) => ({
        originalPhone: c.phone,
        phone: c.phone,
        jid: c.jid,
        name: c.name || "",
        isValid: true,
        variables: { nome: c.name || "", telefone: c.phone },
      }));

      setContactsList(mapped);
      setDetectedColumns(["nome", "telefone"]);
      setFileStats({
        name: `Etiqueta: ${json.label?.name}`,
        total: mapped.length,
        valid: mapped.length,
        duplicates: 0,
      });
      toast.success(`${mapped.length} contatos carregados da etiqueta!`);
      updatePreview(message, mapped);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // 5. Saved List Selection Handler
  const handleSelectSavedList = async (listId: string) => {
    setSelectedListId(listId);
    if (!listId) return;

    try {
      const res = await fetch(`/api/contact-lists/${listId}`);
      if (!res.ok) throw new Error("Falha ao carregar lista");
      const json = await res.json();
      const listData = json.data;

      const rawContacts = Array.isArray(listData.contacts) ? listData.contacts : [];
      const mapped: ParsedContactRow[] = rawContacts.map((c: any) => ({
        originalPhone: c.phone || c.jid || "",
        phone: c.phone || "",
        jid: c.jid || sanitizePhoneNumber(c.phone).jid,
        name: c.name || "",
        isValid: true,
        variables: c.variables || { nome: c.name || "", telefone: c.phone || "" },
      }));

      setContactsList(mapped);
      const cols = mapped.length > 0 ? Object.keys(mapped[0].variables || {}) : ["nome", "telefone"];
      setDetectedColumns(cols);
      setFileStats({
        name: `Lista: ${listData.name}`,
        total: mapped.length,
        valid: mapped.length,
        duplicates: 0,
      });
      toast.success(`${mapped.length} contatos carregados da lista!`);
      updatePreview(message, mapped);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // 6. Manual Contacts parsing
  const handleManualContactsChange = (text: string) => {
    setManualText(text);
    const lines = text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const parsed: ParsedContactRow[] = [];
    const seen = new Set<string>();

    for (const raw of lines) {
      const sanitized = sanitizePhoneNumber(raw);
      if (sanitized.isValid && !seen.has(sanitized.jid)) {
        seen.add(sanitized.jid);
        parsed.push({
          originalPhone: raw,
          phone: sanitized.phone,
          jid: sanitized.jid,
          name: "",
          isValid: true,
          variables: { telefone: sanitized.phone },
        });
      }
    }

    setContactsList(parsed);
    setDetectedColumns(["telefone"]);
    updatePreview(message, parsed);
  };

  // 7. Insert Tag/Variable or Spintax into Message at cursor position
  const insertTextAtCursor = (insertText: string) => {
    if (!textareaRef.current) {
      setMessage((prev) => prev + insertText);
      return;
    }
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = message;
    const newText = text.substring(0, start) + insertText + text.substring(end);
    setMessage(newText);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + insertText.length, start + insertText.length);
    }, 10);
    updatePreview(newText, contactsList);
  };

  // 8. Update Live Preview
  const updatePreview = (msg: string, contacts: ParsedContactRow[]) => {
    if (!msg.trim()) {
      setPreviewSample("");
      return;
    }
    const sampleContact = contacts[0] || {
      name: "Brunno",
      phone: "5519998765432",
      variables: { nome: "Brunno", cidade: "Campinas", imovel: "Apartamento Jardins" },
    };
    const sample = processPersonalizedMessage(msg, {
      ...sampleContact.variables,
      nome: sampleContact.name || "Brunno",
      telefone: sampleContact.phone,
    });
    setPreviewSample(sample);
  };

  useEffect(() => {
    updatePreview(message, contactsList);
  }, [message, contactsList]);

  // 9. Save Current Contacts as Reusable List
  const handleSaveContactList = async () => {
    if (!newListName.trim()) return toast.error("Digite um nome para a lista");
    if (contactsList.length === 0) return toast.error("Nenhum contato para salvar");

    try {
      const res = await fetch("/api/contact-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newListName,
          contacts: contactsList.map((c) => ({
            phone: c.phone,
            name: c.name,
            variables: c.variables,
          })),
        }),
      });

      if (res.ok) {
        toast.success("Lista salva com sucesso!");
        setSaveListDialogOpen(false);
        setNewListName("");
        fetchSavedLists();
      } else {
        toast.error("Erro ao salvar lista");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // 10. Save Message as Template
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return toast.error("Digite um nome para o modelo");
    if (!message.trim()) return toast.error("A mensagem não pode ser vazia");

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          content: message,
          category: "Disparo",
        }),
      });

      if (res.ok) {
        toast.success("Modelo salvo com sucesso!");
        setNewTemplateDialogOpen(false);
        setTemplateName("");
        fetchTemplates();
      } else {
        toast.error("Erro ao salvar modelo");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // 11. Start Broadcast
  const handleStartBroadcast = async () => {
    if (!sessionId) return toast.error("Nenhuma sessão ativa selecionada");
    if (contactsList.length === 0) return toast.error("Adicione contatos para enviar");
    if (!message.trim()) return toast.error("Digite o texto da mensagem");

    setLoading(true);
    setBroadcastProgress(null);

    try {
      const payload = {
        recipients: contactsList.map((c) => ({
          phone: c.phone,
          jid: c.jid,
          name: c.name,
          variables: c.variables,
        })),
        message,
        minDelay: minDelaySec * 1000,
        maxDelay: maxDelaySec * 1000,
        batchSize: enableBatchPause ? batchSize : null,
        batchPause: enableBatchPause ? batchPauseMin * 60 : null,
      };

      const res = await fetch(`/api/messages/${sessionId}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Disparo iniciado para ${contactsList.length} destinatários!`);
      } else {
        toast.error(data.message || "Erro ao iniciar disparo");
        setLoading(false);
      }
    } catch (e: any) {
      toast.error("Erro ao conectar com servidor");
      setLoading(false);
    }
  };

  // 12. Control Broadcast (Pause / Resume / Cancel)
  const handleControlBroadcast = async (action: "pause" | "resume" | "cancel") => {
    if (!broadcastProgress?.broadcastId || !sessionId) return;
    try {
      const res = await fetch(
        `/api/messages/${sessionId}/broadcast/${broadcastProgress.broadcastId}/control`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (res.ok) {
        toast.success(`Disparo ${action === "pause" ? "pausado" : action === "resume" ? "retomado" : "cancelado"}`);
      }
    } catch (e: any) {
      toast.error("Falha ao enviar comando de controle");
    }
  };

  // 13. Export History Report to Excel
  const handleExportReport = (log: BroadcastLog) => {
    if (!log.recipients || log.recipients.length === 0) {
      return toast.warning("Sem detalhes de destinatários para exportar");
    }

    const data = log.recipients.map((r) => ({
      Telefone: r.jid.replace("@s.whatsapp.net", ""),
      Nome: r.name || "",
      Status: r.status === "sent" ? "Enviado" : r.status === "failed" ? "Falhou" : "Pendente",
      Erro: r.error || "",
      DataEnvio: r.sentAt ? new Date(r.sentAt).toLocaleString("pt-BR") : "",
      MensagemPersonalizada: r.resolvedMessage || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatorio_Disparo");
    XLSX.writeFile(workbook, `relatorio_disparo_${log.id.slice(0, 8)}.xlsx`);
    toast.success("Relatório Excel baixado!");
  };

  // 14. Retry Failed Recipients
  const handleRetryFailed = (log: BroadcastLog) => {
    const failedRecipients = (log.recipients || []).filter((r) => r.status === "failed");
    if (failedRecipients.length === 0) {
      return toast.info("Não há contatos com falha neste disparo");
    }

    const mapped: ParsedContactRow[] = failedRecipients.map((r) => ({
      originalPhone: r.jid.replace("@s.whatsapp.net", ""),
      phone: r.jid.replace("@s.whatsapp.net", ""),
      jid: r.jid,
      name: r.name || "",
      isValid: true,
      variables: { nome: r.name || "", telefone: r.jid.replace("@s.whatsapp.net", "") },
    }));

    setContactsList(mapped);
    setMessage(log.message);
    setActiveTab("new");
    setRecipientSource("manual");
    setDetailOpen(false);
    toast.success(`${mapped.length} contatos com falha carregados para novo envio!`);
  };

  // Open History Detail Modal
  const openDetail = async (log: BroadcastLog) => {
    setSelectedLog(log);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/messages/${sessionId}/broadcast/history/${log.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedLog(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <SessionGuard>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
              <Sparkles className="h-7 w-7 text-primary animate-pulse" />
              Disparador Inteligente & Broadcast
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Envios em massa com proteção anti-ban, spintax dinâmico, variáveis personalizadas e importação de planilhas.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex bg-muted/60 p-1 rounded-xl w-fit border border-border/40 shadow-xs">
            <button
              onClick={() => setActiveTab("new")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === "new"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Send className="h-4 w-4 text-primary" />
              Novo Disparo
            </button>
            <button
              onClick={() => setActiveTab("templates")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === "templates"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bookmark className="h-4 w-4 text-amber-500" />
              Modelos ({templates.length})
            </button>
            <button
              onClick={() => setActiveTab("lists")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === "lists"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-4 w-4 text-blue-500" />
              Listas ({savedLists.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === "history"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="h-4 w-4 text-emerald-500" />
              Histórico
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: NOVO DISPARO */}
        {/* ========================================================================= */}
        {activeTab === "new" && (
          <div className="space-y-6">
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
              {/* COLUNA ESQUERDA: DESTINATÁRIOS (5 COLUNAS) */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="border-border/60 shadow-sm overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/20 border-b border-border/40">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        1. Origem dos Destinatários
                      </CardTitle>
                      <Badge variant="secondary" className="font-mono text-xs font-semibold">
                        {contactsList.length} contatos
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    {/* Botões de Escolha de Origem */}
                    <div className="grid grid-cols-4 gap-1.5 bg-muted/50 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setRecipientSource("file")}
                        className={`text-xs py-1.5 px-2 rounded-md font-medium flex flex-col items-center gap-1 transition-all ${
                          recipientSource === "file"
                            ? "bg-background text-primary font-bold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Planilha</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecipientSource("label")}
                        className={`text-xs py-1.5 px-2 rounded-md font-medium flex flex-col items-center gap-1 transition-all ${
                          recipientSource === "label"
                            ? "bg-background text-primary font-bold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Tag className="h-4 w-4" />
                        <span>Etiquetas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecipientSource("list")}
                        className={`text-xs py-1.5 px-2 rounded-md font-medium flex flex-col items-center gap-1 transition-all ${
                          recipientSource === "list"
                            ? "bg-background text-primary font-bold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Bookmark className="h-4 w-4" />
                        <span>Listas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecipientSource("manual")}
                        className={`text-xs py-1.5 px-2 rounded-md font-medium flex flex-col items-center gap-1 transition-all ${
                          recipientSource === "manual"
                            ? "bg-background text-primary font-bold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Edit3 className="h-4 w-4" />
                        <span>Manual</span>
                      </button>
                    </div>

                    {/* Origem: Planilha Excel / CSV */}
                    {recipientSource === "file" && (
                      <div className="space-y-3">
                        <label className="border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer bg-primary/5 hover:bg-primary/10">
                          <UploadCloud className="h-8 w-8 text-primary mb-2" />
                          <span className="text-sm font-semibold text-foreground">
                            Clique ou arraste sua planilha
                          </span>
                          <span className="text-xs text-muted-foreground mt-0.5">
                            Suporta arquivos .xlsx, .xls e .csv
                          </span>
                          <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={loading}
                          />
                        </label>

                        {fileStats && (
                          <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1.5 border border-border/50">
                            <div className="flex justify-between font-semibold text-foreground">
                              <span className="truncate max-w-[200px]">{fileStats.name}</span>
                              <span className="text-primary font-bold">{fileStats.valid} válidos</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-[11px]">
                              <span>Total de Linhas: {fileStats.total}</span>
                              {fileStats.duplicates > 0 && (
                                <span className="text-amber-500 font-medium">
                                  {fileStats.duplicates} duplicados ignorados
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Origem: Etiquetas do WhatsApp */}
                    {recipientSource === "label" && (
                      <div className="space-y-3">
                        <Label className="text-xs">Selecione a Etiqueta do WhatsApp</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={selectedLabelId}
                          onChange={(e) => handleSelectLabel(e.target.value)}
                        >
                          <option value="">Selecione uma etiqueta...</option>
                          {labels.map((lbl) => (
                            <option key={lbl.id} value={lbl.id}>
                              {lbl.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                          O sistema buscará todos os contatos que possuem essa etiqueta na sessão conectada.
                        </p>
                      </div>
                    )}

                    {/* Origem: Listas Salvas */}
                    {recipientSource === "list" && (
                      <div className="space-y-3">
                        <Label className="text-xs">Selecione uma Lista Salva</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={selectedListId}
                          onChange={(e) => handleSelectSavedList(e.target.value)}
                        >
                          <option value="">Selecione uma lista salva...</option>
                          {savedLists.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name} ({l.totalCount} contatos)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Origem: Manual */}
                    {recipientSource === "manual" && (
                      <div className="space-y-2">
                        <Label className="text-xs">Digite ou Cole os Números (com DDD)</Label>
                        <Textarea
                          placeholder={"11999998888\n19988887777\n5521998887766"}
                          className="min-h-[140px] font-mono text-xs"
                          value={manualText}
                          onChange={(e) => handleManualContactsChange(e.target.value)}
                          disabled={loading}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Um por linha ou separados por vírgula. O DDI 55 é inserido automaticamente.
                        </p>
                      </div>
                    )}

                    {/* Resumo & Ação de Salvar Lista */}
                    {contactsList.length > 0 && (
                      <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {contactsList.length} prontos para envio
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setSaveListDialogOpen(true)}
                        >
                          <Bookmark className="h-3 w-3 mr-1 text-primary" />
                          Salvar como Lista
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Variáveis Detectadas Disponíveis */}
                {detectedColumns.length > 0 && (
                  <Card className="border-border/60 shadow-xs">
                    <CardHeader className="py-2.5 px-4 bg-muted/20 border-b border-border/40">
                      <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                        <Tag className="h-3.5 w-3.5 text-primary" />
                        Variáveis da Planilha Identificadas (Clique para Inserir)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 flex flex-wrap gap-1.5">
                      {detectedColumns.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => insertTextAtCursor(`{{${col.toLowerCase()}}}`)}
                          className="px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-mono text-[11px] font-semibold transition-colors"
                          title={`Inserir {{${col.toLowerCase()}}}`}
                        >
                          +{`{{${col.toLowerCase()}}`}
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* COLUNA DIREITA: EDITOR + SIMULADOR + CONTROLE ANTI-BAN (7 COLUNAS) */}
              <div className="lg:col-span-7 space-y-4">
                <Card className="border-border/60 shadow-sm">
                  <CardHeader className="pb-3 bg-muted/20 border-b border-border/40">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Edit3 className="h-4 w-4 text-primary" />
                        2. Mensagem, Spintax & Modelos
                      </CardTitle>

                      {/* Dropdown de Modelos Prontos */}
                      {templates.length > 0 && (
                        <select
                          className="text-xs h-7 rounded-md border border-input bg-background px-2 py-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                          onChange={(e) => {
                            const found = templates.find((t) => t.id === e.target.value);
                            if (found) {
                              setMessage(found.content);
                              toast.info(`Modelo "${found.name}" carregado!`);
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Carregar Modelo Salvo...
                          </option>
                          {templates.map((tpl) => (
                            <option key={tpl.id} value={tpl.id}>
                              {tpl.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    {/* Barra de Atalhos de Variáveis */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground font-semibold">
                          Inserir Variáveis Dinâmicas & Spintax:
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] px-2 text-primary hover:bg-primary/10"
                          onClick={() => insertTextAtCursor("{Olá|Oi|Como vai|Tudo bem}")}
                        >
                          <Sparkles className="h-3 w-3 mr-1" /> Inserir Spintax Exemplo
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => insertTextAtCursor("{{primeiro_nome}}")}
                          className="px-2 py-0.5 bg-muted hover:bg-muted/80 rounded-md text-[11px] font-mono text-foreground font-medium transition-colors"
                        >
                          + {"{{primeiro_nome}}"}
                        </button>
                        <button
                          type="button"
                          onClick={() => insertTextAtCursor("{{nome}}")}
                          className="px-2 py-0.5 bg-muted hover:bg-muted/80 rounded-md text-[11px] font-mono text-foreground font-medium transition-colors"
                        >
                          + {"{{nome}}"}
                        </button>
                        <button
                          type="button"
                          onClick={() => insertTextAtCursor("{{saudacao}}")}
                          className="px-2 py-0.5 bg-muted hover:bg-muted/80 rounded-md text-[11px] font-mono text-foreground font-medium transition-colors"
                          title="Insere Bom dia, Boa tarde ou Boa noite conforme o horário"
                        >
                          + {"{{saudacao}}"}
                        </button>
                        <button
                          type="button"
                          onClick={() => insertTextAtCursor("{{telefone}}")}
                          className="px-2 py-0.5 bg-muted hover:bg-muted/80 rounded-md text-[11px] font-mono text-foreground font-medium transition-colors"
                        >
                          + {"{{telefone}}"}
                        </button>
                        <button
                          type="button"
                          onClick={() => insertTextAtCursor("{Olá|Oi|Tudo bem}")}
                          className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-md text-[11px] font-mono font-medium transition-colors"
                        >
                          + {"{Olá|Oi|Tudo bem}"}
                        </button>
                      </div>
                    </div>

                    {/* Textarea Principal */}
                    <div className="space-y-1.5">
                      <Textarea
                        ref={textareaRef}
                        placeholder="{Olá|Oi} {{primeiro_nome}}, {{saudacao}}! Tudo bem com você?&#10;&#10;Estou entrando em contato para apresentar {uma oportunidade exclusiva|uma novidade imperdível}..."
                        className="min-h-[160px] text-sm leading-relaxed"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={loading}
                      />
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground px-1">
                        <span>Dica: Use chaves {"{A|B|C}"} para alternar frases aleatoriamente.</span>
                        <div className="flex items-center gap-3">
                          <span>{message.length} caracteres</span>
                          <button
                            type="button"
                            onClick={() => setNewTemplateDialogOpen(true)}
                            className="text-primary hover:underline font-medium"
                          >
                            Salvar como Modelo
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Simulador de Preview Estilo WhatsApp */}
                    {previewSample && (
                      <div className="bg-slate-100 dark:bg-slate-900/60 p-3.5 rounded-xl border border-border/60 space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <Eye className="h-3.5 w-3.5" /> Pré-visualização WhatsApp (Simulação Real):
                          </span>
                          <button
                            type="button"
                            onClick={() => updatePreview(message, contactsList)}
                            className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                          >
                            <RotateCcw className="h-3 w-3" /> Sortear Outra Variação
                          </button>
                        </div>

                        {/* Balão WhatsApp */}
                        <div className="max-w-[85%] bg-white dark:bg-emerald-950/40 text-slate-800 dark:text-slate-100 rounded-xl rounded-tl-xs p-3 shadow-xs text-xs sm:text-sm whitespace-pre-wrap leading-relaxed border border-border/40">
                          {previewSample}
                          <div className="text-[10px] text-slate-400 dark:text-slate-400 text-right mt-1">
                            12:00 ✓✓
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Card de Configurações Anti-Ban & Timing */}
                <Card className="border-border/60 shadow-sm">
                  <CardHeader className="py-3 px-5 bg-muted/20 border-b border-border/40">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-emerald-500" />
                      3. Proteção Anti-Ban & Intervalos (Delay Randômico)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-5">
                    {/* Sliders de Delay Mínimo e Máximo */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <Label className="font-medium">Delay Mínimo: {minDelaySec}s</Label>
                        </div>
                        <Slider
                          min={2}
                          max={60}
                          step={1}
                          value={[minDelaySec]}
                          onValueChange={(val) => {
                            const v = val[0];
                            setMinDelaySec(v);
                            if (v > maxDelaySec) setMaxDelaySec(v);
                          }}
                          disabled={loading}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <Label className="font-medium">Delay Máximo: {maxDelaySec}s</Label>
                        </div>
                        <Slider
                          min={2}
                          max={60}
                          step={1}
                          value={[maxDelaySec]}
                          onValueChange={(val) => {
                            const v = val[0];
                            setMaxDelaySec(v);
                            if (v < minDelaySec) setMinDelaySec(v);
                          }}
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/40">
                      ⚡ O sistema sorteará um tempo aleatório entre <strong>{minDelaySec}s</strong> e{" "}
                      <strong>{maxDelaySec}s</strong> antes de cada envio, simulando digitação humana e impedindo que o
                      WhatsApp identifique envios robotizados.
                    </p>

                    {/* Pausa de Segurança em Lote */}
                    <div className="pt-2 border-t border-border/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-xs font-semibold text-foreground">
                            Pausa de Segurança em Lote (Humano-Like)
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Pausa o disparo periodicamente para descanso do número.
                          </p>
                        </div>
                        <Switch
                          checked={enableBatchPause}
                          onCheckedChange={setEnableBatchPause}
                          disabled={loading}
                        />
                      </div>

                      {enableBatchPause && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">A cada quantas mensagens:</Label>
                            <Input
                              type="number"
                              min={5}
                              max={100}
                              value={batchSize}
                              onChange={(e) => setBatchSize(Number(e.target.value) || 20)}
                              className="h-8 text-xs font-mono"
                              disabled={loading}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Pausar por quantos minutos:</Label>
                            <Input
                              type="number"
                              min={1}
                              max={30}
                              value={batchPauseMin}
                              onChange={(e) => setBatchPauseMin(Number(e.target.value) || 3)}
                              className="h-8 text-xs font-mono"
                              disabled={loading}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botão de Disparo */}
                    <Button
                      size="lg"
                      className="w-full h-12 text-sm font-bold shadow-md shadow-primary/20"
                      onClick={handleStartBroadcast}
                      disabled={loading || !sessionId || contactsList.length === 0 || !message.trim()}
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Disparando em Segundo Plano...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" /> Iniciar Disparo para {contactsList.length} Contatos
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Painel de Monitoramento ao Vivo (Socket.IO) */}
            {broadcastProgress && (
              <Card
                className={`border-2 transition-all shadow-lg ${
                  broadcastProgress.status === "completed"
                    ? "border-emerald-500/40 bg-emerald-50/10"
                    : broadcastProgress.status === "paused"
                    ? "border-amber-500/40 bg-amber-50/10"
                    : broadcastProgress.status === "cancelled"
                    ? "border-red-500/40 bg-red-50/10"
                    : "border-blue-500/40 bg-blue-50/10"
                }`}
              >
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      {broadcastProgress.status === "running" ? (
                        <>
                          <Radio className="h-5 w-5 text-blue-500 animate-pulse" />
                          <span>Disparo em Andamento</span>
                        </>
                      ) : broadcastProgress.status === "paused" ? (
                        <>
                          <Pause className="h-5 w-5 text-amber-500" />
                          <span>Disparo Pausado</span>
                        </>
                      ) : broadcastProgress.status === "completed" ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          <span>Disparo Concluído com Sucesso</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-500" />
                          <span>Disparo Interrompido</span>
                        </>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      ID: {broadcastProgress.broadcastId}
                    </CardDescription>
                  </div>

                  {/* Controles Ao Vivo */}
                  {broadcastProgress.status === "running" && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-amber-400 text-amber-600 hover:bg-amber-50"
                        onClick={() => handleControlBroadcast("pause")}
                      >
                        <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleControlBroadcast("cancel")}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                    </div>
                  )}

                  {broadcastProgress.status === "paused" && (
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleControlBroadcast("resume")}
                      >
                        <Play className="h-3.5 w-3.5 mr-1" /> Retomar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleControlBroadcast("cancel")}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Progresso dos Envios</span>
                      <span className="font-mono">
                        {broadcastProgress.sent + broadcastProgress.failed} / {broadcastProgress.total} (
                        {broadcastProgress.progress || 0}%)
                      </span>
                    </div>
                    <Progress value={broadcastProgress.progress || 0} className="h-2.5" />
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-background/80 p-2.5 rounded-lg border border-border/40">
                      <span className="text-[11px] text-muted-foreground block font-medium">Enviados</span>
                      <span className="text-lg font-bold text-emerald-600 font-mono">
                        {broadcastProgress.sent}
                      </span>
                    </div>
                    <div className="bg-background/80 p-2.5 rounded-lg border border-border/40">
                      <span className="text-[11px] text-muted-foreground block font-medium">Falhas</span>
                      <span className="text-lg font-bold text-red-500 font-mono">
                        {broadcastProgress.failed}
                      </span>
                    </div>
                    <div className="bg-background/80 p-2.5 rounded-lg border border-border/40">
                      <span className="text-[11px] text-muted-foreground block font-medium">Restantes</span>
                      <span className="text-lg font-bold text-muted-foreground font-mono">
                        {broadcastProgress.total - (broadcastProgress.sent + broadcastProgress.failed)}
                      </span>
                    </div>
                  </div>

                  {broadcastProgress.currentMessage && (
                    <div className="text-xs bg-background/90 p-3 rounded-lg border border-border/40 space-y-1">
                      <span className="text-[11px] text-muted-foreground font-medium block">
                        Última mensagem enviada ({broadcastProgress.currentName || broadcastProgress.current}):
                      </span>
                      <p className="font-mono text-foreground text-[11px] line-clamp-2">
                        {broadcastProgress.currentMessage}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MODELOS DE MENSAGEM */}
        {/* ========================================================================= */}
        {activeTab === "templates" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Modelos de Mensagem Salvos</h3>
                <p className="text-xs text-muted-foreground">
                  Crie e reutilize copys prontas com tags e spintax.
                </p>
              </div>
              <Button size="sm" onClick={() => setNewTemplateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Novo Modelo
              </Button>
            </div>

            {templates.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Nenhum modelo salvo ainda.</p>
                <p className="text-xs mt-1">Crie um novo modelo para agilizar seus disparos.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((tpl) => (
                  <Card key={tpl.id} className="border-border/60 flex flex-col justify-between">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-sm font-bold">{tpl.name}</CardTitle>
                        <Badge variant="outline" className="text-[10px]">
                          {tpl.category || "Geral"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/40 p-2.5 rounded-md line-clamp-4">
                        {tpl.content}
                      </p>
                      <div className="flex gap-2 pt-2 border-t border-border/40">
                        <Button
                          size="sm"
                          className="flex-1 text-xs h-8"
                          onClick={() => {
                            setMessage(tpl.content);
                            setActiveTab("new");
                            toast.info(`Modelo "${tpl.name}" carregado!`);
                          }}
                        >
                          Usar Modelo
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            if (!confirm("Excluir este modelo?")) return;
                            await fetch(`/api/templates/${tpl.id}`, { method: "DELETE" });
                            toast.success("Modelo excluído");
                            fetchTemplates();
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: LISTAS DE CONTATOS SALVAS */}
        {/* ========================================================================= */}
        {activeTab === "lists" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Listas de Contatos Salvas</h3>
                <p className="text-xs text-muted-foreground">
                  Suas listas salvas de clientes prontas para reenvios e campanhas.
                </p>
              </div>
            </div>

            {savedLists.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Nenhuma lista salva ainda.</p>
                <p className="text-xs mt-1">
                  Importe uma planilha na aba "Novo Disparo" e clique em "Salvar como Lista".
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedLists.map((l) => (
                  <Card key={l.id} className="border-border/60">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-sm font-bold">{l.name}</CardTitle>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {l.totalCount} contatos
                        </Badge>
                      </div>
                      <CardDescription className="text-[11px]">
                        Criada em {new Date(l.createdAt).toLocaleDateString("pt-BR")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 text-xs h-8"
                        onClick={() => {
                          handleSelectSavedList(l.id);
                          setRecipientSource("list");
                          setActiveTab("new");
                        }}
                      >
                        Carregar Lista para Disparo
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          if (!confirm("Excluir esta lista?")) return;
                          await fetch(`/api/contact-lists/${l.id}`, { method: "DELETE" });
                          toast.success("Lista excluída");
                          fetchSavedLists();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: HISTÓRICO DE DISPAROS & RELATÓRIOS */}
        {/* ========================================================================= */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Histórico de Disparos</h3>
                <p className="text-xs text-muted-foreground">
                  Acompanhe taxas de entrega, erros e baixe relatórios em Excel.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchHistory} disabled={historyLoading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${historyLoading ? "animate-spin" : ""}`} /> Atualizar
              </Button>
            </div>

            {history.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Nenhum histórico registrado.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {history.map((log) => (
                  <Card key={log.id} className="border-border/60 hover:border-primary/40 transition-colors">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            Disparo #{log.id.slice(0, 8)}
                          </span>
                          <Badge
                            variant={
                              log.status === "completed"
                                ? "default"
                                : log.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[10px] font-semibold uppercase"
                          >
                            {log.status === "completed"
                              ? "Concluído"
                              : log.status === "cancelled"
                              ? "Cancelado"
                              : "Em Andamento"}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(log.startedAt).toLocaleString("pt-BR")}
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground truncate max-w-xl font-mono">
                          {log.message}
                        </p>

                        <div className="flex gap-4 text-xs font-mono">
                          <span className="text-emerald-600 font-semibold">✓ {log.sent} enviados</span>
                          {log.failed > 0 && <span className="text-red-500 font-semibold">✗ {log.failed} falhas</span>}
                          <span className="text-muted-foreground">Total: {log.total}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openDetail(log)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> Ver Detalhes
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary"
                          title="Exportar Relatório Excel"
                          onClick={async () => {
                            const res = await fetch(`/api/messages/${sessionId}/broadcast/history/${log.id}`);
                            if (res.ok) {
                              const d = await res.json();
                              handleExportReport(d.data);
                            }
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: DETALHES DO DISPARO / RELATÓRIO INDIVIDUAL */}
        {/* ========================================================================= */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
            <DialogHeader>
              <div className="flex justify-between items-start pr-6">
                <div>
                  <DialogTitle className="text-lg font-bold">Relatório do Disparo #{selectedLog?.id.slice(0, 8)}</DialogTitle>
                  <DialogDescription className="text-xs">
                    Iniciado em {selectedLog?.startedAt ? new Date(selectedLog.startedAt).toLocaleString("pt-BR") : ""}
                  </DialogDescription>
                </div>
                {selectedLog && (
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => handleExportReport(selectedLog)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Baixar Excel
                  </Button>
                )}
              </div>
            </DialogHeader>

            {detailLoading ? (
              <div className="py-12 flex justify-center items-center">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : selectedLog ? (
              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-500/20">
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold block">Sucessos</span>
                    <span className="text-lg font-bold font-mono text-emerald-600">{selectedLog.sent}</span>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/20 p-2.5 rounded-lg border border-red-500/20">
                    <span className="text-xs text-red-700 dark:text-red-400 font-semibold block">Falhas</span>
                    <span className="text-lg font-bold font-mono text-red-500">{selectedLog.failed}</span>
                  </div>
                  <div className="bg-muted/40 p-2.5 rounded-lg border border-border/40">
                    <span className="text-xs text-muted-foreground font-semibold block">Taxa de Entrega</span>
                    <span className="text-lg font-bold font-mono text-foreground">
                      {selectedLog.total > 0 ? Math.round((selectedLog.sent / selectedLog.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Botão de Reenviar Falhas */}
                {selectedLog.failed > 0 && (
                  <div className="p-3 bg-red-50/50 dark:bg-red-950/10 border border-red-500/30 rounded-lg flex items-center justify-between">
                    <div className="text-xs text-red-700 dark:text-red-400 font-medium">
                      Houve {selectedLog.failed} falhas neste envio. Deseja tentar novamente apenas com elas?
                    </div>
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleRetryFailed(selectedLog)}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Reenviar Falhas
                    </Button>
                  </div>
                )}

                {/* Tabela de Destinatários com Texto Personalizado */}
                <div className="border border-border/60 rounded-lg overflow-hidden">
                  <div className="max-h-[320px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 text-muted-foreground sticky top-0 border-b border-border/40">
                        <tr>
                          <th className="p-2.5 text-left font-semibold">Contato</th>
                          <th className="p-2.5 text-left font-semibold">Status</th>
                          <th className="p-2.5 text-left font-semibold">Mensagem Personalizada Exata</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {(selectedLog.recipients || []).map((r) => (
                          <tr key={r.id} className="hover:bg-muted/20">
                            <td className="p-2.5 font-mono">
                              <div className="font-semibold">{r.name || "Sem Nome"}</div>
                              <div className="text-[10px] text-muted-foreground">{r.jid.replace("@s.whatsapp.net", "")}</div>
                            </td>
                            <td className="p-2.5">
                              {r.status === "sent" ? (
                                <Badge variant="default" className="text-[10px] bg-emerald-600">Enviado</Badge>
                              ) : r.status === "failed" ? (
                                <Badge variant="destructive" className="text-[10px]">Falhou</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">Pendente</Badge>
                              )}
                            </td>
                            <td className="p-2.5 max-w-xs truncate font-mono text-[11px] text-muted-foreground">
                              {r.resolvedMessage || selectedLog.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* MODAL: SALVAR COMO MODELO */}
        <Dialog open={newTemplateDialogOpen} onOpenChange={setNewTemplateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Salvar Mensagem como Modelo</DialogTitle>
              <DialogDescription>
                Dê um nome para este modelo para reutilizá-lo sempre que quiser.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label className="text-xs">Nome do Modelo</Label>
              <Input
                placeholder="Ex: Prospecção Imóveis Alto Padrão"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewTemplateDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveTemplate}>Salvar Modelo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: SALVAR COMO LISTA */}
        <Dialog open={saveListDialogOpen} onOpenChange={setSaveListDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Salvar Lista de Destinatários</DialogTitle>
              <DialogDescription>
                Dê um nome para salvar estes {contactsList.length} contatos com todas as variáveis.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label className="text-xs">Nome da Lista</Label>
              <Input
                placeholder="Ex: Leads Campinas Outubro 2026"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveListDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveContactList}>Salvar Lista</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SessionGuard>
  );
}
