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

interface Destinatario {
    nome: string;
    jid: string;
    telefone: string;
    file: string;
    fileName: string;
    caption: string;
}

const DESTINATARIOS: Destinatario[] = [
    {
        nome: "André Felipe",
        jid: "5513981404451@s.whatsapp.net",
        telefone: "5513981404451",
        file: "Playbook_andre.pdf",
        fileName: "Playbook_Comercial_Andre_Felipe.pdf",
        caption: "📄 *Playbook Comercial Oficial em PDF • André Felipe*\n\nSegue o arquivo PDF completo com o diagnóstico dos 5 clientes, histórico de visitas e scripts táticos para abordagem imediata. Boas negociações! 🚀"
    },
    {
        nome: "Elaine do Nascimento",
        jid: "5513976008877@s.whatsapp.net",
        telefone: "5513976008877",
        file: "Playbook_elaine.pdf",
        fileName: "Playbook_Comercial_Elaine.pdf",
        caption: "📄 *Playbook Comercial Oficial em PDF • Elaine do Nascimento*\n\nSegue o arquivo PDF completo com a curadoria exclusiva dos 5 atendimentos e roteiros detalhados de abertura e quebra de objeções. Ótimas vendas! 🚀"
    },
    {
        nome: "Leniára Araújo",
        jid: "5513996461664@s.whatsapp.net",
        telefone: "5513996461664",
        file: "Playbook_leniara.pdf",
        fileName: "Playbook_Comercial_Leniara_Araujo.pdf",
        caption: "📄 *Playbook Comercial Oficial em PDF • Leniára Araújo*\n\nSegue o arquivo PDF oficial com a análise completa dos 5 atendimentos transferidos e os imóveis do estoque já vinculados no CRM. Sucesso! 🚀"
    },
    {
        nome: "Roseli Lopes",
        jid: "5513974103368@s.whatsapp.net",
        telefone: "5513974103368",
        file: "Playbook_roseli.pdf",
        fileName: "Playbook_Comercial_Roseli_Lopes.pdf",
        caption: "📄 *Playbook Comercial Oficial em PDF • Roseli Lopes*\n\nSegue o arquivo PDF oficial com as orientações táticas para agendamento dos 5 novos clientes em fase ativa no seu CRM. Bom trabalho! 🚀"
    }
];

async function run() {
    console.log("=== DISPARO DE PLAYBOOKS OFICIAIS EM PDF PARA OS CORRETORES ===");

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
                console.log("[CONEXAO OPEN] Socket pronto!");
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

    await new Promise(r => setTimeout(r, 3000));

    const dbSession = await prisma.session.findUnique({ where: { sessionId: SESSION_ID } });

    for (let i = 0; i < DESTINATARIOS.length; i++) {
        const d = DESTINATARIOS[i];
        const fullPath = path.join(RAIZ_RHEMA, "relatorios", d.file);
        if (!fs.existsSync(fullPath)) {
            console.error(`Arquivo nao encontrado: ${fullPath}`);
            continue;
        }

        console.log(`\n[${i + 1}/${DESTINATARIOS.length}] Enviando ${d.fileName} para ${d.nome} (${d.telefone})...`);
        const b64 = fs.readFileSync(fullPath).toString("base64");
        const dataUri = `data:application/pdf;base64,${b64}`;

        try {
            const sent = await socket.sendMessage(d.jid, {
                document: { url: dataUri },
                mimetype: "application/pdf",
                fileName: d.fileName,
                caption: d.caption
            });

            console.log(`[SUCESSO] ${d.nome}: Key ID ${sent?.key?.id}`);

            if (dbSession) {
                await prisma.message.create({
                    data: {
                        sessionId: dbSession.id,
                        remoteJid: d.jid,
                        senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                        fromMe: true,
                        keyId: sent?.key?.id || `DOC_${Date.now()}`,
                        pushName: "Brunno Anastácio",
                        type: "DOCUMENT",
                        content: `[DOCUMENTO PDF: ${d.fileName}] ${d.caption}`,
                        status: "SENT",
                        timestamp: new Date()
                    }
                }).catch(() => {});
            }
        } catch (e: any) {
            console.error(`[ERRO] Falha ao enviar para ${d.nome}:`, e.message);
        }

        await new Promise(r => setTimeout(r, 4000));
    }

    await new Promise(r => setTimeout(r, 2000));
    socket.end(undefined);
    console.log("\n=== TODOS OS 4 PLAYBOOKS ENVIADOS COM SUCESSO! ===");
    process.exit(0);
}

run().catch((err) => {
    console.error("Erro fatal:", err);
    process.exit(1);
});