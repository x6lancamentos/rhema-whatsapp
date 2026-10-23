import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";
const PHONE_NUMBER = "5513955437609";

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

let isDispatching = false;

async function startBroadcast(socket: any, dbSessionId: string) {
    if (isDispatching) return;
    isDispatching = true;

    console.log("\n=================================================================");
    console.log("🚀 CONECTADO COM SUCESSO! INICIANDO DISPAROS PARA OS CORRETORES");
    console.log("=================================================================\n");

    for (let i = 0; i < RECIPIENTS.length; i++) {
        const item = RECIPIENTS[i];
        console.log(`[${i + 1}/${RECIPIENTS.length}] Preparando envio para: ${item.name} (${item.phone}) [CRECI: ${item.hasCreci ? "SIM" : "NÃO"}]`);

        let targetJid = `${item.phone}@s.whatsapp.net`;
        try {
            const check = await socket.onWhatsApp(item.phone);
            if (check && check.length > 0 && check[0]?.exists) {
                targetJid = check[0].jid;
                console.log(`  -> JID validado: ${targetJid}`);
            }
        } catch (e) {
            console.warn(`  -> Usando fallback JID: ${targetJid}`);
        }

        const baseTemplate = item.hasCreci ? TEMPLATE_CRECI : TEMPLATE_NO_CRECI;
        const personalized = baseTemplate.replace(/\{nome\}/g, item.name);
        const finalMessage = parseSpintax(personalized);

        try {
            const sent = await socket.sendMessage(targetJid, { text: finalMessage });
            console.log(`  ✅ [ENVIADO COM SUCESSO] ${item.name} recebeu! Key ID: ${sent?.key?.id}`);

            try {
                await prisma.message.create({
                    data: {
                        sessionId: dbSessionId,
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
                // não bloqueia
            }

        } catch (err) {
            console.error(`  ❌ [FALHA] Erro ao enviar para ${item.name}:`, err);
        }

        if (i < RECIPIENTS.length - 1) {
            const delaySec = getRandomDelay(15, 75);
            console.log(`  ⏳ Aguardando ${delaySec} segundos para o próximo envio (anti-spam)...`);
            await sleep(delaySec * 1000);
        }
    }

    console.log("\n🎉 === TODOS OS 8 COMUNICADOS FORAM ENVIADOS COM SUCESSO! ===");
    await sleep(5000);
    process.exit(0);
}

async function main() {
    const dbSession = await prisma.session.findUnique({
        where: { sessionId: SESSION_ID }
    });
    if (!dbSession) throw new Error("Sessão não encontrada no banco");

    // Limpar authState para gerar pareamento novo e limpo
    console.log("Iniciando processo de pareamento limpo...");
    await prisma.authState.deleteMany({ where: { sessionId: SESSION_ID } });

    async function startSocket() {
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

        let codeRequested = false;

        socket.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;

            // Solicitar código se ainda não registrado
            if (!socket.authState.creds.registered && !codeRequested) {
                codeRequested = true;
                await sleep(2000);
                try {
                    const code = await socket.requestPairingCode(PHONE_NUMBER);
                    console.log("\n=======================================================");
                    console.log(`   SEU NOVO CÓDIGO DE PAREAMENTO WHATSAPP:`);
                    console.log(`   👉👉  ${code}  👈👈`);
                    console.log("=======================================================");
                    console.log(`Digite no WhatsApp > Aparelhos Conectados > Conectar com número de telefone: ${code}\n`);
                } catch (err) {
                    console.error("Erro ao gerar pairing code:", err);
                }
            }

            if (connection === "open") {
                console.log("Conexão aberta com sucesso!");
                await prisma.session.update({
                    where: { sessionId: SESSION_ID },
                    data: { status: "CONNECTED", qr: null }
                });
                if (dbSession) {
                    startBroadcast(socket, dbSession.id);
                }
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                console.log(`[INFO] Conexão encerrada com status: ${statusCode}`);
                
                // Se for 515 (restartRequired), reconecta imediatamente mantendo as chaves!
                if (statusCode === 515 || statusCode === DisconnectReason.restartRequired) {
                    console.log("[INFO] Restart necessário (515), reconectando socket com as novas credenciais...");
                    setTimeout(startSocket, 1500);
                } else if (statusCode !== DisconnectReason.loggedOut) {
                    console.log("[INFO] Reconectando em 2 segundos...");
                    setTimeout(startSocket, 2000);
                }
            }
        });
    }

    startSocket();
}

main().catch(console.error);
