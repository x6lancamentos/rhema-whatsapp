import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = process.env.RHEMA_GESTOR_SESSION_ID || "5mhrx9";
const BRUNNO_JID = "556293856483@s.whatsapp.net";

async function run() {
    console.log("=== CRIANDO GRUPO DE COMANDO RHEMA OS NO WHATSAPP ===");

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
                console.log("[CONEXÃO ABERTA] WhatsApp conectado! ID:", socket.user?.id);
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado do WhatsApp (Logged Out)"));
                }
            }
        });
        setTimeout(() => reject(new Error("Timeout conectando ao WhatsApp (20s)")), 20000);
    });

    await new Promise((r) => setTimeout(r, 3000));

    const welcomeMsg =
        `🧠 *RHEMA COMMAND CENTER v5.0 — GRUPO DE COMANDO CENTRAL*\n\n` +
        `Comandante *Brunno*, este canal está conectado ao Orquestrador Comercial e ao novo *Agente SDR Autônomo (4 Pilares + Pré-Visita Google Meet)*.\n\n` +
        `⚡ *COMANDOS RÁPIDOS DE 1 LINHA:*\n` +
        `• \`!buscar [nome ou tel]\` → Varredura no Imoview + SQLite\n` +
        `• \`!transferir [id] -> [corretor]\` → Transfere sem duplicar + avisa no WhatsApp (com trava *LEAD CORRETOR*)\n` +
        `• \`!auditar-fila\` → Leads > 7 dias sem interação (blindando *LEAD CORRETOR*)\n` +
        `• \`!carteira [corretor]\` → Raio-X completo de Venda e Aluguel\n` +
        `• \`!cpr\` → Dispara protocolo Dead-Deal CPR (> 3 dias)\n` +
        `• \`!match [imóvel]\` → Cruza imóvel com leads quentes\n` +
        `• \`!sdr [cliente]\` → Qualifica nos 4 Pilares + sugere resposta rumo ao Google Meet\n` +
        `• \`!briefing\` / \`!fechamento\` → Relatórios executivos do dia\n\n` +
        `🎙️ *Você também pode mandar áudios de 30s aqui para comandar a operação!*`;

    try {
        // Verifica se a sessão atual é o próprio número do Brunno ou outro número da Rhema
        const myRawId = (socket.user?.id || "").split(":")[0] + "@s.whatsapp.net";
        console.log("Meu JID na sessão:", myRawId);

        // Cria o grupo "🧠 Rhema OS | Comando Central"
        // Nota: no WhatsApp, se BRUNNO_JID for o próprio número conectado, passamos um participante auxiliar ou criamos o grupo
        let targetJid = BRUNNO_JID;
        try {
            const group = await socket.groupCreate("🧠 Rhema OS | Comando Central", [BRUNNO_JID]);
            console.log(`✓ [GRUPO CRIADO COM SUCESSO] ID: ${group.id}`);
            targetJid = group.id;

            await socket.groupUpdateDescription(
                group.id,
                "Canal Oficial de Orquestração Autônoma do Rhema OS v5.0 (Imoview + Supabase + SDR Autônomo + Placar Rhema)."
            );
        } catch (groupErr: any) {
            console.log(`[AVISO GRUPO] Criando/enviando direto no chat de comando (${groupErr?.message || "mesmo número da sessão"})...`);
        }

        const sent = await socket.sendMessage(targetJid, { text: welcomeMsg });
        console.log(`✓ [MENSAGEM DE COMANDO ENVIADA] Destino: ${targetJid} | Key: ${sent?.key?.id}`);
    } catch (err: any) {
        console.error("[ERRO]:", err.message);
    }

    await new Promise((r) => setTimeout(r, 2500));
    process.exit(0);
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});

