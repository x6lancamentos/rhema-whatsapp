"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  Search,
  Copy,
  Trash2,
  Edit,
  Send,
  Sparkles,
  RefreshCw,
  FolderOpen,
  MessageSquare,
  Building2,
  CheckCircle2,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { SessionGuard } from "@/components/dashboard/session-guard";

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  updatedAt: string;
}

const CATEGORIES = [
  "Todos",
  "Prospecção",
  "Recuperação",
  "Boas-Vindas",
  "Agendamento",
  "Proprietários",
  "Pós-Venda",
  "Geral",
] as const;

const AVAILABLE_VARIABLES = [
  { label: "Primeiro Nome", token: "{{primeiro_nome}}" },
  { label: "Nome Completo", token: "{{nome}}" },
  { label: "Cód. Imóvel", token: "{{codigo_imovel}}" },
  { label: "Tipo Imóvel", token: "{{tipo_imovel}}" },
  { label: "Bairro", token: "{{bairro}}" },
  { label: "Cidade", token: "{{cidade}}" },
  { label: "Valor", token: "{{valor}}" },
  { label: "Quartos", token: "{{quartos}}" },
  { label: "Vagas", token: "{{vagas}}" },
  { label: "Corretor", token: "{{corretor}}" },
  { label: "Proprietário", token: "{{nome_proprietario}}" },
];

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Geral");
  const [formContent, setFormContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Load templates
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data || []);
      }
    } catch {
      toast.error("Erro ao carregar modelos de mensagens");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Seed default templates
  const handleSeedDefaults = async () => {
    try {
      const res = await fetch("/api/templates/seed", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Modelos restaurados com sucesso!");
        fetchTemplates();
      } else {
        toast.error(data.message || "Falha ao restaurar modelos");
      }
    } catch {
      toast.error("Erro ao conectar com o servidor");
    }
  };

  // Open modal for new template
  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormCategory(selectedCategory !== "Todos" ? selectedCategory : "Geral");
    setFormContent("");
    setModalOpen(true);
  };

  // Open modal for editing
  const handleEditTemplate = (tpl: Template) => {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormCategory(tpl.category || "Geral");
    setFormContent(tpl.content);
    setModalOpen(true);
  };

  // Insert variable token into textarea
  const handleInsertVariable = (token: string) => {
    setFormContent((prev) => prev + " " + token);
  };

  // Save or update template
  const handleSave = async () => {
    if (!formName.trim()) {
      return toast.error("O nome do modelo é obrigatório");
    }
    if (!formContent.trim()) {
      return toast.error("O conteúdo da mensagem é obrigatório");
    }

    setSaving(true);
    try {
      const url = editingTemplate ? `/api/templates/${editingTemplate.id}` : "/api/templates";
      const method = editingTemplate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          category: formCategory,
          content: formContent,
        }),
      });

      if (res.ok) {
        toast.success(editingTemplate ? "Modelo atualizado com sucesso!" : "Modelo criado com sucesso!");
        setModalOpen(false);
        fetchTemplates();
      } else {
        const err = await res.json();
        toast.error(err.message || "Erro ao salvar modelo");
      }
    } catch {
      toast.error("Falha ao salvar modelo");
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir o modelo "${name}"?`)) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Modelo excluído com sucesso");
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        toast.error("Falha ao excluir modelo");
      }
    } catch {
      toast.error("Erro ao excluir modelo");
    }
  };

  // Copy to clipboard
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Conteúdo copiado para a área de transferência!");
  };

  // Send to Broadcast
  const handleUseInBroadcast = (tpl: Template) => {
    localStorage.setItem("selected_broadcast_template", JSON.stringify(tpl));
    toast.info(`Modelo "${tpl.name}" selecionado para o Disparador!`);
    router.push("/dashboard/broadcast?template=" + encodeURIComponent(tpl.id));
  };

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesCategory =
        selectedCategory === "Todos" || (t.category || "Geral") === selectedCategory;
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        t.name.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [templates, selectedCategory, searchTerm]);

  // Preview simulation
  const previewText = useMemo(() => {
    if (!formContent) return "Digite o conteúdo da sua mensagem para visualizar a prévia...";
    return formContent
      .replace(/{{primeiro_nome}}/g, "Carlos")
      .replace(/{{nome}}/g, "Carlos Eduardo")
      .replace(/{{codigo_imovel}}/g, "4887")
      .replace(/{{tipo_imovel}}/g, "Apartamento")
      .replace(/{{bairro}}/g, "Gonzaga")
      .replace(/{{cidade}}/g, "Santos")
      .replace(/{{valor}}/g, "R$ 1.330.000,00")
      .replace(/{{quartos}}/g, "3")
      .replace(/{{vagas}}/g, "2")
      .replace(/{{corretor}}/g, "Brunno - Rhema")
      .replace(/{{nome_proprietario}}/g, "Dr. Ricardo");
  }, [formContent]);

  return (
    <SessionGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <FileText className="h-6 w-6" />
              </div>
              Modelos de Mensagens (Templates)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Biblioteca de mensagens pré-formatadas para funil de vendas, captação e relacionamento da Rhema Imóveis.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedDefaults}
              className="gap-2 border-border/80"
              title="Restaura os modelos padrão da imobiliária"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              Restaurar Padrões
            </Button>
            <Button onClick={handleNewTemplate} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Modelo
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <Card className="border border-border/60 bg-card/60 backdrop-blur-sm shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar modelo por nome, mensagem ou palavra-chave..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background/80"
                />
              </div>

              {/* Counter */}
              <div className="text-xs text-muted-foreground whitespace-nowrap self-center">
                Mostrando <strong className="text-foreground">{filteredTemplates.length}</strong> de{" "}
                {templates.length} modelos
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 styled-scrollbar">
              {CATEGORIES.map((cat) => {
                const count =
                  cat === "Todos"
                    ? templates.length
                    : templates.filter((t) => (t.category || "Geral") === cat).length;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/50"
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Templates Grid */}
        {loading ? (
          <div className="text-center py-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando modelos de mensagens...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Card className="border-dashed border-2 border-border/60 bg-muted/20 text-center py-16">
            <CardContent className="space-y-3 flex flex-col items-center">
              <div className="bg-muted p-3.5 rounded-full text-muted-foreground border border-border">
                <FolderOpen className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">Nenhum modelo encontrado</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {searchTerm || selectedCategory !== "Todos"
                  ? "Tente ajustar seus termos de pesquisa ou filtros de categoria."
                  : "Comece criando seu primeiro modelo ou clique em 'Restaurar Padrões' para carregar os modelos imobiliários da Rhema."}
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={handleSeedDefaults} className="gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Carregar Modelos Padrão
                </Button>
                <Button size="sm" onClick={handleNewTemplate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Modelo
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((tpl) => (
              <Card
                key={tpl.id}
                className="group border border-border/70 hover:border-primary/50 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between bg-card/80 backdrop-blur-xs overflow-hidden"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 border border-border/50 bg-muted/50"
                    >
                      {tpl.category || "Geral"}
                    </Badge>
                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleCopy(tpl.content)}
                        title="Copiar texto"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleEditTemplate(tpl)}
                        title="Editar modelo"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(tpl.id, tpl.name)}
                        title="Excluir modelo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-base font-bold text-foreground mt-2 line-clamp-1">
                    {tpl.name}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 pt-2 flex-1 flex flex-col justify-between space-y-4">
                  {/* Message bubble preview */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-xs text-foreground/90 font-mono whitespace-pre-wrap leading-relaxed line-clamp-6 select-all">
                    {tpl.content}
                  </div>

                  {/* Actions */}
                  <Button
                    size="sm"
                    className="w-full gap-2 text-xs font-semibold h-8"
                    onClick={() => handleUseInBroadcast(tpl)}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Usar no Disparador
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal: Create / Edit Template */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto styled-scrollbar">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {editingTemplate ? "Editar Modelo de Mensagem" : "Novo Modelo de Mensagem"}
              </DialogTitle>
              <DialogDescription>
                Personalize seu modelo usando variáveis e spintax ({`{Olá|Oi}`}) para humanizar seus disparos.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tpl-name" className="text-xs font-semibold">
                    Nome do Modelo
                  </Label>
                  <Input
                    id="tpl-name"
                    placeholder="Ex: Apresentação de Imóvel no Gonzaga"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tpl-cat" className="text-xs font-semibold">
                    Etapa / Categoria do Funil
                  </Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger id="tpl-cat">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.filter((c) => c !== "Todos").map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Variable Injector */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Inserir Variáveis do Imóvel / Lead</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    Clique na tag para adicionar ao texto
                  </span>
                </Label>
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg border border-border/60 bg-muted/20">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => handleInsertVariable(v.token)}
                      className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors"
                      title={`Inserir ${v.token}`}
                    >
                      {v.label} <span className="opacity-70 text-[9px]">{v.token}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleInsertVariable("{Olá|Oi|Tudo bem}")}
                    className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-colors"
                    title="Inserir Spintax alternativo"
                  >
                    🎲 Spintax <span className="opacity-70 text-[9px]">{`{Olá|Oi}`}</span>
                  </button>
                </div>
              </div>

              {/* Content Textarea */}
              <div className="space-y-2">
                <Label htmlFor="tpl-content" className="text-xs font-semibold">
                  Conteúdo da Mensagem
                </Label>
                <Textarea
                  id="tpl-content"
                  rows={6}
                  placeholder="Escreva sua mensagem aqui. Use quebras de linha normais para parágrafos..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>

              {/* WhatsApp Live Bubble Preview */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                  Pré-visualização da Conversa
                </Label>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex justify-start">
                  <div className="bg-[#005c4b] text-white rounded-lg rounded-tl-none p-3 max-w-[85%] shadow-md space-y-1">
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{previewText}</p>
                    <div className="text-[9px] text-emerald-200/60 text-right flex items-center justify-end gap-1">
                      <span>12:00</span>
                      <CheckCircle2 className="h-2.5 w-2.5 text-cyan-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? "Salvando..." : editingTemplate ? "Atualizar Modelo" : "Criar Modelo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SessionGuard>
  );
}
