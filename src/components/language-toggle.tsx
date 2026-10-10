"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./language-provider";
import { Button } from "@/components/ui/button";
import { Check, Globe } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface LanguageToggleProps {
  className?: string;
  variant?: "dropdown" | "pill";
}

export function LanguageToggle({ className = "", variant = "dropdown" }: LanguageToggleProps) {
  const { language, setLanguage, toggleLanguage, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={`h-9 px-2.5 rounded-xl opacity-60 pointer-events-none gap-1.5 ${className}`}
        aria-label="Language selector"
      >
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold">PT</span>
      </Button>
    );
  }

  if (variant === "pill") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleLanguage}
        className={`h-8.5 px-2.5 rounded-xl gap-1.5 hover:bg-muted/60 dark:hover:bg-muted/40 transition-all duration-200 active:scale-95 border border-border/50 ${className}`}
        title={t("lang.switch")}
      >
        <span className="text-sm">{language === "pt-BR" ? "🇧🇷" : "🇺🇸"}</span>
        <span className="text-xs font-bold text-foreground">
          {language === "pt-BR" ? "PT" : "EN"}
        </span>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-9 px-2.5 rounded-xl gap-1.5 hover:bg-muted/60 dark:hover:bg-muted/40 transition-all duration-200 active:scale-95 border border-transparent hover:border-border/60 ${className}`}
          title={t("lang.switch")}
        >
          <span className="text-base leading-none select-none">{language === "pt-BR" ? "🇧🇷" : "🇺🇸"}</span>
          <span className="text-xs font-bold text-foreground select-none">
            {language === "pt-BR" ? "PT" : "EN"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-44 p-1.5 rounded-2xl border border-border/60 shadow-2xl backdrop-blur-2xl bg-popover/95"
      >
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
          {t("common.language")}
        </div>
        <button
          onClick={() => {
            setLanguage("pt-BR");
            setOpen(false);
          }}
          className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-xl transition-colors ${
            language === "pt-BR"
              ? "bg-primary/10 text-primary font-semibold"
              : "text-foreground hover:bg-muted/60"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">🇧🇷</span>
            <span>Português (BR)</span>
          </div>
          {language === "pt-BR" && <Check className="h-3.5 w-3.5 text-primary" />}
        </button>
        <button
          onClick={() => {
            setLanguage("en");
            setOpen(false);
          }}
          className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-xl transition-colors ${
            language === "en"
              ? "bg-primary/10 text-primary font-semibold"
              : "text-foreground hover:bg-muted/60"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">🇺🇸</span>
            <span>English (US)</span>
          </div>
          {language === "en" && <Check className="h-3.5 w-3.5 text-primary" />}
        </button>
      </PopoverContent>
    </Popover>
  );
}
