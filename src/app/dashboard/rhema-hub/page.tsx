"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ExternalLink,
  Award,
  Building2,
  FileText,
  Compass,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Maximize2,
  ChevronRight,
  TrendingUp,
  BookOpen,
} from "lucide-react";

interface RhemaModule {
  id: string;
  title: string;
  category: string;
  description: string;
  url: string;
  icon: React.ElementType;
  badge: string;
  highlights: string[];
  color: {
    bg: string;
    text: string;
    border: string;
    hover: string;
    badgeBg: string;
    badgeText: string;
  };
}

const MODULES: RhemaModule[] = [
  {
    id: "placar",
    title: "Placar Oficial & Metas",
    category: "Performance Comercial",
    description:
      "Acompanhe sua pontuação em tempo real com tetos diários oficiais: ligações (1 pt), resgates (2 pts), visitas (15 pts), propostas (50 pts) e vendas (200 pts), além do Bônus Dia Consistente (+20 pts).",
    url: "https://rhema-hub.vercel.app/placar",
    icon: Award,
    badge: "Placar Vivo",
    highlights: ["Pontos em Tempo Real", "Ranking Mensal", "Regras Oficiais de Desempate"],
    color: {
      bg: "from-amber-500/10 to-amber-500/5",
      text: "text-amber-500 dark:text-amber-400",
      border: "border-amber-500/20 hover:border-amber-500/40",
      hover: "group-hover:text-amber-500",
      badgeBg: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
      badgeText: "text-amber-600 dark:text-amber-400",
    },
  },
  {
    id: "fichas",
    title: "Fichas de Captação & CMA",
    category: "Captação & Exclusividade",
    description:
      "Precificação inteligente do m² real nos bairros core de Santos (Embaré, Aparecida, Ponta da Praia, Gonzaga, Boqueirão). Argumentário para fechar na Rhema Premium com 90 dias de exclusividade.",
    url: "https://rhema-hub.vercel.app/fichas",
    icon: Building2,
    badge: "CMA em 10s",
    highlights: ["M² Real Santos", "Exclusividade 90 Dias", "Ficha Digital Direta"],
    color: {
      bg: "from-emerald-500/10 to-emerald-500/5",
      text: "text-emerald-500 dark:text-emerald-400",
      border: "border-emerald-500/20 hover:border-emerald-500/40",
      hover: "group-hover:text-emerald-500",
      badgeBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
      badgeText: "text-emerald-600 dark:text-emerald-400",
    },
  },
  {
    id: "propostas",
    title: "Fábrica de Propostas",
    category: "Closer & Negociação",
    description:
      "Estruturação executiva de propostas de compra analisando tempo de vacância do imóvel, custo fixo acumulado (condomínio + IPTU) e argumentos matemáticos de liquidez para aceite do vendedor.",
    url: "https://rhema-hub.vercel.app/propostas",
    icon: FileText,
    badge: "Deal Closer",
    highlights: ["Calculadora de Vacância", "Fluxo Construtora", "Aceite Rápido"],
    color: {
      bg: "from-blue-500/10 to-blue-500/5",
      text: "text-blue-500 dark:text-blue-400",
      border: "border-blue-500/20 hover:border-blue-500/40",
      hover: "group-hover:text-blue-500",
      badgeBg: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
      badgeText: "text-blue-600 dark:text-blue-400",
    },
  },
  {
    id: "universidade",
    title: "Universidade Rhema",
    category: "Formação Continuada",
    description:
      "12 capítulos práticos de treinamento: Cadência dos 4 Pilares, Captação & Exclusividade (Cap. 09), Condução de Visita (Cap. 10) e Fechamento & Quebra de Objeções (Cap. 11).",
    url: "https://rhema-hub.vercel.app/universidade",
    icon: Compass,
    badge: "12 Capítulos",
    highlights: ["Playbooks de Venda", "Diagnóstico por Taxa", "Scripts Prontos"],
    color: {
      bg: "from-purple-500/10 to-purple-500/5",
      text: "text-purple-500 dark:text-purple-400",
      border: "border-purple-500/20 hover:border-purple-500/40",
      hover: "group-hover:text-purple-500",
      badgeBg: "bg-purple-500/15 text-purple-600 dark:text-purple-300",
      badgeText: "text-purple-600 dark:text-purple-400",
    },
  },
];

export default function RhemaHubPage() {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600/15 via-background to-background border border-emerald-500/30 p-6 md:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Sparkles size={13} />
              <span>SUÍTE DO CORRETOR & GESTÃO · 25 ANOS DE MERCADO</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Rhema Hub <span className="text-muted-foreground font-normal text-xl">| Central Operacional</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ambiente unificado para corretores e diretoria da Rhema Imóveis. Acesse em 1 clique o Placar Oficial, as Fichas de Captação Digital com CMA, a Fábrica de Propostas e a Universidade Corporativa.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <a
              href="https://rhema-hub.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-emerald-600/20 group"
            >
              <span>Abrir Rhema Hub Completo</span>
              <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>

            {embedUrl ? (
              <button
                onClick={() => setEmbedUrl(null)}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border/60 bg-background/80 hover:bg-muted text-sm font-medium transition-all"
              >
                <span>Voltar aos Cards</span>
              </button>
            ) : (
              <button
                onClick={() => setEmbedUrl("https://rhema-hub.vercel.app")}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-emerald-500/30 bg-background/80 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium transition-all"
              >
                <Maximize2 size={15} />
                <span>Navegar Aqui Dentro</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Iframe View (when toggled) */}
      {embedUrl ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Conectado a: <code className="text-foreground font-mono">{embedUrl}</code></span>
            </div>
            <a
              href={embedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground text-emerald-500"
            >
              <span>Abrir em aba externa</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="w-full h-[780px] rounded-2xl border border-border/60 overflow-hidden bg-background shadow-lg">
            <iframe
              src={embedUrl}
              title="Rhema Hub Embutido"
              className="w-full h-full border-0"
              allow="clipboard-write; clipboard-read"
            />
          </div>
        </div>
      ) : (
        /* 4 Main Core Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <div
                key={module.id}
                className={`group relative rounded-2xl border ${module.color.border} bg-card/60 hover:bg-card/90 backdrop-blur-sm p-6 transition-all duration-200 hover:shadow-md flex flex-col justify-between`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${module.color.bg} flex items-center justify-center border border-border/40 shrink-0`}>
                        <Icon size={22} className={module.color.text} />
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {module.category}
                        </span>
                        <h2 className="text-lg font-bold text-foreground group-hover:text-foreground transition-colors">
                          {module.title}
                        </h2>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${module.color.badgeBg}`}>
                      {module.badge}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {module.description}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {module.highlights.map((h, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-lg bg-muted/60 text-muted-foreground border border-border/30"
                      >
                        <CheckCircle2 size={11} className="text-emerald-500" />
                        <span>{h}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-border/40 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setEmbedUrl(module.url)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Visualizar no Painel
                  </button>

                  <a
                    href={module.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${module.color.text} hover:underline`}
                  >
                    <span>Acessar Módulo</span>
                    <ArrowUpRight size={14} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info Box */}
      <div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-500" />
          <span>Sincronização em tempo real com Imoview CRM, Supabase Rhema App e WhatsApp Gateway.</span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground/70">
          Rhema OS v5.0 · Santos/SP
        </span>
      </div>
    </div>
  );
}

