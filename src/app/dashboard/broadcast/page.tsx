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
  Rocket,
  ArrowRight,
  ArrowLeft,
  Minimize2,
  Maximize2,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  MessageSquare,
  Timer,
  Zap,
  FlaskConical,
  Lock,
  Unlock,
  SendHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  name?: string | null;
  listName?: string | null;
  templateName?: string | null;
  message: string;
  total: number;
  sent: number;
  failed: number;
  responded?: number;
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
  respondedAt?: string | null;
  responseMessage?: string | null;
  sessionIdUsed?: string | null;
}

interface HistoryMetrics {
  totalCampaigns: number;
  totalSent: number;
  totalFailed: number;
  totalResponded: number;
  totalTargeted: number;
  successRate: number;
  responseRate: number;
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

  // Stepper Wizard State (Passo 1: Destinatários, 2: Mensagem, 3: Segurança/Chips, 4: Revisão)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Floating Broadcast Miniplayer State
  const [miniplayerMinimized, setMiniplayerMinimized] = useState<boolean>(false);

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

  // Helper para cálculo dinâmico da estimativa de tempo total de envio
  const getEstimatedDuration = useCallback(() => {
    const total = contactsList.length;
    if (total === 0) return "0 min";
    const numChips = Math.max(1, selectedSessionIds.length || 1);
    const avgDelaySec = (minDelaySec + maxDelaySec) / 2;
    let totalSec = (total / numChips) * avgDelaySec;
    if (enableBatchPause && batchSize > 0) {
      const batches = Math.floor(total / (batchSize * numChips));
      totalSec += batches * (batchPauseMin * 60);
    }
    const minutes = Math.ceil(totalSec / 60);
    if (minutes < 60) return `~${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `~${hours}h ${remMinutes > 0 ? `${remMinutes}m` : ""}`;
  }, [contactsList.length, selectedSessionIds.length, minDelaySec, maxDelaySec, enableBatchPause, batchSize, batchPauseMin]);

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

  // Campaign Name
  const [campaignName, setCampaignName] = useState("");

  // History Tab & Metrics
  const [history, setHistory] = useState<BroadcastLog[]>([]);
  const [historyMetrics, setHistoryMetrics] = useState<HistoryMetrics | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<BroadcastLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailStatusFilter, setDetailStatusFilter] = useState<string>("all");
  const [detailSearch, setDetailSearch] = useState("");

  // Blacklist Tab
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [blacklistSearch, setBlacklistSearch] = useState("");
  const [addBlacklistDialogOpen, setAddBlacklistDialogOpen] = useState(false);
  const [newBlacklistPhone, setNewBlacklistPhone] = useState("");
  const [newBlacklistReason, setNewBlacklistReason] = useState("");

  // Preview simulation
  const [previewSample, setPreviewSample] = useState<string>("");

  // Test Message Sending State (Homologação pré-disparo)
  const [testPhone, setTestPhone] = useState<string>("");
  const [sendingTest, setSendingTest] = useState<boolean>(false);
  const [testSentResult, setTestSentResult] = useState<{ phone: string; timestamp: string; preview: string } | null>(null);
  const [bypassTest, setBypassTest] = useState<boolean>(false);
  const [testModalOpen, setTestModalOpen] = useState<boolean>(false);

  // Helper para obter a mensagem resolvida com as variáveis do 1º contato
  const getResolvedFirstContactMessage = useCallback(() => {
    if (!message.trim() && !mediaUrl && !audioUrl) return "";
    const sampleContact = contactsList[0];
    const vars = sampleContact
      ? {
          ...(sampleContact.variables || {}),
          nome: sampleContact.name || (sampleContact.variables as any)?.nome || "Brunno",
          telefone: sampleContact.phone || "5513981001766",
        }
      : { nome: "Brunno", telefone: "5513981001766" };
    return processPersonalizedMessage(message, vars);
  }, [message, contactsList, mediaUrl, audioUrl]);

  const handleSendTestMessage = async (customPhone?: string) => {
    if (!sessionId) {
      toast.error("Nenhuma sessão de WhatsApp conectada");
      return;
    }
    const phoneToTest = customPhone || testPhone;
    const cleanNumber = phoneToTest.replace(/\D/g, "");
    if (cleanNumber.length < 10) {
      toast.error("Por favor, digite um número de WhatsApp válido com DDD (ex: 13981001766)");
      return;
    }
    const fullPhone = (cleanNumber.length === 10 || cleanNumber.length === 11) && !cleanNumber.startsWith("55")
      ? "55" + cleanNumber
      : cleanNumber;
    const testJid = `${fullPhone}@s.whatsapp.net`;

    const resolvedText = getResolvedFirstContactMessage();

    let msgPayload: any = { text: resolvedText };
    if (attachmentType === "media" && mediaUrl) {
      msgPayload = {
        [mediaType]: { url: mediaUrl },
        caption: resolvedText,
        ...(mediaType === "document" && mediaFileName ? { fileName: mediaFileName } : {})
      };
    } else if (attachmentType === "audio" && audioUrl) {
      msgPayload = {
        audio: { url: audioUrl },
        ptt: isPtt
      };
    }

    setSendingTest(true);
    try {
      const res = await fetch(`/api/messages/${sessionId}/${encodeURIComponent(testJid)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msgPayload })
      });
      const data = await res.json();
      if (res.ok) {
        setTestSentResult({
          phone: fullPhone,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          preview: resolvedText
        });
        toast.success(`Mensagem de teste enviada com sucesso para +${fullPhone}! Lista liberada para disparo em massa.`);
        setTestModalOpen(false);
      } else {
        toast.error(data.message || data.error || "Erro ao enviar mensagem de teste");
      }
    } catch (e: any) {
      toast.error("Erro de conexão ao enviar mensagem de teste");
    } finally {
      setSendingTest(false);
    }
  };

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
        if (json.metrics) {
          setHistoryMetrics(json.metrics);
        }
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
            setWizardStep(2);
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
              "condominio",
              "valor_condominio",
              "iptu",
              "valor_iptu",
              "nome_condominio",
              "bairro",
              "cidade",
              "quartos",
              "vagas",
              "dias_sem_atualizacao",
              "data_ultima_alteracao",
              "corretor_captador",
              "is_rhema",
            ]);
            setFileStats({
              name: `Imoview CRM (${parsed.length} proprietários)`,
              total: parsed.length,
              valid: parsed.length,
              duplicates: 0,
            });

            const ownerSuggestedMsg = "{Olá|Oi} {{primeiro_nome}}, tudo bem? Sou da Rhema Imóveis.\n\nEstamos atualizando a nossa carteira de imóveis para clientes compradores e investidores ativos.\n\nGostaria de confirmar se o seu imóvel (Cód. {{codigo_imovel}} - {{tipo_imovel}} em {{bairro}}) ainda está disponível para {{finalidade}}?\n\nPoderia confirmar também se os valores continuam:\n💰 *Valor:* {{valor}}\n🏢 *Condomínio:* {{condominio}}\n📄 *IPTU:* {{iptu}}\n\nPodemos confirmar estes dados?";
            setMessage(ownerSuggestedMsg);
            updatePreview(ownerSuggestedMsg, parsed);

            toast.success(`⚡ ${parsed.length} proprietários do Imoview carregados com sucesso!`);
            setWizardStep(2);
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
        name: campaignName.trim() || undefined,
        listName: fileStats?.name || (selectedListId ? savedLists.find((l) => l.id === selectedListId)?.name : null) || undefined,
        templateName: templateName || undefined,
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
  const handleControlBroadcast = async (action: "pause" | "resume" | "cancel", targetBroadcastId?: string) => {
    const idToControl = targetBroadcastId || broadcastProgress?.broadcastId;
    if (!idToControl || !sessionId) return;
    try {
      const res = await fetch(
        `/api/messages/${sessionId}/broadcast/${idToControl}/control`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (res.ok) {
        toast.success(`Disparo ${action === "pause" ? "pausado" : action === "resume" ? "retomado" : "cancelado"}`);
        // Atualiza estado local no histórico
        setHistory((prev) =>
          prev.map((item) =>
            item.id === idToControl
              ? { ...item, status: action === "pause" ? "paused" : action === "resume" ? "running" : "cancelled" }
              : item
          )
        );
        if (selectedLog && selectedLog.id === idToControl) {
          setSelectedLog((prev) =>
            prev ? { ...prev, status: action === "pause" ? "paused" : action === "resume" ? "running" : "cancelled" } : null
          );
        }
        if (broadcastProgress?.broadcastId === idToControl) {
          setBroadcastProgress((prev) =>
            prev ? { ...prev, status: action === "pause" ? "paused" : action === "resume" ? "running" : "cancelled" } : null
          );
        }
        fetchHistory();
      } else {
        const data = await res.json();
        toast.error(data.message || "Erro ao controlar disparo");
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
      ChipUtilizado: r.sessionIdUsed || log.sessionId,
      Status:
        r.status === "responded"
          ? "Respondeu"
          : r.status === "sent"
          ? "Enviado"
          : r.status === "failed"
          ? "Falhou"
          : "Pendente",
      DataResposta: r.respondedAt ? new Date(r.respondedAt).toLocaleString("pt-BR") : "",
      MensagemResposta: r.responseMessage || "",
      Erro: r.error || "",
      DataEnvio: r.sentAt ? new Date(r.sentAt).toLocaleString("pt-BR") : "",
      MensagemPersonalizada: r.resolvedMessage || log.message || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatorio_Auditoria");
    XLSX.writeFile(workbook, `auditoria_disparo_${log.name ? log.name.replace(/\s+/g, "_") : log.id.slice(0, 8)}.xlsx`);
    toast.success("Relatório de auditoria Excel baixado com sucesso!");
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
        {/* ========================================================================= */}
        {/* TAB 1: NOVO DISPARO (STEPPER WIZARD UX EM 4 ETAPAS) */}
        {/* ========================================================================= */}
        {activeTab === "new" && (
          <div className="space-y-6">
            {/* WIZARD STEPPER HEADER NAVEGADOR */}
            <div className="bg-card/70 backdrop-blur-md border border-border/60 rounded-2xl p-3 sm:p-5 shadow-xs">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {/* Etapa 1: Destinatários */}
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    wizardStep === 1
                      ? "bg-primary/10 border-primary ring-2 ring-primary/20 shadow-xs"
                      : contactsList.length > 0
                      ? "bg-emerald-500/5 border-emerald-500/30 hover:bg-emerald-500/10"
                      : "bg-muted/20 border-border/40 hover:bg-muted/40"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                      wizardStep === 1
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : contactsList.length > 0
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {contactsList.length > 0 && wizardStep !== 1 ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      "1"
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold truncate flex items-center gap-1.5">
                      <span>Destinatários</span>
                      {contactsList.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {contactsList.length > 0
                        ? `${contactsList.length} contatos`
                        : "Planilha, etiquetas, CRM"}
                    </div>
                  </div>
                </button>

                {/* Etapa 2: Mensagem & Mídia */}
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    wizardStep === 2
                      ? "bg-primary/10 border-primary ring-2 ring-primary/20 shadow-xs"
                      : (message.trim() || mediaUrl || audioUrl)
                      ? "bg-emerald-500/5 border-emerald-500/30 hover:bg-emerald-500/10"
                      : "bg-muted/20 border-border/40 hover:bg-muted/40"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                      wizardStep === 2
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : (message.trim() || mediaUrl || audioUrl)
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {(message.trim() || mediaUrl || audioUrl) && wizardStep !== 2 ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      "2"
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold truncate flex items-center gap-1.5">
                      <span>Mensagem & Mídia</span>
                      {(message.trim() || mediaUrl || audioUrl) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {message.trim() ? "Mensagem pronta" : "Texto, spintax e áudio"}
                    </div>
                  </div>
                </button>

                {/* Etapa 3: Blindagem & Multi-Chip */}
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    wizardStep === 3
                      ? "bg-primary/10 border-primary ring-2 ring-primary/20 shadow-xs"
                      : "bg-muted/20 border-border/40 hover:bg-muted/40"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                      wizardStep === 3
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold truncate">
                      Blindagem & Chips
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {(selectedSessionIds.length || 1)} chip(s) • {minDelaySec}-{maxDelaySec}s
                    </div>
                  </div>
                </button>

                {/* Etapa 4: Revisão & Decolagem */}
                <button
                  type="button"
                  onClick={() => setWizardStep(4)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    wizardStep === 4
                      ? "bg-gradient-to-r from-emerald-600/15 to-teal-600/15 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                      : "bg-muted/20 border-border/40 hover:bg-muted/40"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                      wizardStep === 4
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Rocket className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold truncate text-foreground">
                      Revisão & Decolagem
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {contactsList.length > 0 ? getEstimatedDuration() : "Checklist final"}
                    </div>
                  </div>
                </button>
              </div>

              {/* Linha de progresso visual */}
              <div className="mt-3.5 w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(wizardStep / 4) * 100}%` }}
                />
              </div>
            </div>

            {/* ================================================================= */}
            {/* ETAPA 1: DESTINATÁRIOS & SEGMENTAÇÃO */}
            {/* ================================================================= */}
            {wizardStep === 1 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                {/* Identificação da Campanha */}
                <Card className="border-border/60 shadow-xs bg-muted/20">
                  <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1">
                      <Tag className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 max-w-lg">
                        <Input
                          placeholder="Nome / Identificador da Campanha (opcional, ex: Resgate Leads Frios Outubro)"
                          value={campaignName}
                          onChange={(e) => setCampaignName(e.target.value)}
                          className="h-8 text-xs font-medium bg-background"
                        />
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 shrink-0">
                      <Info className="h-3.5 w-3.5 text-blue-500" />
                      Facilita a auditoria e análise de métricas no Histórico.
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="border-border/60 shadow-sm overflow-hidden">
                    <CardHeader className="pb-3 bg-muted/20 border-b border-border/40">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          Origem dos Destinatários
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
                          {`+{{${col.toLowerCase()}}}`}
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}
                </div>

                {/* Rodapé de Navegação da Etapa 1 */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/60">
                  <div className="text-xs text-muted-foreground">
                    {contactsList.length > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> {contactsList.length} contatos prontos para a campanha.
                      </span>
                    ) : (
                      <span>Carregue uma planilha ou selecione uma lista para avançar.</span>
                    )}
                  </div>

                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-11 px-6 font-bold shadow-md shadow-primary/20 gap-2"
                    onClick={() => setWizardStep(2)}
                    disabled={contactsList.length === 0}
                  >
                    <span>Avançar para Mensagem & Mídia (Passo 2)</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* ETAPA 2: MENSAGEM, MÍDIA, SPINTAX & LIVE PREVIEW */}
            {/* ================================================================= */}
            {wizardStep === 2 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
                  {/* COLUNA ESQUERDA: EDITOR DE MENSAGEM E ANEXOS (7 COLUNAS) */}
                  <div className="lg:col-span-7 space-y-4">
                    <Card className="border-border/60 shadow-sm">
                      <CardHeader className="pb-3 bg-muted/20 border-b border-border/40">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Edit3 className="h-4 w-4 text-primary" />
                            Editor de Mensagem & Spintax
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

                      {/* Variáveis Dinâmicas da Base / Imoview / Planilha */}
                      {detectedColumns && detectedColumns.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border/30">
                          <span className="text-[10px] text-muted-foreground font-semibold">Campos do Imóvel / Dados:</span>
                          {detectedColumns
                            .filter((col) => !["nome", "primeiro_nome", "telefone", "saudacao"].includes(col.toLowerCase()))
                            .map((col) => {
                              const isCondoOrIptu = ["condominio", "valor_condominio", "iptu", "valor_iptu", "nome_condominio"].includes(col.toLowerCase());
                              return (
                                <button
                                  key={col}
                                  type="button"
                                  onClick={() => insertTextAtCursor(`{{${col}}}`)}
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium transition-colors ${
                                    isCondoOrIptu
                                      ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                      : "bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                                  }`}
                                  title={`Inserir {{${col}}}`}
                                >
                                  + {`{{${col}}}`}
                                </button>
                              );
                            })}
                        </div>
                      )}
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

                      </CardContent>
                    </Card>
                  </div>

                  {/* COLUNA DIREITA: LIVE WHATSAPP PHONE PREVIEW (5 COLUNAS) */}
                  <div className="lg:col-span-5 space-y-4">
                    <Card className="border-border/60 shadow-sm overflow-hidden sticky top-6">
                      <CardHeader className="py-3 px-4 bg-emerald-600 text-white flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white">
                            RH
                          </div>
                          <div>
                            <div className="text-xs font-bold leading-tight">Rhema Imóveis (Preview)</div>
                            <div className="text-[10px] text-emerald-100 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-200" />
                              online agora
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => updatePreview(message, contactsList)}
                          className="text-[11px] text-white hover:text-emerald-100 flex items-center gap-1 bg-white/10 px-2 py-1 rounded-md transition-colors"
                          title="Sortear nova variação Spintax"
                        >
                          <RotateCcw className="h-3 w-3" /> Sortear
                        </button>
                      </CardHeader>

                      <CardContent className="p-4 bg-slate-100 dark:bg-slate-950/80 min-h-[300px] flex flex-col justify-end space-y-3">
                        <div className="text-center">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-background/80 px-2.5 py-0.5 rounded-full border border-border/40">
                            Hoje
                          </span>
                        </div>

                        {/* Balão WhatsApp Realista */}
                        <div className="self-end max-w-[92%] bg-[#dcf8c6] dark:bg-[#056162] text-slate-900 dark:text-slate-100 rounded-xl rounded-tr-xs p-3 shadow-sm text-xs sm:text-sm whitespace-pre-wrap leading-relaxed border border-emerald-500/20">
                          {audioUrl && (
                            <div className="flex items-center gap-2 mb-2 p-2 bg-emerald-700/10 dark:bg-emerald-900/40 rounded-lg border border-emerald-500/20 text-xs">
                              <Mic className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                              <span className="font-medium text-emerald-900 dark:text-emerald-200">[Mensagem de Voz Gravada PTT]</span>
                            </div>
                          )}

                          {mediaUrl && (
                            <div className="mb-2 p-2 bg-blue-700/10 dark:bg-blue-900/40 rounded-lg border border-blue-500/20 text-xs">
                              <span className="font-medium text-blue-900 dark:text-blue-200">📎 [Arquivo: {mediaType}]</span>
                            </div>
                          )}

                          <div>
                            {previewSample || (
                              <span className="text-muted-foreground italic text-xs">
                                Digite sua mensagem no editor ao lado para ver a prévia ao vivo com dados dinâmicos...
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] text-emerald-800/70 dark:text-emerald-300/70 text-right mt-1 font-mono">
                            12:00 ✓✓
                          </div>
                        </div>

                        <div className="text-[11px] text-muted-foreground text-center pt-2">
                          Variáveis simuladas usando o primeiro contato:{" "}
                          <strong className="text-foreground">
                            {contactsList[0]?.name || "Brunno"} ({contactsList[0]?.phone || "5519998765432"})
                          </strong>
                        </div>

                        <div className="pt-2 flex justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                            onClick={() => setTestModalOpen(true)}
                            disabled={!message.trim() && !mediaUrl && !audioUrl}
                          >
                            <FlaskConical className="h-3.5 w-3.5" />
                            <span>Enviar Mensagem de Teste no WhatsApp</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Rodapé de Navegação da Etapa 2 */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/60">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto h-11 px-5 font-semibold gap-2"
                    onClick={() => setWizardStep(1)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Voltar para Destinatários (Passo 1)</span>
                  </Button>

                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-11 px-6 font-bold shadow-md shadow-primary/20 gap-2"
                    onClick={() => setWizardStep(3)}
                    disabled={!message.trim() && !mediaUrl && !audioUrl}
                  >
                    <span>Avançar para Blindagem & Multi-Chip (Passo 3)</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* ETAPA 3: PROTEÇÃO ANTI-BLOQUEIO, MULTI-CHIP & AGENDAMENTO */}
            {/* ================================================================= */}
            {wizardStep === 3 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
                  {/* Card de Rotação Multi-Chip (Multi-Sessão / Round-Robin) */}
                  <div className="lg:col-span-12">
                    <Card className="border-border/60 shadow-sm">
                      <CardHeader className="py-3 px-5 bg-muted/20 border-b border-border/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-blue-500" />
                          Distribuição de Carga Multi-Sessão (Multi-Chip / Round-Robin)
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Distribua automaticamente a fila entre múltiplas contas para reduzir drasticamente o risco de bloqueio pelo WhatsApp.
                        </CardDescription>
                      </div>

                      {sessions && sessions.length > 1 && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2.5"
                            onClick={() => {
                              const connectedIds = sessions
                                .filter((s) => s.status?.toLowerCase() === "connected")
                                .map((s) => s.sessionId);
                              setSelectedSessionIds(connectedIds.length > 0 ? connectedIds : [sessionId]);
                              toast.success(`${connectedIds.length} contas conectadas selecionadas para o disparo!`);
                            }}
                          >
                            Selecionar Todas Conectadas
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => {
                              setSelectedSessionIds([sessionId]);
                              toast.info("Apenas a sessão atual selecionada.");
                            }}
                          >
                            Apenas Atual
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-3">
                    {sessions && sessions.length > 0 ? (
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
                                if (!isConnected) {
                                  toast.error("Esta sessão está desconectada do WhatsApp.");
                                  return;
                                }
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
                              className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                                !isConnected
                                  ? "opacity-50 cursor-not-allowed bg-muted/20 border-border/40"
                                  : isSelected
                                  ? "bg-primary/10 border-primary shadow-xs text-foreground ring-1 ring-primary/30"
                                  : "hover:bg-muted/40 border-border/60"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    isConnected ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                                  }`}
                                />
                                <div className="truncate">
                                  <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                                    {s.name || s.sessionId}
                                    {s.sessionId === sessionId && (
                                      <span className="text-[10px] text-muted-foreground font-normal">(Atual)</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground font-mono truncate">{s.sessionId}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isConnected ? (
                                  isSelected ? (
                                    <Badge variant="default" className="text-[10px] h-5 bg-emerald-600">
                                      Ativo na Fila
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
                                      Disponível
                                    </Badge>
                                  )
                                ) : (
                                  <Badge variant="secondary" className="text-[10px] h-5 opacity-60">
                                    Desconectado
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma sessão encontrada.</p>
                    )}

                    {/* Status e Explicação do Balanceamento */}
                    {(() => {
                      const activeChipsCount = selectedSessionIds.length === 0 ? 1 : selectedSessionIds.length;
                      if (activeChipsCount > 1) {
                        return (
                          <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-500/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                            <Sparkles className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                            <div>
                              <strong className="font-semibold">Modo Multi-Chip Ativo ({activeChipsCount} contas selecionadas):</strong>
                              <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                                A fila é alternada de forma equilibrada em Round-Robin (Chip 1 ➔ Chip 2 ➔ Chip 3...). Cada lead receberá a mensagem de um número diferente, dividindo a carga e blindando sua operação contra bloqueios. Se qualquer conta desconectar durante o disparo, o motor continua automaticamente com as contas ativas restantes.
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Envio configurado com 1 conta. Conecte contas adicionais em Sessões para ativar a rotação balanceada automática.</span>
                        </p>
                      );
                    })()}
                  </CardContent>
                </Card>

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

                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Rodapé de Navegação da Etapa 3 */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/60">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto h-11 px-5 font-semibold gap-2"
                    onClick={() => setWizardStep(2)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Voltar para Mensagem & Mídia</span>
                  </Button>

                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-11 px-6 font-bold shadow-md shadow-primary/20 gap-2"
                    onClick={() => setWizardStep(4)}
                  >
                    <span>Avançar para Revisão & Decolagem (Passo 4)</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* ETAPA 4: REVISÃO EXECUTIVA & DECOLAGEM */}
            {/* ================================================================= */}
            {wizardStep === 4 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                {/* CHECKLIST EXECUTIVO PRÉ-VOO */}
                <Card className="border-border/60 shadow-lg bg-gradient-to-br from-card to-muted/30 overflow-hidden">
                  <CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                          <Rocket className="h-5 w-5 text-emerald-500" />
                          Revisão Pré-Voo da Campanha
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Confira todos os parâmetros antes de iniciar os disparos no WhatsApp.
                        </CardDescription>
                      </div>

                      <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 bg-background">
                        {campaignName || "Campanha sem identificador"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-6 space-y-6">
                    {/* 4 Cards de Métricas Consolidadas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl border border-border/50 bg-background/80 space-y-1">
                        <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-blue-500" /> Destinatários
                        </span>
                        <div className="text-xl font-bold font-mono text-foreground">
                          {contactsList.length}
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {fileStats?.name || "Lista filtrada"}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl border border-border/50 bg-background/80 space-y-1">
                        <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5">
                          <Smartphone className="h-3.5 w-3.5 text-emerald-500" /> Chips / Sessões
                        </span>
                        <div className="text-xl font-bold font-mono text-foreground">
                          {(selectedSessionIds.length || 1)} chip(s)
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          ~{Math.ceil(contactsList.length / Math.max(1, selectedSessionIds.length || 1))} msgs/chip
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl border border-border/50 bg-background/80 space-y-1">
                        <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-amber-500" /> Tempo Estimado
                        </span>
                        <div className="text-xl font-bold font-mono text-foreground">
                          {getEstimatedDuration()}
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          Delay médio: {Math.round((minDelaySec + maxDelaySec) / 2)}s
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl border border-border/50 bg-background/80 space-y-1">
                        <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Proteção Anti-Ban
                        </span>
                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Blindagem Alta
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {businessHoursOnly ? "Horário comercial ativo" : "Envio contínuo"}
                        </span>
                      </div>
                    </div>

                    {/* Resumo da Mensagem e Anexos */}
                    <div className="p-4 rounded-xl border border-border/50 bg-background/60 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <MessageSquare className="h-4 w-4 text-primary" /> Amostra Real do Disparo:
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Para: {contactsList[0]?.name || "Primeiro Contato"} ({contactsList[0]?.phone || "Telefone"})
                        </span>
                      </div>

                      <div className="p-3 bg-muted/40 rounded-lg text-xs sm:text-sm font-mono whitespace-pre-wrap leading-relaxed border border-border/40 text-foreground">
                        {previewSample || message}
                      </div>

                      {(audioUrl || mediaUrl) && (
                        <div className="flex flex-wrap gap-2 pt-1 text-xs">
                          {audioUrl && (
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
                              <Mic className="h-3 w-3 mr-1" /> Áudio Gravado PTT Incluso
                            </Badge>
                          )}
                          {mediaUrl && (
                            <Badge variant="outline" className="border-blue-500/40 text-blue-600">
                              📎 Mídia Anexa: {mediaFileName || mediaType}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Validação & Envio de Teste Prévio */}
                    <div className="p-4 rounded-xl border border-border/60 bg-gradient-to-br from-background to-muted/20 space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                            <FlaskConical className="h-4 w-4 text-emerald-500" />
                            Validação & Envio de Teste Prévio
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Valide a mensagem, mídias e variáveis dinâmicas no seu WhatsApp antes de liberar o disparo para os {contactsList.length} contatos.
                          </p>
                        </div>

                        {testSentResult ? (
                          <Badge className="bg-emerald-600 text-white font-semibold text-xs px-2.5 py-1 shrink-0">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Teste Validado
                          </Badge>
                        ) : bypassTest ? (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600 font-semibold text-xs shrink-0">
                            ⚠️ Teste Ignorado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="font-semibold text-xs shrink-0 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                            <Lock className="h-3 w-3 mr-1" /> Disparo Bloqueado
                          </Badge>
                        )}
                      </div>

                      {/* Campo de Telefone + Botão de Envio de Teste */}
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <div className="flex-1">
                          <Input
                            placeholder="WhatsApp de teste com DDD (ex: 13 98100-1766)"
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                            className="h-10 text-sm font-mono bg-background"
                            onKeyDown={(e) => e.key === "Enter" && handleSendTestMessage()}
                          />
                        </div>
                        <Button
                          className="h-10 px-4 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0 shadow-sm"
                          onClick={() => handleSendTestMessage()}
                          disabled={sendingTest || !testPhone.trim()}
                        >
                          {sendingTest ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              <span>Enviando Teste...</span>
                            </>
                          ) : (
                            <>
                              <SendHorizontal className="h-4 w-4" />
                              <span>Enviar Teste de Validação</span>
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Feedback de Validação */}
                      {testSentResult ? (
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <span>Envio de teste validado com sucesso para +{testSentResult.phone} às {testSentResult.timestamp}!</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground pl-5.5">
                            A mensagem foi enviada usando as variáveis do 1º contato (<strong>{contactsList[0]?.name || "Primeiro Contato"}</strong>). O disparo em massa para os <strong>{contactsList.length} contatos</strong> está 100% liberado!
                          </p>
                        </div>
                      ) : !bypassTest ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-0.5">
                          <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                            <Info className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            Para garantir que todas as variáveis estejam funcionando, envie um teste para liberar a lista.
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setBypassTest(true);
                              toast.info("Aviso: Teste prévio pulado manualmente. Disparo liberado.");
                            }}
                            className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer shrink-0 text-left"
                          >
                            Pular teste e liberar direto
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs pt-0.5">
                          <span className="text-amber-600 dark:text-amber-400 text-[11px] flex items-center gap-1">
                            ⚠️ Teste pulado manualmente. Disparo liberado por decisão do usuário.
                          </span>
                          <button
                            type="button"
                            onClick={() => setBypassTest(false)}
                            className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                          >
                            Reativar exigência de teste
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Botão Master de Disparo / Decolagem */}
                    <div className="pt-2">
                      <Button
                        size="lg"
                        className={cn(
                          "w-full h-14 text-base font-bold shadow-xl transition-all gap-2 text-white",
                          (testSentResult !== null || bypassTest)
                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/25"
                            : "bg-muted text-muted-foreground hover:bg-muted opacity-60 cursor-not-allowed"
                        )}
                        onClick={handleStartBroadcast}
                        disabled={
                          (!testSentResult && !bypassTest) ||
                          loading ||
                          !sessionId ||
                          contactsList.length === 0 ||
                          (!message.trim() && !mediaUrl && !audioUrl)
                        }
                      >
                        {(!testSentResult && !bypassTest) ? (
                          <>
                            <Lock className="mr-2 h-5 w-5" /> Envie uma mensagem de teste acima para liberar o disparo em massa
                          </>
                        ) : loading ? (
                          <>
                            <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Disparando em Segundo Plano...
                          </>
                        ) : isScheduled ? (
                          <>
                            <CalendarClock className="mr-2 h-5 w-5" /> Agendar Disparo para{" "}
                            {contactsList.length} Contatos
                          </>
                        ) : (
                          <>
                            <Rocket className="mr-2 h-5 w-5 animate-bounce" /> Decolar Campanha Agora para {contactsList.length} Destinatários
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Rodapé de Navegação da Etapa 4 */}
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    className="h-10 px-4 text-xs font-semibold gap-2"
                    onClick={() => setWizardStep(3)}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Voltar para Blindagem & Chips</span>
                  </Button>
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
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <History className="h-5 w-5 text-emerald-500" />
                  Auditoria & Histórico Completo de Broadcasts
                </h3>
                <p className="text-xs text-muted-foreground">
                  Métricas de conversão, entrega, respostas de leads e controle de pausa/retomada de campanhas.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchHistory} disabled={historyLoading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${historyLoading ? "animate-spin" : ""}`} /> Atualizar
              </Button>
            </div>

            {/* Dashboard de Métricas de Conversão & Entrega */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-border/60 p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                  <span>Total de Campanhas</span>
                  <History className="h-4 w-4 text-primary" />
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono mt-1 text-foreground">
                  {historyMetrics?.totalCampaigns ?? history.length}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Campanhas registradas no banco</p>
              </Card>

              <Card className="border-border/60 p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                  <span>Mensagens Enviadas</span>
                  <Send className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono mt-1 text-emerald-600">
                  {historyMetrics?.totalSent ?? history.reduce((acc, l) => acc + l.sent, 0)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Entregues com sucesso</p>
              </Card>

              <Card className="border-border/60 p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                  <span>Taxa de Entrega</span>
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono mt-1 text-blue-600">
                  {(() => {
                    if (historyMetrics) return `${historyMetrics.successRate}%`;
                    const s = history.reduce((acc, l) => acc + l.sent, 0);
                    const f = history.reduce((acc, l) => acc + l.failed, 0);
                    return s + f > 0 ? `${Math.round((s / (s + f)) * 100)}%` : "100%";
                  })()}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {historyMetrics?.totalFailed ?? history.reduce((acc, l) => acc + l.failed, 0)} falhas registradas
                </p>
              </Card>

              <Card className="border-border/60 p-3.5 shadow-xs bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-500/20">
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                  <span>Taxa de Resposta</span>
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono mt-1 text-emerald-600 dark:text-emerald-400 flex items-baseline gap-2">
                  <span>
                    {(() => {
                      if (historyMetrics) return `${historyMetrics.responseRate}%`;
                      const s = history.reduce((acc, l) => acc + l.sent, 0);
                      const r = history.reduce((acc, l) => acc + (l.responded || 0), 0);
                      return s > 0 ? `${Math.round((r / s) * 100)}%` : "0%";
                    })()}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    ({historyMetrics?.totalResponded ?? history.reduce((acc, l) => acc + (l.responded || 0), 0)} respostas)
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Leads que responderam via WhatsApp</p>
              </Card>
            </div>

            {history.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Nenhum histórico registrado.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {history.map((log) => {
                  const hasMultiChip = Array.isArray(log.sessionIds) && log.sessionIds.length > 1;
                  const isRunning = log.status === "running";
                  const isPaused = log.status === "paused";
                  const isScheduled = log.status === "scheduled";

                  return (
                    <Card
                      key={log.id}
                      className={`border-border/60 hover:border-primary/40 transition-colors ${
                        isRunning ? "ring-1 ring-blue-500/30 bg-blue-50/5" : isPaused ? "ring-1 ring-amber-500/30 bg-amber-50/5" : ""
                      }`}
                    >
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground">
                              {log.name ? log.name : `Disparo #${log.id.slice(0, 8)}`}
                            </span>
                            {log.name && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                #{log.id.slice(0, 8)}
                              </span>
                            )}

                            <Badge
                              variant={
                                log.status === "completed"
                                  ? "default"
                                  : log.status === "cancelled"
                                  ? "destructive"
                                  : isScheduled
                                  ? "outline"
                                  : isPaused
                                  ? "secondary"
                                  : "default"
                              }
                              className={`text-[10px] font-semibold uppercase ${
                                isScheduled
                                  ? "border-blue-500/40 text-blue-600 bg-blue-500/10"
                                  : isPaused
                                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                  : isRunning
                                  ? "bg-blue-600 text-white animate-pulse"
                                  : ""
                              }`}
                            >
                              {log.status === "completed"
                                ? "Concluído"
                                : log.status === "cancelled"
                                ? "Cancelado"
                                : isScheduled
                                ? "Agendado"
                                : isPaused
                                ? "Pausado"
                                : "Em Andamento"}
                            </Badge>

                            {hasMultiChip && (
                              <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-500/30 bg-blue-50/10 font-semibold">
                                ⚡ Multi-Chip ({(log.sessionIds as string[]).length} contas)
                              </Badge>
                            )}

                            {log.listName && (
                              <Badge variant="secondary" className="text-[10px]">
                                📋 {log.listName}
                              </Badge>
                            )}

                            {log.templateName && (
                              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                                📑 {log.templateName}
                              </Badge>
                            )}

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

                          <div className="flex gap-4 text-xs font-mono items-center flex-wrap">
                            <span className="text-emerald-600 font-semibold">✓ {log.sent} enviados</span>
                            {log.failed > 0 && <span className="text-red-500 font-semibold">✗ {log.failed} falhas</span>}
                            <span className="text-muted-foreground">Total: {log.total}</span>
                            {(log.responded ?? 0) > 0 && (
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20">
                                💬 {log.responded} responderam ({log.sent > 0 ? Math.round(((log.responded || 0) / log.sent) * 100) : 0}%)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Botões de Ação & Controle de Pausa/Retomada */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                          {isRunning && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                                onClick={() => handleControlBroadcast("pause", log.id)}
                                title="Pausar disparo em andamento"
                              >
                                <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                  if (!confirm("Deseja interromper este disparo em andamento?")) return;
                                  handleControlBroadcast("cancel", log.id);
                                }}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                              </Button>
                            </>
                          )}

                          {isPaused && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleControlBroadcast("resume", log.id)}
                                title="Retomar envio da fila restante"
                              >
                                <Play className="h-3.5 w-3.5 mr-1" /> Retomar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                  if (!confirm("Deseja cancelar permanentemente este disparo pausado?")) return;
                                  handleControlBroadcast("cancel", log.id);
                                }}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                              </Button>
                            </>
                          )}

                          {isScheduled && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={async () => {
                                if (!confirm("Deseja realmente cancelar este disparo agendado?")) return;
                                handleControlBroadcast("cancel", log.id);
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                            </Button>
                          )}

                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openDetail(log)}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> Auditoria
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary"
                            title="Exportar Relatório Excel com Auditoria Completa"
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
                  );
                })}
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
        {/* MODAL: DETALHES DO DISPARO / RELATÓRIO INDIVIDUAL DE AUDITORIA */}
        {/* ========================================================================= */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
            <DialogHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pr-6">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-lg font-bold">
                      {selectedLog?.name ? selectedLog.name : `Auditoria de Disparo #${selectedLog?.id.slice(0, 8)}`}
                    </DialogTitle>
                    {selectedLog?.name && (
                      <span className="text-xs text-muted-foreground font-mono">
                        #{selectedLog.id.slice(0, 8)}
                      </span>
                    )}
                    <Badge
                      variant={
                        selectedLog?.status === "completed"
                          ? "default"
                          : selectedLog?.status === "cancelled"
                          ? "destructive"
                          : selectedLog?.status === "paused"
                          ? "secondary"
                          : "default"
                      }
                      className="text-[10px] uppercase font-semibold"
                    >
                      {selectedLog?.status === "completed"
                        ? "Concluído"
                        : selectedLog?.status === "cancelled"
                        ? "Cancelado"
                        : selectedLog?.status === "paused"
                        ? "Pausado"
                        : selectedLog?.status === "scheduled"
                        ? "Agendado"
                        : "Em Andamento"}
                    </Badge>
                  </div>
                  <DialogDescription className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                    <span>
                      Iniciado em {selectedLog?.startedAt ? new Date(selectedLog.startedAt).toLocaleString("pt-BR") : ""}
                    </span>
                    {selectedLog?.listName && <span>• 📋 Lista: <strong>{selectedLog.listName}</strong></span>}
                    {selectedLog?.templateName && <span>• 📑 Modelo: <strong>{selectedLog.templateName}</strong></span>}
                    {Array.isArray(selectedLog?.sessionIds) && selectedLog.sessionIds.length > 1 && (
                      <span>• ⚡ Multi-Chip: <strong>{selectedLog.sessionIds.length} contas</strong></span>
                    )}
                  </DialogDescription>
                </div>

                {selectedLog && (
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedLog.status === "running" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                        onClick={() => handleControlBroadcast("pause", selectedLog.id)}
                      >
                        <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                      </Button>
                    )}
                    {selectedLog.status === "paused" && (
                      <Button
                        size="sm"
                        className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleControlBroadcast("resume", selectedLog.id)}
                      >
                        <Play className="h-3.5 w-3.5 mr-1" /> Retomar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => handleExportReport(selectedLog)}>
                      <Download className="h-3.5 w-3.5 mr-1" /> Baixar Excel
                    </Button>
                  </div>
                )}
              </div>
            </DialogHeader>

            {detailLoading ? (
              <div className="py-12 flex justify-center items-center">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : selectedLog ? (
              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                {/* 4 KPIs de Auditoria e Conversão */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-500/20">
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold block">Enviados</span>
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
                  <div className="bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/30">
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold block">Respostas (Conversão)</span>
                    <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {selectedLog.responded || 0}
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({selectedLog.sent > 0 ? Math.round(((selectedLog.responded || 0) / selectedLog.sent) * 100) : 0}%)
                      </span>
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

                {/* Filtros e Busca de Leads no Histórico de Auditoria */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/40 text-xs">
                    <button
                      type="button"
                      onClick={() => setDetailStatusFilter("all")}
                      className={`px-2.5 py-1 rounded font-medium transition-all ${
                        detailStatusFilter === "all" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Todos ({(selectedLog.recipients || []).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailStatusFilter("sent")}
                      className={`px-2.5 py-1 rounded font-medium transition-all ${
                        detailStatusFilter === "sent" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Enviados ({(selectedLog.recipients || []).filter((r) => r.status === "sent").length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailStatusFilter("responded")}
                      className={`px-2.5 py-1 rounded font-medium transition-all ${
                        detailStatusFilter === "responded" ? "bg-background text-emerald-600 shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      💬 Respondeu ({(selectedLog.recipients || []).filter((r) => r.status === "responded").length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailStatusFilter("failed")}
                      className={`px-2.5 py-1 rounded font-medium transition-all ${
                        detailStatusFilter === "failed" ? "bg-background text-red-600 shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Falhas ({(selectedLog.recipients || []).filter((r) => r.status === "failed").length})
                    </button>
                  </div>

                  <Input
                    placeholder="Buscar lead por nome ou telefone..."
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    className="h-8 text-xs sm:w-64"
                  />
                </div>

                {/* Tabela de Destinatários com Auditoria Completa */}
                <div className="border border-border/60 rounded-lg overflow-hidden">
                  <div className="max-h-[360px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-muted-foreground sticky top-0 border-b border-border/40">
                        <tr>
                          <th className="p-2.5 text-left font-semibold w-10">#</th>
                          <th className="p-2.5 text-left font-semibold">Destinatário</th>
                          <th className="p-2.5 text-left font-semibold">Chip Utilizado</th>
                          <th className="p-2.5 text-left font-semibold">Status</th>
                          <th className="p-2.5 text-left font-semibold">Resposta do Lead</th>
                          <th className="p-2.5 text-left font-semibold">Mensagem Enviada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {(() => {
                          const filtered = (selectedLog.recipients || []).filter((r) => {
                            if (detailStatusFilter !== "all" && r.status !== detailStatusFilter) {
                              return false;
                            }
                            if (detailSearch.trim()) {
                              const s = detailSearch.toLowerCase();
                              const matchName = (r.name || "").toLowerCase().includes(s);
                              const matchPhone = r.jid.includes(s);
                              const matchReply = (r.responseMessage || "").toLowerCase().includes(s);
                              return matchName || matchPhone || matchReply;
                            }
                            return true;
                          });

                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                                  Nenhum registro encontrado com os filtros aplicados.
                                </td>
                              </tr>
                            );
                          }

                          return filtered.map((r, idx) => (
                            <tr key={r.id} className="hover:bg-muted/20">
                              <td className="p-2.5 font-mono text-[10px] text-muted-foreground">{idx + 1}</td>
                              <td className="p-2.5 font-mono">
                                <div className="font-semibold text-foreground">{r.name || "Sem Nome"}</div>
                                <div className="text-[10px] text-muted-foreground">{r.jid.replace("@s.whatsapp.net", "")}</div>
                              </td>
                              <td className="p-2.5">
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  📱 {r.sessionIdUsed || selectedLog.sessionId}
                                </Badge>
                              </td>
                              <td className="p-2.5">
                                {r.status === "responded" ? (
                                  <Badge className="text-[10px] bg-emerald-600 text-white font-semibold">
                                    Respondeu 💬
                                  </Badge>
                                ) : r.status === "sent" ? (
                                  <Badge variant="default" className="text-[10px] bg-emerald-600">
                                    Enviado ✓
                                  </Badge>
                                ) : r.status === "failed" ? (
                                  <div className="space-y-0.5">
                                    <Badge variant="destructive" className="text-[10px]">Falhou ✗</Badge>
                                    {r.error && (
                                      <p className="text-[10px] text-destructive truncate max-w-[140px]" title={r.error}>
                                        {r.error}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-[10px]">Pendente</Badge>
                                )}
                              </td>
                              <td className="p-2.5 max-w-[180px]">
                                {r.status === "responded" && r.responseMessage ? (
                                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 rounded p-1.5 text-[11px] text-emerald-900 dark:text-emerald-200">
                                    <div className="font-medium truncate" title={r.responseMessage}>
                                      "{r.responseMessage}"
                                    </div>
                                    {r.respondedAt && (
                                      <div className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                        {new Date(r.respondedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground opacity-50">—</span>
                                )}
                              </td>
                              <td className="p-2.5 max-w-[200px] truncate font-mono text-[11px] text-muted-foreground" title={r.resolvedMessage || selectedLog.message}>
                                {r.resolvedMessage || selectedLog.message}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* MODAL: ENVIO DE TESTE DE VALIDAÇÃO */}
        <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-emerald-500" />
                <span>Envio de Teste de Validação</span>
              </DialogTitle>
              <DialogDescription>
                Valide a entrega da mensagem, Spintax e as variáveis dinâmicas antes de liberar o disparo para toda a lista.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Amostra com Variáveis do 1º Contato */}
              <div className="p-3 bg-muted/40 rounded-xl border border-border/50 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    Variáveis do 1º Contato da Lista:
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {contactsList[0]?.name || "Brunno"}
                  </Badge>
                </div>
                <div className="p-2.5 bg-background rounded-lg text-xs font-mono whitespace-pre-wrap max-h-36 overflow-y-auto border border-border/40 text-foreground">
                  {getResolvedFirstContactMessage() || (
                    <span className="text-muted-foreground italic">Nenhuma mensagem configurada ainda...</span>
                  )}
                </div>
                {(mediaUrl || audioUrl) && (
                  <div className="text-[11px] text-muted-foreground pt-1 flex items-center gap-2">
                    {audioUrl && <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px]"><Mic className="h-2.5 w-2.5 mr-1" /> Áudio PTT Incluso</Badge>}
                    {mediaUrl && <Badge variant="outline" className="text-blue-600 border-blue-500/30 text-[10px]">📎 Mídia: {mediaFileName || mediaType}</Badge>}
                  </div>
                )}
              </div>

              {/* Input do WhatsApp de Teste */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  WhatsApp de Teste (com DDD):
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="(13) 98100-1766 ou 5513981001766"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="text-sm font-mono h-10"
                    onKeyDown={(e) => e.key === "Enter" && handleSendTestMessage()}
                  />
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 font-semibold gap-1.5 h-10 px-4"
                    onClick={() => handleSendTestMessage()}
                    disabled={sendingTest || !testPhone.trim()}
                  >
                    {sendingTest ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizontal className="h-4 w-4" />
                    )}
                    <span>Enviar Teste</span>
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Dica: Você pode digitar o seu próprio número de WhatsApp para conferir a notificação e a formatação no seu aparelho.
                </p>
              </div>

              {/* Status do Teste */}
              {testSentResult && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Último teste enviado com sucesso para +{testSentResult.phone} às {testSentResult.timestamp}!</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-5.5">
                    A lista de envio está oficialmente liberada para disparo.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setTestModalOpen(false)}>
                Fechar
              </Button>
              {testSentResult && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  onClick={() => {
                    setTestModalOpen(false);
                    setWizardStep(4);
                  }}
                >
                  Ir para Revisão & Disparo (Passo 4)
                </Button>
              )}
            </DialogFooter>
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

        {/* ========================================================================= */}
        {/* FLOATING BROADCAST MINIPLAYER (GLOBAL PARA TODAS AS ABAS) */}
        {/* ========================================================================= */}
        {broadcastProgress && (
          <div className="fixed bottom-6 right-6 z-50 transition-all duration-300">
            {miniplayerMinimized ? (
              /* MODO COMPACTO: Pílula Flutuante com Glassmorphism */
              <div
                className={`flex items-center gap-3 px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-xl border transition-all ${
                  broadcastProgress.status === "completed"
                    ? "bg-slate-950/90 text-emerald-400 border-emerald-500/40"
                    : broadcastProgress.status === "paused"
                    ? "bg-slate-950/90 text-amber-400 border-amber-500/40"
                    : broadcastProgress.status === "cancelled"
                    ? "bg-slate-950/90 text-red-400 border-red-500/40"
                    : "bg-slate-950/90 text-white border-blue-500/40"
                }`}
              >
                {/* Indicador de Status */}
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      broadcastProgress.status === "running"
                        ? "bg-blue-400 animate-pulse"
                        : broadcastProgress.status === "paused"
                        ? "bg-amber-400"
                        : broadcastProgress.status === "completed"
                        ? "bg-emerald-400"
                        : "bg-red-400"
                    }`}
                  />
                  <span className="text-xs font-bold font-mono">
                    {broadcastProgress.status === "completed"
                      ? "Concluído"
                      : broadcastProgress.status === "paused"
                      ? "Pausado"
                      : `${broadcastProgress.progress || 0}%`}
                  </span>
                </div>

                <span className="text-xs font-medium text-slate-300 font-mono">
                  ({broadcastProgress.sent}/{broadcastProgress.total})
                </span>

                {/* Controles Rápidos */}
                {broadcastProgress.status === "running" && (
                  <button
                    type="button"
                    onClick={() => handleControlBroadcast("pause")}
                    className="p-1 rounded-full hover:bg-white/10 text-amber-400 transition-colors"
                    title="Pausar Disparo"
                  >
                    <Pause className="h-3.5 w-3.5" />
                  </button>
                )}

                {broadcastProgress.status === "paused" && (
                  <button
                    type="button"
                    onClick={() => handleControlBroadcast("resume")}
                    className="p-1 rounded-full hover:bg-white/10 text-emerald-400 transition-colors"
                    title="Retomar Disparo"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Botão Expandir */}
                <button
                  type="button"
                  onClick={() => setMiniplayerMinimized(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  title="Expandir Miniplayer"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              /* MODO EXPANDIDO: Console Flutuante Estilo Dynamic Island */
              <div className="w-[340px] sm:w-[380px] bg-slate-950/95 dark:bg-slate-950/95 text-white border border-slate-700/80 shadow-2xl backdrop-blur-xl rounded-2xl p-4 space-y-3.5 animate-in slide-in-from-bottom-5 duration-200">
                {/* Header do Miniplayer */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    {broadcastProgress.status === "running" ? (
                      <Radio className="h-4 w-4 text-blue-400 animate-pulse" />
                    ) : broadcastProgress.status === "paused" ? (
                      <Pause className="h-4 w-4 text-amber-400" />
                    ) : broadcastProgress.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    <div>
                      <h4 className="text-xs font-bold leading-tight flex items-center gap-1.5">
                        <span>
                          {broadcastProgress.status === "running"
                            ? "Campanha em Andamento"
                            : broadcastProgress.status === "paused"
                            ? "Campanha Pausada"
                            : broadcastProgress.status === "completed"
                            ? "Campanha Concluída"
                            : "Campanha Cancelada"}
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {broadcastProgress.currentSession
                          ? `Chip: ${broadcastProgress.currentSession}`
                          : `Sessão: ${sessionId || "Padrão"}`}
                      </p>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMiniplayerMinimized(true)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Minimizar para Pílula"
                    >
                      <Minimize2 className="h-3.5 w-3.5" />
                    </button>
                    {(broadcastProgress.status === "completed" || broadcastProgress.status === "cancelled") && (
                      <button
                        type="button"
                        onClick={() => setBroadcastProgress(null)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Fechar Miniplayer"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Barra de Progresso com Gradiente */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">Progresso</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {broadcastProgress.progress || 0}% ({broadcastProgress.sent + broadcastProgress.failed}/{broadcastProgress.total})
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 transition-all duration-300 rounded-full"
                      style={{ width: `${broadcastProgress.progress || 0}%` }}
                    />
                  </div>
                </div>

                {/* Métricas Rápidas: Enviados, Falhas, Restantes */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Enviados</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {broadcastProgress.sent}
                    </span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Falhas</span>
                    <span className="font-bold text-red-400 font-mono">
                      {broadcastProgress.failed}
                    </span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Restantes</span>
                    <span className="font-bold text-slate-300 font-mono">
                      {broadcastProgress.total - (broadcastProgress.sent + broadcastProgress.failed)}
                    </span>
                  </div>
                </div>

                {/* Lead Atual em Processamento */}
                {broadcastProgress.current && broadcastProgress.status === "running" && (
                  <div className="text-[11px] bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 text-slate-300 truncate">
                    <span className="text-slate-400">Disparando agora para: </span>
                    <strong className="text-white">
                      {broadcastProgress.currentName || broadcastProgress.current}
                    </strong>
                  </div>
                )}

                {/* Controles Ao Vivo */}
                <div className="flex items-center gap-2 pt-1">
                  {broadcastProgress.status === "running" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs border-amber-500/50 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                        onClick={() => handleControlBroadcast("pause")}
                      >
                        <Pause className="h-3.5 w-3.5 mr-1" /> Pausar Disparo
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs px-3"
                        onClick={() => handleControlBroadcast("cancel")}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Parar
                      </Button>
                    </>
                  )}

                  {broadcastProgress.status === "paused" && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleControlBroadcast("resume")}
                      >
                        <Play className="h-3.5 w-3.5 mr-1" /> Retomar Disparo
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs px-3"
                        onClick={() => handleControlBroadcast("cancel")}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                    </>
                  )}

                  {broadcastProgress.status === "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10"
                      onClick={() => {
                        setActiveTab("history");
                        fetchHistory();
                      }}
                    >
                      <History className="h-3.5 w-3.5 mr-1" /> Ver Relatório no Histórico
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SessionGuard>
  );
}
