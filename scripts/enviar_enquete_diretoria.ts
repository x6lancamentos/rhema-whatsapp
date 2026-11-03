import path from "path";
import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";
const GRUPO_DIRETORIA = "120363426753225157@g.us";

async function run() {
    console.log(`[DISPARO DIRETORIA] Conectando ao Baileys (sessão: ${SESSION_ID})...`);
    const { state, saveCreds } = await usePrismaAuthState(SESSION_ID);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        logger: pino({ level: "silent" }) as any,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }) as any),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true,
        syncFullHistory: false,
    });

    socket.ev.on("creds.update", saveCreds);

    await new Promise<void>((resolve, reject) => {
        socket.ev.on("connection.update", (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "open") {
                console.log("[CONEXAO OPEN] Conectado ao WhatsApp!");
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado do WhatsApp"));
                }
            }
        });
        setTimeout(() => reject(new Error("Timeout conectando ao WhatsApp (15s)")), 15000);
    });

    // Cooldown de estabilização
    await new Promise(r => setTimeout(r, 2500));

    const textoComparativo = `🏛️ *ALINHAMENTO DE GESTÃO • COMUNICADO SOBRE ATUALIZAÇÃO DE CARTEIRA & REGRA DOS 7 DIAS*

Prezados,

Estruturamos duas propostas de mensagem para conscientizar e alinhar a equipe de corretores sobre a *importância da atualização contínua do funil no Imoview* e a aplicação prática da nossa *Regra dos 7 Dias* (redistribuição por SLA para garantir agilidade e follow-up com os clientes).

Vejam as duas versões abaixo para avaliação:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 *OPÇÃO 1: COMPLETA, DIDÁTICA & ORIENTATIVA*
_(Tom de liderança, explica o porquê da regra e ensina a proteger o lead agendando tarefas na agenda do CRM)_

📢 *COMUNICADO OFICIAL • GESTÃO COMERCIAL RHEMA IMÓVEIS*

Fala, time! Tudo bem? 👊🏼

Passando para alinhar um dos pilares mais importantes da nossa operação: *a agilidade de atendimento e o compromisso com o follow-up dos nossos clientes.*

O lead que chega na Rhema busca atenção, velocidade e consultoria. Quando um cliente fica dias sem contato, não é apenas uma oportunidade que esfria — é o trabalho de investimento de toda a empresa que perde tração.

Por isso, reforçamos a aplicação oficial da nossa *Regra de Permanência dos 7 Dias:*

⏱️ *Como funciona a Regra dos 7 Dias no CRM Imoview:*
• Todo lead sob sua responsabilidade precisa de *atualização constante e comprovada* (notas de feedback, ligações registradas, envio de opções ou agendamentos).
• Caso o lead complete *7 dias consecutivos sem nenhuma movimentação ou tarefa registrada*, ele entrará automaticamente na esteira de *redistribuição por SLA*.
• O lead será repassado para outro corretor da equipe com capacidade imediata de tração e fechamento.

🛡️ *Dica Importante (Cliente viajando ou retorno futuro?):*
Se o seu cliente estiver viajando, aguardando virada de mês ou com visita marcada para daqui a 10 dias, *registre a atividade futura na Agenda do CRM!* O sistema reconhece tarefas futuras e *protege o lead*, garantindo que ele continue seguro na sua carteira.

🎯 *Nosso objetivo é único:* garantir que nenhum cliente fique desassistido e que quem está com energia e cadência de atendimento tenha sempre boas oportunidades na mesa para fechar negócio.

Façam uma revisão geral nos seus funis no Imoview hoje, registrem as interações e vamos pra cima! 🚀🏠

*Brunno Anastácio — Gestão Comercial & Diretoria*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 *OPÇÃO 2: DIRETA & OBJETIVA*
_(Tom mais formal, focado direto nas regras e no senso de urgência operacional)_

⚠️ *ALINHAMENTO OPERACIONAL • ATUALIZAÇÃO DE CARTEIRA & REGRA DOS 7 DIAS*

Time, atenção a um aviso importante da gestão comercial:

A velocidade de resposta e a consistência no follow-up são os maiores fatores de conversão em vendas imobiliárias. Para mantermos nosso padrão de excelência, estamos monitorando diariamente o tempo de inatividade dos atendimentos no CRM Imoview.

📌 *Regra de Permanência de Carteira (7 Dias):*
1. Atendimentos sem qualquer registro de interação, nota ou atividade no prazo de *7 dias* serão considerados parados e entrarão em *redistribuição imediata*.
2. O objetivo é dar agilidade ao cliente e garantir que as oportunidades circulem para quem está pronto para avançar.
3. Se você tem alinhamento futuro com o cliente, certifique-se de que a *tarefa/visita esteja agendada no CRM* para preservar o lead na sua carteira.

Reservem um momento hoje para auditar seus atendimentos e atualizar o status de cada cliente. 

Contamos com o profissionalismo e a dedicação de todos! 👊🏼

*Diretoria Comercial • Rhema Imóveis*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗳️ *Por favor, votem na enquete abaixo para definirmos a versão que será enviada à equipe!* 👇🏼`;

    console.log(`[PASSO 1] Enviando texto com as duas versões para o Grupo da Diretoria (${GRUPO_DIRETORIA})...`);
    const sentTexto = await socket.sendMessage(GRUPO_DIRETORIA, { text: textoComparativo });
    console.log(`[TEXTO ENVIADO] Key ID: ${sentTexto?.key?.id}`);

    // Persistir no banco Prisma
    try {
        const dbSession = await prisma.session.findUnique({ where: { sessionId: SESSION_ID } });
        if (dbSession) {
            await prisma.message.create({
                data: {
                    sessionId: dbSession.id,
                    remoteJid: GRUPO_DIRETORIA,
                    senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                    fromMe: true,
                    keyId: sentTexto?.key?.id || `NOTIF_${Date.now()}`,
                    pushName: "Brunno Anastacio",
                    type: "TEXT" as any,
                    content: textoComparativo,
                    status: "SENT",
                    timestamp: new Date()
                }
            });
        }
    } catch (e: any) {
        console.warn("[AVISO BANCO TEXTO]", e.message);
    }

    // Cooldown de 3.5 segundos entre mensagens
    console.log("[COOLDOWN] Aguardando 3.5s antes da enquete...");
    await new Promise(r => setTimeout(r, 3500));

    // Enviar a Enquete Oficial
    console.log(`[PASSO 2] Enviando Enquete de Votação...`);
    const pollMessage = {
        poll: {
            name: "Qual versão da mensagem você aprova para os corretores?",
            values: [
                "Opção 1: Didática & Orientativa",
                "Opção 2: Direta & Objetiva",
                "Precisa de ajustes / Outra"
            ],
            selectableCount: 1
        }
    };

    const sentPoll = await socket.sendMessage(GRUPO_DIRETORIA, pollMessage);
    console.log(`[ENQUETE ENVIADA] Key ID: ${sentPoll?.key?.id}`);

    // Persistir enquete no banco Prisma
    try {
        const dbSession = await prisma.session.findUnique({ where: { sessionId: SESSION_ID } });
        if (dbSession) {
            await prisma.message.create({
                data: {
                    sessionId: dbSession.id,
                    remoteJid: GRUPO_DIRETORIA,
                    senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                    fromMe: true,
                    keyId: sentPoll?.key?.id || `POLL_${Date.now()}`,
                    pushName: "Brunno Anastacio",
                    type: "TEXT" as any,
                    content: "[ENQUETE: Qual versão da mensagem você aprova para os corretores?]",
                    status: "SENT",
                    timestamp: new Date()
                }
            });
        }
    } catch (e: any) {
        console.warn("[AVISO BANCO ENQUETE]", e.message);
    }

    await new Promise(r => setTimeout(r, 2000));
    socket.end(undefined);
    console.log("[SUCESSO TOTAL] Mensagem e Enquete entregues no Grupo da Diretoria!");
}

run().catch((err) => {
    console.error("[ERRO DISPARO DIRETORIA]", err);
    process.exit(1);
});
