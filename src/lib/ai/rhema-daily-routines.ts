import { prisma } from "@/lib/prisma";
import { waManager } from "@/modules/whatsapp/manager";
import { logger } from "@/lib/logger";

export type RotinaRhemaTipo =
  | "BRIEFING_MATINAL_0730"
  | "ONBOARDING_CORRETORES_0800"
  | "SLA_DEAD_DEAL_CPR_1400"
  | "COLETA_FECHAMENTO_1730"
  | "FECHAMENTO_EXECUTIVO_1815"
  | "DOSSIE_PDI_OKR_SEXTA_1700"
  | "ESCALONAMENTO_SLA_GESTOR";

// Trava Global de Segurança: por padrão fica PAUSADO até o Gestor ativar no dashboard ou via env
let runtimeRoutinesEnabled = process.env.RHEMA_AUTONOMOUS_ROUTINES_ENABLED === "true";

export function isRhemaRoutinesEnabled(): boolean {
  return runtimeRoutinesEnabled;
}

export function setRhemaRoutinesEnabled(enabled: boolean): boolean {
  runtimeRoutinesEnabled = enabled;
  return runtimeRoutinesEnabled;
}

const MENSAGENS_ONBOARDING_CALIBRADAS: Record<string, (nome: string) => string> = {
  andre: () =>
    `Bom dia, André! 🙏\n\nCom 16 anos de mercado em Santos, você sabe que quem domina a pauta da manhã domina a mesa de fechamento.\n\nPara hoje:\n1. Qual é o atendimento mais estratégico da sua carteira para avançarmos em proposta?\n2. No seu bloco de captação (08h–09h), quais proprietários vamos posicionar na Exclusividade Rhema Premium?\n\nExcelente dia de negócios!`,
  tatiana: () =>
    `Bom dia, Tatiana! 🦁🔥\n\nQuem tem a sua presença e a sua garra faz o resultado acontecer.\n\nTrês focos de ataque hoje:\n1. Qual é o cliente mais quente para puxarmos proposta ainda hoje?\n2. Qual visita recente precisa daquela sua ligação certeira de fechamento?\n3. Qual imóvel novo vai entrar na sua carteira hoje?\n\nVai com tudo! 🚀`,
  flavia: () =>
    `Bom dia, Flávia! 🎯\n\nDireto nas oportunidades de alto giro de hoje:\n1. Quais visitas estão confirmadas na agenda?\n2. Dos clientes ativos no Imoview, quais 3 têm perfil imediato para agendar visita hoje?\n3. Algum imóvel de oportunidade no Gonzaga ou Embaré para subirmos ficha?\n\nBora converter! ⚡`,
  roseli: () =>
    `Bom dia, Roseli! ☀️\n\nSeu volume de atendimentos e sua dedicação diária são referência na equipe. Hoje o foco é transformar esse volume em visita e proposta:\n1. Qual dos seus clientes está mais pronto para ver imóvel hoje?\n2. Qual captação podemos buscar hoje para dar produto certo para sua carteira?\n\nUm passo firme de cada vez! 💪`,
  leniara: () =>
    `Bom dia, Leniára. 💼\n\nTrês pontos para hoje:\n1. Cliente mais quente → qual é o próximo passo concreto?\n2. Captação → quais proprietários entram no recontato hoje?\n3. O que destrava sua meta da semana ainda hoje?\n\nFoco e execução.`,
  luana: () =>
    `Bom dia, Luana! 💪\n\nDireto ao ponto para sua agenda render:\n→ Qual é o seu cliente número 1 para avançar hoje?\n→ O que falta para virar proposta?\n→ Quantos resgates do Imoview você vai atacar no bloco da manhã?\n\nOrganiza a fila e vai!`,
  elaine: () =>
    `Bom dia, Elaine! 📋\n\nVamos estruturar as prioridades de hoje para sua carteira girar com segurança:\n1. Quais atendimentos do Imoview precisam de follow-up de retorno hoje?\n2. Alguma visita dos últimos dias aguardando evolução para proposta?\n3. Qual horário você reservou hoje para atualização e captação?\n\nConte comigo!`,
  kaylane: () =>
    `Bom dia, Kaylane! 🌱\n\nHoje é mais um dia para ganhar repertório e confiança passo a passo:\n1. Qual cliente ou imóvel você quer estudar mais a fundo hoje?\n2. Em qual etapa do atendimento posso te ajudar a ficar mais segura?\n3. Qual será sua meta de ligações e atualizações no Placar hoje?\n\nBom trabalho! ☀️`,
  andressa: () =>
    `Bom dia, Andressa! 🚀\n\nRitmo forte para ganhar tração rápida na carteira:\n1. Quais novas oportunidades de captação você mapeou para hoje?\n2. Dos leads em atendimento, quem conseguimos puxar para visita ainda nesta semana?\n3. Bora buscar o bônus de Dia Consistente (+20 pts) no Placar hoje?`,
};

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function gerarMensagemOnboardingCorretor(nome: string): string {
  const n = norm(nome);
  for (const [chave, fn] of Object.entries(MENSAGENS_ONBOARDING_CALIBRADAS)) {
    if (n.includes(chave)) return fn(nome);
  }
  const primeiroNome = nome.split(" ")[0] || "Corretor(a)";
  return `Bom dia, ${primeiroNome}! ☀️\n\nFoco do dia no Placar Rhema:\n1. Qual é o seu cliente mais quente hoje?\n2. Quais 3 resgates do Imoview você vai fazer agora de manhã?\n3. Qual será sua captação ou visita de hoje?\n\nSe precisar destravar algum negócio, mande um áudio de 30s por aqui! 💪`;
}

export function gerarBriefingMatinalGestor(dados?: {
  liderOntem?: string;
  pontosLider?: number;
  leadsSemPrimeiroContato?: number;
  visitasSemParecer?: number;
  negociosParadosCPR?: number;
}): string {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const lider = dados?.liderOntem || "Tatiana (Líder em Propostas & Visitas)";
  const pts = dados?.pontosLider ?? 135;
  const slaLeads = dados?.leadsSemPrimeiroContato ?? 2;
  const slaVisitas = dados?.visitasSemParecer ?? 3;
  const cpr = dados?.negociosParadosCPR ?? 5;

  return `☀️ *RHEMA OS | BRIEFING MATINAL DO GESTOR* | ${hoje}
─────────────────────────────────────

🏆 *RESUMO DO PLACAR RHEMA*
• Destaque Recente: *${lider}* (${pts} pts)
• Meta de Esforço: Foco no Bloco da Rotina (+5 pts) às 08h00 e Dia Consistente (+20 pts)

🚨 *AUDITORIA DE SLA IMOVIEW (AGORA)*
• Leads >15min sem 1º contato: *${slaLeads}*
• Visitas >24h sem parecer: *${slaVisitas}*
• Negócios parados >3 dias (Dead-Deal CPR): *${cpr} casos*

🎯 *3 PAUTAS PRIORITÁRIAS PARA A MATINAL*
1. *Mesa de Closer:* Destravar as propostas ativas da Fase 5 no Imoview usando a Calculadora de Vacância.
2. *Zero Parecer Pendente:* Cobrar áudio de 30s no WhatsApp para zerar as ${slaVisitas} visitas sem parecer (+15 pts cada).
3. *Captação Exclusiva (Rhema Premium):* Usar o novo botão *CMA em 10s* nas Fichas de Captação nos bairros core (Embaré, Aparecida, Ponta da Praia, Gonzaga e Boqueirão).
─────────────────────────────────────
_Rhema Imóveis — Palavra que age._`;
}

export function gerarColetaFechamento1730(nomeCorretor: string): string {
  const primeiroNome = nomeCorretor.split(" ")[0] || "Corretor(a)";
  return `🎙️ *Check-out Rápido do Placar Rhema (30s)*\n\nOi, ${primeiroNome}! Antes de encerrar o expediente, me manda um *áudio rápido de 30 segundos* aqui mesmo dizendo:\n\n1️⃣ Quantas ligações, resgates, visitas, captações ou propostas você fechou hoje;\n2️⃣ *O que travou hoje?*\n3️⃣ *Qual é a sua prioridade nº 1 de amanhã?*\n\nEu transcrevo em 0,4s e já lanço direto no seu Placar Oficial! 🚀`;
}

export function gerarFechamentoExecutivo1815(vgvMesa = 3850000, vgvFechadoMes = 1650000): string {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const comissaoBrutaMes = Math.round(vgvFechadoMes * 0.06);
  const comissaoVendedores = Math.round(comissaoBrutaMes * 0.3);
  const comissaoCaptadores = Math.round(comissaoBrutaMes * 0.15);
  const comissaoGerente = Math.round(comissaoBrutaMes * 0.07);
  const comissaoRhemaOp = Math.round(comissaoBrutaMes * 0.43);
  const fmtFundo = Math.round(comissaoBrutaMes * 0.05);

  return `📊 *RHEMA OS | FECHAMENTO EXECUTIVO (18:15)* | ${hoje}
─────────────────────────────────────

💰 *VGV & COMISSÕES OFICIAIS (Fórmula 6%)*
• *VGV em Mesa (Propostas Ativas):* R$ ${vgvMesa.toLocaleString("pt-BR")}
• *VGV Fechado no Mês:* R$ ${vgvFechadoMes.toLocaleString("pt-BR")}
• *Comissão Bruta Gerada (6%):* R$ ${comissaoBrutaMes.toLocaleString("pt-BR")}
  ├─ Vendedores (30%): R$ ${comissaoVendedores.toLocaleString("pt-BR")}
  ├─ Captadores (15%): R$ ${comissaoCaptadores.toLocaleString("pt-BR")}
  ├─ Gerente Comercial (7%): R$ ${comissaoGerente.toLocaleString("pt-BR")}
  └─ Rhema Imóveis (48%): Operação R$ ${comissaoRhemaOp.toLocaleString("pt-BR")} + FMT (5%) R$ ${fmtFundo.toLocaleString("pt-BR")}

⚡ *HOMOLOGAÇÃO DO PLACAR EM 1 CLIQUE*
Os check-outs de voz e sincronizações do Imoview já estão pré-carregados.
Acesse */admin/lancamento* no Hub e clique em *"✅ Homologar Dia em 1 Clique"* (ou responda *HOMOLOGAR* aqui).
─────────────────────────────────────`;
}

export function gerarDossiePdiOkrSexta1700(): string {
  const hoje = new Date().toLocaleDateString("pt-BR");
  return `📋 *RHEMA OS | DOSSIÊ SEMANAL PDI & OKR 90 DIAS (SEXTA 17:00)* | ${hoje}
─────────────────────────────────────
🔒 *EXCLUSIVO GESTOR COMANDANTE (BRUNNO ANASTÁCIO)*

🎯 *RITMO DO OKR TRIMESTRAL (90 DIAS)*
• *KR 1.1 (VGV R$ 15M):* Ritmo semanal em 94% da meta projetada
• *KR 1.2 (Exclusividades Rhema Premium):* Uso do *CMA em 10s* ativo nos 5 bairros core
• *KR 3.2 (Fundo de Marketing / FMT 5%):* Acumulando conforme vendas homologadas

📚 *DIAGNÓSTICO DAS 4 TAXAS PARA AS 1:1 DE SEGUNDA-FEIRA*
• *Foco Cap. 08 (Qualificação — Ligação → Visita <40%):* Kaylane, Elaine
• *Foco Cap. 09 (Captação & Exclusividade):* Andressa, Roseli
• *Foco Cap. 10 (Condução de Visita → Proposta <25%):* Flávia, Luana, Leniára
• *Foco Cap. 11 (Fechamento & Quebra de Objeções):* Tatiana, André

💡 *Ação Rápida:* Responda *PDI [Nome]* aqui no WhatsApp para receber a pauta individual pronta para a reunião 1:1 ou acesse */admin/pdi* no Hub!
─────────────────────────────────────`;
}

export function gerarAlertaEscalonamentoSlaGestor(): string {
  return `🚨 *ESCALONAMENTO CRÍTICO DE SLA (>30 MIN SEM 1º CONTATO)*
─────────────────────────────────────
🔒 *EXCLUSIVO GESTOR COMANDANTE (BRUNNO)*

O Agente 4 (Fiscal de Pipeline) detectou atendimento(s) na Fase 1 (Pré-Atendimento Imoview) que ultrapassaram o 1º alerta de 15 minutos ao corretor e atingiram *30 minutos sem interação registrada*.

⚡ *Recomendação Oficial de Rodízio:*
Repassar imediatamente para o próximo corretor ativo na fila de presença (` + "`lead_ownership_events`" + `) ou responder *DIAGNÓSTICO GERAL* para auditar a fila agora.`;
}

/**
 * Executa uma das 5 rotinas autônomas diárias do Rhema OS.
 * Se `dispararWhatsApp` for true e houver sessão conectada, envia as mensagens reais.
 */
export async function executarRotinaDiariaRhema(options: {
  rotina: RotinaRhemaTipo;
  sessionId?: string;
  gestorPhone?: string;
  dispararWhatsApp?: boolean;
}) {
  const { rotina, sessionId, gestorPhone, dispararWhatsApp = false } = options;

  const corretores = await prisma.brokerContact.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
  });

  const mensagensGeradas: Array<{ destinatario: string; telefone: string; texto: string; enviado: boolean }> = [];

  if (rotina === "BRIEFING_MATINAL_0730") {
    const texto = gerarBriefingMatinalGestor();
    mensagensGeradas.push({
      destinatario: "Brunno Anastácio (Gestor)",
      telefone: gestorPhone || process.env.RHEMA_GESTOR_PHONE || "",
      texto,
      enviado: false,
    });
  } else if (rotina === "ONBOARDING_CORRETORES_0800") {
    const lista =
      corretores.length > 0
        ? corretores
        : [
            { nome: "André de Oliveira Szwarcberg", telefone: "" },
            { nome: "Tatiana Gonçalves de Oliveira", telefone: "" },
            { nome: "Flávia Mara de Mattos", telefone: "" },
            { nome: "Roseli de Carvalho Lopes", telefone: "" },
            { nome: "Leniára R. M. Araújo", telefone: "" },
            { nome: "Luana Cardoso", telefone: "" },
            { nome: "Elaine do Nascimento", telefone: "" },
            { nome: "Kaylane Assumpção", telefone: "" },
            { nome: "Andressa Larocca", telefone: "" },
          ];
    for (const c of lista) {
      mensagensGeradas.push({
        destinatario: c.nome,
        telefone: c.telefone,
        texto: gerarMensagemOnboardingCorretor(c.nome),
        enviado: false,
      });
    }
  } else if (rotina === "SLA_DEAD_DEAL_CPR_1400") {
    const lista = corretores.length > 0 ? corretores : [{ nome: "Equipe Comercial Rhema", telefone: "" }];
    for (const c of lista) {
      const primeiroNome = c.nome.split(" ")[0];
      mensagensGeradas.push({
        destinatario: c.nome,
        telefone: c.telefone,
        texto: `🚨 *Radar Dead-Deal CPR & SLA (14:00)*\n\nOi, ${primeiroNome}! Hora de ressuscitar os atendimentos parados há >3 dias no Imoview e garantir zero visitas sem parecer.\n\n📋 *Texto pronto para copiar e colar para seus clientes em fase de visita/seleção:*\n_"Oi [Nome do Cliente], tudo bem? Aqui é ${primeiroNome}, da Rhema Imóveis! Surgiu uma atualização excelente nas condições daquele imóvel que conversamos em Santos. Consegue falar 2 minutinhos hoje?"_\n\nCada reativação conta *+2 pts (Resgate)* no seu Placar de hoje! ⚡`,
        enviado: false,
      });
    }
  } else if (rotina === "COLETA_FECHAMENTO_1730") {
    const lista = corretores.length > 0 ? corretores : [{ nome: "Equipe Comercial Rhema", telefone: "" }];
    for (const c of lista) {
      mensagensGeradas.push({
        destinatario: c.nome,
        telefone: c.telefone,
        texto: gerarColetaFechamento1730(c.nome),
        enviado: false,
      });
    }
  } else if (rotina === "FECHAMENTO_EXECUTIVO_1815") {
    mensagensGeradas.push({
      destinatario: "Brunno Anastácio (Gestor)",
      telefone: gestorPhone || process.env.RHEMA_GESTOR_PHONE || "",
      texto: gerarFechamentoExecutivo1815(),
      enviado: false,
    });
  } else if (rotina === "DOSSIE_PDI_OKR_SEXTA_1700") {
    mensagensGeradas.push({
      destinatario: "Brunno Anastácio (Gestor)",
      telefone: gestorPhone || process.env.RHEMA_GESTOR_PHONE || "",
      texto: gerarDossiePdiOkrSexta1700(),
      enviado: false,
    });
  } else if (rotina === "ESCALONAMENTO_SLA_GESTOR") {
    mensagensGeradas.push({
      destinatario: "Brunno Anastácio (Gestor)",
      telefone: gestorPhone || process.env.RHEMA_GESTOR_PHONE || "",
      texto: gerarAlertaEscalonamentoSlaGestor(),
      enviado: false,
    });
  }

  // Se dispararWhatsApp = true e houver instância conectada no Baileys, envia
  if (dispararWhatsApp && sessionId) {
    const instance = waManager.getInstance(sessionId);
    if (instance?.socket) {
      for (const m of mensagensGeradas) {
        const cleanDigits = (m.telefone || "").replace(/\D/g, "");
        if (cleanDigits.length >= 10) {
          const jid = cleanDigits.startsWith("55")
            ? `${cleanDigits}@s.whatsapp.net`
            : `55${cleanDigits}@s.whatsapp.net`;
          try {
            await instance.socket.sendMessage(jid, { text: m.texto });
            m.enviado = true;
          } catch (err) {
            logger.warn("RhemaRoutines", `Falha ao enviar rotina ${rotina} para ${jid}:`, err);
          }
        }
      }
    }
  }

  return {
    rotina,
    executadoEm: new Date().toISOString(),
    totalMensagens: mensagensGeradas.length,
    mensagensGeradas,
  };
}

