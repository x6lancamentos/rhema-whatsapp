import fs from "fs";
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
const IMAGE_PATH = path.resolve(__dirname, "../../Sistema Rhema - Imoview/relatorios/convite_thiago_baroni_gm.jpg");

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

interface BrokerRecipient {
    nome: string;
    apelido: string;
    phone: string;
    jid: string;
}

const BROKERS: BrokerRecipient[] = [
    { nome: "Andressa Larocca Orlandi Pereira", apelido: "Andressa", phone: "5513981512755", jid: "5513981512755@s.whatsapp.net" },
    { nome: "Flávia Mara de Mattos", apelido: "Flávia", phone: "5515974042000", jid: "5515974042000@s.whatsapp.net" },
    { nome: "Tatiana Gonçalves de Oliveira", apelido: "Tatiana", phone: "5513981854677", jid: "5513981854677@s.whatsapp.net" },
    { nome: "Elaine do Nascimento", apelido: "Elaine", phone: "5513976008877", jid: "5513976008877@s.whatsapp.net" },
    { nome: "Ulisses Dias Vieira", apelido: "Ulisses", phone: "5513988181515", jid: "5513988181515@s.whatsapp.net" },
    { nome: "André Felipe O. Cavalcante", apelido: "André", phone: "5513981404451", jid: "5513981404451@s.whatsapp.net" },
    { nome: "Leniára R. M. Araújo", apelido: "Leniara", phone: "5513996461664", jid: "5513996461664@s.whatsapp.net" },
    { nome: "Roseli de Carvalho Lopes", apelido: "Roseli", phone: "5513974103368", jid: "5513974103368@s.whatsapp.net" },
    { nome: "Georjana Garcia Gonçalves", apelido: "Georjana", phone: "5512991797436", jid: "5512991797436@s.whatsapp.net" }
];

const GROUPS = [
    { nome: "Avisos Rhema", jid: "120363417825887441@g.us" },
    { nome: "🚀 Time Rhema", jid: "120363427965736363@g.us" }
];

function generateBrokerMessage(apelido: string): string {
    const template = `{Fala|Olá|Oi}, ${apelido}! {Tudo bem?|Como estão as coisas?|Espero que você esteja ótimo(a)!} 🚀

{Passando aqui para trazer um anúncio estratégico e de altíssimo impacto|Passando para te dar uma notícia imperdível para os nossos negócios|Brunno aqui com um alinhamento fundamental} para este fechamento de ano e preparação de mercado:

📅 *SAVE THE DATE: 19 DE NOVEMBRO DE 2026*

Com a chegada dos novos corretores na casa e o atual cenário político e econômico, nós *bloqueamos com exclusividade a agenda do Thiago Baroni (GM Financiamento Imobiliário)* para vir presencialmente até a Rhema Imóveis ministrar um treinamento imersivo para a nossa equipe!

🎯 *Principais Pilares do Encontro:*
• *Cenário & Tendências:* A influência do momento político e econômico no mercado imobiliário para os próximos anos.
• *Crédito como Alavanca:* Como utilizar o financiamento bancário para destravar clientes indecisos e acelerar o fechamento de vendas.
• *Ferramentas Práticas:* Quebra de objeções sobre taxas, aprovações e condução ágil do processo de crédito.

⏰ *Horários e Programação Detalhada:* Serão enviados nos próximos dias.

Trave esta data na sua agenda! A participação de toda a equipe é indispensável para alinharmos estratégias e acelerarmos nossos resultados.

Bora pra cima! 🚀💪

*Brunno Anastácio* | Diretoria Comercial Rhema Imóveis`;
    return parseSpintax(template);
}

function generateGroupMessage(): string {
    return `📢🔥 *COMUNICADO OFICIAL & SAVE THE DATE — RHEMA IMÓVEIS* 🔥📢

Fala, Time Rhema! 🚀

Diante do momento político e econômico que o nosso país e o mercado imobiliário estão vivenciando, e com os novos corretores integrando a nossa equipe, nós *bloqueamos a agenda do Thiago Baroni (GM Financiamento Imobiliário)* para vir presencialmente até a Rhema!

📅 *DATA:* 19 de Novembro de 2026
📍 *LOCAL:* Sede Rhema Imóveis
🎯 *TEMA:* Crédito Imobiliário, Mercado & a Influência Política e Econômica para os Próximos Anos

💡 *Por que este treinamento é fundamental para todos nós?*
O crédito imobiliário é o maior motor de vendas do setor. Compreender o cenário econômico, as projeções políticas e dominar os caminhos de financiamento é o que separa um atendimento travado de um negócio fechado!

Travem essa data agora mesmo em suas agendas! Os horários e a grade do encontro serão confirmados em breve.

Contamos com 100% da presença e energia de todo o time comercial. Vamos juntos transformar conhecimento em vendas! 🚀💪

*Brunno Anastácio* | Diretoria Rhema Imóveis`;
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectToWhatsApp(): Promise<any> {
    const { state, saveCreds } = await usePrismaAuthState(SESSION_ID);
    const { version } = await fetchLatestBaileysVersion();

    return new Promise((resolve, reject) => {
        let isResolved = false;

        function connect() {
            console.log("🔌 Conectando socket Baileys ao WhatsApp...");
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
                const { connection, lastDisconnect } = update;
                if (connection === "open") {
                    console.log("✅ [OK] Conexão Baileys aberta e autenticada com sucesso!");
                    if (!isResolved) {
                        isResolved = true;
                        resolve(socket);
                    }
                } else if (connection === "close") {
                    const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                    console.log(`⚠️ Conexão fechada (statusCode: ${statusCode}).`);
                    if (statusCode === DisconnectReason.loggedOut) {
                        if (!isResolved) reject(new Error("Instância desconectada (Logged Out / 401)."));
                    } else {
                        if (!isResolved) {
                            console.log("🔄 Tentando reconectar em 2 segundos...");
                            setTimeout(connect, 2000);
                        }
                    }
                }
            });
        }

        connect();
    });
}

async function main() {
    console.log("=========================================================");
    console.log("🚀 DISPARO OFICIAL DE SAVE THE DATE — THIAGO BARONI (GM)");
    console.log("=========================================================\n");

    if (!fs.existsSync(IMAGE_PATH)) {
        throw new Error(`Imagem do convite não encontrada em: ${IMAGE_PATH}`);
    }

    const dbSession = await prisma.session.findUnique({
        where: { sessionId: SESSION_ID }
    });
    if (!dbSession) throw new Error("Sessão avg78n não encontrada no banco");

    // Preparar buffer e Base64 Data URI conforme regra de compliance
    const imgBuffer = fs.readFileSync(IMAGE_PATH);
    const imgBase64 = imgBuffer.toString("base64");
    const dataUri = `data:image/jpeg;base64,${imgBase64}`;
    console.log(`📸 Imagem carregada: ${IMAGE_PATH} (${(imgBuffer.length / 1024).toFixed(1)} KB)`);

    const socket = await connectToWhatsApp();
    console.log(`👤 Socket ativo como: ${socket.user?.id || "avg78n"}`);

    // Estabilização inicial de canal
    console.log("⏳ Aguardando 3,5s de estabilização do canal...");
    await sleep(3500);

    const relatorioEnvio: any[] = [];

    // 1. Envio para os 9 Corretores Individuais
    console.log(`\n--- FASE 1: DISPARO INDIVIDUAL PARA ${BROKERS.length} CORRETORES ---`);
    for (let i = 0; i < BROKERS.length; i++) {
        const broker = BROKERS[i];
        const caption = generateBrokerMessage(broker.apelido);
        console.log(`\n[${i + 1}/${BROKERS.length}] Enviando para ${broker.nome} (${broker.phone})...`);

        try {
            const sent = await socket.sendMessage(broker.jid, {
                image: { url: dataUri },
                caption: caption
            });

            console.log(`  ✅ [SUCESSO] Entregue para ${broker.apelido}! Key ID: ${sent?.key?.id}`);
            relatorioEnvio.push({
                tipo: "CORRETOR",
                nome: broker.nome,
                destino: broker.phone,
                status: "ENTREGUE",
                keyId: sent?.key?.id,
                timestamp: new Date().toISOString()
            });

            // Persistência auditada no banco Prisma
            try {
                await prisma.message.create({
                    data: {
                        sessionId: dbSession.id,
                        remoteJid: broker.jid,
                        senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                        fromMe: true,
                        keyId: sent?.key?.id || `IMG_${Date.now()}_${i}`,
                        pushName: "Brunno Anastácio",
                        type: "IMAGE",
                        content: `[IMAGEM: convite_thiago_baroni_gm.jpg] ${caption}`,
                        status: "SENT",
                        timestamp: new Date()
                    }
                });
            } catch (e: any) {
                console.warn("  ⚠️ [AVISO PRISMA]", e.message);
            }
        } catch (err: any) {
            console.error(`  ❌ [FALHA] Erro ao enviar para ${broker.nome}:`, err.message);
            relatorioEnvio.push({
                tipo: "CORRETOR",
                nome: broker.nome,
                destino: broker.phone,
                status: "ERRO",
                erro: err.message,
                timestamp: new Date().toISOString()
            });
        }

        // Cooldown seguro anti-ban e estabilização de media_conn (4 segundos)
        if (i < BROKERS.length - 1) {
            console.log("  ⏱️ Cooldown de 4s...");
            await sleep(4000);
        }
    }

    // Cooldown entre envio individual e grupos
    console.log("\n⏳ Aguardando 5s para iniciar disparo nos grupos...");
    await sleep(5000);

    // 2. Envio para os Grupos Oficiais
    console.log(`\n--- FASE 2: DISPARO PARA ${GROUPS.length} GRUPOS OFICIAIS ---`);
    const groupCaption = generateGroupMessage();

    for (let j = 0; j < GROUPS.length; j++) {
        const grp = GROUPS[j];
        console.log(`\n[${j + 1}/${GROUPS.length}] Enviando para grupo: ${grp.nome} (${grp.jid})...`);

        try {
            const sent = await socket.sendMessage(grp.jid, {
                image: { url: dataUri },
                caption: groupCaption
            });

            console.log(`  ✅ [SUCESSO] Entregue para grupo ${grp.nome}! Key ID: ${sent?.key?.id}`);
            relatorioEnvio.push({
                tipo: "GRUPO",
                nome: grp.nome,
                destino: grp.jid,
                status: "ENTREGUE",
                keyId: sent?.key?.id,
                timestamp: new Date().toISOString()
            });

            try {
                await prisma.message.create({
                    data: {
                        sessionId: dbSession.id,
                        remoteJid: grp.jid,
                        senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                        fromMe: true,
                        keyId: sent?.key?.id || `GRP_IMG_${Date.now()}_${j}`,
                        pushName: "Brunno Anastácio",
                        type: "IMAGE",
                        content: `[IMAGEM: convite_thiago_baroni_gm.jpg] ${groupCaption}`,
                        status: "SENT",
                        timestamp: new Date()
                    }
                });
            } catch (e: any) {
                console.warn("  ⚠️ [AVISO PRISMA]", e.message);
            }
        } catch (err: any) {
            console.error(`  ❌ [FALHA] Erro ao enviar para grupo ${grp.nome}:`, err.message);
            relatorioEnvio.push({
                tipo: "GRUPO",
                nome: grp.nome,
                destino: grp.jid,
                status: "ERRO",
                erro: err.message,
                timestamp: new Date().toISOString()
            });
        }

        if (j < GROUPS.length - 1) {
            console.log("  ⏱️ Cooldown de 4s...");
            await sleep(4000);
        }
    }

    // Salvar log auditado de disparo
    const logPath = path.resolve(__dirname, "../../Sistema Rhema - Imoview/scratch/log_disparo_save_the_date.json");
    fs.writeFileSync(logPath, JSON.stringify(relatorioEnvio, null, 2), "utf8");
    console.log(`\n📊 Log da operação salvo em: ${logPath}`);

    console.log("\n=========================================================");
    console.log("🎉 DISPARO CONCLUÍDO COM SUCESSO!");
    console.log("=========================================================");

    await sleep(2000);
    socket.end(undefined);
    process.exit(0);
}

main().catch(err => {
    console.error("ERRO FATAL:", err);
    process.exit(1);
});
