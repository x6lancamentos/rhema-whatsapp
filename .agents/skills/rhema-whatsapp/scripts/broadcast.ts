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

export function parseSpintax(text: string): string {
    const regex = /\{([^{}]+)\}/g;
    let result = text;
    while (regex.test(result)) {
        result = result.replace(regex, (_, choices) => {
            const options = choices.split('|');
            return options[Math.floor(Math.random() * options.length)];
        });
    }
    return result;
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomDelay(minSec = 15, maxSec = 75) {
    return Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
}

export interface BroadcastOptions {
    target: "corretores" | "diretoria_e_adm" | "custom";
    templateCreci?: string;
    templateNoCreci?: string;
    customRecipients?: Array<{ name: string; phone: string; hasCreci?: boolean }>;
    minDelay?: number;
    maxDelay?: number;
}

export async function executeBroadcast(options: BroadcastOptions) {
    const teamPath = path.join(__dirname, "..", "references", "team.json");
    const teamData = JSON.parse(fs.readFileSync(teamPath, "utf-8"));

    const dbSession = await prisma.session.findUnique({
        where: { sessionId: SESSION_ID }
    });
    if (!dbSession) throw new Error("Sessão não encontrada no banco");

    let recipients: Array<{ name: string; phone: string; hasCreci?: boolean }> = [];
    if (options.target === "corretores") {
        recipients = teamData.corretores.filter((c: any) => c.active !== false);
    } else if (options.target === "diretoria_e_adm") {
        recipients = teamData.diretoria_e_adm;
    } else if (options.customRecipients) {
        recipients = options.customRecipients;
    }

    console.log(`=== INICIANDO BROADCAST: ${recipients.length} DESTINATÁRIOS ===`);

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
                console.log("[OK] Conexão com o WhatsApp estabelecida!");
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Instância desconectada (Logged Out)"));
                }
            }
        });
    });

    for (let i = 0; i < recipients.length; i++) {
        const item = recipients[i];
        console.log(`\n[${i + 1}/${recipients.length}] Enviando para: ${item.name} (+${item.phone})`);

        let targetJid = `${item.phone}@s.whatsapp.net`;
        try {
            const check = await socket.onWhatsApp(item.phone);
            if (check && check.length > 0 && check[0]?.exists) {
                targetJid = check[0].jid;
            }
        } catch (e) {}

        const template = (item.hasCreci !== false)
            ? (options.templateCreci || options.templateNoCreci || "")
            : (options.templateNoCreci || options.templateCreci || "");

        const personalized = template.replace(/\{nome\}/g, item.name);
        const finalMessage = parseSpintax(personalized);

        try {
            const sent = await socket.sendMessage(targetJid, { text: finalMessage });
            console.log(`  ✅ [ENVIADO COM SUCESSO] Key ID: ${sent?.key?.id}`);

            // Gravar no histórico
            try {
                await prisma.message.create({
                    data: {
                        sessionId: dbSession.id,
                        remoteJid: targetJid,
                        senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                        fromMe: true,
                        keyId: sent?.key?.id || `AUTO_${Date.now()}_${i}`,
                        pushName: "Brunno Anastácio",
                        type: "TEXT",
                        content: finalMessage,
                        status: "SENT",
                        timestamp: new Date()
                    }
                });
            } catch (e) {}
        } catch (err: any) {
            console.error(`  ❌ [FALHA] Erro ao enviar para ${item.name}:`, err.message);
        }

        if (i < recipients.length - 1) {
            const delay = getRandomDelay(options.minDelay || 15, options.maxDelay || 75);
            console.log(`  ⏳ Aguardando ${delay}s de intervalo anti-spam...`);
            await sleep(delay * 1000);
        }
    }

    console.log("\n🎉 === BROADCAST CONCLUÍDO COM SUCESSO! ===");
    setTimeout(() => process.exit(0), 2000);
}
