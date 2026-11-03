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

const MSG_ANDRESSA = `Oi, Andressa! Tudo bem? 🚀

Além de toda a sua carteira de resgate estar 100% atualizada e ativa em Venda, acabei de colocar mais *5 leads de alto potencial de compra* no seu *CRM Imoview*:

1. *Virgínia Carvalho* (Atendimento #808) — R$ 688.000,00 (Embaré)
2. *Nathalia Araujo* (Atendimento #625) — R$ 680.000,00 (Gonzaga)
3. *Solange* (Atendimento #537) — R$ 680.000,00 (Boqueirão)
4. *Ana* (Atendimento #482) — R$ 680.000,00 (Ponta da Praia)
5. *Marília Previero* (Atendimento #506) — R$ 663.000,00 (Santos)

💡 *Carrinho abastecido:* Todos já estão com opções compatíveis do nosso estoque no carrinho para você apresentar na abordagem.

Vamos com tudo pra cima dessa semana! 🎯`;

const MSG_TATIANA = `Olá, Tatiana! Tudo bem? 🎯

Selecionei a dedo *5 compradores com perfil qualificado* e transferi diretamente para o seu usuário no *CRM Imoview*:

1. *Dra. Alessandra* (Atendimento #495) — R$ 516.000,00 (Gonzaga)
2. *Dra. Sandra Maria Passini* (Atendimento #718) — R$ 600.000,00 (Embaré / Advogada)
3. *Dr. Ricardo Teles* (Atendimento #773) — R$ 580.000,00 (Boqueirão / Médico)
4. *Ricardo Alencar* (Atendimento #725) — R$ 585.000,00 (Marapé)
5. *Marcos / Áurea* (Atendimento #700) — R$ 460.000,00 (Aparecida)

💡 *Dica:* Cada atendimento já está com opções selecionadas no carrinho do Imoview prontas para você entrar em contato e agendar as visitas.

Bom trabalho e foco total no resultado! 🚀`;

async function main() {
    console.log("\n1) Enviando para Andressa Larocca (5513981512755)...");
    await sendMessage("5513981512755@s.whatsapp.net", MSG_ANDRESSA);

    console.log("Aguardando 4 segundos...");
    await new Promise(r => setTimeout(r, 4000));

    console.log("\n2) Enviando para Tatiana Gonçalves (5513981854677)...");
    await sendMessage("5513981854677@s.whatsapp.net", MSG_TATIANA);

    console.log("\nTODOS OS ENVIOS FINALIZADOS COM SUCESSO!");
    process.exit(0);
}

main().catch(err => {
    console.error("Erro:", err);
    process.exit(1);
});
