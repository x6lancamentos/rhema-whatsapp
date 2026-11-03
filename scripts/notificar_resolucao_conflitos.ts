import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";

interface Destinatario {
    nome: string;
    corretorId: number;
    telefone: string;
    jid: string;
    mensagem: string;
}

const DESTINATARIOS: Destinatario[] = [
    {
        nome: "Andressa Larocca",
        corretorId: 21,
        telefone: "5513981512755",
        jid: "5513981512755@s.whatsapp.net",
        mensagem: `Oi, Andressa! Tudo bem? 🚀

Fizemos uma auditoria completa na carteira ativa da Rhema hoje e organizamos alguns atendimentos que estavam duplicados no sistema:
• Os atendimentos #506 (Marília), #949 (Cleide), #983 (Andrea) e #982 (Eunice) foram baixados por duplicidade / compra já realizada, limpando sua esteira para não impactar suas métricas de SLA.

E para recompor sua esteira com força total, já transferi para o seu CRM Imoview 3 novos leads compradores exclusivos com opções no carrinho:
1. *Vera* (Atendimento #186) — Tel: (13) 99114-1261
2. *Isabel Nache* (Atendimento #110) — Tel: (11) 97392-7046
3. *Rosana* (Atendimento #132) — Tel: (13) 99669-7083

💡 *Dica:* Cada um deles já está com imóveis compatíveis do nosso estoque no carrinho para você iniciar a abordagem.

Pra cima, boas vendas! 🎯`
    },
    {
        nome: "Ulisses Dias Vieira",
        corretorId: 25,
        telefone: "5513988181515",
        jid: "5513988181515@s.whatsapp.net",
        mensagem: `Fala, Ulisses! Tudo bem? 🎯

Passando para alinhar um ajuste de carteira:
• O lead *Helio Gomes* (#578) foi unificado com o atendimento #832 do André Felipe, que já estava em contato avançado conduzindo uma permuta de sala comercial com ele. Baixamos o #578 para evitar duplicidade de abordagem com o cliente.

E para repor sua carteira com perfil qualificado, já transferi diretamente para o seu CRM:
👉 *Caio Mussi Taranto* (Atendimento #174) — Tel: (11) 96726-1424

💡 Já adicionei opções compatíveis do nosso estoque no carrinho do atendimento no Imoview para você trabalhar o resgate e agendamento.

Foco total e boas vendas! 🚀`
    },
    {
        nome: "André Felipe",
        corretorId: 24,
        telefone: "5513981404451",
        jid: "5513981404451@s.whatsapp.net",
        mensagem: `Fala, André! Tudo bem? 🚀

Passando para confirmar que o atendimento do cliente *Helio Gomes* (Atendimento #832) está 100% blindado e sob sua condução exclusiva!

Identificamos no sistema que havia um registro duplicado legado dele no CRM, mas já foi devidamente cancelado. Parabéns pela rápida qualificação e pelo mapeamento detalhado da permuta da sala comercial.

Bora pra cima fechar esse negócio! 🎯`
    },
    {
        nome: "Georjana Garcia",
        corretorId: 28,
        telefone: "5512991797436",
        jid: "5512991797436@s.whatsapp.net",
        mensagem: `Olá, Georjana! Tudo bem? 🎯

Passando para avisar que realizamos uma auditoria de duplicidades no CRM Imoview hoje e garantimos a blindagem e exclusividade dos seus atendimentos:
• *Cleide Costa* (Atendimento #213) — 100% exclusiva com você para retorno na segunda quinzena de novembro.
• *Bruno* (Atendimento #1004) — 100% exclusivo com você na seleção de imóveis.

Os atendimentos paralelos antigos que estavam em outros usuários foram devidamente baixados no sistema.

Excelente trabalho no acompanhamento dos clientes! 🚀`
    },
    {
        nome: "Flávia Mara",
        corretorId: 20,
        telefone: "5515974042000",
        jid: "5515974042000@s.whatsapp.net",
        mensagem: `Oi, Flávia! Tudo bem? 🌟

Fizemos uma auditoria de governança no CRM hoje e garantimos a blindagem e exclusividade total de dois atendimentos de alto potencial com você:
• *Valéria Kassai* (Atendimento #892) — Carteira exclusiva com você, opções no carrinho.
• *Alexandre Silva* (Atendimento #555) — Carteira exclusiva com você na fase de visita.

Os registros duplicados antigos em outros corretores foram cancelados no sistema.

Foco total nas visitas e fechamentos! 🚀`
    },
    {
        nome: "Tatiana Gonçalves",
        corretorId: 13,
        telefone: "5513981854677",
        jid: "5513981854677@s.whatsapp.net",
        mensagem: `Olá, Tatiana! Tudo bem? 🎯

Fizemos uma auditoria de duplicidades no CRM Imoview hoje:
• Confirmamos que o atendimento de *Maria Mello* (Atendimento #836) está 100% com você, com a visita realizada no imóvel 9789.
• O atendimento #989 (Marcia) foi unificado com a titularidade de Ana Maria Lisboa.

E para recompor sua carteira ativa, já transferi diretamente para o seu CRM:
👉 *Marcos Spolaor* (Atendimento #96) — Tel: (13) 99618-8029

💡 Já incluí opções compatíveis do estoque no carrinho para você entrar em contato e qualificar.

Bom trabalho e boas vendas! 🚀`
    },
    {
        nome: "Elaine do Nascimento",
        corretorId: 14,
        telefone: "5513976008877",
        jid: "5513976008877@s.whatsapp.net",
        mensagem: `Olá, Elaine! Tudo bem? 🎯

Fizemos uma auditoria de duplicidades no CRM hoje:
• O lead *Maria Mello* (#107) foi unificado com a Tatiana (#836) que já tinha agendamento e visita presencial recente no imóvel 9789.
• O lead *Maria Eliza* (Atendimento #941) está 100% exclusivo com você!

E para recompor sua carteira com um novo comprador, já transferi diretamente para o seu CRM:
👉 *Rodrigo* (Atendimento #113) — Tel: (13) 99141-6161

💡 O atendimento já está com opções selecionadas do estoque no carrinho para você apresentar na abordagem.

Boas vendas e foco total! 🚀`
    }
];

async function run() {
    console.log("=== NOTIFICAÇÃO VIA WHATSAPP AUTO: RESOLUÇÃO DE DUPLICIDADES E REDISTRIBUIÇÃO ===");

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
        setTimeout(() => reject(new Error("Timeout conectando ao WhatsApp (15s)")), 15000);
    });

    // Aguardar estabilização do socket (2.5s)
    await new Promise(r => setTimeout(r, 2500));

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    let sucessos = 0;
    for (let i = 0; i < DESTINATARIOS.length; i++) {
        const item = DESTINATARIOS[i];
        console.log(`\n[${i + 1}/${DESTINATARIOS.length}] Enviando WhatsApp para ${item.nome} (${item.telefone})...`);

        try {
            const sent = await socket.sendMessage(item.jid, {
                text: item.mensagem
            });

            console.log(`  -> [SUCESSO] Mensagem enviada para ${item.nome}! Message ID: ${sent?.key?.id}`);
            sucessos++;

            // Salvar no banco Prisma
            try {
                await prisma.message.create({
                    data: {
                        sessionId: dbSession.id,
                        remoteJid: item.jid,
                        senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                        fromMe: true,
                        keyId: sent?.key?.id || `RESOLV_${Date.now()}_${item.corretorId}`,
                        pushName: "Brunno Anastácio",
                        type: "TEXT",
                        content: item.mensagem,
                        status: "SENT",
                        timestamp: new Date()
                    }
                });
            } catch (errDb: any) {
                console.warn("  -> Aviso ao salvar no banco:", errDb.message);
            }

        } catch (err: any) {
            console.error(`  -> Erro ao enviar para ${item.nome}:`, err.message);
        }

        // Intervalo anti-spam seguro de 4.5 segundos
        if (i < DESTINATARIOS.length - 1) {
            console.log("  Aguardando cooldown de 4.5s...");
            await sleep(4500);
        }
    }

    console.log(`\n=========================================================`);
    console.log(`✅ ENVIOS CONCLUÍDOS: ${sucessos}/${DESTINATARIOS.length} mensagens entregues com sucesso!`);
    console.log(`=========================================================`);

    // Encerrar socket de forma limpa
    try {
        await sleep(1500);
        socket.end(undefined);
    } catch (e) {}

    process.exit(0);
}

run().catch(err => {
    console.error("Erro fatal na execução:", err);
    process.exit(1);
});

