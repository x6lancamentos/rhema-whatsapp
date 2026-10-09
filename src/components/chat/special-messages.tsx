"use client";

import { MapPin, ExternalLink, User, Phone, Copy, Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPhone, getCleanPhone } from "@/lib/phone-formatter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Status Ticks (WhatsApp Delivery & Read Receipts) ────────────────
interface MessageTicksProps {
  status: string;
  fromMe: boolean;
  className?: string;
}

export function MessageTicks({ status, fromMe, className }: MessageTicksProps) {
  if (!fromMe) return null;

  const upperStatus = (status || "PENDING").toUpperCase();

  switch (upperStatus) {
    case "READ":
      return (
        <span title="Lido" className={cn("inline-flex items-center", className)}>
          <CheckCheck className="h-3.5 w-3.5 text-sky-400" />
        </span>
      );
    case "DELIVERED":
      return (
        <span title="Entregue" className={cn("inline-flex items-center text-primary-foreground/70", className)}>
          <CheckCheck className="h-3.5 w-3.5" />
        </span>
      );
    case "SENT":
      return (
        <span title="Enviado" className={cn("inline-flex items-center text-primary-foreground/70", className)}>
          <Check className="h-3 w-3" />
        </span>
      );
    case "FAILED":
      return (
        <span title="Falha no envio" className={cn("inline-flex items-center text-rose-300", className)}>
          <AlertCircle className="h-3 w-3" />
        </span>
      );
    case "PENDING":
    default:
      return (
        <span title="Pendente" className={cn("inline-flex items-center text-primary-foreground/50", className)}>
          <Clock className="h-2.5 w-2.5" />
        </span>
      );
  }
}

// ─── Location Message Card ───────────────────────────────────────────
interface LocationCardProps {
  content?: string | null;
  fromMe?: boolean;
}

export function LocationCard({ content, fromMe = false }: LocationCardProps) {
  if (!content) return null;

  // Expected formats: "-23.9618,-46.3322" or JSON or with label
  const parts = content.split(",");
  const lat = parseFloat(parts[0]?.trim());
  const lng = parseFloat(parts[1]?.trim());

  const hasCoords = !isNaN(lat) && !isNaN(lng);
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(content)}`;

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden border mb-1.5 max-w-[280px] sm:max-w-[300px] shadow-xs text-xs",
        fromMe
          ? "border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground"
          : "border-border/50 bg-card text-card-foreground"
      )}
    >
      {/* Map visual header */}
      <div className="relative h-28 bg-gradient-to-br from-emerald-500/20 via-sky-500/10 to-emerald-700/20 flex flex-col items-center justify-center border-b border-border/30">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-12 w-12 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md z-10">
            <MapPin className="h-5 w-5" />
          </div>
        </div>
        <span className="text-[11px] font-semibold mt-2 opacity-90">Localização Compartilhada</span>
      </div>

      {/* Info & action */}
      <div className="p-2.5 space-y-2">
        {hasCoords ? (
          <div className="text-[11px] font-mono opacity-80 truncate">
            Lat: {lat.toFixed(5)}, Lng: {lng.toFixed(5)}
          </div>
        ) : (
          <div className="text-[11px] opacity-80 break-words">{content}</div>
        )}

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer",
            fromMe
              ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              : "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500"
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir no Google Maps
        </a>
      </div>
    </div>
  );
}

// ─── Contact (vCard) Card ───────────────────────────────────────────
interface ContactCardProps {
  content?: string | null;
  fromMe?: boolean;
  onSelectChat?: (jid: string, name?: string) => void;
}

export function ContactCard({ content, fromMe = false, onSelectChat }: ContactCardProps) {
  if (!content) return null;

  // Extract contact name and phone from text or vCard
  let contactName = "Contato";
  let contactPhone = "";

  if (content.includes("BEGIN:VCARD")) {
    const fnMatch = content.match(/FN:(.*?)(\r?\n|$)/i);
    const telMatch = content.match(/TEL(?:;[^:]*)?:(.*?)(\r?\n|$)/i) || content.match(/waid=([0-9]+)/i);

    if (fnMatch && fnMatch[1]) contactName = fnMatch[1].trim();
    if (telMatch && telMatch[1]) contactPhone = telMatch[1].trim();
  } else {
    // Check if line 1 is name, line 2 is phone or content itself is phone/name
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      contactName = lines[0];
      contactPhone = lines[1];
    } else {
      contactName = lines[0] || "Contato";
      contactPhone = getCleanPhone(lines[0]);
    }
  }

  const cleanPhoneDigits = getCleanPhone(contactPhone);
  const formattedPhoneStr = formatPhone(contactPhone || contactName);

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    const toCopy = cleanPhoneDigits || contactPhone;
    if (toCopy) {
      navigator.clipboard.writeText(toCopy);
      toast.success("Telefone copiado para a área de transferência!");
    }
  };

  const handleOpenWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cleanPhoneDigits) {
      const fullPhone = cleanPhoneDigits.startsWith("55") ? cleanPhoneDigits : `55${cleanPhoneDigits}`;
      if (onSelectChat) {
        onSelectChat(`${fullPhone}@s.whatsapp.net`, contactName);
      } else {
        window.open(`https://wa.me/${fullPhone}`, "_blank");
      }
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-3 mb-1.5 max-w-[280px] sm:max-w-[300px] shadow-xs text-xs space-y-2.5",
        fromMe
          ? "border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground"
          : "border-border/50 bg-card text-card-foreground"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0 font-bold",
            fromMe
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          <User className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{contactName}</div>
          {formattedPhoneStr && (
            <div className="text-[11px] opacity-80 font-mono truncate">{formattedPhoneStr}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopyPhone}
          className={cn(
            "h-7 text-[11px] px-2 font-medium",
            fromMe ? "border-primary-foreground/30 hover:bg-primary-foreground/20 text-primary-foreground" : ""
          )}
        >
          <Copy className="h-3 w-3 mr-1" />
          Copiar
        </Button>

        {cleanPhoneDigits && (
          <Button
            size="sm"
            onClick={handleOpenWhatsApp}
            className={cn(
              "h-7 text-[11px] px-2 font-semibold text-white",
              fromMe
                ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                : "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500"
            )}
          >
            <Phone className="h-3 w-3 mr-1" />
            Conversar
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Emoji Reactions Badge ──────────────────────────────────────────
interface ReactionsBadgeProps {
  reactions?: string[] | { emoji: string; count?: number }[];
  fromMe?: boolean;
}

export function ReactionsBadge({ reactions, fromMe = false }: ReactionsBadgeProps) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div
      className={cn(
        "absolute -bottom-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-background border shadow-xs select-none z-10 transition-transform hover:scale-110",
        fromMe ? "right-2" : "left-2"
      )}
    >
      {reactions.map((r, i) => {
        const emoji = typeof r === "string" ? r : r.emoji;
        const count = typeof r === "string" ? undefined : r.count;
        return (
          <span key={i} className="inline-flex items-center text-[12px] leading-none">
            {emoji}
            {count && count > 1 && <span className="text-[9px] font-bold ml-0.5 text-muted-foreground">{count}</span>}
          </span>
        );
      })}
    </div>
  );
}
