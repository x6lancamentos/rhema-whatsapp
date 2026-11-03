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
const TARGET_JID = "556293856483@s.whatsapp.net";
const RAIZ_RHEMA = "C:\\Users\\brunn\\OneDrive\\Documentos\\Sistemas\\Sistema Rhema - Imoview";

async function run() {
    console.log(`[INICIANDO TESTE BASE64] Destinatario: ${TARGET_JID}`);

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
                console.log("[CONECTADO AO WHATSAPP] Conexao Baileys estabelecida!");
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

    // Aguardar 3s para estabilização
    await new Promise(r => setTimeout(r, 3000));

    // 1. TESTE DE IMAGEM VIA BASE64 DATA URI
    const imgPath = path.join(RAIZ_RHEMA, "relatorios/preview_resgate_andressa.png");
    if (fs.existsSync(imgPath)) {
        console.log(`\n--- [TESTE 1: IMAGEM VIA BASE64] ---`);
        console.log(`Lendo imagem: ${imgPath} (${fs.statSync(imgPath).size} bytes)`);
        const imgBase64 = fs.readFileSync(imgPath).toString("base64");
        const imgDataUri = `data:image/png;base64,${imgBase64}`;
        console.log(`String Base64 gerada (prefixo: ${imgDataUri.substring(0, 40)}...)`);

        try {
            const imgSent = await socket.sendMessage(TARGET_JID, {
                image: { url: imgDataUri },
                caption: "📸 *[TESTE RHEMA]* Imagem enviada via Base64 Data URI com sucesso!"
            });
            console.log(`[SUCESSO TESTE 1 - IMAGEM BASE64] Key ID: ${imgSent?.key?.id}`);
        } catch (e: any) {
            console.error(`[FALHA TESTE 1 - IMAGEM BASE64]:`, e.message);
        }
    } else {
        console.log(`Imagem de teste nao encontrada em ${imgPath}`);
    }

    // Intervalo de segurança
    await new Promise(r => setTimeout(r, 4000));

    // 2. TESTE DE PDF VIA BASE64 DATA URI
    const pdfPath = path.join(RAIZ_RHEMA, "relatorios/Playbook_elaine.pdf");
    if (fs.existsSync(pdfPath)) {
        console.log(`\n--- [TESTE 2: PDF VIA BASE64] ---`);
        console.log(`Lendo PDF: ${pdfPath} (${fs.statSync(pdfPath).size} bytes)`);
        const pdfBase64 = fs.readFileSync(pdfPath).toString("base64");
        const pdfDataUri = `data:application/pdf;base64,${pdfBase64}`;
        console.log(`String Base64 PDF gerada (prefixo: ${pdfDataUri.substring(0, 50)}...)`);

        try {
            const pdfSent = await socket.sendMessage(TARGET_JID, {
                document: { url: pdfDataUri },
                mimetype: "application/pdf",
                fileName: "Playbook_Comercial_Elaine.pdf",
                caption: "📄 *[TESTE RHEMA]* Playbook Comercial em PDF enviado via Base64 Data URI!"
            });
            console.log(`[SUCESSO TESTE 2 - PDF BASE64] Key ID: ${pdfSent?.key?.id}`);
        } catch (e: any) {
            console.error(`[FALHA TESTE 2 - PDF BASE64]:`, e.message);
        }
    }

    // Intervalo de segurança
    await new Promise(r => setTimeout(r, 4000));

    // 3. TESTE DE PDF VIA BUFFER DIRETO (REFERENCIA DE COMPARACAO)
    if (fs.existsSync(pdfPath)) {
        console.log(`\n--- [TESTE 3: PDF VIA BUFFER DIRETO] ---`);
        const pdfBuffer = fs.readFileSync(pdfPath);
        try {
            const bufferSent = await socket.sendMessage(TARGET_JID, {
                document: pdfBuffer,
                mimetype: "application/pdf",
                fileName: "Playbook_Comercial_Buffer.pdf",
                caption: "📄 *[TESTE RHEMA]* Playbook Comercial em PDF enviado via Buffer direto!"
            });
            console.log(`[SUCESSO TESTE 3 - PDF BUFFER] Key ID: ${bufferSent?.key?.id}`);
        } catch (e: any) {
            console.error(`[FALHA TESTE 3 - PDF BUFFER]:`, e.message);
        }
    }

    await new Promise(r => setTimeout(r, 2000));
    socket.end(undefined);
    console.log("\n[FIM DO TESTE] Execucao concluida.");
    process.exit(0);
}

run().catch((err) => {
    console.error("Erro fatal:", err);
    process.exit(1);
});