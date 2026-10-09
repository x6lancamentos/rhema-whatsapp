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
  Mic,
  MicOff,
  Music,
  Paperclip,
  ShieldBan,
  Calendar,
  Layers,
  Volume2,
  Check,
  AlertCircle,
  Info,
  Clock4,
  Smartphone,
  CalendarClock,
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
  status: "running" | "completed" | "paused" | "cancelled" | "scheduled";
  total: number;
  sent: number;
  failed: number;
  current?: string | null;
  currentName?: string | null;
  currentMessage?: string | null;
  currentSession?: string | null;
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
  batchSize?: number | null;
  batchPause?: number | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  audioUrl?: string | null;
  isPtt?: boolean;
  sessionIds?: any;
  scheduledAt?: string | null;
  simulateTyping?: boolean;
  businessHoursOnly?: boolean;
  startHour?: number;
  endHour?: number;
  startedAt: string;
  completedAt: string | null;
  recipients?: BroadcastRecipient[];
}

interface BlacklistEntry {
  id: string;
  userId: string;
  phone: string;
  jid: string;
  reason?: string | null;
  createdAt: string;
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
  const { sessionId, sessions } = useSession();
  const { getSocket, joinSession } = useSocket();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"new" | "templates" | "lists" | "history" | "blacklist">("new");

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

  // Media & PTT Voice Note State
  const [attachmentType, setAttachmentType] = useState<"none" | "audio" | "media">("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "document">("image");
  const [mediaFileName, setMediaFileName] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [isPtt, setIsPtt] = useState(true);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioRecordDuration, setAudioRecordDuration] = useState(0);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioTimerRef = useRef<any>(null);

  // Multi-Chip Rotation State
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);

  // Scheduling State
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");

  // Human Simulation & Business Hours Protection
  const [simulateTyping, setSimulateTyping] = useState(true);
  const [businessHoursOnly, setBusinessHoursOnly] = useState(false);
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(20);

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

  // Gerenciamento e Edição de Contatos em Memória (Disparo Atual)
  const [activeContactsDialogOpen, setActiveContactsDialogOpen] = useState(false);
  const [activeContactsSearch, setActiveContactsSearch] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");

  // Visualização e Edição de Lista Salva
  const [listDetailsModalOpen, setListDetailsModalOpen] = useState(false);
  const [listDetailsLoading, setListDetailsLoading] = useState(false);
  const [selectedSavedListId, setSelectedSavedListId] = useState("");
  const [editingSavedListName, setEditingSavedListName] = useState("");
  const [editingSavedListContacts, setEditingSavedListContacts] = useState<any[]>([]);
  const [editingSavedListSearch, setEditingSavedListSearch] = useState("");
  const [newSavedListContactName, setNewSavedListContactName] = useState("");
  const [newSavedListContactPhone, setNewSavedListContactPhone] = useState("");
  const [savingListChanges, setSavingListChanges] = useState(false);

  // History Tab
  const [history, setHistory] = useState<BroadcastLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<BroadcastLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Blacklist Tab
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [blacklistSearch, setBlacklistSearch] = useState("");
  const [addBlacklistDialogOpen, setAddBlacklistDialogOpen] = useState(false);
  const [newBlacklistPhone, setNewBlacklistPhone] = useState("");
  const [newBlacklistReason, setNewBlacklistReason] = useState("");

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

  // Auto-load Imoview Resgate Leads or Proprietários if coming from Imoview screen
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    const templateParam = params.get("template") || params.get("templateId");

    if (source === "imoview") {
      try {
        const stored = localStorage.getItem("imoview_resgate_leads");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setContactsList(parsed);
            setRecipientSource("manual");
            setDetectedColumns([
              "nome",
              "primeiro_nome",
              "telefone",
              "corretor",
              "codigo_imovel",
              "tipo_imovel",
              "bairro",
              "cidade",
              "valor",
              "quartos",
              "vagas",
              "codigo_atendimento"
            ]);
            setFileStats({
              name: `Imoview CRM (${parsed.length} leads parados)`,
              total: parsed.length,
              valid: parsed.length,
              duplicates: 0,
            });

            const suggestedMsg = "{Olá|Oi} {{primeiro_nome}}, tudo bem? Aqui é da Rhema Imóveis.\nVi aqui no sistema que você estava buscando imóveis na região {de {{bairro}}|da cidade}.\n\nAinda está buscando opções ou já encontrou o que precisava?";
            setMessage(suggestedMsg);
            updatePreview(suggestedMsg, parsed);

            toast.success(`⚡ ${parsed.length} leads do Imoview carregados com sucesso para resgate!`);
            localStorage.removeItem("imoview_resgate_leads");
          }
        }
      } catch (err) {
        console.error("Error loading imoview leads", err);
      }
    } else if (source === "proprietarios") {
      try {
        const stored = localStorage.getItem("imoview_proprietarios_leads");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setContactsList(parsed);
            setRecipientSource("manual");
            setDetectedColumns([
              "nome_proprietario",
              "primeiro_nome",
              "telefone",
              "codigo_imovel",
              "tipo_imovel",
              "titulo_imovel",
              "finalidade",
              "valor",
              "bairro",
              "cidade",
              "quartos",
              "vagas",
              "dias_sem_atualizacao",
              "data_ultima_alteracao"
            ]);
            setFileStats({
              name: `Imoview CRM (${parsed.length} proprietários)`,
              total: parsed.length,
              valid: parsed.length,
              duplicates: 0,
            });

            const ownerSuggestedMsg = "{Olá|Oi} {{primeiro_nome}}, tudo bem? Sou da Rhema Imóveis.\n\nEstamos atualizando a nossa carteira de imóveis para clientes compradores e investidores ativos.\n\nGostaria de confirmar se o seu imóvel (Cód. {{codigo_imovel}} - {{tipo_imovel}} no {{bairro}}) ainda está disponível para {{finalidade}} e se o valor continua {{valor}}?\n\nPodemos confirmar os detalhes?";
            setMessage(ownerSuggestedMsg);
            updatePreview(ownerSuggestedMsg, parsed);

            toast.success(`⚡ ${parsed.length} proprietários do Imoview carregados com sucesso!`);
            localStorage.removeItem("imoview_proprietarios_leads");
          }
        }
      } catch (err) {
        console.error("Error loading imoview proprietarios", err);
      }
    }

    // Auto-select template if specified in query params
    if (templateParam) {
      fetch("/api/templates")
        .then((r) => r.json())
        .then((data) => {
          if (data.data && Array.isArray(data.data)) {
            const found = data.data.find(
              (t: any) =>
                t.id === templateParam ||
                t.name.toLowerCase().includes(templateParam.toLowerCase()) ||
                (t.category && t.category.toLowerCase().includes(templateParam.toLowerCase()))
            );
            if (found) {
              setMessage(found.content);
              toast.info(`Modelo "${found.name}" aplicado automaticamente!`);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  const fetchBlacklist = useCallback(async () => {
    setBlacklistLoading(true);
    try {
      const url = blacklistSearch ? `/api/blacklist?q=${encodeURIComponent(blacklistSearch)}` : "/api/blacklist";
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setBlacklist(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch blacklist", e);
    } finally {
      setBlacklistLoading(false);
    }
  }, [blacklistSearch]);

  useEffect(() => {
    if (sessionId) {
      fetchLabels();
      if (activeTab === "history") fetchHistory();
      if (activeTab === "blacklist") fetchBlacklist();
    }
  }, [sessionId, activeTab, fetchLabels, fetchHistory, fetchBlacklist]);

  // Audio Recording & Upload Handlers
  const handleMediaFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.status) {
        setMediaUrl(data.data.url);
        setMediaFileName(file.name);
        if (file.type.startsWith("image/")) {
          setMediaType("image");
        } else if (file.type.startsWith("video/")) {
          setMediaType("video");
        } else {
          setMediaType("document");
        }
        toast.success("Arquivo anexado com sucesso!");
      } else {
        toast.error(data.message || "Falha no upload do arquivo");
      }
    } catch (err: any) {
      toast.error("Erro ao fazer upload do arquivo");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.status) {
        setAudioUrl(data.data.url);
        setAudioPreviewUrl(URL.createObjectURL(file));
        toast.success("Áudio anexado com sucesso!");
      } else {
        toast.error(data.message || "Falha no upload do áudio");
      }
    } catch (err: any) {
      toast.error("Erro ao fazer upload do áudio");
    } finally {
      setUploadingMedia(false);
    }
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/ogg; codecs=opus" });
        const preview = URL.createObjectURL(audioBlob);
        setAudioPreviewUrl(preview);

        setUploadingMedia(true);
        try {
          const file = new File([audioBlob], `audio_${Date.now()}.ogg`, { type: "audio/ogg" });
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (res.ok && data.status) {
            setAudioUrl(data.data.url);
            toast.success("Áudio gravado e pronto para envio!");
          } else {
            toast.error(data.message || "Erro no upload do áudio gravado");
          }
        } catch (uploadErr) {
          toast.error("Erro ao salvar áudio gravado");
        } finally {
          setUploadingMedia(false);
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecordingAudio(true);
      setAudioRecordDuration(0);

      audioTimerRef.current = setInterval(() => {
        setAudioRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      toast.error("Permissão de microfone negada ou indisponível");
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      if (audioTimerRef.current) {
        clearInterval(audioTimerRef.current);
        audioTimerRef.current = null;
      }
    }
  };

  const clearAudio = () => {
    setAudioUrl("");
    setAudioPreviewUrl("");
    setAudioRecordDuration(0);
  };

  const clearMedia = () => {
    setMediaUrl("");
    setMediaFileName("");
  };

  // Blacklist Handlers
  const handleAddBlacklist = async () => {
    if (!newBlacklistPhone.trim()) {
      return toast.error("Digite o número de telefone");
    }
    try {
      const res = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: newBlacklistPhone.trim(),
          reason: newBlacklistReason.trim() || "Adicionado manualmente",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Número adicionado à lista negra!");
        setAddBlacklistDialogOpen(false);
        setNewBlacklistPhone("");
        setNewBlacklistReason("");
        fetchBlacklist();
      } else {
        toast.error(data.message || "Erro ao adicionar à lista negra");
      }
    } catch (e: any) {
      toast.error("Erro ao conectar com servidor");
    }
  };

  const handleDeleteBlacklist = async (id: string) => {
    try {
      const res = await fetch(`/api/blacklist/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Contato removido da lista negra!");
        fetchBlacklist();
      } else {
        toast.error("Erro ao remover da lista negra");
      }
    } catch (e: any) {
      toast.error("Erro ao remover contato");
    }
  };

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

  // Funções de Edição dos Contatos do Disparo Atual
  const handleRemoveActiveContact = (indexToRemove: number) => {
    const updated = contactsList.filter((_, idx) => idx !== indexToRemove);
    setContactsList(updated);
    if (recipientSource === "manual") {
      setManualText(updated.map((c) => c.phone || c.originalPhone).join("\n"));
    }
    setFileStats((prev) => (prev ? { ...prev, total: updated.length, valid: updated.length } : null));
    toast.info("Contato removido do disparo atual");
  };

  const handleUpdateActiveContact = (index: number, newName: string, newPhone: string) => {
    const updated = [...contactsList];
    const target = updated[index];
    if (!target) return;
    const sanitized = sanitizePhoneNumber(newPhone);
    updated[index] = {
      ...target,
      name: newName,
      phone: sanitized.phone,
      originalPhone: newPhone,
      jid: sanitized.jid,
      variables: {
        ...(target.variables || {}),
        nome: newName,
        telefone: sanitized.phone,
      },
    };
    setContactsList(updated);
    if (recipientSource === "manual") {
      setManualText(updated.map((c) => c.phone || c.originalPhone).join("\n"));
    }
  };

  const handleAddActiveContact = () => {
    if (!newContactPhone.trim()) return toast.error("Informe o telefone com DDD");
    const sanitized = sanitizePhoneNumber(newContactPhone.trim());
    if (!sanitized.isValid) return toast.error("Telefone inválido");

    const newContact: ParsedContactRow = {
      originalPhone: newContactPhone.trim(),
      phone: sanitized.phone,
      jid: sanitized.jid,
      name: newContactName.trim() || "",
      isValid: true,
      variables: {
        nome: newContactName.trim() || "",
        primeiro_nome: (newContactName.trim() || "").split(" ")[0] || "",
        telefone: sanitized.phone,
      },
    };

    const updated = [...contactsList, newContact];
    setContactsList(updated);
    if (recipientSource === "manual") {
      setManualText(updated.map((c) => c.phone || c.originalPhone).join("\n"));
    }
    setFileStats((prev) => (prev ? { ...prev, total: updated.length, valid: updated.length } : null));
    setNewContactName("");
    setNewContactPhone("");
    toast.success("Contato adicionado ao disparo!");
  };

  const handleClearAllActiveContacts = () => {
    if (!confirm("Tem certeza que deseja limpar todos os contatos carregados?")) return;
    setContactsList([]);
    setManualText("");
    setFileStats(null);
    toast.info("Lista de destinatários limpa");
    setActiveContactsDialogOpen(false);
  };

  // Funções de Visualização e Edição de Lista Salva
  const handleOpenListDetails = async (listId: string) => {
    setSelectedSavedListId(listId);
    setListDetailsLoading(true);
    setListDetailsModalOpen(true);
    try {
      const res = await fetch(`/api/contact-lists/${listId}`);
      if (!res.ok) throw new Error("Falha ao carregar detalhes da lista");
      const json = await res.json();
      const list = json.data;
      setEditingSavedListName(list.name || "");
      setEditingSavedListContacts(Array.isArray(list.contacts) ? list.contacts : []);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar lista");
    } finally {
      setListDetailsLoading(false);
    }
  };

  const handleSaveListChanges = async () => {
    if (!selectedSavedListId) return;
    if (!editingSavedListName.trim()) return toast.error("O nome da lista não pode ficar vazio");
    if (editingSavedListContacts.length === 0) return toast.error("A lista precisa ter pelo menos 1 contato");

    setSavingListChanges(true);
    try {
      const res = await fetch(`/api/contact-lists/${selectedSavedListId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingSavedListName.trim(),
          contacts: editingSavedListContacts,
        }),
      });

      if (res.ok) {
        toast.success("Lista salva com sucesso!");
        fetchSavedLists();
        setListDetailsModalOpen(false);
      } else {
        const data = await res.json();
        toast.error(data.message || "Erro ao salvar alterações da lista");
      }
    } catch (e: any) {
      toast.error("Erro de conexão ao salvar alterações");
    } finally {
      setSavingListChanges(false);
    }
  };

  const handleRemoveContactFromSavedList = (idxToRemove: number) => {
    setEditingSavedListContacts((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleUpdateContactInSavedList = (idx: number, newName: string, newPhone: string) => {
    setEditingSavedListContacts((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        name: newName,
        phone: newPhone,
        variables: {
          ...(updated[idx].variables || {}),
          nome: newName,
          telefone: newPhone,
        },
      };
      return updated;
    });
  };

  const handleAddContactToSavedList = () => {
    if (!newSavedListContactPhone.trim()) return toast.error("Informe o telefone");
    const sanitized = sanitizePhoneNumber(newSavedListContactPhone.trim());
    if (!sanitized.isValid) return toast.error("Telefone inválido");

    const newContact = {
      phone: sanitized.phone,
      name: newSavedListContactName.trim() || "",
      variables: {
        nome: newSavedListContactName.trim() || "",
        primeiro_nome: (newSavedListContactName.trim() || "").split(" ")[0] || "",
        telefone: sanitized.phone,
      },
    };

    setEditingSavedListContacts((prev) => [...prev, newContact]);
    setNewSavedListContactName("");
    setNewSavedListContactPhone("");
    toast.success("Contato adicionado à lista!");
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
    
    const hasText = message.trim().length > 0;
    const hasMedia = !!mediaUrl;
    const hasAudio = !!audioUrl;

    if (!hasText && !hasMedia && !hasAudio) {
      return toast.error("Digite o texto da mensagem, grave um áudio ou anexe uma mídia");
    }

    if (isScheduled) {
      if (!scheduledDate) {
        return toast.error("Informe a data e o horário para o agendamento");
      }
      const scheduledTime = new Date(scheduledDate).getTime();
      if (isNaN(scheduledTime) || scheduledTime <= Date.now()) {
        return toast.error("A data e hora do agendamento precisam estar no futuro");
      }
    }

    setLoading(true);
    setBroadcastProgress(null);

    try {
      const chipSessions = selectedSessionIds.length > 0 ? selectedSessionIds : [sessionId];

      const payload = {
        recipients: contactsList.map((c) => ({
          phone: c.phone,
          jid: c.jid,
          name: c.name,
          variables: c.variables,
        })),
        message: message.trim(),
        minDelay: minDelaySec * 1000,
        maxDelay: maxDelaySec * 1000,
        batchSize: enableBatchPause ? batchSize : null,
        batchPause: enableBatchPause ? batchPauseMin * 60 : null,
        mediaUrl: mediaUrl || null,
        mediaType: mediaUrl ? mediaType : null,
        audioUrl: audioUrl || null,
        isPtt: !!audioUrl && isPtt,
        sessionIds: chipSessions,
        scheduledAt: isScheduled && scheduledDate ? new Date(scheduledDate).toISOString() : null,
        simulateTyping,
        businessHoursOnly,
        startHour,
        endHour,
      };

      const res = await fetch(`/api/messages/${sessionId}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        if (isScheduled) {
          toast.success(
            `Disparo agendado com sucesso para ${new Date(scheduledDate).toLocaleString("pt-BR")}!`
          );
          setActiveTab("history");
          fetchHistory();
        } else {
          toast.success(
            `Disparo iniciado para ${contactsList.length} destinatários!` +
              (data.data?.filteredBlacklist > 0
                ? ` (${data.data.filteredBlacklist} contatos protegidos na lista negra foram ignorados)`
                : "")
          );
        }
      } else {
        toast.error(data.message || data.error?.message || "Erro ao iniciar disparo");
      }
    } catch (e: any) {
      toast.error("Erro ao conectar com servidor");
    } finally {
      if (isScheduled) setLoading(false);
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
            <button
              onClick={() => setActiveTab("blacklist")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === "blacklist"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldBan className="h-4 w-4 text-rose-500" />
              Lista Negra / Opt-Out ({blacklist.length})
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

                    {/* Resumo Rico, Visualização & Ação de Salvar Lista */}
                    {contactsList.length > 0 && (
                      <div className="pt-3 border-t border-border/40 space-y-2.5">
                        <div className="p-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-primary text-primary-foreground font-mono text-xs px-2 py-0.5">
                                {contactsList.length} contatos prontos
                              </Badge>
                              <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[180px]">
                                {fileStats?.name || "Lista carregada"}
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 font-semibold"
                              onClick={() => setActiveContactsDialogOpen(true)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Ver / Editar Lista ({contactsList.length})
                            </Button>
                          </div>

                          {/* Prévia dos primeiros contatos */}
                          <div className="text-[11px] text-muted-foreground flex flex-wrap gap-1.5 pt-1.5 border-t border-border/30">
                            {contactsList.slice(0, 4).map((c, i) => (
                              <span key={i} className="px-2 py-0.5 bg-background/80 rounded border border-border/40 font-mono text-[10px]">
                                {c.name ? `${c.name}: ` : ""}{c.phone}
                              </span>
                            ))}
                            {contactsList.length > 4 && (
                              <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground font-semibold">
                                +{contactsList.length - 4} outros...
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                            onClick={handleClearAllActiveContacts}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Limpar Destinatários
                          </Button>
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

                    {/* Seletor de Tipo de Anexo: Texto puro / Áudio Gravado PTT / Mídia */}
                    <div className="space-y-3 pt-3 border-t border-border/40">
                      <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                        <Paperclip className="h-3.5 w-3.5 text-primary" /> Anexo Opcional: Áudio Gravado (PTT) ou Mídia
                      </Label>

                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          type="button"
                          variant={attachmentType === "none" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs font-medium"
                          onClick={() => {
                            setAttachmentType("none");
                            clearAudio();
                            clearMedia();
                          }}
                        >
                          Apenas Texto
                        </Button>
                        <Button
                          type="button"
                          variant={attachmentType === "audio" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs font-medium flex items-center justify-center gap-1.5"
                          onClick={() => setAttachmentType("audio")}
                        >
                          <Mic className="h-3.5 w-3.5 text-emerald-500" /> Áudio (PTT)
                        </Button>
                        <Button
                          type="button"
                          variant={attachmentType === "media" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs font-medium flex items-center justify-center gap-1.5"
                          onClick={() => setAttachmentType("media")}
                        >
                          <UploadCloud className="h-3.5 w-3.5 text-blue-500" /> Imagem / PDF
                        </Button>
                      </div>

                      {/* Painel de Áudio PTT */}
                      {attachmentType === "audio" && (
                        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {isRecordingAudio ? (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 animate-pulse flex items-center gap-1.5"
                                  onClick={stopAudioRecording}
                                >
                                  <MicOff className="h-4 w-4" /> Parar Gravação ({audioRecordDuration}s)
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1.5"
                                  onClick={startAudioRecording}
                                  disabled={uploadingMedia}
                                >
                                  <Mic className="h-4 w-4 text-emerald-600" /> Gravar Microfone
                                </Button>
                              )}

                              <span className="text-xs text-muted-foreground">ou</span>

                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  accept="audio/*"
                                  className="hidden"
                                  onChange={handleAudioFileUpload}
                                  disabled={uploadingMedia || isRecordingAudio}
                                />
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors">
                                  <UploadCloud className="h-3.5 w-3.5 text-muted-foreground" />
                                  {uploadingMedia ? "Enviando..." : "Subir Áudio (MP3/OGG)"}
                                </div>
                              </label>
                            </div>

                            {audioUrl && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                                onClick={clearAudio}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover Áudio
                              </Button>
                            )}
                          </div>

                          {audioPreviewUrl && (
                            <div className="pt-1">
                              <audio controls src={audioPreviewUrl} className="w-full h-8" />
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1">
                            <div className="space-y-0.5">
                              <Label className="text-xs font-medium">Enviar como Áudio Gravado na Hora (PTT)</Label>
                              <p className="text-[11px] text-muted-foreground">
                                Envia com o microfone verde nativo do WhatsApp (taxa de abertura muito superior).
                              </p>
                            </div>
                            <Switch checked={isPtt} onCheckedChange={setIsPtt} />
                          </div>
                        </div>
                      )}

                      {/* Painel de Mídia (Imagem/Vídeo/PDF) */}
                      {attachmentType === "media" && (
                        <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept="image/*,video/*,application/pdf"
                                className="hidden"
                                onChange={handleMediaFileUpload}
                                disabled={uploadingMedia}
                              />
                              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-background border border-input text-xs font-medium hover:bg-muted transition-colors shadow-xs">
                                <UploadCloud className="h-4 w-4 text-primary" />
                                {uploadingMedia ? "Enviando arquivo..." : "Selecionar Imagem, Vídeo ou PDF"}
                              </div>
                            </label>

                            {mediaUrl && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium truncate max-w-xs text-foreground">
                                  📎 {mediaFileName || mediaUrl.split("/").pop()}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                                  onClick={clearMedia}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                                </Button>
                              </div>
                            )}
                          </div>

                          {mediaUrl && mediaType === "image" && (
                            <div className="mt-2 max-w-[180px] rounded-lg overflow-hidden border border-border/60">
                              <img src={mediaUrl} alt="Preview" className="w-full h-auto object-cover max-h-32" />
                            </div>
                          )}

                          <p className="text-[11px] text-muted-foreground">
                            O texto digitado acima será enviado como legenda junto com o arquivo.
                          </p>
                        </div>
                      )}
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
                          {audioUrl && (
                            <div className="flex items-center gap-2 mb-2 p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                              <Mic className="h-4 w-4 text-emerald-600" />
                              <span>[Mensagem de Voz PTT Gravada]</span>
                            </div>
                          )}
                          {mediaUrl && (
                            <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-500/20 text-xs text-blue-800 dark:text-blue-300">
                              <span>📎 [Arquivo Anexado: {mediaType}]</span>
                            </div>
                          )}
                          {previewSample}
                          <div className="text-[10px] text-slate-400 dark:text-slate-400 text-right mt-1">
                            12:00 ✓✓
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Card de Rotação Multi-Chip (se houver mais de uma sessão disponível) */}
                {sessions && sessions.length > 1 && (
                  <Card className="border-border/60 shadow-sm">
                    <CardHeader className="py-3 px-5 bg-muted/20 border-b border-border/40">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-blue-500" />
                        Multi-Chip: Rotação e Balanceamento de Disparos
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Distribua os envios entre múltiplos chips de WhatsApp para reduzir o risco de bloqueio e acelerar o disparo.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {sessions.map((s) => {
                          const isConnected = s.status?.toLowerCase() === "connected";
                          const isSelected =
                            selectedSessionIds.length === 0
                              ? s.sessionId === sessionId
                              : selectedSessionIds.includes(s.sessionId);

                          return (
                            <div
                              key={s.sessionId}
                              onClick={() => {
                                if (!isConnected) return;
                                setSelectedSessionIds((prev) => {
                                  const currentList = prev.length === 0 ? [sessionId] : prev;
                                  if (currentList.includes(s.sessionId)) {
                                    const next = currentList.filter((id) => id !== s.sessionId);
                                    return next.length === 0 ? [sessionId] : next;
                                  } else {
                                    return [...currentList, s.sessionId];
                                  }
                                });
                              }}
                              className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                                !isConnected
                                  ? "opacity-50 cursor-not-allowed bg-muted/20 border-border/40"
                                  : isSelected
                                  ? "bg-primary/10 border-primary/40 text-foreground"
                                  : "hover:bg-muted/40 border-border/60"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isConnected ? "bg-emerald-500" : "bg-zinc-400"
                                  }`}
                                />
                                <div className="truncate">
                                  <div className="text-xs font-semibold truncate">{s.name || s.sessionId}</div>
                                  <div className="text-[10px] text-muted-foreground">{s.sessionId}</div>
                                </div>
                              </div>
                              {isSelected && <Badge variant="default" className="text-[10px] h-5">Ativo</Badge>}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        🔄 As mensagens serão alternadas (round-robin) proporcionalmente entre todos os chips ativos selecionados.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Card de Configurações Anti-Ban, Horário e Agendamento */}
                <Card className="border-border/60 shadow-sm">
                  <CardHeader className="py-3 px-5 bg-muted/20 border-b border-border/40">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-emerald-500" />
                      3. Proteção Anti-Ban, Horário Comercial & Agendamento
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

                    {/* Simulação de Digitação / Gravação Humana */}
                    <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold text-foreground">
                          Simular Presença Humana ("digitando..." / "gravando áudio...")
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Emite status de presença no WhatsApp do destinatário simulando uma pessoa real.
                        </p>
                      </div>
                      <Switch
                        checked={simulateTyping}
                        onCheckedChange={setSimulateTyping}
                        disabled={loading}
                      />
                    </div>

                    {/* Horário Comercial */}
                    <div className="pt-2 border-t border-border/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-xs font-semibold text-foreground">
                            Restringir Disparo ao Horário Comercial
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Pausa os envios à noite e retoma automaticamente pela manhã para evitar denúncias.
                          </p>
                        </div>
                        <Switch
                          checked={businessHoursOnly}
                          onCheckedChange={setBusinessHoursOnly}
                          disabled={loading}
                        />
                      </div>

                      {businessHoursOnly && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Hora de Início (h):</Label>
                            <Input
                              type="number"
                              min={0}
                              max={23}
                              value={startHour}
                              onChange={(e) => setStartHour(Number(e.target.value) || 8)}
                              className="h-8 text-xs font-mono"
                              disabled={loading}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Hora de Término (h):</Label>
                            <Input
                              type="number"
                              min={0}
                              max={23}
                              value={endHour}
                              onChange={(e) => setEndHour(Number(e.target.value) || 20)}
                              className="h-8 text-xs font-mono"
                              disabled={loading}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Agendamento de Disparo */}
                    <div className="pt-2 border-t border-border/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <CalendarClock className="h-4 w-4 text-primary" />
                            Agendar Disparo para Data/Hora Futura
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            O disparo será iniciado automaticamente pelo cron no horário programado.
                          </p>
                        </div>
                        <Switch
                          checked={isScheduled}
                          onCheckedChange={setIsScheduled}
                          disabled={loading}
                        />
                      </div>

                      {isScheduled && (
                        <div className="pt-1">
                          <Label className="text-[11px] text-muted-foreground">Data e Horário do Envio:</Label>
                          <Input
                            type="datetime-local"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className="h-9 text-xs mt-1"
                            disabled={loading}
                          />
                        </div>
                      )}
                    </div>

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
                      disabled={
                        loading ||
                        !sessionId ||
                        contactsList.length === 0 ||
                        (!message.trim() && !mediaUrl && !audioUrl)
                      }
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Disparando em Segundo Plano...
                        </>
                      ) : isScheduled ? (
                        <>
                          <CalendarClock className="mr-2 h-4 w-4" /> Agendar Disparo para{" "}
                          {contactsList.length} Contatos
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
                    <CardContent className="pt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="flex-1 text-xs h-8"
                        onClick={() => {
                          handleSelectSavedList(l.id);
                          setRecipientSource("list");
                          setActiveTab("new");
                        }}
                      >
                        Carregar p/ Disparo
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 px-2.5"
                        onClick={() => handleOpenListDetails(l.id)}
                        title="Ver e editar contatos desta lista"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1 text-primary" />
                        Ver / Editar
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">
                            Disparo #{log.id.slice(0, 8)}
                          </span>
                          <Badge
                            variant={
                              log.status === "completed"
                                ? "default"
                                : log.status === "cancelled"
                                ? "destructive"
                                : log.status === "scheduled"
                                ? "outline"
                                : "secondary"
                            }
                            className={`text-[10px] font-semibold uppercase ${
                              log.status === "scheduled"
                                ? "border-blue-500/40 text-blue-600 bg-blue-500/10"
                                : ""
                            }`}
                          >
                            {log.status === "completed"
                              ? "Concluído"
                              : log.status === "cancelled"
                              ? "Cancelado"
                              : log.status === "scheduled"
                              ? "Agendado"
                              : "Em Andamento"}
                          </Badge>

                          {log.isPtt && (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-50/10">
                              Áudio PTT 🎙️
                            </Badge>
                          )}
                          {log.mediaUrl && (
                            <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-500/30 bg-blue-50/10">
                              Mídia 📎
                            </Badge>
                          )}

                          <span className="text-[11px] text-muted-foreground">
                            {new Date(log.startedAt).toLocaleString("pt-BR")}
                          </span>

                          {log.scheduledAt && (
                            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                              <CalendarClock className="h-3.5 w-3.5" />
                              Programado para: {new Date(log.scheduledAt).toLocaleString("pt-BR")}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground truncate max-w-xl font-mono">
                          {log.message || (log.audioUrl ? "[Áudio Gravado PTT]" : "[Mídia sem texto]")}
                        </p>

                        <div className="flex gap-4 text-xs font-mono">
                          <span className="text-emerald-600 font-semibold">✓ {log.sent} enviados</span>
                          {log.failed > 0 && <span className="text-red-500 font-semibold">✗ {log.failed} falhas</span>}
                          <span className="text-muted-foreground">Total: {log.total}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {log.status === "scheduled" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={async () => {
                              if (!confirm("Deseja realmente cancelar este disparo agendado?")) return;
                              await fetch(
                                `/api/messages/${sessionId}/broadcast/${log.id}/control`,
                                {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ action: "cancel" }),
                                }
                              );
                              toast.success("Disparo agendado cancelado com sucesso!");
                              fetchHistory();
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                          </Button>
                        )}
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
        {/* TAB 5: LISTA NEGRA / PROTEÇÃO DE OPT-OUT */}
        {/* ========================================================================= */}
        {activeTab === "blacklist" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ShieldBan className="h-5 w-5 text-rose-500" />
                  Lista Negra & Proteção Anti-Denúncias (Opt-Out)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Contatos bloqueados são automaticamente ignorados e filtrados antes de qualquer disparo.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchBlacklist}
                  disabled={blacklistLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${blacklistLoading ? "animate-spin" : ""}`} /> Atualizar
                </Button>
                <Button
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={() => setAddBlacklistDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Bloquear Número
                </Button>
              </div>
            </div>

            {/* Banner Informativo sobre Opt-Out Automático */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
              <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Proteção Automática Inteligente Ativa</p>
                <p className="text-[11px] leading-relaxed opacity-90">
                  Quando qualquer contato responder palavras como <strong>"PARAR"</strong>, <strong>"CANCELAR"</strong>, <strong>"SAIR"</strong> ou <strong>"NÃO QUERO"</strong>, o sistema automaticamente o descadastra, adiciona o número nesta lista negra e envia uma confirmação de descadastramento. Isso protege seus números contra denúncias e banimentos imediatos.
                </p>
              </div>
            </div>

            {/* Barra de Busca */}
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por telefone ou motivo..."
                value={blacklistSearch}
                onChange={(e) => setBlacklistSearch(e.target.value)}
                className="max-w-md h-9 text-xs"
              />
            </div>

            {/* Tabela de Contatos Bloqueados */}
            {blacklist.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <ShieldBan className="h-8 w-8 mx-auto mb-2 opacity-40 text-emerald-500" />
                <p className="text-sm font-medium">Nenhum número bloqueado na lista negra.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sua base de contatos está 100% liberada para envios.
                </p>
              </Card>
            ) : (
              <div className="border border-border/60 rounded-xl overflow-hidden shadow-xs bg-card">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground sticky top-0 border-b border-border/40">
                      <tr>
                        <th className="p-3 text-left font-semibold">Telefone / JID</th>
                        <th className="p-3 text-left font-semibold">Motivo do Bloqueio</th>
                        <th className="p-3 text-left font-semibold">Data do Registro</th>
                        <th className="p-3 text-right font-semibold">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {blacklist.map((entry) => (
                        <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-mono">
                            <span className="font-semibold text-foreground">{entry.phone}</span>
                            <div className="text-[10px] text-muted-foreground">{entry.jid}</div>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={
                                entry.reason?.toLowerCase().includes("auto")
                                  ? "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 text-[10px]"
                                  : "border-border/60 text-[10px]"
                              }
                            >
                              {entry.reason || "Adicionado manualmente"}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleString("pt-BR")}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              onClick={() => handleDeleteBlacklist(entry.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Desbloquear
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

                {/* Informações adicionais do disparo: Áudio / Mídia / Agendamento */}
                {(selectedLog.audioUrl || selectedLog.mediaUrl || selectedLog.scheduledAt) && (
                  <div className="p-3 bg-muted/30 border border-border/40 rounded-lg flex flex-wrap gap-3 items-center text-xs">
                    {selectedLog.audioUrl && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-50/10">
                          {selectedLog.isPtt ? "Áudio PTT 🎙️" : "Arquivo de Áudio 🎵"}
                        </Badge>
                        <audio controls src={selectedLog.audioUrl} className="h-7 w-48" />
                      </div>
                    )}
                    {selectedLog.mediaUrl && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-blue-600 border-blue-500/30 bg-blue-50/10">
                          Mídia 📎 ({selectedLog.mediaType || "arquivo"})
                        </Badge>
                        <a
                          href={selectedLog.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline text-xs font-medium"
                        >
                          Ver arquivo anexado
                        </a>
                      </div>
                    )}
                    {selectedLog.scheduledAt && (
                      <div className="text-muted-foreground flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5 text-blue-500" />
                        Agendado para: {new Date(selectedLog.scheduledAt).toLocaleString("pt-BR")}
                      </div>
                    )}
                  </div>
                )}

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

        {/* MODAL: ADICIONAR À LISTA NEGRA */}
        <Dialog open={addBlacklistDialogOpen} onOpenChange={setAddBlacklistDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldBan className="h-5 w-5 text-rose-500" />
                Bloquear Número na Lista Negra
              </DialogTitle>
              <DialogDescription className="text-xs">
                Este número será ignorado em todos os disparos e campanhas futuras.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Telefone com DDD:</Label>
                <Input
                  placeholder="Ex: 5511999998888 ou 11999998888"
                  value={newBlacklistPhone}
                  onChange={(e) => setNewBlacklistPhone(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Motivo do Bloqueio:</Label>
                <Input
                  placeholder="Ex: Solicitou cancelamento por ligação / Não quer novidades"
                  value={newBlacklistReason}
                  onChange={(e) => setNewBlacklistReason(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddBlacklistDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={handleAddBlacklist}
              >
                Bloquear Número
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: VER E GERENCIAR CONTATOS DO DISPARO ATUAL */}
        <Dialog open={activeContactsDialogOpen} onOpenChange={setActiveContactsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Destinatários do Disparo Atual
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-1">
                    {contactsList.length} contatos prontos para envio. Edite números, nomes ou remova os que não deseja contatar.
                  </DialogDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {contactsList.length} contatos
                </Badge>
              </div>
            </DialogHeader>

            {/* Barra de Filtro e Adição Rápida */}
            <div className="space-y-3 pt-2">
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Buscar na lista por nome ou telefone..."
                  value={activeContactsSearch}
                  onChange={(e) => setActiveContactsSearch(e.target.value)}
                  className="h-8 text-xs flex-1"
                />
              </div>

              {/* Inclusão rápida */}
              <div className="p-2.5 bg-muted/40 rounded-lg border border-border/40 flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[140px] space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Nome (opcional):</Label>
                  <Input
                    placeholder="Ex: João Silva"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="flex-1 min-w-[140px] space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Telefone com DDD:</Label>
                  <Input
                    placeholder="Ex: 11999998888"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <Button size="sm" className="h-7 text-xs" onClick={handleAddActiveContact}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
            </div>

            {/* Tabela com scroll */}
            <div className="flex-1 overflow-y-auto border border-border/60 rounded-lg mt-2 min-h-[220px] max-h-[360px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0 border-b border-border/40 text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left w-10">#</th>
                    <th className="p-2 text-left">Nome</th>
                    <th className="p-2 text-left">Telefone</th>
                    <th className="p-2 text-left">Detalhes / Imoview</th>
                    <th className="p-2 text-center w-12">Remover</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {contactsList
                    .filter((c) => {
                      if (!activeContactsSearch.trim()) return true;
                      const s = activeContactsSearch.toLowerCase();
                      return (
                        (c.name || "").toLowerCase().includes(s) ||
                        (c.phone || "").toLowerCase().includes(s) ||
                        (c.originalPhone || "").toLowerCase().includes(s)
                      );
                    })
                    .map((c, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="p-2 font-mono text-[10px] text-muted-foreground">{idx + 1}</td>
                        <td className="p-2">
                          <Input
                            value={c.name || ""}
                            onChange={(e) => handleUpdateActiveContact(idx, e.target.value, c.phone || c.originalPhone)}
                            placeholder="Nome..."
                            className="h-7 text-xs font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={c.phone || c.originalPhone || ""}
                            onChange={(e) => handleUpdateActiveContact(idx, c.name || "", e.target.value)}
                            placeholder="Telefone..."
                            className="h-7 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2 text-[11px] text-muted-foreground">
                          {c.variables?.corretor && (
                            <Badge variant="outline" className="text-[10px] mr-1">
                              {c.variables.corretor}
                            </Badge>
                          )}
                          {c.variables?.bairro && (
                            <Badge variant="secondary" className="text-[10px]">
                              {c.variables.bairro}
                            </Badge>
                          )}
                          {!c.variables?.corretor && !c.variables?.bairro && (
                            <span className="text-[10px] opacity-60">Direto</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveActiveContact(idx)}
                            title="Remover este contato do disparo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <DialogFooter className="mt-3 flex items-center justify-between sm:justify-between">
              <Button variant="ghost" size="sm" className="text-xs text-destructive hover:bg-destructive/10" onClick={handleClearAllActiveContacts}>
                <Trash2 className="h-3 w-3 mr-1" /> Limpar Todos
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSaveListDialogOpen(true)}>
                  <Bookmark className="h-3.5 w-3.5 mr-1 text-primary" /> Salvar como Lista
                </Button>
                <Button size="sm" onClick={() => setActiveContactsDialogOpen(false)}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Concluir Edição
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: VISUALIZAR E EDITAR LISTA SALVA */}
        <Dialog open={listDetailsModalOpen} onOpenChange={setListDetailsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <Bookmark className="h-5 w-5 text-primary" />
                    Visualizar e Editar Lista Salva
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-1">
                    Edite os números ou nomes dos contatos gravados nesta lista.
                  </DialogDescription>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">
                  {editingSavedListContacts.length} contatos
                </Badge>
              </div>
            </DialogHeader>

            {listDetailsLoading ? (
              <div className="py-12 flex justify-center items-center">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="space-y-3 pt-2">
                  {/* Nome da Lista */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Nome da Lista:</Label>
                    <Input
                      value={editingSavedListName}
                      onChange={(e) => setEditingSavedListName(e.target.value)}
                      className="h-8 text-xs font-medium"
                      placeholder="Nome da lista..."
                    />
                  </div>

                  {/* Adicionar novo contato na lista salva */}
                  <div className="p-2.5 bg-muted/40 rounded-lg border border-border/40 flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[140px] space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Nome (opcional):</Label>
                      <Input
                        placeholder="Ex: Maria Pereira"
                        value={newSavedListContactName}
                        onChange={(e) => setNewSavedListContactName(e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="flex-1 min-w-[140px] space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Telefone com DDD:</Label>
                      <Input
                        placeholder="Ex: 11988887777"
                        value={newSavedListContactPhone}
                        onChange={(e) => setNewSavedListContactPhone(e.target.value)}
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                    <Button size="sm" className="h-7 text-xs" onClick={handleAddContactToSavedList}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar à Lista
                    </Button>
                  </div>

                  <Input
                    placeholder="Filtrar contatos da lista..."
                    value={editingSavedListSearch}
                    onChange={(e) => setEditingSavedListSearch(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Tabela de contatos da lista salva */}
                <div className="flex-1 overflow-y-auto border border-border/60 rounded-lg mt-2 min-h-[220px] max-h-[340px]">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0 border-b border-border/40 text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left w-10">#</th>
                        <th className="p-2 text-left">Nome</th>
                        <th className="p-2 text-left">Telefone</th>
                        <th className="p-2 text-center w-12">Remover</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {editingSavedListContacts
                        .filter((c) => {
                          if (!editingSavedListSearch.trim()) return true;
                          const s = editingSavedListSearch.toLowerCase();
                          return (
                            (c.name || "").toLowerCase().includes(s) ||
                            (c.phone || "").toLowerCase().includes(s)
                          );
                        })
                        .map((c, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="p-2 font-mono text-[10px] text-muted-foreground">{idx + 1}</td>
                            <td className="p-2">
                              <Input
                                value={c.name || ""}
                                onChange={(e) => handleUpdateContactInSavedList(idx, e.target.value, c.phone)}
                                placeholder="Nome..."
                                className="h-7 text-xs font-medium"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={c.phone || ""}
                                onChange={(e) => handleUpdateContactInSavedList(idx, c.name || "", e.target.value)}
                                placeholder="Telefone..."
                                className="h-7 text-xs font-mono"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemoveContactFromSavedList(idx)}
                                title="Remover contato desta lista"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <DialogFooter className="mt-3 flex items-center justify-between sm:justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      // Carrega os contatos para a tela de disparo direto do modal
                      handleSelectSavedList(selectedSavedListId);
                      setRecipientSource("list");
                      setActiveTab("new");
                      setListDetailsModalOpen(false);
                      toast.success("Lista carregada na tela de disparo!");
                    }}
                  >
                    <Send className="h-3.5 w-3.5 mr-1 text-primary" /> Carregar para Disparo
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setListDetailsModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSaveListChanges} disabled={savingListChanges}>
                      {savingListChanges ? (
                        <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Salvando...</>
                      ) : (
                        <><Check className="h-3.5 w-3.5 mr-1" /> Salvar Alterações</>
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SessionGuard>
  );
}
