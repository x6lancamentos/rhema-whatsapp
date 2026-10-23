import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";

const TARGET_GROUPS = [
    { name: "🚀 Time Rhema", jid: "120363427965736363@g.us" },
    { name: "Avisos Rhema", jid: "120363417825887441@g.us" },
    { name: "🎯🚀 Diretoria RHEMA", jid: "120363426753225157@g.us" }
];

const GROUP_MESSAGE = `📢 *COMUNICADO E ALINHAMENTO GERAL — EQUIPE RHEMA* 🚀

Olá, equipe! Tudo bem com todos?

Passando por aqui para trazer um alinhamento importante e novidades sobre o *Imoview* e a nossa rotina de atendimentos:

📲 *1. Atualização: Liberação do Telefone do Proprietário no Sistema*
Fizemos uma melhoria no sistema liberando o contato telefônico direto do proprietário para agilizar o agendamento de visitas, dando mais velocidade ao atendimento e aumentando a nossa eficiência e taxa de fechamento.
*(⚠️ Lembrando que, conforme a regra da casa, o acesso ao contato do proprietário é liberado exclusivamente para corretores com CRECI ativo).*

📋 *2. Qualidade e Padronização dos Cadastros no Imoview*
Para que nossas ferramentas, filtros e cruzamentos funcionem com máxima assertividade no *Radar*, precisamos de atenção redobrada em 3 pontos essenciais:

🚗 *Vagas de Garagem:*
Sempre informem com exatidão: quando a vaga for coletiva, especifiquem se é *suficiente* ou *insuficiente*. Isso evita surpresas e dúvidas na hora da visita com o cliente!

🏢 *Andar do Imóvel:*
Atenção para cadastrar o andar correto da unidade. É um dado fundamental para a apresentação do imóvel e para o cruzamento no sistema.

🌅 *Varanda vs. Sacada:*
Cuidado redobrado na distinção entre Varanda e Sacada! Preencher a opção correta é indispensável para que o imóvel seja localizado nos *filtros avançados do Radar*.

---
💡 *Por que isso é tão importante?*
Uma base de imóveis impecável e padronizada, somada à agilidade no agendamento de visitas, nos permite encontrar opções muito mais rápido no Radar, atender melhor nossos clientes e acelerar o fechamento de negócios!

Contamos com a atenção e o capricho de todos. Qualquer dúvida sobre o preenchimento, estamos à disposição! Bora pra cima e ótimas vendas! 🚀

Abraço,  
*Brunno Anastácio*`;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log("=== INICIANDO ENVIO DO COMUNICADO PARA OS GRUPOS ===");

    const dbSession = await prisma.session.findUnique({
        where: { sessionId: SESSION_ID }
    });
    if (!dbSession) throw new Error("Sessão não encontrada no banco");

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
                console.log("[OK] Conexão com o WhatsApp aberta!");
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado"));
                }
            }
        });
    });

    for (let i = 0; i < TARGET_GROUPS.length; i++) {
        const group = TARGET_GROUPS[i];
        console.log(`\n[${i + 1}/${TARGET_GROUPS.length}] Enviando para o grupo: ${group.name} (${group.jid})...`);

        try {
            const sent = await socket.sendMessage(group.jid, { text: GROUP_MESSAGE });
            console.log(`  ✅ [ENVIADO COM SUCESSO] ${group.name} recebeu! Key ID: ${sent?.key?.id}`);

            // Salvar no banco
            try {
                await prisma.message.create({
                    data: {
                        sessionId: dbSession.id,
                        remoteJid: group.jid,
                        senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                        fromMe: true,
                        keyId: sent?.key?.id || `GRP_${Date.now()}_${i}`,
                        pushName: "Brunno Anastácio",
                        type: "TEXT",
                        content: GROUP_MESSAGE,
                        status: "SENT",
                        timestamp: new Date()
                    }
                });
            } catch (e) {}

        } catch (err) {
            console.error(`  ❌ [FALHA] Erro ao enviar para ${group.name}:`, err);
        }

        if (i < TARGET_GROUPS.length - 1) {
            console.log("  ⏳ Aguardando 10 segundos antes do próximo grupo...");
            await sleep(10000);
        }
    }

    console.log("\n🎉 === ENVIO CONCLUÍDO PARA TODOS OS GRUPOS ===");
    await sleep(3000);
    process.exit(0);
}

run().catch((err) => {
    console.error("Erro fatal no envio para grupos:", err);
    process.exit(1);
});
