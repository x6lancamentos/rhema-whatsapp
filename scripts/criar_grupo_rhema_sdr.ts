import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import path from "path";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";
import { getGestorSession } from "../src/lib/rhema-session";

const BRUNNO_PERSONAL_JID = "556293856483@s.whatsapp.net";
const RHEMA_INSTITUTIONAL_JID = "5513991588225@s.whatsapp.net";

async function main() {
    console.log("=== CRIANDO GRUPO WHATSAPP: 'Rhema SDR' ===");

    const gestorSession = await getGestorSession();
    if (!gestorSession) throw new Error("Sessão do gestor não encontrada.");

    const sessionId = gestorSession.sessionId;
    console.log(`Usando sessão criadora: ${sessionId} (${gestorSession.name})`);

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

    const groupJid = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.end(undefined);
            reject(new Error("Timeout conectando ao WhatsApp"));
        }, 30000);

        socket.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === "open") {
                clearTimeout(timeout);
                console.log(`🟢 [CONECTADO] Chip: ${socket.user?.id}`);

                try {
                    // Participantes a adicionar
                    const participants = [BRUNNO_PERSONAL_JID, RHEMA_INSTITUTIONAL_JID];
                    console.log("Criando grupo 'Rhema SDR' com participantes:", participants);

                    const group = await socket.groupCreate("Rhema SDR", participants);
                    console.log(`✅ Grupo criado com sucesso! ID: ${group.id}`);

                    // Atualiza descrição do grupo
                    try {
                        await socket.groupUpdateDescription(
                            group.id,
                            "Canal Oficial Rhema SDR — Recepção de Leads da Camila, Qualificação 4 Pilares, Agendamento com Proprietário e Distribuição Inteligente para Corretores."
                        );
                    } catch (descErr) {
                        console.warn("Aviso ao atualizar descrição:", descErr);
                    }

                    // Envia mensagem inaugural
                    const welcomeText =
`🚀 *BEM-VINDOS AO RHEMA SDR* 🎯
─────────────────────────────────────
Canal operacional oficial de pré-atendimento e qualificação inteligente da Rhema Imóveis.

📋 *COMO FUNCIONA O FLUXO AUTOMATIZADO:*
1️⃣ *Camila posta o lead aqui no grupo*, informando:
   • Código do imóvel de interesse
   • Nome do cliente
   • Telefone do cliente
   • Origem / Mídia e Observações relevantes

2️⃣ *O Agente SDR de IA assume instantaneamente:*
   • Abre contato natural e consultivo com o lead no WhatsApp (sem panfletagem de ficha técnica).
   • Qualifica os 4 Pilares: *Finalidade*, *Localização*, *Prazo* e *Condição Financeira*.
   • Consulta simultaneamente o proprietário sobre janelas disponíveis para visita.
   • Conduz para o *agendamento da visita presencial* (ou até 3 opções aderentes se o imóvel foi vendido/desistiu).
   • Cadastra o atendimento no Imoview até a fase de *Agendamento (Visita)*.
   • Distribui o lead por fila de rodízio / meritocracia e avisa o corretor no WhatsApp.

💡 *Melhoria Contínua:* O Agente SDR analisa cada ciclo e envia sugestões de aprimoramento contínuo aqui no grupo!
─────────────────────────────────────
_Rhema Imóveis — Palavra que age._`;

                    await socket.sendMessage(group.id, { text: welcomeText });
                    console.log("✅ Mensagem inaugural enviada com sucesso no grupo!");

                    setTimeout(() => {
                        socket.end(undefined);
                        resolve(group.id);
                    }, 2000);
                } catch (err) {
                    socket.end(undefined);
                    reject(err);
                }
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    clearTimeout(timeout);
                    reject(new Error("Desconectado"));
                }
            }
        });
    });

    console.log(`\n🎉 SUCESSO! GROUP_JID = ${groupJid}`);

    // Atualiza no .env
    const envPath = path.resolve(__dirname, "../.env");
    let envContent = fs.readFileSync(envPath, "utf8");

    if (envContent.includes("RHEMA_SDR_GROUP_JID=")) {
        envContent = envContent.replace(/RHEMA_SDR_GROUP_JID=".*"/, `RHEMA_SDR_GROUP_JID="${groupJid}"`);
    } else {
        envContent += `\nRHEMA_SDR_GROUP_JID="${groupJid}"\n`;
    }

    fs.writeFileSync(envPath, envContent, "utf8");
    console.log("✅ Arquivo .env atualizado com RHEMA_SDR_GROUP_JID!");
}

main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
});

