"use client";

import { useEffect, useState } from "react";
import { useTheme } from "./theme-provider";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Monitor, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ThemeToggleProps {
  className?: string;
  variant?: "icon-only" | "dropdown";
}

export function ThemeToggle({ className = "", variant = "icon-only" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`h-9 w-9 rounded-full opacity-60 pointer-events-none ${className}`}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  if (variant === "dropdown") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 rounded-full hover:bg-muted/60 dark:hover:bg-muted/40 transition-all duration-200 active:scale-95 border border-transparent hover:border-border/60 ${className}`}
            title="Alterar tema visual"
          >
            {resolvedTheme === "dark" ? (
              <Moon className="h-4 w-4 text-emerald-400 transition-transform duration-300 rotate-0 hover:rotate-12" />
            ) : (
              <Sun className="h-4 w-4 text-amber-500 transition-transform duration-300 rotate-0 hover:rotate-45" />
            )}
            <span className="sr-only">Alternar tema</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-40 p-1.5 rounded-2xl border border-border/60 shadow-2xl backdrop-blur-2xl bg-popover/95"
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Aparência
          </div>
          <button
            onClick={() => {
              setTheme("light");
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-xl transition-colors ${
              theme === "light"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-foreground hover:bg-muted/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              <span>Claro</span>
            </div>
            {theme === "light" && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
          <button
            onClick={() => {
              setTheme("dark");
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-xl transition-colors ${
              theme === "dark"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-foreground hover:bg-muted/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 text-emerald-400" />
              <span>Escuro</span>
            </div>
            {theme === "dark" && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
          <button
            onClick={() => {
              setTheme("system");
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-xl transition-colors ${
              theme === "system"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-foreground hover:bg-muted/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Automático</span>
            </div>
            {theme === "system" && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
        </PopoverContent>
      </Popover>
    );
  }

  // Quick 1-click toggle between Dark and Light
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={`h-9 w-9 rounded-full hover:bg-muted/60 dark:hover:bg-muted/40 transition-all duration-200 active:scale-90 border border-transparent hover:border-border/60 ${className}`}
      title={resolvedTheme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? (
        <Moon className="h-4 w-4 text-emerald-400 transition-transform duration-300 hover:rotate-12" />
      ) : (
        <Sun className="h-4 w-4 text-amber-500 transition-transform duration-300 hover:rotate-45" />
      )}
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
}
