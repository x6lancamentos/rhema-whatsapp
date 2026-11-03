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
        nome: "Flávia Mara de Mattos",
        jid: "5515974042000@s.whatsapp.net",
        telefone: "5515974042000",
        file: "Dossie_Comercial_Flavia_Mara_Leads_Andre_e_Luana.pdf",
        fileName: "Dossie_Comercial_Flavia_Mara.pdf",
        caption: "📄 *Dossiê Comercial & Playbook Tático Oficial • Flávia Mara*\n\nOlá, Flávia! Segue o seu Dossiê Comercial completo em PDF contendo o diagnóstico dos atendimentos das carteiras de Luana e André, histórico detalhado, opções do estoque já no carrinho e scripts consultivos de abordagem. Boas vendas! 🚀"
    },
    {
        nome: "Tatiana Gonçalves de Oliveira",
        jid: "5513981854677@s.whatsapp.net",
        telefone: "5513981854677",
        file: "Playbook_tatiana.pdf",
        fileName: "Playbook_Comercial_Tatiana_Oliveira.pdf",
        caption: "📄 *Playbook Comercial Oficial em PDF • Tatiana de Oliveira*\n\nOlá, Tatiana! Segue o seu Playbook Oficial em PDF com os 5 atendimentos estratégicos transferidos para você (Walter Daval Jr., Enna, Maurycio, Patrícia e Mayara), contendo diagnóstico, sugestões do estoque e roteiros de abordagem. Sucesso! 🚀"
    },
    {
        nome: "Andressa Larocca",
        jid: "5513981512755@s.whatsapp.net",
        telefone: "5513981512755",
        file: "Lista_Resgate_Andressa_Larocca_35_Leads.pdf",
        fileName: "Dossie_Resgate_Comercial_Andressa_Larocca_35_Leads.pdf",
        caption: "📄 *Dossiê de Resgate Comercial • Andressa Larocca (35 Leads)*\n\nOlá, Andressa! Segue o seu Dossiê Oficial em PDF com a carteira de 35 atendimentos ativos atribuídos no CRM Imoview, contendo o raio-x de cada cliente, histórico, tickets de até R$ 1 Milhão e roteiros de ligação. Bora pra cima! 🚀"
    }
];

async function run() {
    console.log("=== ENVIANDO DOSSIÊS EM PDF PARA FLÁVIA, TATIANA E ANDRESSA ===");

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

        console.log(`\n[${i + 1}/${DESTINATARIOS.length}] Enviando ${d.fileName} (${fs.statSync(fullPath).size} bytes) para ${d.nome} (${d.telefone})...`);
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
    console.log("\n=== DISPAROS PARA FLÁVIA, TATIANA E ANDRESSA FINALIZADOS COM SUCESSO! ===");
    process.exit(0);
}

run().catch((err) => {
    console.error("Erro fatal:", err);
    process.exit(1);
});