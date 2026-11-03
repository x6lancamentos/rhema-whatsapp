import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    normalizeMessageContent
} from "@whiskeysockets/baileys";
import pino from "pino";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";
import { isManagerCommandText, executeCommanderCommand } from "../src/lib/ai/rhema-commander-service";

const SESSION_ID = process.env.RHEMA_GESTOR_SESSION_ID || "5mhrx9";
const COMMAND_GROUP_JID = process.env.RHEMA_COMMAND_GROUP_JID || "120363413785925263@g.us";
const BRUNNO_PHONE = process.env.RHEMA_GESTOR_PERSONAL_PHONE || "556293856483";

async function startListener() {
    console.log("=== INICIANDO LISTENER CONTÍNUO DO RHEMA COMMAND CENTER ===");
    console.log("Sessão Baileys:", SESSION_ID);
    console.log("Grupo de Comando Monitorado:", COMMAND_GROUP_JID);

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

    socket.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("🟢 [CONECTADO] Baileys ouvindo comandos em tempo real! ID:", socket.user?.id);
        } else if (connection === "close") {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
            console.log("🔴 [DESCONECTADO] Conexão fechada. StatusCode:", statusCode);
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log("Tentando reconectar em 5 segundos...");
                setTimeout(startListener, 5000);
            }
        }
    });

    socket.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        for (const msg of messages) {
            const remoteJid = msg.key.remoteJid;
            const fromMe = Boolean(msg.key.fromMe);
            const isGroup = remoteJid?.endsWith("@g.us");
            const senderJid = isGroup ? (msg.key.participant || msg.participant) : remoteJid;

            if (!remoteJid || !senderJid) continue;

            const isTargetGroup = remoteJid === COMMAND_GROUP_JID;
            const cleanSender = senderJid.replace(/@.*$/, "").replace(/\D/g, "");
            const isBrunno = cleanSender.includes(BRUNNO_PHONE);

            const content = normalizeMessageContent(msg.message);
            const text = (content?.conversation || content?.extendedTextMessage?.text || "").trim();

            if (!text) continue;

            // Se for no grupo de comando ou for comando ! vindo do Brunno
            const isCommand = text.startsWith("!") || isManagerCommandText(text);

            if ((isTargetGroup || isBrunno) && isCommand) {
                console.log(`\n📥 [COMANDO RECEBIDO] De: ${senderJid} em ${remoteJid}: "${text}"`);

                try {
                    const result = await executeCommanderCommand({
                        comandoTexto: text,
                        role: "COMMANDER_GESTOR",
                        remetenteNome: "Brunno",
                    });

                    console.log(`📤 [RESPONDENDO] Destino: ${remoteJid}...`);
                    await socket.sendMessage(remoteJid, { text: result.respostaWhatsApp }, { quoted: msg });
                    console.log(`✓ [RESPOSTA ENVIADA COM SUCESSO]`);
                } catch (err: any) {
                    console.error("Erro ao executar comando:", err);
                    await socket.sendMessage(remoteJid, { text: `❌ Erro ao processar comando: ${err.message}` }, { quoted: msg });
                }
            }
        }
    });
}

startListener().catch((err) => {
    console.error("Erro fatal no listener:", err);
});

