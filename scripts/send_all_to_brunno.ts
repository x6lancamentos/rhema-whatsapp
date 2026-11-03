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
const TARGET_JID = "556293856483@s.whatsapp.net";
const RAIZ_RHEMA = "C:\\Users\\brunn\\OneDrive\\Documentos\\Sistemas\\Sistema Rhema - Imoview";

const PLAYBOOKS = [
    { file: "Playbook_andre.pdf", name: "Playbook_Comercial_Andre_Felipe.pdf", caption: "📄 Playbook Comercial • André Felipe (5 Leads Quentes c/ Visitas)" },
    { file: "Playbook_leniara.pdf", name: "Playbook_Comercial_Leniara_Araujo.pdf", caption: "📄 Playbook Comercial • Leniára Araújo (5 Leads Macuco/Embaré/Aparecida)" },
    { file: "Playbook_roseli.pdf", name: "Playbook_Comercial_Roseli_Lopes.pdf", caption: "📄 Playbook Comercial • Roseli Lopes (5 Leads Ponta da Praia/Embaré/Itararé)" }
];

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
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado do WhatsApp"));
                }
            }
        });
        setTimeout(() => reject(new Error("Timeout conectando (15s)")), 15000);
    });

    await new Promise(r => setTimeout(r, 2500));

    for (let i = 0; i < PLAYBOOKS.length; i++) {
        const item = PLAYBOOKS[i];
        const fullPath = path.join(RAIZ_RHEMA, "relatorios", item.file);
        if (!fs.existsSync(fullPath)) continue;

        console.log(`Enviando ${item.name} via Base64 para Brunno...`);
        const b64 = fs.readFileSync(fullPath).toString("base64");
        const dataUri = `data:application/pdf;base64,${b64}`;

        const sent = await socket.sendMessage(TARGET_JID, {
            document: { url: dataUri },
            mimetype: "application/pdf",
            fileName: item.name,
            caption: item.caption
        });

        console.log(`[SUCESSO] ${item.name}: Key ${sent?.key?.id}`);
        await new Promise(r => setTimeout(r, 3500));
    }

    await new Promise(r => setTimeout(r, 1500));
    socket.end(undefined);
    console.log("[CONCLUIDO] Todos os 3 playbooks enviados para o WhatsApp do Brunno!");
    process.exit(0);
}

run().catch((err) => {
    console.error("Erro fatal:", err);
    process.exit(1);
});