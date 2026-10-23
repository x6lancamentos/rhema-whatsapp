import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";
const GROUP_JID = "120363410557904743@g.us"; // Vamos Orar #01 🇧🇷

async function run() {
    console.log("=== ENVIANDO AVISO E ENQUETE NO GRUPO VAMOS ORAR ===");

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

    console.log(`Buscando participantes do grupo: ${GROUP_JID}...`);
    const groupMeta = await socket.groupMetadata(GROUP_JID);
    const allParticipantJids = groupMeta.participants.map(p => p.id);
    console.log(`Grupo: "${groupMeta.subject}", Total de membros a mencionar: ${allParticipantJids.length}`);

    // 1. Mensagem de texto com menção a todos
    const announcementText = `🕊️ *RETOMADA DOS NOSSOS ENCONTROS DE ORAÇÃO ONLINE!* 🙏✨

A paz do Senhor, amados! Como vocês estão?

Estamos nos organizando para retomar com muita alegria e propósito os nossos momentos de oração, clamor e comunhão online!

Queremos ouvir cada um de vocês para definir o melhor dia fixo na nossa semana para nos reunirmos (sempre às 22h).

Por favor, votem na enquete abaixo com a sua preferência: 👇`;

    console.log("1. Enviando mensagem de aviso com menção a todos os membros...");
    const sentText = await socket.sendMessage(GROUP_JID, {
        text: announcementText,
        mentions: allParticipantJids
    });
    console.log(`  ✅ Aviso enviado! Key ID: ${sentText?.key?.id}`);

    // Gravar mensagem no banco
    try {
        await prisma.message.create({
            data: {
                sessionId: dbSession.id,
                remoteJid: GROUP_JID,
                senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                fromMe: true,
                keyId: sentText?.key?.id || `VO_NOTICE_${Date.now()}`,
                pushName: "Pr. Brunno Anastácio",
                type: "TEXT",
                content: announcementText,
                status: "SENT",
                timestamp: new Date()
            }
        });
    } catch (e) {}

    // Aguardar 3 segundos para a enquete entrar logo abaixo
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. Enviar a enquete oficial interativa
    console.log("2. Enviando enquete interativa...");
    const sentPoll = await socket.sendMessage(GROUP_JID, {
        poll: {
            name: "Qual o melhor dia para nosso encontro de oração às 22h?",
            values: [
                "Segunda-feira às 22h",
                "Quarta-feira às 22h"
            ],
            selectableCount: 1
        }
    });
    console.log(`  ✅ Enquete enviada com sucesso! Key ID: ${sentPoll?.key?.id}`);

    try {
        await prisma.message.create({
            data: {
                sessionId: dbSession.id,
                remoteJid: GROUP_JID,
                senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                fromMe: true,
                keyId: sentPoll?.key?.id || `VO_POLL_${Date.now()}`,
                pushName: "Pr. Brunno Anastácio",
                type: "TEXT",
                content: "Qual o melhor dia para nosso encontro de oração às 22h?\n1. Segunda-feira às 22h\n2. Quarta-feira às 22h",
                status: "SENT",
                timestamp: new Date()
            }
        });
    } catch (e) {}

    console.log("\n🎉 === AVISO E ENQUETE ENVIADOS COM SUCESSO! ===");
    setTimeout(() => process.exit(0), 1000);
}

run().catch((err) => {
    console.error("Erro fatal:", err);
    process.exit(1);
});
