import fs from "fs";
import path from "path";
import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";
import { prisma } from "../src/lib/prisma";

const SESSION_ID = "avg78n";
const RAIZ_RHEMA = "C:\\Users\\brunn\\OneDrive\\Documentos\\Sistemas\\Sistema Rhema - Imoview";

async function run() {
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
                console.log("[CONECTADO] Aguardando estabilização da conexão...");
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado do WhatsApp"));
                }
            }
        });
    });

    await new Promise(r => setTimeout(r, 4000));

    const pdfPath = path.join(RAIZ_RHEMA, "relatorios/Playbook_andre.pdf");
    console.log("Lendo arquivo:", pdfPath, "Tamanho:", fs.statSync(pdfPath).size);

    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log("Enviando Playbook Comercial para André Felipe...");

    const sent = await socket.sendMessage("5513981404451@s.whatsapp.net", {
        document: pdfBuffer,
        mimetype: "application/pdf",
        fileName: "Playbook_Comercial_Andre_Felipe.pdf",
        caption: "📄 Playbook Comercial Oficial em PDF • André Felipe\nInstruções completas e detalhadas para abordagem dos 5 atendimentos quentes com visitas recentes."
    });

    console.log("[SUCESSO TOTAL ANDRE] Key:", sent?.key?.id);

    try {
        const dbSession = await prisma.session.findUnique({ where: { sessionId: SESSION_ID } });
        if (dbSession) {
            await prisma.message.create({
                data: {
                    sessionId: dbSession.id,
                    remoteJid: "5513981404451@s.whatsapp.net",
                    senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                    fromMe: true,
                    keyId: sent?.key?.id || `DOC_${Date.now()}`,
                    pushName: "Brunno Anastácio",
                    type: "DOCUMENT",
                    content: "[DOCUMENTO PDF: Playbook_Comercial_Andre_Felipe.pdf] Playbook Comercial Oficial em PDF • André Felipe",
                    status: "SENT",
                    timestamp: new Date()
                }
            });
        }
    } catch (e) {}

    await new Promise(r => setTimeout(r, 2000));
    socket.end(undefined);
    process.exit(0);
}

run().catch((err) => {
    console.error("Erro ao enviar doc:", err);
    process.exit(1);
});