import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";

function parseSpintax(text: string): string {
    const regex = /\{([^{}]+)\}/g;
    let result = text;
    while (regex.test(result)) {
        result = result.replace(regex, (_, choices) => {
            const options = choices.split('|');
            return options[Math.floor(Math.random() * options.length)];
        });
    }
    return result;
}

const TEMPLATE_CRECI = `{Olá|Oi|Fala}, {nome}! {Tudo bem por aí?|Tudo bem com você?|Como você tá?}

{Passando aqui para um alinhamento rápido e trazer uma novidade importante|Dando uma passada rápida com novidades e alinhamentos essenciais da equipe|Brunno aqui! Um recadinho rápido com novidades importantes} sobre o *Imoview* e a nossa rotina:

📲 *1. Atualização: Liberação do Telefone do Proprietário!*
{Fizemos uma atualização importante no sistema liberando o telefone direto do proprietário para vocês!|Liberamos agora o acesso ao contato telefônico do proprietário diretamente no sistema!|Temos uma excelente novidade: o telefone do proprietário já está liberado!}
{Essa melhoria foi feita especialmente para agilizar o agendamento de visitas, dar mais autonomia à equipe e aumentar a nossa eficiência e velocidade de atendimento.|O objetivo é desengargalar e acelerar o processo de agendamento de visitas com o proprietário, tornando nosso time muito mais ágil e competitivo!}

📋 *2. Qualidade dos Cadastros no Imoview (Atenção redobrada):*
Para que nossas ferramentas e filtros funcionem com máxima precisão, precisamos muito do capricho de vocês nestes pontos:

🚗 *Vagas de Garagem:* {Muita atenção ao cadastrar|Sempre informem com exatidão}: quando for vaga coletiva, especifiquem se é *suficiente* ou *insuficiente*. Isso evita surpresas e dúvidas na hora da visita!
🏢 *Andar do Imóvel:* {Atenção para cadastrar o andar exato|Não deixem de informar o andar correto}: dado fundamental para o cruzamento de informações e apresentação da unidade.
🌅 *Varanda vs. Sacada:* {Cuidado na diferenciação entre Varanda e Sacada|Muita atenção na distinção de Varanda e Sacada}: marcar a opção certa é essencial para o imóvel ser localizado nos *filtros avançados do Radar*!

💡 *Lembrando:* {cadastros padronizados somados ao contato direto com o proprietário vão nos permitir agendar muito mais visitas e fechar negócios mais rápido.|quanto mais precisa for a nossa base no Imoview, mais assertivo fica o match com clientes no Radar e mais ágil fica a nossa rotina!}

{Bora aproveitar essas melhorias para acelerar as visitas e arrebentar nas vendas! Tamo junto!|Conto com o apoio de vocês para mantermos o sistema impecável. Qualquer dúvida, estou por aqui!|Vamos pra cima lotar a agenda de visitas com essas novidades! Contem comigo!} 🚀

Abraço,
*Brunno Anastácio*`;

const TEMPLATE_NO_CRECI = `{Olá|Oi|Fala}, {nome}! {Tudo bem por aí?|Tudo bem com você?|Como você tá?}

{Passando aqui para um alinhamento rápido e muito importante|Dando uma passada rápida para alinhar alguns pontos essenciais|Brunno aqui! Um recadinho rápido da equipe} sobre a qualidade dos cadastros de imóveis no *Imoview*:

📋 *Pontos de Atenção nos Cadastros (Imoview):*
Para que nossas ferramentas, filtros e cruzamentos funcionem com máxima eficiência, precisamos muito do capricho de vocês nestes detalhes:

🚗 *Vagas de Garagem:* {Muita atenção ao preencher|Sempre verifiquem com cuidado}: quando a vaga for coletiva, especifiquem certinho se é *suficiente* ou *insuficiente*. Isso evita retrabalho e dúvidas com o cliente!
🏢 *Andar do Imóvel:* {Atenção para cadastrar o andar correto|Não deixem de informar o andar exato}: é um dado indispensável para a apresentação da unidade e para o sistema.
🌅 *Varanda vs. Sacada:* {Cuidado na diferenciação entre Varanda e Sacada|Muita atenção na distinção de Varanda e Sacada}: marcar a opção exata faz toda a diferença para o imóvel aparecer corretamente nos *filtros avançados do Radar*!

💡 *Por que isso é tão importante?*
{Um cadastro bem detalhado e padronizado agiliza os nossos atendimentos, valoriza o estoque e facilita muito o match de clientes no Radar.|Quanto mais preciso for o cadastro no Imoview, mais rápido a gente localiza as opções ideais e ganha tempo nas negociações!}

{Conto com a atenção de vocês! Qualquer dúvida sobre como preencher, fico à disposição.|Bora manter essa base redondinha pra gente acelerar os atendimentos e vendas! Tamo junto!|Qualquer dúvida, pode me chamar!} 🚀

Abraço,
*Brunno Anastácio*`;

interface Recipient {
    name: string;
    phone: string;
    hasCreci: boolean;
}

const RECIPIENTS: Recipient[] = [
    { name: "Flávia", phone: "5515974042000", hasCreci: true },
    { name: "Tatiana", phone: "5513981854677", hasCreci: true },
    { name: "André", phone: "5513981404451", hasCreci: false },
    { name: "Elaine", phone: "5513976008877", hasCreci: true },
    { name: "Karla", phone: "5513997744475", hasCreci: false },
    { name: "Andressa", phone: "5513981512755", hasCreci: false },
    { name: "Ulisses", phone: "5513988181515", hasCreci: true },
    { name: "Leniara", phone: "5513996461664", hasCreci: true },
];

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelay(minSec = 15, maxSec = 75) {
    return Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
}

async function connectToWhatsApp(): Promise<any> {
    const { state, saveCreds } = await usePrismaAuthState(SESSION_ID);
    const { version } = await fetchLatestBaileysVersion();

    return new Promise((resolve, reject) => {
        let isResolved = false;

        function connect() {
            console.log("Estabelecendo conexão socket com o WhatsApp...");
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

            socket.ev.on("connection.update", (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    console.log("[AVISO] QR Code solicitado pelo servidor.");
                }
                if (connection === "open") {
                    console.log("[OK] Conexão com o WhatsApp aberta e autenticada!");
                    if (!isResolved) {
                        isResolved = true;
                        resolve(socket);
                    }
                } else if (connection === "close") {
                    const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                    console.log(`[INFO] Conexão fechada (statusCode: ${statusCode}).`);
                    if (statusCode === DisconnectReason.loggedOut) {
                        if (!isResolved) {
                            reject(new Error("Instância desconectada (Logged Out / 401)."));
                        }
                    } else {
                        if (!isResolved) {
                            console.log("[INFO] Reconectando em 2 segundos...");
                            setTimeout(connect, 2000);
                        }
                    }
                }
            });
        }

        connect();
    });
}

async function run() {
    console.log("=== INICIANDO DISPARO DO COMUNICADO PARA CORRETORES ===");
    console.log(`Instância: ${SESSION_ID}`);
    console.log(`Total de corretores: ${RECIPIENTS.length}`);

    const dbSession = await prisma.session.findUnique({
        where: { sessionId: SESSION_ID }
    });
    if (!dbSession) {
        throw new Error(`Sessão ${SESSION_ID} não encontrada no banco de dados.`);
    }

    const socket = await connectToWhatsApp();
    console.log(`Conectado como: ${socket.user?.id || socket.user?.name || "OK"}`);

    await prisma.session.update({
        where: { sessionId: SESSION_ID },
        data: { status: "CONNECTED", qr: null }
    });

    console.log("\n--- INICIANDO ENVIOS COM INTERVALO RANDÔMICO (15s a 75s) ---");

    for (let i = 0; i < RECIPIENTS.length; i++) {
        const item = RECIPIENTS[i];
        console.log(`\n[${i + 1}/${RECIPIENTS.length}] Preparando envio para: ${item.name} (${item.phone}) [CRECI: ${item.hasCreci ? "SIM" : "NÃO"}]`);

        // Check on WhatsApp
        let targetJid = `${item.phone}@s.whatsapp.net`;
        try {
            const check = await socket.onWhatsApp(item.phone);
            if (check && check.length > 0 && check[0]?.exists) {
                targetJid = check[0].jid;
                console.log(`  -> JID validado no WhatsApp: ${targetJid}`);
            } else {
                console.log(`  -> JID padrão utilizado: ${targetJid}`);
            }
        } catch (e) {
            console.warn(`  -> Não foi possível verificar via onWhatsApp, usando ${targetJid}`);
        }

        // Escolha do template
        const baseTemplate = item.hasCreci ? TEMPLATE_CRECI : TEMPLATE_NO_CRECI;
        const personalized = baseTemplate.replace(/\{nome\}/g, item.name);
        const finalMessage = parseSpintax(personalized);

        try {
            console.log(`  -> Enviando mensagem...`);
            const sent = await socket.sendMessage(targetJid, { text: finalMessage });
            console.log(`  [SUCESSO] Mensagem enviada para ${item.name}! Key ID: ${sent?.key?.id}`);

            // Salvar no banco para histórico do sistema
            try {
                await prisma.message.create({
                    data: {
                        sessionId: dbSession.id,
                        remoteJid: targetJid,
                        senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                        fromMe: true,
                        keyId: sent?.key?.id || `COMM_${Date.now()}_${i}`,
                        pushName: "Brunno Anastácio",
                        type: "TEXT",
                        content: finalMessage,
                        status: "SENT",
                        timestamp: new Date()
                    }
                });
            } catch (dbErr) {
                // não bloqueia o envio caso falhe apenas o registro
                console.warn(`  -> Aviso: Mensagem enviada, mas não gravou no DB local:`, dbErr);
            }

        } catch (sendError) {
            console.error(`  [ERRO] Falha ao enviar para ${item.name} (${item.phone}):`, sendError);
        }

        // Delay para o próximo envio (se não for o último)
        if (i < RECIPIENTS.length - 1) {
            const delaySec = getRandomDelay(15, 75);
            console.log(`  ⏳ Aguardando ${delaySec} segundos antes do próximo envio (anti-spam)...`);
            await sleep(delaySec * 1000);
        }
    }

    console.log("\n=== DISPARO CONCLUÍDO COM SUCESSO PARA TODOS OS CORRETORES ===");
    await sleep(3000);
    process.exit(0);
}

run().catch((err) => {
    console.error("FATAL ERROR NO DISPARO:", err);
    process.exit(1);
});
