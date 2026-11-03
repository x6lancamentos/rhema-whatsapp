import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";

async function sendMessage(targetJid: string, text: string) {
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
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado"));
                }
            }
        });
    });

    const sent = await socket.sendMessage(targetJid, { text });
    console.log(`[SUCESSO] Mensagem enviada para ${targetJid}! Key: ${sent?.key?.id}`);

    // Gravar no prisma
    try {
        const dbSession = await prisma.session.findUnique({ where: { sessionId: SESSION_ID } });
        if (dbSession) {
            await prisma.message.create({
                data: {
                    sessionId: dbSession.id,
                    remoteJid: targetJid,
                    senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                    fromMe: true,
                    keyId: sent?.key?.id || `COMM_${Date.now()}`,
                    pushName: "Brunno Anastácio",
                    type: "TEXT",
                    content: text,
                    status: "SENT",
                    timestamp: new Date()
                }
            });
        }
    } catch (e) {}

    await new Promise(r => setTimeout(r, 2000));
}

const MSG_CORRECAO_ROSELI = `Oi, Roseli! Por favor, desconsidere a mensagem anterior referente àqueles 5 atendimentos enviados há pouco. A Diretoria realizou um alinhamento e ajuste interno no sistema. Em breve direciono novas oportunidades diretamente para você. Obrigado! 🙏`;

const MSG_CORRECAO_LENIARA = `Oi, Leniára! Por favor, desconsidere a mensagem anterior referente àqueles 5 atendimentos enviados há pouco. A Diretoria realizou um alinhamento e ajuste interno no sistema. Em breve direciono novas oportunidades diretamente para você. Obrigado! 🙏`;

async function main() {
    console.log("\n1) Enviando mensagem de alinhamento para Roseli (5513974103368)...");
    await sendMessage("5513974103368@s.whatsapp.net", MSG_CORRECAO_ROSELI);

    console.log("Aguardando 4 segundos...");
    await new Promise(r => setTimeout(r, 4000));

    console.log("\n2) Enviando mensagem de alinhamento para Leniára (5513996461664)...");
    await sendMessage("5513996461664@s.whatsapp.net", MSG_CORRECAO_LENIARA);

    console.log("\nALINHAMENTO ENVIADO COM SUCESSO!");
    process.exit(0);
}

main().catch(err => {
    console.error("Erro:", err);
    process.exit(1);
});
