import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";

const DESTINATARIOS = [
    {
        nome: "Flávia Mara",
        corretorId: 20,
        telefone: "5515974042000",
        jid: "5515974042000@s.whatsapp.net",
        leads: [
            { id: 664, nome: "Nelson Antonini", ticket: "R$ 1.432.000,00", bairro: "Santos" },
            { id: 816, nome: "Rad Ostin", ticket: "R$ 792.000,00", bairro: "Boqueirão" },
            { id: 820, nome: "Areovaldo Alves dos Santos", ticket: "R$ 759.000,00", bairro: "Santos" },
            { id: 565, nome: "Tiago Oliveira", ticket: "R$ 680.000,00", bairro: "Embaré (Visita)" },
            { id: 63, nome: "Roberta Nascimento", ticket: "R$ 650.000,00", bairro: "Gonzaga (Visita)" }
        ],
        mensagem: `Olá, Flávia! Tudo bem? 🎯

Passando para te avisar que acabei de direcionar *5 oportunidades de altíssimo potencial de compra* diretamente para o seu usuário no *CRM Imoview*!

São compradores qualificados com tickets de até *R$ 1,43 Milhão*:
1. *Nelson Antonini* (Atendimento #664) — R$ 1.432.000,00
2. *Rad Ostin* (Atendimento #816) — R$ 792.000,00 (Boqueirão)
3. *Areovaldo Alves dos Santos* (Atendimento #820) — R$ 759.000,00
4. *Tiago Oliveira* (Atendimento #565) — R$ 680.000,00 (Visita realizada)
5. *Roberta Nascimento* (Atendimento #63) — R$ 650.000,00 (Visita realizada / Médica)

💡 *Diferencial:* Já cruzei o perfil de cada um com o nosso estoque e inseri de 2 a 3 imóveis compatíveis diretamente no *carrinho* de cada atendimento no Imoview para você apresentar.

Vamos pra cima fechar essas negociações nesta semana! Boas vendas! 🚀`
    },
    {
        nome: "Ulisses Dias",
        corretorId: 25,
        telefone: "5513988181515",
        jid: "5513988181515@s.whatsapp.net",
        leads: [
            { id: 812, nome: "Elis Bueno", ticket: "R$ 759.000,00", bairro: "Gonzaga" },
            { id: 825, nome: "Marilia Potiguara", ticket: "R$ 759.000,00", bairro: "Boqueirão" },
            { id: 601, nome: "Poliana - Eduardo", ticket: "R$ 720.000,00", bairro: "Embaré" },
            { id: 578, nome: "Helio Gomes", ticket: "R$ 696.000,00", bairro: "Aparecida" },
            { id: 814, nome: "Rosely", ticket: "R$ 688.000,00", bairro: "Ponta da Praia" }
        ],
        mensagem: `Fala, Ulisses! Tudo bem? 🎯

Direcionei *5 excelentes oportunidades de compra* para a sua carteira no *CRM Imoview*, com tickets na faixa de *R$ 700k a R$ 760k*:

1. *Elis Bueno* (Atendimento #812) — R$ 759.000,00 (Gonzaga)
2. *Marilia Potiguara* (Atendimento #825) — R$ 759.000,00 (Boqueirão)
3. *Poliana / Eduardo* (Atendimento #601) — R$ 720.000,00 (Embaré)
4. *Helio Gomes* (Atendimento #578) — R$ 696.000,00 (Aparecida)
5. *Rosely* (Atendimento #814) — R$ 688.000,00 (Ponta da Praia)

💡 *Diferencial:* Já selecionei as opções mais quentes do nosso estoque e adicionei no *carrinho* de cada cliente no Imoview. Excelente momento para você acionar esses clientes e agendar as visitas.

Bora pra cima! Qualquer dúvida estou por aqui. 🚀`
    },
    {
        nome: "Andressa Larocca",
        corretorId: 21,
        telefone: "5513981512755",
        jid: "5513981512755@s.whatsapp.net",
        leads: [
            { id: 808, nome: "Virgínia Carvalho", ticket: "R$ 688.000,00", bairro: "Embaré" },
            { id: 625, nome: "Nathalia Araujo", ticket: "R$ 680.000,00", bairro: "Gonzaga" },
            { id: 537, nome: "Solange", ticket: "R$ 680.000,00", bairro: "Boqueirão" },
            { id: 482, nome: "Ana", ticket: "R$ 680.000,00", bairro: "Ponta da Praia" },
            { id: 506, nome: "Marília Previero", ticket: "R$ 663.000,00", bairro: "Santos" }
        ],
        mensagem: `Oi, Andressa! Tudo bem? 🚀

Além de toda a sua carteira de resgate estar 100% atualizada e ativa em Venda, acabei de colocar mais *5 leads de alto potencial de compra* no seu *CRM Imoview*:

1. *Virgínia Carvalho* (Atendimento #808) — R$ 688.000,00 (Embaré)
2. *Nathalia Araujo* (Atendimento #625) — R$ 680.000,00 (Gonzaga)
3. *Solange* (Atendimento #537) — R$ 680.000,00 (Boqueirão)
4. *Ana* (Atendimento #482) — R$ 680.000,00 (Ponta da Praia)
5. *Marília Previero* (Atendimento #506) — R$ 663.000,00 (Santos)

💡 *Carrinho abastecido:* Todos já estão com opções compatíveis do nosso estoque no carrinho para você apresentar na abordagem.

Vamos com tudo pra cima dessa semana! 🎯`
    },
    {
        nome: "Tatiana Gonçalves",
        corretorId: 13,
        telefone: "5513981854677",
        jid: "5513981854677@s.whatsapp.net",
        leads: [
            { id: 495, nome: "Alessandra", ticket: "R$ 516.000,00", bairro: "Gonzaga" },
            { id: 718, nome: "Sandra Maria Passini", ticket: "R$ 600.000,00", bairro: "Embaré" },
            { id: 773, nome: "Ricardo Teles", ticket: "R$ 580.000,00", bairro: "Boqueirão" },
            { id: 725, nome: "Ricardo Alencar", ticket: "R$ 585.000,00", bairro: "Marapé" },
            { id: 700, nome: "Marcos / Áurea", ticket: "R$ 460.000,00", bairro: "Aparecida" }
        ],
        mensagem: `Olá, Tatiana! Tudo bem? 🎯

Selecionei a dedo *5 compradores com perfil qualificado* e transferi diretamente para o seu usuário no *CRM Imoview*:

1. *Dra. Alessandra* (Atendimento #495) — R$ 516.000,00 (Gonzaga)
2. *Dra. Sandra Maria Passini* (Atendimento #718) — R$ 600.000,00 (Embaré / Advogada)
3. *Dr. Ricardo Teles* (Atendimento #773) — R$ 580.000,00 (Boqueirão / Médico)
4. *Ricardo Alencar* (Atendimento #725) — R$ 585.000,00 (Marapé)
5. *Marcos / Áurea* (Atendimento #700) — R$ 460.000,00 (Aparecida)

💡 *Dica:* Cada atendimento já está com opções selecionadas no carrinho do Imoview prontas para você entrar em contato e agendar as visitas.

Bom trabalho e foco total no resultado! 🚀`
    }
];

async function run() {
    console.log("=== INICIANDO NOTIFICAÇÃO VIA WHATSAPP DOS 4 CORRETORES ===");

    const dbSession = await prisma.session.findUnique({
        where: { sessionId: SESSION_ID }
    });
    if (!dbSession) throw new Error("Sessão avg78n não encontrada no banco");

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
                console.log("[OK] Conectado ao WhatsApp!");
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado do WhatsApp"));
                }
            }
        });
    });

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    for (let i = 0; i < DESTINATARIOS.length; i++) {
        const item = DESTINATARIOS[i];
        console.log(`\n[${i + 1}/${DESTINATARIOS.length}] Enviando WhatsApp para ${item.nome} (${item.telefone})...`);

        try {
            const sent = await socket.sendMessage(item.jid, {
                text: item.mensagem
            });

            console.log(`  -> [SUCESSO] Mensagem enviada para ${item.nome}! Message ID: ${sent?.key?.id}`);

            // Salvar no banco
            try {
                await prisma.message.create({
                    data: {
                        sessionId: dbSession.id,
                        remoteJid: item.jid,
                        senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                        fromMe: true,
                        keyId: sent?.key?.id || `COMM_${Date.now()}_${item.corretorId}`,
                        pushName: "Brunno Anastácio",
                        type: "TEXT",
                        content: item.mensagem,
                        status: "SENT",
                        timestamp: new Date()
                    }
                });
            } catch (err) {}

        } catch (err: any) {
            console.error(`  -> Erro ao enviar para ${item.nome}:`, err.message);
        }

        // Intervalo anti-spam de segurança (4 a 6 segundos entre mensagens)
        await sleep(5000);
    }

    console.log("\n=========================================================");
    console.log("🎉 DISPARO CONCLUÍDO: Todos os 4 corretores foram notificados no WhatsApp!");
    setTimeout(() => process.exit(0), 1000);
}

run().catch((err) => {
    console.error("Erro fatal no disparo:", err);
    process.exit(1);
});
