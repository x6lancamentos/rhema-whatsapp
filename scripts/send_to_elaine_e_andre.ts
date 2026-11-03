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

const MSG_ELAINE = `Olá, Elaine! Tudo bem? 🎯

Passando para te avisar que acabei de direcionar *5 excelentes atendimentos de compra* diretamente para o seu usuário no *CRM Imoview*:

1. *Aline Sagiorato de Castro* (Atendimento #835) — R$ 650.000,00 (Ponta da Praia)
2. *Luiz Pereira* (Atendimento #840) — R$ 790.000,00 (Campo Grande)
3. *Zoraide De Cassia Saibro Alves* (Atendimento #780) — R$ 600.000,00 (Embaré)
4. *Lara Pascom* (Atendimento #782) — R$ 750.000,00 (Aparecida)
5. *Cristina Veralda* (Atendimento #800) — R$ 535.000,00 (Santos)

💡 *Diferencial:* Já selecionei de 2 a 3 imóveis compatíveis do nosso estoque e adicionei diretamente no *carrinho* de cada cliente no Imoview para você apresentar. Clientes com excelente perfil para você conduzir e fechar!

Bom trabalho e ótimas vendas! 🚀`;

const MSG_ANDRE = `Fala, André! Tudo bem? 🎯

Acabei de direcionar *5 leads quentes de compra com visitas já realizadas* diretamente para o seu usuário no *CRM Imoview*:

1. *Keyla* (Atendimento #706) — R$ 499.000,00 (Aparecida / Visita realizada recente)
2. *Leonardo Goes de Souza* (Atendimento #670) — R$ 490.000,00 (Aparecida / Visita realizada recente)
3. *Tassi Ferreira* (Atendimento #283) — R$ 320.000,00 (Compradora ativa / 3 visitas)
4. *Bruna / Paulo* (Atendimento #394) — R$ 620.000,00 (Embaré / Compradores de SP com visita)
5. *Gabriela Maria* (Atendimento #370) — R$ 597.000,00 (Embaré / Compradora de SP com 3 visitas)

💡 *Carrinho pronto:* Cada cliente já está com opções compatíveis do nosso estoque no carrinho do Imoview prontas para você entrar em contato, reaquecer o atendimento e agendar nova visita.

Bora pra cima virar essas visitas em proposta! 🚀`;

async function main() {
    console.log("\n1) Enviando para Elaine do Nascimento (5513976008877)...");
    await sendMessage("5513976008877@s.whatsapp.net", MSG_ELAINE);

    console.log("Aguardando 4 segundos...");
    await new Promise(r => setTimeout(r, 4000));

    console.log("\n2) Enviando para André Felipe (5513981404451)...");
    await sendMessage("5513981404451@s.whatsapp.net", MSG_ANDRE);

    console.log("\nTODOS OS ENVIOS FINALIZADOS COM SUCESSO!");
    process.exit(0);
}

main().catch(err => {
    console.error("Erro:", err);
    process.exit(1);
});
