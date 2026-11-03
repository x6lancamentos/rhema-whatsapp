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
                console.log("[CONECTADO] Aguardando estabilização...");
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
    console.log("Enviando Playbook_andre.pdf para André Felipe (5513981404451)...");

    const sent = await socket.sendMessage("5513981404451@s.whatsapp.net", {
        document: fs.readFileSync(pdfPath),
        mimetype: "application/pdf",
        fileName: "Playbook_Comercial_Andre_Felipe.pdf",
        caption: `📄 *Playbook Comercial Oficial • André Felipe*\n\nFala, André! Segue em anexo o seu *Playbook Oficial em PDF* com os 5 atendimentos quentes com visitas recentes direcionados para o seu usuário.\n\n🎯 *O que você encontra no documento:*\n• Histórico de visitas e diagnóstico dos clientes (Keyla, Leonardo, Tassi, Bruna/Paulo e Gabriela)\n• Estratégia de reaquecimento focada em fechar negócio\n• Roteiros de abordagem com gatilhos de fechamento e agendamento de nova visita\n• Como quebrar objeções de indecisão\n• Imóveis do estoque já vinculados no carrinho do Imoview\n\nBora pra cima virar essas visitas em propostas! 🚀`
    });

    console.log("[SUCESSO ANDRE] Key:", sent?.key?.id);
    await new Promise(r => setTimeout(r, 2000));
    process.exit(0);
}

run().catch(console.error);
