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

    // Gravar no prisma
    try {
        const dbSession = await prisma.session.findUnique({ where: { sessionId: SESSION_ID } });
        if (dbSession) {
            await prisma.message.create({
                data: {
                    sessionId: dbSession.id,
                    remoteJid: targetJid,
                    senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                    fromMe: true,
                    keyId: sent?.key?.id || `COMM_${Date.now()}`,
                    pushName: "Brunno Anastácio",
                    type: "TEXT",
                    content: text,
                    status: "SENT",
                    timestamp: new Date()
                }
            });
        }
    } catch (e) {}

    await new Promise(r => setTimeout(r, 2000));
}

const MSG_LENIARA = `Olá, Leniára! Tudo bem? 🎯

A Diretoria realizou uma redistribuição de carteira e direcionou *5 atendimentos ativos de compra* diretamente para o seu usuário no *CRM Imoview*:

1. *SAMARA OLIVEIRA DA PAZ* (Atendimento #906) — Macuco (Busca imóvel/sobrado até R$ 400.000,00)
2. *Rose G Mazzini* (Atendimento #898) — José Menino (R$ 468.000,00 / Compradora de SP)
3. *Felipe Derek* (Atendimento #884) — Embaré (R$ 450.000,00 / Apto 2 dorms)
4. *Ne Braga* (Atendimento #880) — Boqueirão (R$ 280.000,00 / Comprador do RJ)
5. *Edgar* (Atendimento #874) — Aparecida (R$ 550.000,00 / Apto/Cobertura 3 dorms)

💡 *Carrinho abastecido:* Já selecionamos até 3 imóveis compatíveis do nosso estoque e adicionamos diretamente no carrinho de cada cliente no Imoview para você apresentar de imediato.

Bons contatos e ótimas vendas! 🚀`;

const MSG_ROSELI = `Olá, Roseli! Tudo bem? 🎯

A Diretoria realizou uma redistribuição de carteira e direcionou *5 atendimentos ativos de compra* diretamente para o seu usuário no *CRM Imoview*:

1. *Karen* (Atendimento #946) — Itararé / Santos (R$ 500.000,00 / Apto 2 dorms)
2. *Sheila Souza* (Atendimento #907) — Santa Maria (R$ 320.000,00 / Casa / Em agendamento)
3. *Otamar Pelusio* (Atendimento #900) — Embaré (R$ 450.000,00 / Apto 2 dorms)
4. *Eloisa* (Atendimento #896) — Ponta da Praia (R$ 392.000,00 / Fase de Visita)
5. *Ana Luiza Cassilhas* (Atendimento #883) — Aparecida / Ponta da Praia (R$ 450.000,00 / Apto)

💡 *Carrinho abastecido:* Já selecionamos até 3 imóveis compatíveis do nosso estoque e adicionamos diretamente no carrinho de cada atendimento no Imoview para você apresentar de imediato.

Bons contatos e ótimas vendas! 🚀`;

async function main() {
    console.log("\n1) Enviando nova carteira para Leniára Araújo (5513996461664)...");
    await sendMessage("5513996461664@s.whatsapp.net", MSG_LENIARA);

    console.log("Aguardando 4 segundos...");
    await new Promise(r => setTimeout(r, 4000));

    console.log("\n2) Enviando nova carteira para Roseli Lopes (5513974103368)...");
    await sendMessage("5513974103368@s.whatsapp.net", MSG_ROSELI);

    console.log("\nTODOS OS ENVIOS FINALIZADOS COM SUCESSO!");
    process.exit(0);
}

main().catch(err => {
    console.error("Erro:", err);
    process.exit(1);
});
