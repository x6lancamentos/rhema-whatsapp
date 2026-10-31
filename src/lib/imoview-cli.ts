import crypto from "node:crypto";

const API_URL = process.env.IMOVIEW_API_URL || "https://api.imoview.com.br";
const API_KEY = process.env.IMOVIEW_API_KEY || "11f9e237496a809fd4f1a803e05d6a8e";
const EMAIL = process.env.IMOVIEW_EMAIL || "brunno@rhemaimobiliaria.com.br";
const SENHA = process.env.IMOVIEW_SENHA || "12345678";
const GESTOR_ID = 8;

const CORRETORES_MAP: Record<string, number> = {
  miguel: 5,
  "ana maria": 6,
  brunno: 8,
  roseli: 11,
  leniara: 12,
  tatiana: 13,
  elaine: 14,
  kaylane: 16,
  camila: 18,
  flavia: 20,
  andressa: 21,
  andre: 24,
  ulisses: 25,
  georjana: 28,
};

const FASES_NOMES: Record<number, string> = {
  1: "Pré-atendimento",
  2: "Seleção de perfil",
  3: "Seleção de imóveis",
  4: "Visita",
  5: "Proposta",
  6: "Negócio realizado",
  7: "Lead qualificado",
  8: "Agendamento",
};

function norm(str: string) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function resolveCorretorId(input: string | number): number | null {
  if (!input) return null;
  if (/^\d+$/.test(String(input))) return Number(input);
  const n = norm(String(input));
  for (const [nome, id] of Object.entries(CORRETORES_MAP)) {
    if (n.includes(nome) || nome.includes(n)) return id;
  }
  return null;
}

function parseBrDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const parts = String(dateStr).trim().split(" ");
  const dParts = parts[0].split("/");
  if (dParts.length !== 3) return null;
  const day = Number(dParts[0]);
  const month = Number(dParts[1]) - 1;
  const year = Number(dParts[2]);
  if (parts[1]) {
    const tParts = parts[1].split(":");
    return new Date(year, month, day, Number(tParts[0] || 0), Number(tParts[1] || 0));
  }
  return new Date(year, month, day);
}

function daysSince(dateStr?: string): number | null {
  const dt = parseBrDate(dateStr);
  if (!dt || isNaN(dt.getTime())) return null;
  const diffMs = Date.now() - dt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function isLeadCorretorBlindado(atendimentoObj: any): boolean {
  const campos = [
    atendimentoObj.midia,
    atendimentoObj.campanha,
    atendimentoObj.tipo,
    atendimentoObj.funil,
    atendimentoObj.utm,
  ].map(norm);

  if (campos.some((c) => c.includes("lead corretor") || c.includes("lead_corretor") || c.includes("carteira corretor"))) {
    return true;
  }
  if (Array.isArray(atendimentoObj.interacoes)) {
    for (const inter of atendimentoObj.interacoes) {
      const txt = norm(inter.descricao || inter.texto || "");
      if (txt.includes("lead corretor") || txt.includes("#lead-corretor")) {
        return true;
      }
    }
  }
  return false;
}

let cachedAuth: { headers: Record<string, string>; expires: number } | null = null;

async function getImoviewAuthHeaders(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedAuth && cachedAuth.expires > now) {
    return cachedAuth.headers;
  }

  const senhaMd5 = crypto.createHash("md5").update(SENHA).digest("hex");
  const url = `${API_URL}/Usuario/App_ValidarAcesso?email=${encodeURIComponent(EMAIL)}&senha=${senhaMd5}`;
  const res = await fetch(url, { headers: { chave: API_KEY } });
  const data = await res.json();
  if (!data.codigoacesso) {
    throw new Error(`Falha na autenticação Imoview: ${JSON.stringify(data)}`);
  }

  const headers = {
    chave: API_KEY,
    codigoacesso: String(data.codigoacesso),
  };
  cachedAuth = { headers, expires: now + 30 * 60 * 1000 };
  return headers;
}

export async function buscarNoImoview(termo: string): Promise<string> {
  const headers = await getImoviewAuthHeaders();
  const res = await fetch(
    `${API_URL}/Cliente/App_PesquisarCliente?codigoUsuario=${GESTOR_ID}&textoPesquisa=${encodeURIComponent(termo)}`,
    { headers }
  );
  const data = await res.json();
  const clientes = data.lista || [];

  if (clientes.length === 0) {
    return `🔍 *BUSCA RHEMA CRM: "${termo}"*\n─────────────────────────────────────\nNenhum cliente encontrado no cadastro com este nome ou telefone.`;
  }

  let out = `🔍 *BUSCA RHEMA CRM: "${termo}"* (${clientes.length} encontrado(s))\n─────────────────────────────────────\n`;

  for (const c of clientes.slice(0, 5)) {
    out += `👤 *[Cliente #${c.codigo}] ${c.nome}*\n• Tel: ${c.telefone || "Não informado"}\n`;

    // Buscar atendimentos vinculados
    for (const fin of [2, 1]) {
      const finLabel = fin === 2 ? "Venda" : "Aluguel";
      try {
        const atRes = await fetch(
          `${API_URL}/Atendimento/RetornarAtendimentos?numeroPagina=1&numeroRegistros=10&finalidade=${fin}&situacao=0&codigoCliente=${c.codigo}`,
          { headers }
        );
        const atData = await atRes.json();
        if (atData?.lista && atData.lista.length > 0) {
          for (const a of atData.lista) {
            const blindado = isLeadCorretorBlindado(a);
            const dias = daysSince(a.datahoraultimainteracao || a.datahoraultimaalteracao || a.datahoraentradalead);
            out += `  ↳ *Card #${a.codigo}* (${finLabel}) | Corretor: *${a.corretor || "Rhema"}* | Mídia: ${a.midia || "Geral"}${
              blindado ? " 🛡️ [LEAD CORRETOR]" : ""
            } | ${dias ?? 0}d sem contato\n`;
          }
        }
      } catch {
        // Ignora erro em busca secundária
      }
    }
    out += `\n`;
  }

  return out.trim();
}

export async function carteiraDoCorretor(corretorInput: string): Promise<string> {
  const corretorId = resolveCorretorId(corretorInput);
  if (!corretorId) {
    return `❌ Não foi possível identificar o corretor: "${corretorInput}". Tente pelo nome (ex: Tatiana, Flávia, Ulisses) ou ID.`;
  }

  const headers = await getImoviewAuthHeaders();
  const todos: any[] = [];

  for (const fin of [2, 1]) {
    const finNome = fin === 2 ? "Venda" : "Aluguel";
    for (let fase = 1; fase <= 8; fase++) {
      let page = 1;
      while (page <= 5) {
        const url = `${API_URL}/Atendimento/RetornarAtendimentos?numeroPagina=${page}&numeroRegistros=20&finalidade=${fin}&fase=${fase}&codigoCorretor=${corretorId}&situacao=1`;
        const res = await fetch(url, { headers });
        const data = await res.json();
        if (!data?.lista || data.lista.length === 0) break;
        for (const a of data.lista) {
          const dias = daysSince(a.datahoraultimainteracao || a.datahoraultimaalteracao || a.datahoraentradalead);
          todos.push({
            codigo: a.codigo,
            finalidade: finNome,
            fase,
            faseNome: FASES_NOMES[fase] || `Fase ${fase}`,
            cliente: a.lead?.nome || "Sem nome",
            telefone: a.lead?.telefone1 || "",
            midia: a.midia || "",
            blindado: isLeadCorretorBlindado(a),
            diasParado: dias,
          });
        }
        if (data.lista.length < 20) break;
        page++;
      }
    }
  }

  const vendas = todos.filter((t) => t.finalidade === "Venda");
  const alugueis = todos.filter((t) => t.finalidade === "Aluguel");
  const expirados = todos.filter((t) => t.diasParado !== null && t.diasParado > 7 && !t.blindado);
  const blindados = todos.filter((t) => t.blindado);

  let out = `📂 *CARTEIRA DO CORRETOR (ID ${corretorId})*\n─────────────────────────────────────\n`;
  out += `• *Total Ativos:* ${todos.length} (${vendas.length} Venda | ${alugueis.length} Aluguel)\n`;
  out += `• *🛡️ Blindados (LEAD CORRETOR):* ${blindados.length}\n`;
  out += `• *⏳ Expirados (>7 dias sem contato):* ${expirados.length}\n─────────────────────────────────────\n`;

  for (const item of todos.slice(0, 15)) {
    const tag = item.blindado
      ? "🛡️ [LEAD CORRETOR]"
      : item.diasParado > 7
      ? `⚠️ [${item.diasParado}d parado]`
      : `✅ [${item.diasParado ?? 0}d]`;
    out += `• *#${item.codigo}* [${item.finalidade}] ${item.faseNome} | *${item.cliente}* (${item.telefone}) | ${tag}\n`;
  }

  if (todos.length > 15) {
    out += `\n_... e mais ${todos.length - 15} atendimentos na carteira._`;
  }

  return out.trim();
}

export async function auditarFila(limiteDias = 7): Promise<string> {
  const headers = await getImoviewAuthHeaders();
  const expirados: any[] = [];
  const protegidos: any[] = [];

  for (const fin of [2, 1]) {
    const finNome = fin === 2 ? "Venda" : "Aluguel";
    for (let fase = 1; fase <= 5; fase++) {
      let page = 1;
      while (page <= 8) {
        const url = `${API_URL}/Atendimento/RetornarAtendimentos?numeroPagina=${page}&numeroRegistros=20&finalidade=${fin}&fase=${fase}&situacao=1`;
        const res = await fetch(url, { headers });
        const data = await res.json();
        if (!data?.lista || data.lista.length === 0) break;

        for (const a of data.lista) {
          const dias = daysSince(a.datahoraultimainteracao || a.datahoraultimaalteracao || a.datahoraentradalead);
          const blindado = isLeadCorretorBlindado(a);
          if (dias !== null && dias >= limiteDias) {
            const reg = {
              codigo: a.codigo,
              finalidade: finNome,
              fase,
              corretor: a.corretor || "Rhema",
              cliente: a.lead?.nome || "",
              telefone: a.lead?.telefone1 || "",
              midia: a.midia || "",
              diasParado: dias,
            };
            if (blindado) {
              protegidos.push(reg);
            } else {
              expirados.push(reg);
            }
          }
        }
        if (data.lista.length < 20) break;
        page++;
      }
    }
  }

  let out = `🚨 *AUDITORIA DE FILA (> ${limiteDias} DIAS SEM CONTATO)*\n─────────────────────────────────────\n`;
  out += `• *Elegíveis a Redistribuição:* ${expirados.length}\n`;
  out += `• *🛡️ Blindados (LEAD CORRETOR):* ${protegidos.length} (imunes a repasse)\n─────────────────────────────────────\n`;

  if (protegidos.length > 0) {
    out += `🛡️ *BLINDADOS (LEAD CORRETOR - Mantidos com o corretor original):*\n`;
    for (const p of protegidos.slice(0, 5)) {
      out += `• #${p.codigo} [${p.corretor}] Cliente: ${p.cliente} (${p.diasParado}d)\n`;
    }
    out += `\n`;
  }

  out += `⚠️ *TOP LEADS EXPIRADOS PARA REDISTRIBUIÇÃO:*\n`;
  for (const e of expirados.slice(0, 10)) {
    out += `• *#${e.codigo}* [${e.finalidade}] Corretor: ${e.corretor} | Lead: *${e.cliente}* (${e.telefone}) | ⏳ *${e.diasParado} dias*\n`;
  }

  if (expirados.length > 10) {
    out += `\n_Para transferir um lead, use:_ \`!transferir [id] -> [corretor]\``;
  }

  return out.trim();
}

export async function transferirAtendimento(params: {
  codigoAtendimento: string | number;
  codigoNovoCorretor: string | number;
  motivo?: string;
  forceDiretoria?: boolean;
}): Promise<{ sucesso: boolean; mensagem: string }> {
  const headers = await getImoviewAuthHeaders();
  const idNovoCorretor = resolveCorretorId(params.codigoNovoCorretor);

  if (!idNovoCorretor) {
    return { sucesso: false, mensagem: `Corretor de destino não identificado: "${params.codigoNovoCorretor}"` };
  }

  // Checar detalhes e trava LEAD CORRETOR
  const detRes = await fetch(
    `${API_URL}/Atendimento/App_DetalhesAtendimentos?codigoUsuario=${GESTOR_ID}&codigoAtendimento=${params.codigoAtendimento}`,
    { headers }
  );
  const det = await detRes.json();
  if (!det?.codigo) {
    return { sucesso: false, mensagem: `Atendimento #${params.codigoAtendimento} não encontrado no CRM.` };
  }

  const blindado = isLeadCorretorBlindado(det);
  if (blindado && !params.forceDiretoria) {
    return {
      sucesso: false,
      mensagem: `🛑 *TRAVA LEAD CORRETOR ATIVADA!* O atendimento #${params.codigoAtendimento} (${det.lead?.nome}) possui origem *${det.midia}* (rede de relacionamento pessoal do corretor). Repasse bloqueado pelas regras da Diretoria.`,
    };
  }

  const p = new URLSearchParams({
    codigoUsuario: String(GESTOR_ID),
    codigoAtendimento: String(params.codigoAtendimento),
    codigoNovoCorretor: String(idNovoCorretor),
    codigoNovaUnidade: "0",
    motivo: params.motivo || "Redistribuição autorizada pela Diretoria (SLA)",
  });

  const trRes = await fetch(`${API_URL}/Atendimento/App_AlterarCorretor?${p.toString()}`, {
    method: "POST",
    headers,
  });
  const trData = await trRes.json();

  return {
    sucesso: true,
    mensagem: `✅ *ATENDIMENTO #${params.codigoAtendimento} TRANSFERIDO COM SUCESSO!*\n• Lead: *${det.lead?.nome}* (${det.lead?.telefone1 || ""})\n• Corretor Anterior: ${det.corretor?.nome || "N/A"}\n• Novo Titular: Corretor ID *${idNovoCorretor}*\n• Sem duplicidade de card no Imoview.`,
  };
}

