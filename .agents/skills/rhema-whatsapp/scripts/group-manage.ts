import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import path from "path";
import { prisma } from "../../../../src/lib/prisma";
import { usePrismaAuthState } from "../../../../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";

async function getConnectedSocket() {
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
            if (connection === "open") resolve();
            if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) reject(new Error("Desconectado"));
            }
        });
    });

    return socket;
}

export async function addMemberToGroup(groupJid: string, phone: string) {
    const socket = await getConnectedSocket();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    let targetJid = `${cleanPhone}@s.whatsapp.net`;

    try {
        const check = await socket.onWhatsApp(cleanPhone);
        if (check && check.length > 0 && check[0]?.exists) {
            targetJid = check[0].jid;
        }
    } catch (e) {}

    console.log(`Adicionando ${targetJid} ao grupo ${groupJid}...`);
    const result = await socket.groupParticipantsUpdate(groupJid, [targetJid], "add");
    console.log("Resultado:", JSON.stringify(result, null, 2));
    setTimeout(() => process.exit(0), 1000);
    return result;
}

export async function sendGroupAnnouncement(groupJid: string, message: string, tagAll = true) {
    const socket = await getConnectedSocket();
    const groupMeta = await socket.groupMetadata(groupJid);

    const mentions = tagAll ? groupMeta.participants.map(p => p.id) : undefined;
    console.log(`Enviando mensagem para "${groupMeta.subject}" (mencionando ${mentions?.length || 0} membros)...`);

    const sent = await socket.sendMessage(groupJid, {
        text: message,
        mentions
    });

    console.log(`✅ [SUCESSO] Mensagem enviada! Key ID: ${sent?.key?.id}`);
    setTimeout(() => process.exit(0), 1000);
    return sent;
}

export async function setGroupMode(groupJid: string, onlyAdminsCanSend: boolean) {
    const socket = await getConnectedSocket();
    const mode = onlyAdminsCanSend ? "announcement" : "not_announcement";
    await socket.groupSettingUpdate(groupJid, mode as any);
    console.log(`✅ Configuração do grupo alterada para: ${mode}`);
    setTimeout(() => process.exit(0), 1000);
}
