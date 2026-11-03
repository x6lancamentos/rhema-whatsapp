import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";
import { getGestorSession, getGestorPersonalJid } from "../src/lib/rhema-session";

async function main() {
    console.log("=== INICIANDO TESTE EXCLUSIVO PARA O GESTOR BRUNNO ===");

    const gestorSession = await getGestorSession();
    if (!gestorSession) {
        throw new Error("Sessão do Gestor não encontrada no banco de dados.");
    }

    const sessionId = gestorSession.sessionId;
    const targetJid = getGestorPersonalJid();

    console.log(`[Configuração] Sessão do Gestor: ${sessionId} (${gestorSession.name})`);
    console.log(`[Configuração] Destinatário Pessoal: ${targetJid}`);
    console.log(`[Blindagem] Envios para corretores: TOTALMENTE BLOQUEADOS (0 mensagens para corretores).`);

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
            socket.end(undefined);
            reject(new Error("Timeout após 30 segundos aguardando conexão"));
        }, 30000);

        socket.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === "open") {
                clearTimeout(timeout);
                console.log(`🟢 [CONECTADO] Chip Oficial da Gerência: ${socket.user?.id}`);

                const agora = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
                const dataHoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

                const texto = 
`🧪 *TESTE DE VALIDAÇÃO DE DISPARO — RHEMA OS*
─────────────────────────────────────
Olá, Brunno! Este é o teste de conferência após a revisão completa das configurações de disparo.

✅ *DIAGNÓSTICO E AJUSTES CONCLUÍDOS:*
• *Remetente Confirmado:* WhatsApp Oficial da Gerência (*${socket.user?.id || '5513955437609'}*)
• *Sessão Baileys Travada:* \`${sessionId}\` (*${gestorSession.name}*)
• *Causa do Envio Anterior:* O Scheduler/Rotinas utilizava um fallback cego \`prisma.session.findFirst({ where: { status: 'CONNECTED' } })\`, que retornava a primeira sessão conectada encontrada no banco (que era o chip institucional Rhema \`59n5i\`).
• *Correção Aplicada:* 
  1. Definidas variáveis explícitas no \`.env\` (\`RHEMA_GESTOR_SESSION_ID=5mhrx9\`, \`RHEMA_INSTITUTIONAL_SESSION_ID=59n5i\`, etc.).
  2. Criado módulo \`rhema-session.ts\` e atualizado o Scheduler para buscar *estritamente* a sessão do Gestor antes de qualquer rotina comercial.
  3. Desacoplamento total entre o WhatsApp Institucional (Rhema Bot) e a Gerência Comercial (Brunno).
• *Equipe Comercial Alinhada:*
  - *Luana e Roseli:* Desativadas na base de dados (\`ativo: false\`) e removidas das rotinas.
  - *Equipe Ativa (9 corretores):* André Felipe (calibrado para rampa/1ª venda), Tatiana, Flávia, Leniára, Elaine, Kaylane, Andressa, Ulisses e Georjana.
• *Blindagem de Corretores:* Nenhuma mensagem foi enviada aos corretores (ordem respeitada à risca).

📅 *Horário do Teste:* ${dataHoje} às ${agora}
─────────────────────────────────────
_Rhema Imóveis — Palavra que age._`;

                try {
                    console.log(`📤 Enviando mensagem de teste para ${targetJid}...`);
                    const result = await socket.sendMessage(targetJid, { text: texto });
                    console.log(`✅ [SUCESSO] Mensagem enviada! KeyId: ${result?.key?.id}`);
                    
                    // Aguarda 2 segundos para o socket persistir e fecha suavemente
                    setTimeout(() => {
                        socket.end(undefined);
                        resolve();
                    }, 2000);
                } catch (sendErr) {
                    console.error("❌ Erro ao enviar mensagem:", sendErr);
                    socket.end(undefined);
                    reject(sendErr);
                }
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                console.log(`🔴 [CONEXÃO FECHADA] StatusCode: ${statusCode}`);
                if (statusCode === DisconnectReason.loggedOut) {
                    clearTimeout(timeout);
                    reject(new Error("Sessão desconectada ou deslogada"));
                }
            }
        });
    });
}

main().then(() => {
    console.log("=== TESTE CONCLUÍDO COM SUCESSO ===");
    process.exit(0);
}).catch((err) => {
    console.error("❌ FALHA NO TESTE:", err);
    process.exit(1);
});

