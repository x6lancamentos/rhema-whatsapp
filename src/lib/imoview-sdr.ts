import crypto from "node:crypto";
import { logger } from "@/lib/logger";

const BASE_URL = process.env.IMOVIEW_API_URL || "https://api.imoview.com.br";
const API_KEY = process.env.IMOVIEW_API_KEY || "11f9e237496a809fd4f1a803e05d6a8e";
const EMAIL = process.env.IMOVIEW_EMAIL || "brunno@rhemaimobiliaria.com.br";
const SENHA = process.env.IMOVIEW_SENHA || "12345678";
const GESTOR_ID = process.env.IMOVIEW_GESTOR_ID || "8";
const UNIDADE_CODIGO = process.env.IMOVIEW_UNIDADE_CODIGO || "9238";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getAuthToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const senhaMd5 = crypto.createHash("md5").update(SENHA).digest("hex");
  const loginUrl = new URL("/Usuario/App_ValidarAcesso", BASE_URL);
  loginUrl.searchParams.set("email", EMAIL);
  loginUrl.searchParams.set("senha", senhaMd5);

  const res = await fetch(loginUrl.toString(), {
    method: "GET",
    headers: { chave: API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Falha no login Imoview: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data?.codigoacesso) {
    throw new Error(`Imoview login não retornou codigoacesso: ${JSON.stringify(data)}`);
  }

  cachedToken = data.codigoacesso;
  tokenExpiresAt = now + 4 * 60 * 60 * 1000; // 4 horas de cache
  return cachedToken!;
}

async function callImoviewApi(endpoint: string, options: { method?: string; params?: Record<string, string>; bodyJson?: any }) {
  const { method = "GET", params = {}, bodyJson } = options;

  let token = await getAuthToken();
  const url = new URL(endpoint, BASE_URL);

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const doFetch = async (authToken: string) => {
    return fetch(url.toString(), {
      method,
      headers: {
        chave: API_KEY,
        codigoacesso: authToken,
        ...(bodyJson ? { "Content-Type": "application/json" } : {}),
      },
      body: bodyJson ? JSON.stringify(bodyJson) : undefined,
    });
  };

  let res = await doFetch(token);

  // Se expirar token (401/403), renova e tenta de novo
  if (res.status === 401 || res.status === 403) {
    token = await getAuthToken(true);
    res = await doFetch(token);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro na chamada Imoview ${endpoint} (HTTP ${res.status}): ${errText}`);
  }

  return res.json();
}

export interface ImoviewCheckResult {
  hasExistingAttendance: boolean;
  isLeadCorretor: boolean;
  codigoAtendimento?: number;
  corretorNome?: string;
  corretorId?: number;
  faseCodigo?: number;
  clienteCodigo?: number;
}

/**
 * Verifica se o cliente já possui cadastro ou atendimento ativo no Imoview
 * Blindando com rigor a trava LEAD CORRETOR
 */
export async function checkExistingLeadInImoview(telefone: string): Promise<ImoviewCheckResult> {
  try {
    const cleanDigits = (telefone || "").replace(/\D/g, "");
    if (cleanDigits.length < 8) {
      return { hasExistingAttendance: false, isLeadCorretor: false };
    }

    // Busca cliente por texto
    const res = await callImoviewApi("/Cliente/App_PesquisarCliente", {
      params: {
        codigoUsuario: GESTOR_ID,
        textoPesquisa: cleanDigits,
      },
    });

    const lista = res?.lista || [];
    if (lista.length === 0) {
      return { hasExistingAttendance: false, isLeadCorretor: false };
    }

    const cliente = lista[0];
    const clienteCodigo = cliente.codigo;

    // Busca atendimentos ativos do cliente
    await sleep(350);
    const atdRes = await callImoviewApi("/Atendimento/RetornarAtendimentos", {
      params: {
        codigoCliente: String(clienteCodigo),
        situacao: "1", // Ativos
        numeroPagina: "1",
        numeroRegistros: "5",
      },
    });

    const atendimentos = atdRes?.lista || [];
    if (atendimentos.length === 0) {
      return { hasExistingAttendance: false, isLeadCorretor: false, clienteCodigo };
    }

    const ativo = atendimentos[0];
    const canal = `${ativo.origem || ""} ${ativo.midia || ""} ${ativo.campanha || ""}`.toUpperCase();
    const isLeadCorretor = canal.includes("LEAD CORRETOR") || canal.includes("LEAD_CORRETOR");

    return {
      hasExistingAttendance: true,
      isLeadCorretor,
      codigoAtendimento: ativo.codigo,
      corretorNome: ativo.corretor || ativo.nomecorretor,
      corretorId: ativo.codigocorretor,
      faseCodigo: ativo.fase,
      clienteCodigo,
    };
  } catch (err: any) {
    logger.warn("ImoviewSdr", `Aviso ao pesquisar cliente ${telefone} no Imoview:`, err?.message || err);
    return { hasExistingAttendance: false, isLeadCorretor: false };
  }
}

/**
 * Cria ou avança o Atendimento no Imoview até a fase de Visita Agendada (Fase 8)
 * e transfere para o corretor responsável
 */
export async function registerSdrAttendanceInImoview(params: {
  leadNome: string;
  leadTelefone: string;
  codigoImovel?: string;
  origem?: string;
  temperatura?: string;
  dossieQualificacao: string;
  corretorIdDestino: number;
  corretorNomeDestino: string;
  visitaAgendada?: {
    dataHoraFormatada: string;
    imovelCodigo: string;
  };
}): Promise<{ success: boolean; codigoAtendimento?: number; mensagem: string }> {
  const {
    leadNome,
    leadTelefone,
    codigoImovel,
    origem = "Portal / WhatsApp",
    temperatura = "MORNO",
    dossieQualificacao,
    corretorIdDestino,
    corretorNomeDestino,
    visitaAgendada,
  } = params;

  try {
    const cleanPhone = leadTelefone.replace(/\D/g, "");
    const termometroCodigo = temperatura === "QUENTE" ? 3 : temperatura === "FRIO" ? 1 : 2;

    const payloadAtendimento = {
      unidadecodigo: UNIDADE_CODIGO,
      finalidadecodigo: 2, // 2 = Venda
      tipocodigo: 1, // On-line
      midiacodigo: 4, // 4 = Indicação / Portal
      campanha: "RHEMA SDR IA",
      termometrocodigo: String(termometroCodigo),
      leadnome: leadNome,
      leadtelefone: cleanPhone,
      interacaoinicial: `[TRIAGEM SDR AUTÔNOMO]\n${dossieQualificacao}`,
    };

    logger.info("ImoviewSdr", `Criando Atendimento no Imoview para ${leadNome} (${cleanPhone})...`);

    // 1. Criar Atendimento (Fase 2 inicial)
    const incRes = await callImoviewApi("/Atendimento/App_IncluirAtendimento", {
      method: "POST",
      params: {
        codigoUsuario: GESTOR_ID,
        jsonAtendimento: JSON.stringify(payloadAtendimento),
      },
    });

    const mensagem = String(incRes?.mensagem || "");
    const match = mensagem.match(/Atendimento\s+(\d+)/i);
    if (!match || !match[1]) {
      throw new Error(`Imoview não retornou o número do atendimento criado: ${JSON.stringify(incRes)}`);
    }

    const atdId = parseInt(match[1], 10);
    logger.info("ImoviewSdr", `Atendimento #${atdId} criado com sucesso!`);

    await sleep(450);

    // 2. Incluir Imóvel no Carrinho (Avança para Fase 3)
    const imovelAlvo = visitaAgendada?.imovelCodigo || codigoImovel;
    if (imovelAlvo) {
      try {
        await callImoviewApi("/Atendimento/App_IncluirImovelCarrinho", {
          method: "POST",
          params: {
            codigoUsuario: GESTOR_ID,
            codigoAtendimento: String(atdId),
            codigoImovel: String(imovelAlvo),
          },
        });
        logger.info("ImoviewSdr", `Imóvel #${imovelAlvo} adicionado ao carrinho do Atendimento #${atdId}.`);
      } catch (carrinhoErr) {
        logger.warn("ImoviewSdr", `Aviso ao incluir imóvel no carrinho:`, carrinhoErr);
      }
    }

    await sleep(450);

    // 3. Se houver visita agendada, avança para Fase 8 (Agendamento)
    if (visitaAgendada?.imovelCodigo) {
      try {
        await callImoviewApi("/Atendimento/App_IncluirImovelVisita", {
          method: "POST",
          params: {
            codigoUsuario: GESTOR_ID,
            codigoAtendimento: String(atdId),
            codigoImovel: String(visitaAgendada.imovelCodigo),
          },
        });
        logger.info("ImoviewSdr", `Imóvel #${visitaAgendada.imovelCodigo} agendado para visita no Atendimento #${atdId} (Fase 8).`);
      } catch (visitaErr) {
        logger.warn("ImoviewSdr", `Aviso ao incluir visita agendada:`, visitaErr);
      }
    }

    await sleep(450);

    // 4. Transferir Atendimento para o Corretor Destino
    if (corretorIdDestino && corretorIdDestino !== Number(GESTOR_ID)) {
      try {
        await callImoviewApi("/Atendimento/App_AlterarCorretor", {
          method: "POST",
          params: {
            codigoUsuario: GESTOR_ID,
            codigoAtendimento: String(atdId),
            codigoNovoCorretor: String(corretorIdDestino),
            codigoNovaUnidade: "0",
            motivo: `Distribuição automática Rhema SDR para ${corretorNomeDestino}`,
          },
        });
        logger.info("ImoviewSdr", `Atendimento #${atdId} transferido para o corretor ${corretorNomeDestino} (ID: ${corretorIdDestino}).`);
      } catch (transfErr) {
        logger.warn("ImoviewSdr", `Aviso ao transferir para corretor:`, transfErr);
      }
    }

    await sleep(400);

    // 5. Registrar Interação com o resumo consolidado e data/hora da visita
    const textoNota =
      `📅 *STATUS SDR: VISITA AGENDADA*\n` +
      `• Data/Hora Prevista: ${visitaAgendada?.dataHoraFormatada || "A alinhar janelas"}\n` +
      `• Imóvel Alvo: ${imovelAlvo || "Não informado"}\n` +
      `• Corretor Destinado: ${corretorNomeDestino}\n` +
      `• Origem: ${origem}\n\n` +
      `📋 *DOSSIÊ DOS 4 PILARES:*\n${dossieQualificacao}`;

    try {
      await callImoviewApi("/Atendimento/App_IncluirInteracao", {
        method: "POST",
        params: {
          codigoUsuario: GESTOR_ID,
          codigoAtendimento: String(atdId),
          descricao: textoNota.slice(0, 4000),
        },
      });
      logger.info("ImoviewSdr", `Nota com dossiê da visita registrada no Atendimento #${atdId}.`);
    } catch (notaErr) {
      logger.warn("ImoviewSdr", `Aviso ao registrar nota no atendimento:`, notaErr);
    }

    return {
      success: true,
      codigoAtendimento: atdId,
      mensagem: `Atendimento #${atdId} cadastrado com sucesso e transferido para ${corretorNomeDestino}.`,
    };
  } catch (err: any) {
    logger.error("ImoviewSdr", "Falha geral ao cadastrar atendimento no Imoview:", err);
    return {
      success: false,
      mensagem: `Erro ao integrar com Imoview: ${err?.message || err}`,
    };
  }
}

