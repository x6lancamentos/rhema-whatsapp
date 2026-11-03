import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import pino from "pino";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";
import { getGestorSession } from "../src/lib/rhema-session";

async function main() {
    const gestorSession = await getGestorSession();
    if (!gestorSession) throw new Error("Sessão do Gestor não encontrada.");

    const sessionId = gestorSession.sessionId;
    const destJid = "5513981404451@s.whatsapp.net"; // André Felipe
    const mensagem = 
`Fala, André Felipe! Tudo bem? 🚀

Passando para te dar um alinhamento fundamental na sua rampa de evolução aqui na Rhema.

Nesta próxima sexta-feira, às 09:30h, teremos um treinamento exclusivo e presencial na imobiliária: *O Futuro do Mercado Imobiliário*.

Para você que está estruturando o seu método e construindo a sua primeira venda com consistência, entender para onde o mercado está caminhando, como qualificar o cliente no cenário atual e antecipar as demandas dos compradores vai te dar muita segurança na mesa e no atendimento.

📅 *Data:* Próxima sexta-feira (06/11)
⏰ *Horário:* 09:30h pontual
📍 *Local:* Sede Rhema Imóveis

Trave a sua agenda. Foco no processo e no aprendizado diário que o resultado vem. Conto com você lá! 🤝`;

    const { state, saveCreds } = await usePrismaAuthState(sessionId);
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
        const timeout = setTimeout(() => {
            try { socket.end(undefined); } catch {}
            reject(new Error("Timeout após 30 segundos"));
        }, 30000);

        socket.ev.on("connection.update", async (update) => {
            const { connection } = update;
            if (connection === "open") {
                clearTimeout(timeout);
                console.log(`🟢 [CONECTADO] Enviando para André Felipe...`);
                try {
                    const sent = await socket.sendMessage(destJid, { text: mensagem });
                    console.log(`✅ [SUCESSO] Mensagem enviada para André Felipe! KeyId: ${sent?.key?.id}`);
                    await new Promise(r => setTimeout(r, 2000));
                    try { socket.end(undefined); } catch {}
                    resolve();
                } catch (e) {
                    try { socket.end(undefined); } catch {}
                    reject(e);
                }
            }
        });
    });
}

main().catch(err => {
    console.error("Erro:", err);
    process.exit(1);
});

