import { prisma } from "./prisma";
import { Role } from "@prisma/client";

export type PermissionCategory = 
  | "whatsapp" 
  | "broadcast" 
  | "imoview" 
  | "templates" 
  | "management";

export type PermissionKey =
  // WhatsApp
  | "whatsapp.view_sessions"
  | "whatsapp.connect_session"
  | "whatsapp.disconnect_session"
  | "whatsapp.view_all_sessions"
  | "whatsapp.chat_live"
  // Broadcast
  | "broadcast.send_campaign"
  | "broadcast.view_history"
  | "broadcast.pause_resume"
  | "broadcast.use_round_robin"
  // Imoview CRM
  | "imoview.view_leads"
  | "imoview.view_all_brokers"
  | "imoview.view_owners"
  | "imoview.export_sheets"
  // Templates & Lists
  | "templates.view"
  | "templates.manage"
  | "contact_lists.manage"
  // Management & Audit
  | "users.view"
  | "users.manage"
  | "users.manage_permissions"
  | "reports.view_team_productivity";

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  category: PermissionCategory;
}

export const PERMISSION_CATEGORIES: Record<PermissionCategory, { label: string; icon: string }> = {
  whatsapp: { label: "WhatsApp & Chips", icon: "Smartphone" },
  broadcast: { label: "Campanhas & Disparos", icon: "Send" },
  imoview: { label: "Imoview & Carteiras de Clientes", icon: "Building2" },
  templates: { label: "Modelos & Automações", icon: "FileText" },
  management: { label: "Gestão, Equipe & Auditoria", icon: "Shield" },
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // WhatsApp
  {
    key: "whatsapp.view_sessions",
    label: "Visualizar Meu WhatsApp",
    description: "Permite visualizar a conexão e status do próprio chip do WhatsApp.",
    category: "whatsapp",
  },
  {
    key: "whatsapp.connect_session",
    label: "Conectar / Reconectar WhatsApp",
    description: "Permite ler QR Code para parear o WhatsApp no sistema.",
    category: "whatsapp",
  },
  {
    key: "whatsapp.disconnect_session",
    label: "Desconectar WhatsApp",
    description: "Permite deslogar o chip do WhatsApp.",
    category: "whatsapp",
  },
  {
    key: "whatsapp.view_all_sessions",
    label: "Monitorar Todos os Chips (Admin)",
    description: "Permite ver quais corretores têm chips ativos no sistema (sem espionar conversas privadas).",
    category: "whatsapp",
  },
  {
    key: "whatsapp.chat_live",
    label: "Central de Chat & Atendimento",
    description: "Acessar a tela de conversas ativas e responder leads em tempo real.",
    category: "whatsapp",
  },

  // Broadcast
  {
    key: "broadcast.send_campaign",
    label: "Disparar Campanhas de Mensagens",
    description: "Criar e iniciar campanhas de reativação e disparos em massa.",
    category: "broadcast",
  },
  {
    key: "broadcast.view_history",
    label: "Histórico de Disparos",
    description: "Acessar histórico de envios e relatórios de entrega de mensagens.",
    category: "broadcast",
  },
  {
    key: "broadcast.pause_resume",
    label: "Pausar e Retomar Campanhas",
    description: "Controle de pausa e retomada de campanhas em andamento.",
    category: "broadcast",
  },
  {
    key: "broadcast.use_round_robin",
    label: "Disparo Multi-Chip (Round-Robin)",
    description: "Distribuir mensagens automaticamente entre múltiplos chips conectados.",
    category: "broadcast",
  },

  // Imoview CRM
  {
    key: "imoview.view_leads",
    label: "Acessar Leads Parados Imoview",
    description: "Buscar e visualizar leads sem atendimento ou parados no funil do CRM.",
    category: "imoview",
  },
  {
    key: "imoview.view_all_brokers",
    label: "Ver Leads de Outros Corretores (Geral)",
    description: "Se DESMARCADO, o corretor só enxerga estritamente os leads da SUA própria carteira.",
    category: "imoview",
  },
  {
    key: "imoview.view_owners",
    label: "Acessar Proprietários de Imóveis",
    description: "Buscar proprietários de imóveis cadastrados para envio de atualizações e feedback.",
    category: "imoview",
  },
  {
    key: "imoview.export_sheets",
    label: "Exportar Planilhas (DLP Anti-Vazamento)",
    description: "Permite baixar planilhas Excel dos clientes e leads. Mantenha desativado para evitar vazamentos.",
    category: "imoview",
  },

  // Templates & Lists
  {
    key: "templates.view",
    label: "Visualizar Modelos de Mensagens",
    description: "Consultar os modelos e scripts pré-aprovados pela imobiliária.",
    category: "templates",
  },
  {
    key: "templates.manage",
    label: "Criar e Editar Modelos",
    description: "Adicionar novos modelos de mensagens e variáveis inteligentes.",
    category: "templates",
  },
  {
    key: "contact_lists.manage",
    label: "Gerenciar Listas de Contatos",
    description: "Criar, importar e segmentar listas de contatos no sistema.",
    category: "templates",
  },

  // Management & Audit
  {
    key: "users.view",
    label: "Visualizar Membros da Equipe",
    description: "Ver a lista de corretores e usuários cadastrados.",
    category: "management",
  },
  {
    key: "users.manage",
    label: "Cadastrar e Editar Usuários",
    description: "Adicionar novos corretores e alterar seus dados.",
    category: "management",
  },
  {
    key: "users.manage_permissions",
    label: "Configurar Permissões e Níveis",
    description: "Ajustar toggles de permissões por perfil e overrides individuais.",
    category: "management",
  },
  {
    key: "reports.view_team_productivity",
    label: "Relatório de Produtividade da Equipe",
    description: "Acompanhar métricas de envio, conversão e atividade de cada corretor.",
    category: "management",
  },
];

// Default configurations per role
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Record<PermissionKey, boolean>> = {
  SUPERADMIN: {
    "whatsapp.view_sessions": true,
    "whatsapp.connect_session": true,
    "whatsapp.disconnect_session": true,
    "whatsapp.view_all_sessions": true,
    "whatsapp.chat_live": true,
    "broadcast.send_campaign": true,
    "broadcast.view_history": true,
    "broadcast.pause_resume": true,
    "broadcast.use_round_robin": true,
    "imoview.view_leads": true,
    "imoview.view_all_brokers": true,
    "imoview.view_owners": true,
    "imoview.export_sheets": true,
    "templates.view": true,
    "templates.manage": true,
    "contact_lists.manage": true,
    "users.view": true,
    "users.manage": true,
    "users.manage_permissions": true,
    "reports.view_team_productivity": true,
  },
  ADMIN: {
    "whatsapp.view_sessions": true,
    "whatsapp.connect_session": true,
    "whatsapp.disconnect_session": true,
    "whatsapp.view_all_sessions": true,
    "whatsapp.chat_live": true,
    "broadcast.send_campaign": true,
    "broadcast.view_history": true,
    "broadcast.pause_resume": true,
    "broadcast.use_round_robin": true,
    "imoview.view_leads": true,
    "imoview.view_all_brokers": true,
    "imoview.view_owners": true,
    "imoview.export_sheets": true,
    "templates.view": true,
    "templates.manage": true,
    "contact_lists.manage": true,
    "users.view": true,
    "users.manage": true,
    "users.manage_permissions": true,
    "reports.view_team_productivity": true,
  },
  OWNER: {
    "whatsapp.view_sessions": true,
    "whatsapp.connect_session": true,
    "whatsapp.disconnect_session": true,
    "whatsapp.view_all_sessions": true,
    "whatsapp.chat_live": true,
    "broadcast.send_campaign": true,
    "broadcast.view_history": true,
    "broadcast.pause_resume": true,
    "broadcast.use_round_robin": true,
    "imoview.view_leads": true,
    "imoview.view_all_brokers": true,
    "imoview.view_owners": true,
    "imoview.export_sheets": true,
    "templates.view": true,
    "templates.manage": true,
    "contact_lists.manage": true,
    "users.view": true,
    "users.manage": true,
    "users.manage_permissions": true,
    "reports.view_team_productivity": true,
  },
  PRE_VENDAS: {
    // Camila (Pré-Vendas / Recepção):
    // Qualifica, faz primeira abordagem, vê leads gerais, tria e distribui
    "whatsapp.view_sessions": true,
    "whatsapp.connect_session": true,
    "whatsapp.disconnect_session": true,
    "whatsapp.view_all_sessions": false,
    "whatsapp.chat_live": true,
    "broadcast.send_campaign": true,
    "broadcast.view_history": true,
    "broadcast.pause_resume": true,
    "broadcast.use_round_robin": false,
    "imoview.view_leads": true,
    "imoview.view_all_brokers": true, // Camila precisa ver leads de toda a imobiliária para triar!
    "imoview.view_owners": false,      // Foco de pré-vendas são clientes/leads compradores
    "imoview.export_sheets": false,    // Anti-vazamento desativado por padrão
    "templates.view": true,
    "templates.manage": false,
    "contact_lists.manage": true,
    "users.view": false,
    "users.manage": false,
    "users.manage_permissions": false,
    "reports.view_team_productivity": false,
  },
  CORRETOR: {
    // Corretor:
    // Focado estritamente na sua própria carteira, seu chip, sem vazamento
    "whatsapp.view_sessions": true,
    "whatsapp.connect_session": true,
    "whatsapp.disconnect_session": true,
    "whatsapp.view_all_sessions": false, // Não enxerga chips de outros corretores
    "whatsapp.chat_live": true,
    "broadcast.send_campaign": true,
    "broadcast.view_history": true,
    "broadcast.pause_resume": true,
    "broadcast.use_round_robin": false, // Usa seu próprio chip
    "imoview.view_leads": true,
    "imoview.view_all_brokers": false, // ISOLAMENTO: estritamente os seus próprios leads
    "imoview.view_owners": true,       // Pode consultar proprietários dos imóveis sob sua captação
    "imoview.export_sheets": false,    // DLP: não pode baixar base de clientes
    "templates.view": true,
    "templates.manage": false,
    "contact_lists.manage": false,
    "users.view": false,
    "users.manage": false,
    "users.manage_permissions": false,
    "reports.view_team_productivity": false,
  },
  STAFF: {
    "whatsapp.view_sessions": true,
    "whatsapp.connect_session": true,
    "whatsapp.disconnect_session": true,
    "whatsapp.view_all_sessions": false,
    "whatsapp.chat_live": true,
    "broadcast.send_campaign": false,
    "broadcast.view_history": true,
    "broadcast.pause_resume": false,
    "broadcast.use_round_robin": false,
    "imoview.view_leads": true,
    "imoview.view_all_brokers": false,
    "imoview.view_owners": false,
    "imoview.export_sheets": false,
    "templates.view": true,
    "templates.manage": false,
    "contact_lists.manage": false,
    "users.view": false,
    "users.manage": false,
    "users.manage_permissions": false,
    "reports.view_team_productivity": false,
  },
};

/**
 * Get effective permissions for a role, combining default fallback with any DB config
 */
export async function getRolePermissions(role: Role): Promise<Record<PermissionKey, boolean>> {
  const defaults = { ...DEFAULT_ROLE_PERMISSIONS[role] };
  try {
    const config = await prisma.rolePermissionConfig.findUnique({
      where: { role },
    });
    if (config?.permissions && typeof config.permissions === "object") {
      return {
        ...defaults,
        ...(config.permissions as Record<string, boolean>),
      };
    }
  } catch (error) {
    console.error(`Error loading permissions for role ${role}:`, error);
  }
  return defaults;
}

/**
 * Get all role permissions (for configuration UI)
 */
export async function getAllRolesPermissions(): Promise<Record<Role, Record<PermissionKey, boolean>>> {
  const result: Record<Role, Record<PermissionKey, boolean>> = {
    SUPERADMIN: { ...DEFAULT_ROLE_PERMISSIONS.SUPERADMIN },
    ADMIN: { ...DEFAULT_ROLE_PERMISSIONS.ADMIN },
    OWNER: { ...DEFAULT_ROLE_PERMISSIONS.OWNER },
    PRE_VENDAS: { ...DEFAULT_ROLE_PERMISSIONS.PRE_VENDAS },
    CORRETOR: { ...DEFAULT_ROLE_PERMISSIONS.CORRETOR },
    STAFF: { ...DEFAULT_ROLE_PERMISSIONS.STAFF },
  };

  try {
    const configs = await prisma.rolePermissionConfig.findMany();
    for (const c of configs) {
      if (result[c.role] && c.permissions && typeof c.permissions === "object") {
        result[c.role] = {
          ...result[c.role],
          ...(c.permissions as Record<string, boolean>),
        };
      }
    }
  } catch (error) {
    console.error("Error fetching all role configs:", error);
  }

  return result;
}

/**
 * Get effective permissions for an individual user:
 * Priority: SUPERADMIN (all true) -> User Overrides -> Role Configuration -> Role Defaults
 */
export async function getUserEffectivePermissions(userId: string): Promise<{
  permissions: Record<PermissionKey, boolean>;
  role: Role;
  overrides: Record<string, boolean>;
  imoviewCorretorNome: string | null;
  imoviewCorretorCodigo: string | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      permissionsOverrides: true,
      imoviewCorretorNome: true,
      imoviewCorretorCodigo: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    // Inactive or not found: revoke all
    const allDisabled = Object.keys(DEFAULT_ROLE_PERMISSIONS.CORRETOR).reduce((acc, k) => {
      acc[k as PermissionKey] = false;
      return acc;
    }, {} as Record<PermissionKey, boolean>);

    return {
      permissions: allDisabled,
      role: user?.role || "CORRETOR",
      overrides: {},
      imoviewCorretorNome: null,
      imoviewCorretorCodigo: null,
    };
  }

  if (user.role === "SUPERADMIN") {
    return {
      permissions: { ...DEFAULT_ROLE_PERMISSIONS.SUPERADMIN },
      role: user.role,
      overrides: {},
      imoviewCorretorNome: user.imoviewCorretorNome,
      imoviewCorretorCodigo: user.imoviewCorretorCodigo,
    };
  }

  const rolePerms = await getRolePermissions(user.role);
  const overrides = (user.permissionsOverrides as Record<string, boolean>) || {};

  const effective = { ...rolePerms };
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "boolean") {
      effective[key as PermissionKey] = value;
    }
  }

  return {
    permissions: effective,
    role: user.role,
    overrides,
    imoviewCorretorNome: user.imoviewCorretorNome,
    imoviewCorretorCodigo: user.imoviewCorretorCodigo,
  };
}

/**
 * Check if a user has a specific permission
 */
export async function checkUserPermission(userId: string, key: PermissionKey): Promise<boolean> {
  const userPerms = await getUserEffectivePermissions(userId);
  return !!userPerms.permissions[key];
}
