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

const TEMPLATE_ADM = `{Olá|Oi}, {nome}! {Tudo bem?|Tudo bem com você?}

{Passando aqui para pedir uma força rápida e muito importante|Dando uma passada rápida para te convidar para uma ação simples de engajamento|Brunno aqui com um pedido rápido e estratégico}:

Temos 3 novos corretores chegando para somar com a nossa equipe no grupo *Time Rhema*: a *Karla*, o *André* e o *Ulisses*! 👏

{Se puder, dá uma passadinha rápida lá no grupo *🚀 Time Rhema* e manda uma mensagem calorosa de boas-vindas para eles!|Dá um pulo lá no grupo *🚀 Time Rhema* para deixar um recado acolhedor de boas-vindas aos novos corretores!|Passa lá no grupo *🚀 Time Rhema* e deixa aquela mensagem bacana de boas-vindas!}

Essa presença e apoio de vocês do administrativo e diretoria faz toda a diferença para acolher os novos integrantes, integrar a equipe e esquentar o engajamento de todos os corretores! 🎯🤝

{Conto com você! Tamo junto!|Bora movimentar essa equipe! Conto contigo!|Valeu pelo apoio de sempre, tamo junto!} 🚀

Abraço,  
*Brunno Anastácio*`;

const ADM_RECIPIENTS = [
    { name: "Ana Maria", phone: "5513991673717", role: "Diretoria" },
    { name: "Miguel", phone: "5513991368031", role: "Diretoria" },
    { name: "Nice", phone: "5513997787173", role: "Gerente ADM" },
    { name: "Camila", phone: "5513991588225", role: "Recepção" },
    { name: "Kaylane", phone: "5513992123879", role: "Aux. ADM" },
    { name: "Time ADM", phone: "5513991488850", role: "Central ADM" }
];

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomDelay(minSec = 15, maxSec = 45) {
    return Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
}

async function run() {
    console.log("=== INICIANDO DISPARO PARA A DIRETORIA E ADM (ENGAJAMENTO NO TIME RHEMA) ===");

    const dbSession = await prisma.session.findUnique({
        where: { sessionId: SESSION_ID }
    });
    if (!dbSession) throw new Error("Sessão não encontrada no banco");

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
                console.log("[OK] Conectado ao WhatsApp!");
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado"));
                }
            }
        });
    });

    for (let i = 0; i < ADM_RECIPIENTS.length; i++) {
        const item = ADM_RECIPIENTS[i];
        console.log(`\n[${i + 1}/${ADM_RECIPIENTS.length}] Preparando envio para: ${item.name} (${item.phone}) [${item.role}]`);

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

        const personalized = TEMPLATE_ADM.replace(/\{nome\}/g, item.name);
        const finalMessage = parseSpintax(personalized);

        try {
            const sent = await socket.sendMessage(targetJid, { text: finalMessage });
            console.log(`  ✅ [ENVIADO COM SUCESSO] ${item.name} recebeu! Key ID: ${sent?.key?.id}`);

            // Gravar no histórico do banco
            try {
                await prisma.message.create({
                    data: {
                        sessionId: dbSession.id,
                        remoteJid: targetJid,
                        senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                        fromMe: true,
                        keyId: sent?.key?.id || `ADM_ENGAGE_${Date.now()}_${i}`,
                        pushName: "Brunno Anastácio",
                        type: "TEXT",
                        content: finalMessage,
                        status: "SENT",
                        timestamp: new Date()
                    }
                });
            } catch (e) {}

        } catch (err) {
            console.error(`  ❌ [FALHA] Não foi possível enviar para ${item.name}:`, err);
        }

        if (i < ADM_RECIPIENTS.length - 1) {
            const delaySec = getRandomDelay(15, 45);
            console.log(`  ⏳ Aguardando ${delaySec} segundos para o próximo envio (anti-spam)...`);
            await sleep(delaySec * 1000);
        }
    }

    console.log("\n🎉 === TODOS OS MEMBROS DO ADM/DIRETORIA RECEBERAM A MENSAGEM! ===");
    await sleep(3000);
    process.exit(0);
}

run().catch((err) => {
    console.error("Erro fatal:", err);
    process.exit(1);
});
