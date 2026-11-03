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
const ANDRESSA_PHONE = "5513981512755";
const ANDRESSA_JID = "5513981512755@s.whatsapp.net";

const RAIZ_RHEMA = path.resolve(__dirname, "../../Sistema Rhema - Imoview");
const PDF_PATH = path.join(RAIZ_RHEMA, "relatorios/Playbook_Resgate_Andressa_Larocca_10_Leads.pdf");
const XLSX_PATH = path.join(RAIZ_RHEMA, "relatorios/Lista_Resgate_Andressa_Larocca_10_Leads.xlsx");

const MENSAGEM_CAPTION = `Oi, Andressa! Tudo bem? 🚀

Acabei de transferir uma nova carteira estratégica de *10 leads de recuperação* diretamente para o seu usuário no *CRM Imoview*!

📊 *Resumo da Carteira Atribuída:*
• *Total de Leads:* 10 atendimentos
• *Critério:* Clientes de venda sem contato há mais de 15 dias (15 a 22 dias estagnados com cedentes anteriores)
• *Status no CRM:* 100% ativos na sua esteira (Situação 1 - Em Atendimento)
• *Carrinho Abastecido:* Cada atendimento já está com 2 a 3 imóveis selecionados do estoque Rhema inseridos no carrinho do Imoview para você apresentar!

📄 *Playbook Comercial Oficial em Anexo:*
Segue em anexo o *Playbook Oficial em PDF* com o diagnóstico completo de cada cliente (Elisabeth, Henrique, Jarina, Emilio, Pedro, Bianca, Érica, Priscila, Marcos e Gabriel) e os scripts de abordagem prontos para você ligar e destravar novas visitas.

💡 *Dica Tática:* Os perfis são excelentes e com busca definida em Santos (Embaré, Aparecida, Pompéia, Gonzaga e Boqueirão). Priorize os leads que já têm perfil bem amarrado (ex: Elisabeth no Embaré e Érica que procura casa com quintal para pet).

Bons contatos e bora pra cima virar esses atendimentos em visitas e fechamentos! 🎯💪

*Brunno Anastácio* | Diretoria Rhema Imóveis`;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectToWhatsApp(): Promise<any> {
    const { state, saveCreds } = await usePrismaAuthState(SESSION_ID);
    const { version } = await fetchLatestBaileysVersion();

    return new Promise((resolve, reject) => {
        let isResolved = false;

        function connect() {
            console.log("🔌 Conectando socket Baileys ao WhatsApp...");
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
                    console.log("✅ [OK] Conexão Baileys autenticada com sucesso!");
                    if (!isResolved) {
                        isResolved = true;
                        resolve(socket);
                    }
                } else if (connection === "close") {
                    const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                    if (statusCode === DisconnectReason.loggedOut) {
                        if (!isResolved) reject(new Error("Desconectado do WhatsApp"));
                    } else {
                        if (!isResolved) {
                            setTimeout(connect, 2000);
                        }
                    }
                }
            });
        }

        connect();
    });
}

async function main() {
    console.log("=========================================================");
    console.log("📲 DISPARO DE AVISO E MATERIAIS PARA ANDRESSA LAROCCA");
    console.log("=========================================================\n");

    const dbSession = await prisma.session.findUnique({
        where: { sessionId: SESSION_ID }
    });
    if (!dbSession) throw new Error("Sessão avg78n não encontrada no banco");

    if (!fs.existsSync(PDF_PATH)) throw new Error(`PDF não encontrado: ${PDF_PATH}`);
    if (!fs.existsSync(XLSX_PATH)) throw new Error(`Excel não encontrado: ${XLSX_PATH}`);

    const socket = await connectToWhatsApp();
    console.log(`👤 Socket ativo como: ${socket.user?.id || "avg78n"}`);

    console.log("⏳ Aguardando 3,5s de estabilização do canal...");
    await sleep(3500);

    // 1. Envio do Playbook em PDF com a Legenda Completa
    console.log(`\n📄 [1/2] Enviando Playbook em PDF para Andressa (${ANDRESSA_PHONE})...`);
    const pdfB64 = fs.readFileSync(PDF_PATH).toString("base64");
    const pdfDataUri = `data:application/pdf;base64,${pdfB64}`;

    const sentPdf = await socket.sendMessage(ANDRESSA_JID, {
        document: { url: pdfDataUri },
        mimetype: "application/pdf",
        fileName: "Playbook_Resgate_Andressa_Larocca_10_Leads.pdf",
        caption: MENSAGEM_CAPTION
    });
    console.log(`  ✅ [SUCESSO PDF] Entregue! Key ID: ${sentPdf?.key?.id}`);

    // Persistir no Prisma
    try {
        await prisma.message.create({
            data: {
                sessionId: dbSession.id,
                remoteJid: ANDRESSA_JID,
                senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                fromMe: true,
                keyId: sentPdf?.key?.id || `PDF_${Date.now()}`,
                pushName: "Brunno Anastácio",
                type: "DOCUMENT",
                content: `[PLAYBOOK PDF: Playbook_Resgate_Andressa_Larocca_10_Leads.pdf] ${MENSAGEM_CAPTION}`,
                status: "SENT",
                timestamp: new Date()
            }
        });
    } catch (e: any) {
        console.warn("  ⚠️ [AVISO PRISMA]", e.message);
    }

    // Cooldown de 4 segundos
    console.log("  ⏱️ Cooldown de 4s para estabilização de media_conn...");
    await sleep(4000);

    // 2. Envio da Planilha Excel (.xlsx)
    console.log(`\n📊 [2/2] Enviando Planilha Excel para Andressa (${ANDRESSA_PHONE})...`);
    const xlsxB64 = fs.readFileSync(XLSX_PATH).toString("base64");
    const xlsxDataUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${xlsxB64}`;

    const sentXlsx = await socket.sendMessage(ANDRESSA_JID, {
        document: { url: xlsxDataUri },
        mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileName: "Lista_Resgate_Andressa_Larocca_10_Leads.xlsx",
        caption: "📊 *Planilha de Acompanhamento • 10 Leads de Recuperação*\nPlanilha estruturada para você registrar o histórico e feedbacks de cada contato."
    });
    console.log(`  ✅ [SUCESSO EXCEL] Entregue! Key ID: ${sentXlsx?.key?.id}`);

    try {
        await prisma.message.create({
            data: {
                sessionId: dbSession.id,
                remoteJid: ANDRESSA_JID,
                senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                fromMe: true,
                keyId: sentXlsx?.key?.id || `XLSX_${Date.now()}`,
                pushName: "Brunno Anastácio",
                type: "DOCUMENT",
                content: `[PLANILHA EXCEL: Lista_Resgate_Andressa_Larocca_10_Leads.xlsx]`,
                status: "SENT",
                timestamp: new Date()
            }
        });
    } catch (e: any) {
        console.warn("  ⚠️ [AVISO PRISMA]", e.message);
    }

    console.log("\n=========================================================");
    console.log("🎉 COMUNICADO E MATERIAIS ENTREGUES COM SUCESSO A ANDRESSA!");
    console.log("=========================================================");

    await sleep(2000);
    socket.end(undefined);
    process.exit(0);
}

main().catch(err => {
    console.error("ERRO FATAL:", err);
    process.exit(1);
});
