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

const MSG_ROSELI = `Olá, Roseli! Tudo bem? 🎯

Passando para te avisar que acabei de direcionar *5 novos atendimentos de compra* diretamente para o seu usuário no *CRM Imoview*:

1. *Marcia* (Atendimento #985) — R$ 320.000,00 (Aparecida / Ponta da Praia / Embaré)
2. *Tânia* (Atendimento #885) — R$ 480.000,00 (Embaré / Orla)
3. *Diego Mattera* (Atendimento #903) — R$ 550.000,00 (Embaré / Comprador de SP)
4. *Thaís Soares Jucá Ribeiro* (Atendimento #879) — R$ 450.000,00 (Boqueirão)
5. *Lucas* (Atendimento #752) — R$ 400.000,00 (Campo Grande)

💡 *Diferencial:* Já selecionei até 3 imóveis compatíveis do nosso estoque e adicionei diretamente no *carrinho* de cada cliente no Imoview para você apresentar. Todos são clientes de venda para você fazer contato imediato, qualificar e agendar visita.

Bom trabalho e ótimas vendas! 🚀`;

const MSG_LENIARA = `Olá, Leniára! Tudo bem? 🎯

Passando para te avisar que acabei de direcionar *5 novos atendimentos de compra* diretamente para o seu usuário no *CRM Imoview*:

1. *Andrea Felix* (Atendimento #889) — R$ 430.000,00 (Encruzilhada / Compradora à vista, quer fechar rápido!)
2. *Yasmin Hassane Hammoud Khatib* (Atendimento #869) — R$ 450.000,00 (Aparecida)
3. *Alexandra* (Atendimento #849) — R$ 500.000,00 (Embaré / Aparecida)
4. *Thais Baba* (Atendimento #897) — R$ 520.000,00 (Embaré / Compradora de SP)
5. *Maria Leonor Calçada* (Atendimento #870) — R$ 480.000,00 (Boqueirão)

💡 *Diferencial:* Já selecionei até 3 imóveis compatíveis do nosso estoque e adicionei diretamente no *carrinho* de cada atendimento no Imoview. Oportunidades com excelente perfil para você fazer contato ágil e evoluir para visita!

Bom trabalho e ótimas negociações! 🚀`;

async function main() {
    console.log("\n1) Enviando para Roseli Lopes (5513974103368)...");
    await sendMessage("5513974103368@s.whatsapp.net", MSG_ROSELI);

    console.log("Aguardando 4 segundos...");
    await new Promise(r => setTimeout(r, 4000));

    console.log("\n2) Enviando para Leniára Araújo (5513996461664)...");
    await sendMessage("5513996461664@s.whatsapp.net", MSG_LENIARA);

    console.log("\nTODOS OS ENVIOS FINALIZADOS COM SUCESSO!");
    process.exit(0);
}

main().catch(err => {
    console.error("Erro:", err);
    process.exit(1);
});
