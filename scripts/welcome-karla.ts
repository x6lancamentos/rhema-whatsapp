import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";
const GROUP_JID = "120363427965736363@g.us"; // 🚀 Time Rhema
const KARLA_PHONE = "5513997744475";

async function run() {
    console.log("=== ENVIANDO MENSAGEM DE BOAS-VINDAS PARA KARLA COM MENÇÃO A TODOS ===");

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

    // 1. Obter metadados do grupo e participantes
    console.log("Obtendo participantes do grupo para menção geral...");
    const groupMeta = await socket.groupMetadata(GROUP_JID);
    const participants = groupMeta.participants;
    console.log(`Grupo: "${groupMeta.subject}", Total de membros: ${participants.length}`);

    // Extrair todos os JIDs dos participantes para notificar a todos
    const allMentionJids = participants.map((p: any) => p.id);

    // Identificar a Karla especificamente
    const karlaParticipant = participants.find((p: any) => 
        p.id.includes(KARLA_PHONE) || 
        (p.phoneNumber && p.phoneNumber.includes(KARLA_PHONE)) ||
        p.id === "92457878446286@lid"
    );

    const karlaTagJid = karlaParticipant ? karlaParticipant.id : `${KARLA_PHONE}@s.whatsapp.net`;
    const karlaTagDisplay = `@${KARLA_PHONE}`;

    // Montar texto de boas-vindas caloroso e profissional
    const welcomeMessage = `🎉 *BEM-VINDA AO TIME RHEMA, KARLA!* 🚀

Equipe, vamos dar as boas-vindas para a ${karlaTagDisplay}, nossa nova integrante que chega para somar com a gente! 👏

Karla, seja muito bem-vinda à família Rhema! Desejamos muito sucesso, foco e grandes realizações nessa nova jornada. Conte com todos nós para o que precisar no seu dia a dia!

Bora pra cima! 🎯🚀`;

    console.log("Enviando mensagem de boas-vindas com menção a todos os participantes...");
    const sent = await socket.sendMessage(GROUP_JID, {
        text: welcomeMessage,
        mentions: allMentionJids
    });

    console.log(`✅ [SUCESSO] Mensagem de boas-vindas enviada! Key ID: ${sent?.key?.id}`);

    // Salvar no banco
    try {
        await prisma.message.create({
            data: {
                sessionId: dbSession.id,
                remoteJid: GROUP_JID,
                senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                fromMe: true,
                keyId: sent?.key?.id || `COMM_WELCOME_${Date.now()}`,
                pushName: "Brunno Anastácio",
                type: "TEXT",
                content: welcomeMessage,
                status: "SENT",
                timestamp: new Date()
            }
        });
    } catch (e) {}

    setTimeout(() => process.exit(0), 1000);
}

run().catch((err) => {
    console.error("Erro fatal ao enviar boas-vindas:", err);
    process.exit(1);
});
