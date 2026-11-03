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

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case ".pdf": return "application/pdf";
        case ".png": return "image/png";
        case ".jpg":
        case ".jpeg": return "image/jpeg";
        case ".webp": return "image/webp";
        case ".xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        case ".csv": return "text/csv";
        case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        default: return "application/octet-stream";
    }
}

function isImageType(mimetype: string): boolean {
    return mimetype.startsWith("image/");
}

interface DispatchOptions {
    targetPhone: string;
    messageText?: string;
    attachmentPath?: string;
    caption?: string;
}

async function attemptSend(opts: DispatchOptions, retryCount = 0): Promise<void> {
    let targetJid = opts.targetPhone.trim();
    if (!targetJid.includes("@")) {
        const cleanPhone = targetJid.replace(/\D/g, "");
        targetJid = `${cleanPhone}@s.whatsapp.net`;
    }

    console.log(`[WHATSAPP DISPATCH] (Tentativa ${retryCount + 1}) Destinatario: ${targetJid}`);

    const dbSession = await prisma.session.findUnique({
        where: { sessionId: SESSION_ID }
    });
    if (!dbSession) throw new Error("Sessao avg78n nao encontrada no banco");

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
                console.log("[CONEXAO OPEN] Baileys conectado com sucesso!");
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado do WhatsApp"));
                }
            }
        });
        setTimeout(() => reject(new Error("Timeout conectando ao WhatsApp (15s)")), 15000);
    });

    // Aguardar estabilização do socket (2.5s)
    await new Promise(r => setTimeout(r, 2500));

    try {
        let sent: any;
        let msgType = "TEXT";
        let dbContent = "";

        if (opts.attachmentPath) {
            if (!fs.existsSync(opts.attachmentPath)) {
                throw new Error(`Anexo nao encontrado: ${opts.attachmentPath}`);
            }

            const fileName = path.basename(opts.attachmentPath);
            const mimetype = getMimeType(opts.attachmentPath);
            const b64 = fs.readFileSync(opts.attachmentPath).toString("base64");
            const dataUri = `data:${mimetype};base64,${b64}`;
            const caption = opts.caption || opts.messageText || "";

            if (isImageType(mimetype)) {
                console.log(`[ANEXO BASE64] Enviando Imagem: ${fileName} (${mimetype})...`);
                msgType = "IMAGE";
                dbContent = `[IMAGEM: ${fileName}] ${caption}`;
                sent = await socket.sendMessage(targetJid, {
                    image: { url: dataUri },
                    caption
                });
            } else {
                console.log(`[ANEXO BASE64] Enviando Documento: ${fileName} (${mimetype})...`);
                msgType = "DOCUMENT";
                dbContent = `[DOCUMENTO: ${fileName}] ${caption}`;
                sent = await socket.sendMessage(targetJid, {
                    document: { url: dataUri },
                    mimetype,
                    fileName,
                    caption
                });
            }
        } else if (opts.messageText) {
            console.log(`[TEXTO] Enviando mensagem de texto...`);
            msgType = "TEXT";
            dbContent = opts.messageText;
            sent = await socket.sendMessage(targetJid, { text: opts.messageText });
        } else {
            throw new Error("Nenhum texto ou anexo especificado para envio.");
        }

        console.log(`[SUCESSO] Mensagem entregue para ${opts.targetPhone}! Key ID: ${sent?.key?.id}`);

        // Persistir no banco Prisma
        try {
            await prisma.message.create({
                data: {
                    sessionId: dbSession.id,
                    remoteJid: targetJid,
                    senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                    fromMe: true,
                    keyId: sent?.key?.id || `NOTIF_${Date.now()}`,
                    pushName: "Brunno Anastacio",
                    type: msgType as any,
                    content: dbContent,
                    status: "SENT",
                    timestamp: new Date()
                }
            });
            console.log("[BANCO OK] Registro persistido na tabela prisma.message");
        } catch (e: any) {
            console.warn("[AVISO BANCO]", e.message);
        }

        await new Promise(r => setTimeout(r, 1500));
        socket.end(undefined);
    } catch (sendErr: any) {
        socket.end(undefined);
        if (retryCount < 2) {
            console.warn(`[RETRY] Falha no envio: ${sendErr.message}. Aguardando 5s para tentar novamente...`);
            await new Promise(r => setTimeout(r, 5000));
            return attemptSend(opts, retryCount + 1);
        }
        throw sendErr;
    }
}

async function run() {
    const args = process.argv.slice(2);
    const opts: DispatchOptions = {
        targetPhone: ""
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--phone" && args[i + 1]) opts.targetPhone = args[++i];
        if (args[i] === "--message" && args[i + 1]) opts.messageText = args[++i];
        if (args[i] === "--caption" && args[i + 1]) opts.caption = args[++i];
        if (args[i] === "--attachment" && args[i + 1]) opts.attachmentPath = args[++i];
        if (args[i] === "--file" && args[i + 1]) {
            const filePath = args[++i];
            if (fs.existsSync(filePath)) {
                opts.messageText = fs.readFileSync(filePath, "utf8");
            } else {
                throw new Error(`Arquivo nao encontrado: ${filePath}`);
            }
        }
    }

    if (!opts.targetPhone || (!opts.messageText && !opts.attachmentPath)) {
        console.error("Uso: npx tsx scripts/send-broker-direct.ts --phone <55XXXXXXXXXXX | JID> [--message <texto> | --file <caminho>] [--attachment <caminho_anexo>] [--caption <legenda>]");
        process.exit(1);
    }

    await attemptSend(opts, 0);
    process.exit(0);
}

run().catch((err) => {
    console.error("[ERRO DISPATCH]", err.message);
    process.exit(1);
});