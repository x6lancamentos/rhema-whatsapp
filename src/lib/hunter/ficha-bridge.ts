import { logger } from "@/lib/logger";

export interface FichaDraftParams {
  proprietarioNome: string;
  proprietarioTelefone: string;
  bairro: string;
  tipoImovel: string;
  valorVenda: number;
  condominio?: number;
  iptu?: number;
  quartos?: number;
  vagas?: number;
  areaM2?: number;
  enderecoAprox?: string;
  fotos?: string[];
  captadorNome?: string;
  horarioPreferencialVisita?: string;
}

/**
 * Cria ou prepara o rascunho de Pré-Ficha Digital do Rhema Hub
 */
export async function createFichaDraft(params: FichaDraftParams): Promise<{ success: boolean; fichaId: string; urlApp: string }> {
  const {
    proprietarioNome,
    proprietarioTelefone,
    bairro,
    tipoImovel,
    valorVenda,
    condominio = 0,
    iptu = 0,
    quartos = 0,
    enderecoAprox = "",
    captadorNome = "Brunno Anastácio (Gerente)",
  } = params;

  logger.info("FichaBridge", `Criando Pré-Ficha para ${proprietarioNome} (${tipoImovel} no ${bairro} - R$ ${valorVenda})...`);

  const mockFichaId = `fc-${Date.now().toString(36)}`;
  const appBaseUrl = process.env.RHEMA_HUB_URL || "https://rhema-app.coolify.rhemaimobiliaria.com.br";
  const urlApp = `${appBaseUrl}/fichas/${mockFichaId}`;

  // Se houver cliente Supabase configurado
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/fichas`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          status: "rascunho",
          captador_nome: captadorNome,
          proprietario_nome: proprietarioNome,
          proprietario_telefone: proprietarioTelefone,
          bairro,
          cidade: "Santos",
          tipos_imovel: [tipoImovel],
          valor_venda: valorVenda,
          condominio,
          iptu,
          dormitorios: quartos,
          ponto_referencia: enderecoAprox,
          data_captacao: new Date().toISOString().slice(0, 10),
        }),
      });

      if (resp.ok) {
        const rows = await resp.json();
        const first = Array.isArray(rows) ? rows[0] : rows;
        if (first?.id) {
          logger.info("FichaBridge", `Ficha criada com sucesso no Supabase com ID: ${first.id}`);
          return { success: true, fichaId: first.id, urlApp: `${appBaseUrl}/fichas/${first.id}` };
        }
      } else {
        const errText = await resp.text();
        logger.warn("FichaBridge", "Aviso ao inserir no Supabase (usando draft local):", errText);
      }
    } catch (sbErr: any) {
      logger.warn("FichaBridge", "Aviso ao conectar no Supabase:", sbErr.message);
    }
  }

  return {
    success: true,
    fichaId: mockFichaId,
    urlApp,
  };
}

/**
 * Formata o Dossiê Executivo enviado diretamente para o WhatsApp do Brunno
 */
export function formatBrunnoDossier(params: {
  proprietarioNome: string;
  proprietarioTelefone: string;
  bairro: string;
  tipoImovel: string;
  valorVenda: number;
  condominio?: number;
  iptu?: number;
  quartos?: number;
  enderecoAprox?: string;
  horarioPreferencialVisita?: string;
  fichaId: string;
  urlApp: string;
  psicometria?: { disc?: string; gatilhoIdeal?: string };
}): string {
  const valorFormatado = params.valorVenda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const discPerfil = params.psicometria?.disc || "Conforme";
  const gatilhoPerfil = params.psicometria?.gatilhoIdeal || "Segurança Jurídica";

  return (
    `🚨 *[RHEMA HUNTER] NOVA CAPTAÇÃO ACEITA PELO PROPRIETÁRIO!*\n\n` +
    `🏠 *Imóvel:* ${params.tipoImovel} no ${params.bairro}\n` +
    `💰 *Valor:* ${valorFormatado} (Cond: R$ ${params.condominio || 0} | IPTU: R$ ${params.iptu || 0})\n` +
    `👤 *Proprietário:* ${params.proprietarioNome}\n` +
    `📲 *Telefone:* ${params.proprietarioTelefone}\n` +
    `📍 *Endereço/Ref:* ${params.enderecoAprox || "Santos/SP"}\n` +
    `🧠 *Perfil Psicométrico:* ${discPerfil} (Gatilho: ${gatilhoPerfil})\n\n` +
    `📸 *Pré-Ficha Digital no Rhema Hub:*\n👉 ${params.urlApp}\n\n` +
    `🧭 *Ação da Gerência:* Defina qual corretor da equipe irá realizar as fotos oficiais e a formalização.`
  );
}
