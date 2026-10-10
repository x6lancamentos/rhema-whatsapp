"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  X,
  Phone,
  User,
  DollarSign,
  MapPin,
  Calendar,
  Send,
  Copy,
  ExternalLink,
  RefreshCw,
  Tag,
  Bed,
  Car,
  Home,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatPhone } from "@/lib/phone-formatter";

interface ImoviewContextData {
  id?: string;
  phone: string;
  jid?: string;
  tipoRelacionamento: string;
  nome?: string;
  codigoImovel?: string;
  tituloImovel?: string;
  tipoImovel?: string;
  finalidade?: string;
  valor?: string;
  valorCondominio?: string;
  valorIptu?: string;
  nomeCondominio?: string;
  bairro?: string;
  cidade?: string;
  quartos?: string;
  vagas?: string;
  corretorId?: string;
  corretorNome?: string;
  diasSemContato?: number;
  ultimoHistorico?: string;
  fotoPrincipal?: string;
  isRhemaProprio?: boolean;
  campaignName?: string;
}

interface ImoviewContextPanelProps {
  jid: string;
  contactName?: string;
  isOpen: boolean;
  onClose: () => void;
  onInsertMessage?: (text: string) => void;
}

export function ImoviewContextPanel({
  jid,
  contactName,
  isOpen,
  onClose,
  onInsertMessage,
}: ImoviewContextPanelProps) {
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<ImoviewContextData | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  const fetchContext = useCallback(async () => {
    if (!jid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/imoview/context?jid=${encodeURIComponent(jid)}`);
      if (res.ok) {
        const json = await res.json();
        setContext(json.data || null);
      } else {
        setContext(null);
      }
    } catch (e) {
      console.error("Failed to fetch Imoview context:", e);
      setContext(null);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }, [jid]);

  useEffect(() => {
    if (isOpen) {
      fetchContext();
    }
  }, [isOpen, fetchContext]);

  if (!isOpen) return null;

  const handleCopySummary = () => {
    if (!context) return;
    const lines = [
      `*${context.tituloImovel || context.tipoImovel || "Imóvel Rhema"}* (Cód: ${context.codigoImovel || "N/A"})`,
      `📍 ${context.bairro || "Santos"} - ${context.cidade || "SP"}`,
      `💰 Valor: ${context.valor || "Sob Consulta"}`,
      context.valorCondominio ? `🏢 Condomínio: ${context.valorCondominio}` : null,
      context.valorIptu ? `🏛️ IPTU: ${context.valorIptu}` : null,
      context.quartos ? `🛏️ ${context.quartos} quarto(s)` : null,
      context.vagas ? `🚗 ${context.vagas} vaga(s)` : null,
      context.corretorNome ? `👤 Corretor: ${context.corretorNome}` : null,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Resumo do imóvel copiado para a área de transferência!");
  };

  const handleInsertFicha = () => {
    if (!context || !onInsertMessage) return;
    const clientName = context.nome || contactName || "Olá";
    const text = `Olá ${clientName}! Segue a ficha do imóvel *${context.codigoImovel || ""}*:\n\n` +
      `📍 *${context.tipoImovel || "Imóvel"}* em ${context.bairro || "Santos"} - ${context.cidade || "SP"}\n` +
      `💰 *Valor:* ${context.valor || "Sob consulta"}\n` +
      (context.valorCondominio ? `🏢 *Condomínio:* ${context.valorCondominio}\n` : "") +
      (context.valorIptu ? `🏛️ *IPTU:* ${context.valorIptu}\n` : "") +
      (context.quartos ? `🛏️ ${context.quartos} quarto(s)  ` : "") +
      (context.vagas ? `🚗 ${context.vagas} vaga(s)\n` : "\n") +
      `\nFico à disposição para agendarmos uma visita!`;

    onInsertMessage(text);
    toast.success("Ficha do imóvel inserida no campo de mensagem!");
  };

  const handleManualLink = async () => {
    if (!manualCode.trim()) return;
    setIsLinking(true);
    try {
      const res = await fetch("/api/integrations/imoview/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jid,
          phone: jid.split("@")[0],
          codigoImovel: manualCode.trim().toUpperCase(),
          tituloImovel: `Imóvel Cód ${manualCode.trim().toUpperCase()}`,
          nome: contactName || undefined,
        }),
      });

      if (res.ok) {
        toast.success(`Imóvel ${manualCode.trim()} vinculado a este contato com sucesso!`);
        setManualCode("");
        fetchContext();
      } else {
        toast.error("Falha ao vincular imóvel.");
      }
    } catch {
      toast.error("Erro ao vincular.");
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="w-80 lg:w-96 border-l border-border/30 bg-background/95 backdrop-blur-md flex flex-col h-full shrink-0 animate-in slide-in-from-right-4 duration-200 z-20 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-tight text-foreground flex items-center gap-1.5">
              Contexto do Imoview
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </h3>
            <p className="text-[10px] text-muted-foreground font-medium">Produtividade no Atendimento</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={fetchContext}
            title="Recarregar dados"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 styled-scrollbar">
        {loading && !context ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : context ? (
          <>
            {/* Contact & Relationship Badge Card */}
            <div className="p-3 rounded-xl border border-border/40 bg-card/60 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 ${
                    context.isRhemaProprio
                      ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                      : context.tipoRelacionamento === "proprietario" || context.tipoRelacionamento === "locador"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                      : "bg-blue-500/10 text-blue-500 border-blue-500/30"
                  }`}
                >
                  {context.isRhemaProprio
                    ? "Patrimônio Rhema"
                    : context.tipoRelacionamento === "locador"
                    ? "Locador / Proprietário"
                    : context.tipoRelacionamento === "proprietario"
                    ? "Proprietário (Captação)"
                    : "Lead Interessado"}
                </Badge>

                {context.codigoImovel && (
                  <span className="text-xs font-mono font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded-md border">
                    {context.codigoImovel}
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground truncate">
                  {context.nome || contactName || "Contato Rhema"}
                </h4>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 font-mono">
                  <Phone className="h-3 w-3 text-emerald-500" />
                  <span>{formatPhone(context.phone || jid)}</span>
                </div>
              </div>

              {context.corretorNome && (
                <div className="pt-2 border-t border-border/20 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Corretor Responsável:</span>
                  <span className="font-semibold text-foreground truncate max-w-[140px]">
                    {context.corretorNome}
                  </span>
                </div>
              )}

              {context.campaignName && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Origem do Contato:</span>
                  <span className="font-medium text-emerald-500 truncate max-w-[140px]">
                    {context.campaignName}
                  </span>
                </div>
              )}
            </div>

            {/* Property Details Card */}
            <div className="p-3.5 rounded-xl border border-border/40 bg-card/60 shadow-xs space-y-3">
              {context.fotoPrincipal && (
                <div className="relative h-32 w-full rounded-lg overflow-hidden border border-border/30">
                  <img
                    src={context.fotoPrincipal}
                    alt={context.tituloImovel || "Imóvel"}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded">
                    {context.tipoImovel || "Imóvel"}
                  </div>
                </div>
              )}

              <div>
                <h5 className="text-xs font-bold text-foreground leading-snug">
                  {context.tituloImovel || `${context.tipoImovel || "Imóvel"} em ${context.bairro || "Santos"}`}
                </h5>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                  <span className="truncate">
                    {context.bairro || "Bairro não informado"}{context.cidade ? `, ${context.cidade}` : ""}
                  </span>
                </div>
              </div>

              {/* Price & Highlighted Values (Condominio + IPTU) */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                <div className="p-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-emerald-500 block">
                      {context.finalidade || "Valor de Venda"}
                    </span>
                    <span className="text-base font-extrabold text-foreground">
                      {context.valor || "Sob consulta"}
                    </span>
                  </div>
                  <Tag className="h-5 w-5 text-emerald-500/50" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-muted/40 border border-border/30">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Condomínio
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {context.valorCondominio || "Não informado"}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/40 border border-border/30">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      IPTU
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {context.valorIptu || "Não informado"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Specs (Bedrooms, Parking, Days) */}
              <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground border-t border-border/20">
                {context.quartos && (
                  <div className="flex items-center gap-1">
                    <Bed className="h-3.5 w-3.5 text-blue-500" />
                    <span>{context.quartos} qtos</span>
                  </div>
                )}
                {context.vagas && (
                  <div className="flex items-center gap-1">
                    <Car className="h-3.5 w-3.5 text-amber-500" />
                    <span>{context.vagas} vagas</span>
                  </div>
                )}
                {context.diasSemContato !== undefined && (
                  <div className="flex items-center gap-1 ml-auto text-[10px] font-mono">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{context.diasSemContato}d sem contato</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="space-y-2 pt-1">
              {onInsertMessage && (
                <Button
                  onClick={handleInsertFicha}
                  className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xs font-medium text-xs h-9"
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar Ficha do Imóvel no Chat
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleCopySummary}
                className="w-full gap-2 text-xs h-8 border-border/50 hover:bg-muted/60"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar Resumo Comercial
              </Button>
            </div>
          </>
        ) : (
          /* Empty state: No property linked yet */
          <div className="py-8 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-foreground">Nenhum Imóvel Vinculado</h4>
              <p className="text-[11px] text-muted-foreground px-4">
                Este contato ainda não possui um imóvel associado no cache do Imoview.
              </p>
            </div>

            {/* Manual Link by Code */}
            <div className="p-3 rounded-xl border border-border/40 bg-muted/20 text-left space-y-2 mt-4">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Vincular Imóvel por Código
              </span>
              <div className="flex gap-2">
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Ex: AP0123"
                  className="h-8 text-xs font-mono uppercase bg-background"
                />
                <Button
                  onClick={handleManualLink}
                  disabled={!manualCode.trim() || isLinking}
                  size="sm"
                  className="h-8 text-xs shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isLinking ? "..." : "Vincular"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
