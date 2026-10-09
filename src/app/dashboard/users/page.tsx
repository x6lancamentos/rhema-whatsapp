"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Trash2,
  Plus,
  Edit,
  User,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Send,
  Building2,
  FileText,
  KeyRound,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Headphones,
  Briefcase,
  TrendingUp,
  MessageSquare,
  Users as UsersIcon,
  RotateCcw,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

interface SessionInfo {
  id: string;
  sessionId: string;
  name: string;
  status: string;
  updatedAt: string;
}

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  role: "SUPERADMIN" | "ADMIN" | "PRE_VENDAS" | "CORRETOR" | "OWNER" | "STAFF";
  imoviewCorretorCodigo: string | null;
  imoviewCorretorNome: string | null;
  isActive: boolean;
  permissionsOverrides?: Record<string, boolean> | null;
  createdAt: string;
  sessions?: SessionInfo[];
  _count?: {
    sessions: number;
  };
}

interface ImoviewBroker {
  id: string;
  nome: string;
}

interface PermissionDef {
  key: string;
  label: string;
  description: string;
  category: "whatsapp" | "broadcast" | "imoview" | "templates" | "management";
}

interface TeamProductivityItem {
  id: string;
  name: string;
  email: string;
  role: string;
  imoviewCorretorNome: string | null;
  imoviewCorretorCodigo: string | null;
  isActive: boolean;
  sessionsCount: number;
  hasConnectedSession: boolean;
  sessions: SessionInfo[];
  totalCampaigns: number;
  totalSent: number;
  totalResponded: number;
  totalFailed: number;
  responseRate: number;
  totalChatMessages: number;
  totalContacts: number;
  lastActivity: string | null;
}

export default function UsersManagementPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"users" | "roles" | "productivity">("users");

  // Users State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // Form State (New / Edit)
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "CORRETOR",
    imoviewCorretorCodigo: "",
    imoviewCorretorNome: "",
    isActive: true,
  });

  // Brokers from Imoview
  const [imoviewBrokers, setImoviewBrokers] = useState<ImoviewBroker[]>([]);

  // Permissions Metadata State
  const [permissionDefs, setPermissionDefs] = useState<PermissionDef[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [selectedRoleForEdit, setSelectedRoleForEdit] = useState<string>("CORRETOR");
  const [activeRolePermsDraft, setActiveRolePermsDraft] = useState<Record<string, boolean>>({});
  const [savingRolePerms, setSavingRolePerms] = useState(false);

  // User Granular Overrides Modal State
  const [userForOverrides, setUserForOverrides] = useState<UserProfile | null>(null);
  const [userOverridesDraft, setUserOverridesDraft] = useState<Record<string, boolean>>({});
  const [userEffectivePerms, setUserEffectivePerms] = useState<Record<string, boolean>>({});
  const [savingUserOverrides, setSavingUserOverrides] = useState(false);

  // Productivity State
  const [productivityData, setProductivityData] = useState<{
    summary: {
      totalMembers: number;
      activeMembers: number;
      connectedChips: number;
      totalMessagesSent: number;
      totalResponses: number;
    };
    team: TeamProductivityItem[];
  } | null>(null);
  const [productivityLoading, setProductivityLoading] = useState(false);

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 1. Fetch Users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setUsers(list);
        setFilteredUsers(list);
      } else if (res.status === 403) {
        toast.error("Sem autorização para visualizar usuários.");
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Imoview Brokers
  const fetchBrokers = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/imoview/corretores");
      if (res.ok) {
        const json = await res.json();
        setImoviewBrokers(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch brokers", e);
    }
  }, []);

  // 3. Fetch Permissions metadata & Role configs
  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch("/api/permissions");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setPermissionDefs(json.data.definitions || []);
          setRolePermissions(json.data.roles || {});
          if (json.data.roles?.[selectedRoleForEdit]) {
            setActiveRolePermsDraft({ ...json.data.roles[selectedRoleForEdit] });
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch permissions", e);
    }
  }, [selectedRoleForEdit]);

  // 4. Fetch Productivity Report
  const fetchProductivity = useCallback(async () => {
    try {
      setProductivityLoading(true);
      const res = await fetch("/api/reports/team-productivity");
      if (res.ok) {
        const json = await res.json();
        setProductivityData(json.data || null);
      }
    } catch (e) {
      console.error("Failed to fetch productivity", e);
    } finally {
      setProductivityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchBrokers();
    fetchPermissions();
  }, [fetchUsers, fetchBrokers, fetchPermissions]);

  useEffect(() => {
    if (activeTab === "productivity") {
      fetchProductivity();
    }
  }, [activeTab, fetchProductivity]);

  // Update draft when selected role changes
  useEffect(() => {
    if (rolePermissions[selectedRoleForEdit]) {
      setActiveRolePermsDraft({ ...rolePermissions[selectedRoleForEdit] });
    }
  }, [selectedRoleForEdit, rolePermissions]);

  // Filter users by search term and role
  useEffect(() => {
    let result = users;
    if (roleFilter !== "ALL") {
      result = result.filter((u) => u.role === roleFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.imoviewCorretorNome?.toLowerCase().includes(q)
      );
    }
    setFilteredUsers(result);
  }, [searchTerm, roleFilter, users]);

  // Open Form for New User
  const handleOpenNewUser = () => {
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "CORRETOR",
      imoviewCorretorCodigo: "",
      imoviewCorretorNome: "",
      isActive: true,
    });
    setShowFormModal(true);
  };

  // Open Form for Edit User
  const handleOpenEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      name: user.name || "",
      email: user.email,
      password: "",
      role: user.role,
      imoviewCorretorCodigo: user.imoviewCorretorCodigo || "",
      imoviewCorretorNome: user.imoviewCorretorNome || "",
      isActive: user.isActive,
    });
    setShowFormModal(true);
  };

  // Save User (Create or Update)
  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PATCH" : "POST";

      const payload: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        imoviewCorretorCodigo: formData.imoviewCorretorCodigo || null,
        imoviewCorretorNome: formData.imoviewCorretorNome || null,
        isActive: formData.isActive,
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingUser ? "Usuário atualizado com sucesso!" : "Usuário cadastrado com sucesso!");
        setShowFormModal(false);
        fetchUsers();
      } else {
        const err = await res.json();
        toast.error(err.message || err.error || "Erro ao salvar usuário.");
      }
    } catch (e) {
      toast.error("Falha ao comunicar com o servidor.");
    }
  };

  // Delete User
  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Usuário excluído com sucesso.");
        fetchUsers();
      } else {
        const err = await res.json();
        toast.error(err.error || "Erro ao excluir usuário.");
      }
    } catch {
      toast.error("Erro ao excluir usuário.");
    } finally {
      setDeleteId(null);
    }
  };

  // Open User Overrides Modal
  const handleOpenOverrides = async (user: UserProfile) => {
    setUserForOverrides(user);
    const overrides = (user.permissionsOverrides as Record<string, boolean>) || {};
    setUserOverridesDraft({ ...overrides });

    // Fetch effective permissions
    try {
      const res = await fetch(`/api/users/${user.id}/permissions`);
      if (res.ok) {
        const json = await res.json();
        setUserEffectivePerms(json.data?.permissions || {});
      }
    } catch {
      // ignore
    }
  };

  // Save User Overrides
  const handleSaveUserOverrides = async () => {
    if (!userForOverrides) return;
    setSavingUserOverrides(true);
    try {
      const res = await fetch(`/api/users/${userForOverrides.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: userOverridesDraft }),
      });

      if (res.ok) {
        toast.success(`Permissões personalizadas de ${userForOverrides.name} salvas!`);
        setUserForOverrides(null);
        fetchUsers();
      } else {
        const err = await res.json();
        toast.error(err.message || "Erro ao salvar permissões.");
      }
    } catch {
      toast.error("Erro ao salvar permissões.");
    } finally {
      setSavingUserOverrides(false);
    }
  };

  // Save Role Permissions
  const handleSaveRolePermissions = async () => {
    setSavingRolePerms(true);
    try {
      const res = await fetch("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRoleForEdit,
          permissions: activeRolePermsDraft,
        }),
      });

      if (res.ok) {
        toast.success(`Permissões padrão do perfil ${selectedRoleForEdit} atualizadas!`);
        fetchPermissions();
      } else {
        const err = await res.json();
        toast.error(err.message || "Erro ao salvar permissões do perfil.");
      }
    } catch {
      toast.error("Falha ao salvar permissões do perfil.");
    } finally {
      setSavingRolePerms(false);
    }
  };

  // Role Badge Helper
  const renderRoleBadge = (role: string) => {
    switch (role) {
      case "SUPERADMIN":
        return (
          <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 gap-1 font-semibold">
            <ShieldAlert className="h-3 w-3" /> Super Admin
          </Badge>
        );
      case "ADMIN":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 gap-1 font-semibold">
            <ShieldCheck className="h-3 w-3" /> Gestor / Admin
          </Badge>
        );
      case "PRE_VENDAS":
        return (
          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 gap-1 font-semibold">
            <Headphones className="h-3 w-3" /> Pré-Vendas (Camila)
          </Badge>
        );
      case "CORRETOR":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 gap-1 font-semibold">
            <Briefcase className="h-3 w-3" /> Corretor
          </Badge>
        );
      case "OWNER":
        return (
          <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 gap-1 font-semibold">
            <ShieldCheck className="h-3 w-3" /> Proprietário
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <User className="h-3 w-3" /> {role}
          </Badge>
        );
    }
  };

  // Group definitions by category
  const defsByCategory = {
    whatsapp: permissionDefs.filter((p) => p.category === "whatsapp"),
    broadcast: permissionDefs.filter((p) => p.category === "broadcast"),
    imoview: permissionDefs.filter((p) => p.category === "imoview"),
    templates: permissionDefs.filter((p) => p.category === "templates"),
    management: permissionDefs.filter((p) => p.category === "management"),
  };

  const categoryTitles = {
    whatsapp: { title: "WhatsApp & Chips", icon: Smartphone, color: "text-emerald-500" },
    broadcast: { title: "Campanhas & Disparos em Massa", icon: Send, color: "text-blue-500" },
    imoview: { title: "Imoview CRM & Carteiras de Clientes", icon: Building2, color: "text-amber-500" },
    templates: { title: "Modelos & Automações", icon: FileText, color: "text-violet-500" },
    management: { title: "Gestão, Permissões & Auditoria", icon: Shield, color: "text-rose-500" },
  };

  // Counts for Top Statistics
  const totalUsersCount = users.length;
  const corretoresCount = users.filter((u) => u.role === "CORRETOR").length;
  const connectedChipsCount = users.filter((u) => u.sessions?.some((s) => s.status === "CONNECTED")).length;
  const preVendasCount = users.filter((u) => u.role === "PRE_VENDAS").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <UsersIcon className="h-6 w-6" />
            </div>
            Gestão de Equipe & Permissões
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Isolamento multi-corretor, perfis de atendimento (Camila Pré-vendas), pareamento de chips e proteção de carteiras.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleOpenNewUser} className="shadow-sm gap-2">
            <Plus className="h-4 w-4" /> Novo Membro
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md bg-muted/60 p-1 border">
          <TabsTrigger value="users" className="gap-2 text-xs md:text-sm">
            <UsersIcon className="h-4 w-4" /> Usuários
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2 text-xs md:text-sm">
            <Shield className="h-4 w-4" /> Perfis & Toggles
          </TabsTrigger>
          <TabsTrigger value="productivity" className="gap-2 text-xs md:text-sm">
            <TrendingUp className="h-4 w-4" /> Produtividade
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB 1: USERS LIST & MANAGEMENT                               */}
        {/* ============================================================ */}
        <TabsContent value="users" className="space-y-6">
          {/* Metrics summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border shadow-xs bg-card/60 backdrop-blur-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total de Membros</p>
                  <p className="text-2xl font-bold mt-1">{totalUsersCount}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <User className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-xs bg-card/60 backdrop-blur-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Corretores</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-600">{corretoresCount}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Briefcase className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-xs bg-card/60 backdrop-blur-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Chips Conectados</p>
                  <p className="text-2xl font-bold mt-1 text-teal-600">{connectedChipsCount}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-600">
                  <Smartphone className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-xs bg-card/60 backdrop-blur-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pré-Vendas / Recepção</p>
                  <p className="text-2xl font-bold mt-1 text-purple-600">{preVendasCount}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600">
                  <Headphones className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters Bar */}
          <Card className="border shadow-xs">
            <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, e-mail ou corretor..."
                  className="pl-9 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium whitespace-nowrap">
                  <Filter className="h-3.5 w-3.5" /> Filtrar Perfil:
                </div>
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v)}>
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos os Cargos</SelectItem>
                    <SelectItem value="CORRETOR">Corretores</SelectItem>
                    <SelectItem value="PRE_VENDAS">Pré-Vendas (Camila)</SelectItem>
                    <SelectItem value="ADMIN">Gestores / Admin</SelectItem>
                    <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Users Grid */}
          {loading ? (
            <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-2">
              <RotateCcw className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm">Carregando membros da equipe...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <Card className="border-dashed p-12 text-center text-muted-foreground">
              <UsersIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-semibold text-base">Nenhum usuário encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou adicione um novo membro.</p>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.map((u) => {
                const connectedSession = u.sessions?.find((s) => s.status === "CONNECTED");
                const hasOverrides = u.permissionsOverrides && Object.keys(u.permissionsOverrides).length > 0;

                return (
                  <Card key={u.id} className="border shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between overflow-hidden">
                    <div>
                      {/* Top bar of card */}
                      <div className="p-5 border-b border-border/40 bg-muted/20">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-lg shadow-xs">
                              {u.name?.charAt(0).toUpperCase() || u.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-semibold text-base leading-tight">{u.name || "Sem Nome"}</h3>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">{u.email}</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {renderRoleBadge(u.role)}
                            {hasOverrides && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-600 bg-amber-500/5">
                                Overrides
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Content details */}
                      <div className="p-5 space-y-3 text-xs">
                        {/* Imoview Binding */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-amber-500" /> Corretor Imoview:
                          </span>
                          {u.imoviewCorretorNome ? (
                            <span className="font-semibold text-foreground truncate max-w-[150px]">
                              {u.imoviewCorretorNome}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic">Não vinculado</span>
                          )}
                        </div>

                        {/* WhatsApp Chip Status */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Smartphone className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp Chip:
                          </span>
                          {connectedSession ? (
                            <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                              {connectedSession.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic">Nenhum chip conectado</span>
                          )}
                        </div>

                        {/* Account active status */}
                        <div className="flex items-center justify-between px-1">
                          <span className="text-muted-foreground">Status da Conta:</span>
                          {u.isActive ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-rose-500 font-medium text-[11px]">
                              <XCircle className="h-3.5 w-3.5" /> Inativo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-3 bg-muted/20 border-t border-border/50 flex justify-between items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 gap-1.5 font-medium"
                        onClick={() => handleOpenOverrides(u)}
                      >
                        <KeyRound className="h-3.5 w-3.5 text-primary" /> Permissões
                      </Button>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs gap-1"
                          onClick={() => handleOpenEditUser(u)}
                        >
                          <Edit className="h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                          onClick={() => setDeleteId(u.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: ROLES MATRIX & TOGGLES                                */}
        {/* ============================================================ */}
        <TabsContent value="roles" className="space-y-6">
          <Card className="border shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" /> Matriz de Permissões por Perfil
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm mt-1">
                    Defina as permissões padrão para cada cargo da imobiliária. Ao alterar uma regra, todos os usuários do cargo herdarão imediatamente.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    Perfil Selecionado:
                  </div>
                  <Select
                    value={selectedRoleForEdit}
                    onValueChange={(v) => setSelectedRoleForEdit(v)}
                  >
                    <SelectTrigger className="w-52 h-9 font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CORRETOR">Corretor (Padrão)</SelectItem>
                      <SelectItem value="PRE_VENDAS">Pré-Vendas (Camila)</SelectItem>
                      <SelectItem value="ADMIN">Gestor / Admin</SelectItem>
                      <SelectItem value="STAFF">Staff / Suporte</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={handleSaveRolePermissions}
                    disabled={savingRolePerms}
                    className="gap-2 h-9 text-xs shadow-xs"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {savingRolePerms ? "Salvando..." : "Salvar Perfil"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Role Profile Info Banner */}
            <div className="px-6 pb-4">
              {selectedRoleForEdit === "CORRETOR" && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                  <Lock className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Diretriz de Segurança do Corretor:</span> Este perfil possui <strong>isolamento estrito</strong> da carteira. O corretor enxerga apenas seus próprios leads e imóveis, dispara campanhas apenas pelo seu próprio chip e não tem permissão para exportar planilhas Excel (anti-vazamento DLP).
                  </div>
                </div>
              )}
              {selectedRoleForEdit === "PRE_VENDAS" && (
                <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-800 dark:text-purple-300 text-xs flex items-start gap-2.5">
                  <Headphones className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Diretriz de Pré-Vendas / Recepção (Camila):</span> Este perfil tem acesso à visualização geral dos leads do Imoview para triagem, qualificação inicial e direcionamento para os corretores. A exportação de planilhas permanece bloqueada por segurança.
                  </div>
                </div>
              )}
              {selectedRoleForEdit === "ADMIN" && (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Perfil Administrativo / Gestão:</span> Acesso a monitoramento geral, relatórios de produtividade, gerenciamento de equipe e configuração de réguas de automação.
                  </div>
                </div>
              )}
            </div>

            <CardContent className="space-y-6 pt-2">
              {Object.entries(defsByCategory).map(([catKey, defs]) => {
                const info = categoryTitles[catKey as keyof typeof categoryTitles];
                if (!info || defs.length === 0) return null;
                const IconComponent = info.icon;

                return (
                  <div key={catKey} className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                      <IconComponent className={`h-4 w-4 ${info.color}`} />
                      <h3 className="text-sm font-bold tracking-tight text-foreground">{info.title}</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {defs.map((def) => {
                        const isChecked = activeRolePermsDraft[def.key] ?? false;

                        return (
                          <div
                            key={def.key}
                            className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-4 ${
                              isChecked
                                ? "bg-card border-primary/30 shadow-xs"
                                : "bg-muted/20 border-border/60 opacity-80"
                            }`}
                          >
                            <div className="space-y-1 pr-2">
                              <Label
                                htmlFor={`role-toggle-${def.key}`}
                                className="text-xs font-semibold cursor-pointer text-foreground block"
                              >
                                {def.label}
                              </Label>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {def.description}
                              </p>
                            </div>

                            <Switch
                              id={`role-toggle-${def.key}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                setActiveRolePermsDraft((prev) => ({
                                  ...prev,
                                  [def.key]: checked,
                                }));
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3: TEAM PRODUCTIVITY REPORT                              */}
        {/* ============================================================ */}
        <TabsContent value="productivity" className="space-y-6">
          {productivityLoading ? (
            <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-2">
              <RotateCcw className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm">Consolidando relatórios de produtividade...</p>
            </div>
          ) : productivityData ? (
            <div className="space-y-6">
              {/* Executive KPI summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="border shadow-xs bg-card/60">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground">Chips Conectados</p>
                    <p className="text-2xl font-bold mt-1 text-emerald-600">
                      {productivityData.summary.connectedChips} / {productivityData.summary.totalMembers}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border shadow-xs bg-card/60">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground">Disparos Realizados</p>
                    <p className="text-2xl font-bold mt-1 text-blue-600">
                      {productivityData.summary.totalMessagesSent.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border shadow-xs bg-card/60">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground">Leads que Responderam</p>
                    <p className="text-2xl font-bold mt-1 text-teal-600">
                      {productivityData.summary.totalResponses.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border shadow-xs bg-card/60">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground">Taxa Global de Conversão</p>
                    <p className="text-2xl font-bold mt-1 text-purple-600">
                      {productivityData.summary.totalMessagesSent > 0
                        ? `${(
                            (productivityData.summary.totalResponses /
                              productivityData.summary.totalMessagesSent) *
                            100
                          ).toFixed(1)}%`
                        : "0%"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Productivity Table */}
              <Card className="border shadow-xs">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" /> Desempenho Individual dos Corretores & Equipe
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Métricas de engajamento, status do WhatsApp e volume de contatos por corretor.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold">
                        <th className="p-3 pl-6">Corretor / Membro</th>
                        <th className="p-3">Cargo</th>
                        <th className="p-3">WhatsApp Conectado</th>
                        <th className="p-3 text-center">Campanhas</th>
                        <th className="p-3 text-center">Enviadas</th>
                        <th className="p-3 text-center">Respostas</th>
                        <th className="p-3 text-center">Taxa de Resposta</th>
                        <th className="p-3 pr-6 text-right">Último Disparo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {productivityData.team.map((m) => (
                        <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 pl-6">
                            <div className="font-semibold text-foreground text-sm">{m.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {m.imoviewCorretorNome ? `CRM: ${m.imoviewCorretorNome}` : m.email}
                            </div>
                          </td>
                          <td className="p-3">{renderRoleBadge(m.role)}</td>
                          <td className="p-3">
                            {m.hasConnectedSession ? (
                              <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>{m.sessions.find((s) => s.status === "CONNECTED")?.name || "Online"}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/60 italic">Desconectado</span>
                            )}
                          </td>
                          <td className="p-3 text-center font-bold text-foreground">
                            {m.totalCampaigns}
                          </td>
                          <td className="p-3 text-center font-semibold text-blue-600 dark:text-blue-400">
                            {m.totalSent.toLocaleString()}
                          </td>
                          <td className="p-3 text-center font-semibold text-teal-600 dark:text-teal-400">
                            {m.totalResponded.toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-bold text-xs">{m.responseRate}%</span>
                              <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-primary h-full rounded-full"
                                  style={{ width: `${Math.min(100, m.responseRate * 2)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3 pr-6 text-right text-muted-foreground">
                            {m.lastActivity
                              ? new Date(m.lastActivity).toLocaleDateString("pt-BR")
                              : "Sem envios"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum dado disponível.</p>
          )}
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* MODAL: CREATE / EDIT USER                                    */}
      {/* ============================================================ */}
      <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {editingUser ? "Editar Membro da Equipe" : "Cadastrar Novo Membro"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe os dados do colaborador, seu cargo no sistema e o vínculo de corretor no Imoview.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitUser} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nome Completo</Label>
                <Input
                  required
                  placeholder="Ex: João da Silva"
                  className="h-9 text-xs"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">E-mail de Acesso</Label>
                <Input
                  required
                  type="email"
                  placeholder="joao@rhemabr.com.br"
                  className="h-9 text-xs"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {editingUser ? "Nova Senha (opcional)" : "Senha de Acesso"}
                </Label>
                <Input
                  type="password"
                  placeholder={editingUser ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                  required={!editingUser}
                  className="h-9 text-xs"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Perfil / Cargo</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) => setFormData({ ...formData, role: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CORRETOR">Corretor (Carteira Restrita)</SelectItem>
                    <SelectItem value="PRE_VENDAS">Pré-Vendas / Recepção (Camila)</SelectItem>
                    <SelectItem value="ADMIN">Gestor / Administrador</SelectItem>
                    <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
                    <SelectItem value="STAFF">Staff / Suporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Imoview Broker Association */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Building2 className="h-4 w-4 text-amber-500" /> Vínculo com Corretor do Imoview CRM
              </Label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Fundamental para que o corretor visualize apenas seus próprios leads parados e imóveis captados.
              </p>
              <Select
                value={formData.imoviewCorretorCodigo || "NONE"}
                onValueChange={(val) => {
                  if (val === "NONE") {
                    setFormData({
                      ...formData,
                      imoviewCorretorCodigo: "",
                      imoviewCorretorNome: "",
                    });
                  } else {
                    const selected = imoviewBrokers.find((b) => b.id === val);
                    setFormData({
                      ...formData,
                      imoviewCorretorCodigo: val,
                      imoviewCorretorNome: selected?.nome || val,
                    });
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-card">
                  <SelectValue placeholder="Selecione o corretor correspondente no Imoview" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sem vínculo com Imoview</SelectItem>
                  {imoviewBrokers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome} (Cód: #{b.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Conta Ativa</Label>
                <p className="text-[11px] text-muted-foreground">
                  Se desativado, o colaborador não conseguirá fazer login no sistema.
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowFormModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {editingUser ? "Atualizar Membro" : "Salvar Membro"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL: GRANULAR PERMISSION OVERRIDES PER USER                */}
      {/* ============================================================ */}
      <Dialog open={!!userForOverrides} onOpenChange={(open) => !open && setUserForOverrides(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Permissões Granulares: {userForOverrides?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cargo atual: <strong className="text-foreground">{userForOverrides?.role}</strong>. Você pode ativar ou desativar permissões pontuais para este usuário sem alterar os demais membros do cargo.
            </DialogDescription>
          </DialogHeader>

          {userForOverrides && (
            <div className="space-y-6 pt-2">
              {Object.entries(defsByCategory).map(([catKey, defs]) => {
                const info = categoryTitles[catKey as keyof typeof categoryTitles];
                if (!info || defs.length === 0) return null;
                const IconComponent = info.icon;

                return (
                  <div key={catKey} className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-border/40 pb-1.5">
                      <IconComponent className={`h-4 w-4 ${info.color}`} />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {info.title}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {defs.map((def) => {
                        const hasCustomOverride = userOverridesDraft[def.key] !== undefined;
                        const effectiveValue = hasCustomOverride
                          ? userOverridesDraft[def.key]
                          : userEffectivePerms[def.key] ?? false;

                        return (
                          <div
                            key={def.key}
                            className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                              effectiveValue
                                ? "bg-card border-primary/30"
                                : "bg-muted/10 border-border/60 opacity-75"
                            }`}
                          >
                            <div className="space-y-1 pr-2">
                              <div className="flex items-center gap-1.5">
                                <Label className="text-xs font-semibold cursor-pointer">
                                  {def.label}
                                </Label>
                                {hasCustomOverride ? (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-amber-500/50 text-amber-600 bg-amber-500/10">
                                    Personalizado
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 text-muted-foreground border-border">
                                    Perfil
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-tight">
                                {def.description}
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <Switch
                                checked={effectiveValue}
                                onCheckedChange={(checked) => {
                                  setUserOverridesDraft((prev) => ({
                                    ...prev,
                                    [def.key]: checked,
                                  }));
                                }}
                              />
                              {hasCustomOverride && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = { ...userOverridesDraft };
                                    delete next[def.key];
                                    setUserOverridesDraft(next);
                                  }}
                                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 underline"
                                >
                                  <RotateCcw className="h-2.5 w-2.5" /> resetar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUserForOverrides(null)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveUserOverrides}
              disabled={savingUserOverrides}
              size="sm"
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {savingUserOverrides ? "Salvando..." : "Salvar Permissões Individuais"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* CONFIRM DELETE DIALOG                                        */}
      {/* ============================================================ */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja remover este membro?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Esta ação excluirá o usuário da plataforma e removerá seus acessos ao sistema. As sessões ativas do WhatsApp e o histórico de mensagens serão mantidos no banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700 text-white">
              Sim, Excluir Membro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
