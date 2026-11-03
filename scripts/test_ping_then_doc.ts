import fs from "fs";
import path from "path";
import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";
const RAIZ_RHEMA = path.resolve(__dirname, "../../Sistema Rhema - Imoview");

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
                console.log("[CONECTADO]");
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado"));
                }
            }
        });
    });

    await new Promise(r => setTimeout(r, 4000));
    await (socket as any).refreshMediaConn(true);

    const targetJid = "5513981404451@s.whatsapp.net";

    // 1. Enviar mensagem de texto introdutória primeiro
    console.log("Enviando texto introdutório para André...");
    const msgSent = await socket.sendMessage(targetJid, {
        text: `📄 *Playbook Comercial Oficial • André Felipe*\n\nFala, André! Estou te encaminhando em seguida o seu *Playbook Oficial em PDF* com os 5 atendimentos quentes com visitas recentes direcionados para você, com instruções táticas completas para cada lead. Segue o arquivo abaixo:`
    });
    console.log("[TEXTO ENVIADO] Key:", msgSent?.key?.id);

    // Aguardar 3 segundos para sync de chaves de dispositivo
    await new Promise(r => setTimeout(r, 3000));

    // 2. Enviar documento PDF
    const pdfPath = path.join(RAIZ_RHEMA, "relatorios/Playbook_andre.pdf");
    console.log("Enviando documento PDF para André...");

    const docSent = await socket.sendMessage(targetJid, {
        document: fs.readFileSync(pdfPath),
        mimetype: "application/pdf",
        fileName: "Playbook_Comercial_Andre_Felipe.pdf"
    });
    console.log("[PDF ENVIADO] Key:", docSent?.key?.id);

    await new Promise(r => setTimeout(r, 2000));
    process.exit(0);
}

run().catch(console.error);
