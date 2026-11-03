import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";

async function sendMessage(targetJid: string, text: string) {
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
                    reject(new Error("Desconectado"));
                }
            }
        });
    });

    const sent = await socket.sendMessage(targetJid, { text });
    console.log(`[SUCESSO] Mensagem enviada para ${targetJid}! Key: ${sent?.key?.id}`);
    await new Promise(r => setTimeout(r, 2000));
}

const MSG_ULISSES = `Fala, Ulisses! Tudo bem? 🎯

Direcionei *5 excelentes oportunidades de compra* para a sua carteira no *CRM Imoview*, com tickets na faixa de *R$ 700k a R$ 760k*:

1. *Elis Bueno* (Atendimento #812) — R$ 759.000,00 (Gonzaga)
2. *Marilia Potiguara* (Atendimento #825) — R$ 759.000,00 (Boqueirão)
3. *Poliana / Eduardo* (Atendimento #601) — R$ 720.000,00 (Embaré)
4. *Helio Gomes* (Atendimento #578) — R$ 696.000,00 (Aparecida)
5. *Rosely* (Atendimento #814) — R$ 688.000,00 (Ponta da Praia)

💡 *Diferencial:* Já selecionei as opções mais quentes do nosso estoque e adicionei no *carrinho* de cada cliente no Imoview. Excelente momento para você acionar esses clientes e agendar as visitas.

Bora pra cima! Qualquer dúvida estou por aqui. 🚀`;

async function main() {
    console.log("Enviando para Ulisses...");
    await sendMessage("5513988181515@s.whatsapp.net", MSG_ULISSES);
    process.exit(0);
}

main().catch(err => {
    console.error("Erro:", err);
    process.exit(1);
});
