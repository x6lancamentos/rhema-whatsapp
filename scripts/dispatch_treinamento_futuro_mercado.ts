import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";
import { getGestorSession } from "../src/lib/rhema-session";

interface Destinatario {
    nome: string;
    apelido: string;
    telefone: string;
    jid: string;
    mensagem: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Lista rigorosamente calibrada dos 9 corretores oficiais ativos
// Roseli e Luana estão EXCLUÍDAS
const DESTINATARIOS: Destinatario[] = [
    {
        nome: "André Felipe O. Cavalcante",
        apelido: "André Felipe",
        telefone: "5513981404451",
        jid: "5513981404451@s.whatsapp.net",
        mensagem: 
`Fala, André Felipe! Tudo bem? 🚀

Passando para te dar um alinhamento fundamental na sua rampa de evolução aqui na Rhema.

Nesta próxima sexta-feira, às 09:30h, teremos um treinamento exclusivo e presencial na imobiliária: *O Futuro do Mercado Imobiliário*.

Para você que está estruturando o seu método e construindo a sua primeira venda com consistência, entender para onde o mercado está caminhando, como qualificar o cliente no cenário atual e antecipar as demandas dos compradores vai te dar muita segurança na mesa e no atendimento.

📅 *Data:* Próxima sexta-feira (06/11)
⏰ *Horário:* 09:30h pontual
📍 *Local:* Sede Rhema Imóveis

Trave a sua agenda. Foco no processo e no aprendizado diário que o resultado vem. Conto com você lá! 🤝`
    },
    {
        nome: "Tatiana Gonçalves de Oliveira",
        apelido: "Tatiana",
        telefone: "5513981854677",
        jid: "5513981854677@s.whatsapp.net",
        mensagem:
`Tatiana! 🦁🔥 Tudo ótimo?

Quem tem a sua energia e essa garra de fechar negócio sabe que conhecimento afiado é munição pura para dominar o mercado!

Nesta próxima sexta-feira, às 09:30h, vamos fazer um treinamento de altíssimo impacto aqui na sede: *O Futuro do Mercado Imobiliário*.

Vamos abrir o jogo sobre as grandes transformações de vendas, comportamento dos clientes e como antecipar as jogadas para colocar ainda mais proposta na mesa e acelerar fechamento. Sua presença e sua voz são indispensáveis para puxar o time pra cima!

📅 *Data:* Próxima sexta-feira (06/11)
⏰ *Horário:* 09:30h pontual
📍 *Local:* Sede Rhema Imóveis

Bloqueie esse horário com chave de ouro. Vai ser pesado! Bora pra cima! 💥🚀`
    },
    {
        nome: "Flávia Mara de Mattos",
        apelido: "Flávia",
        telefone: "5515974042000",
        jid: "5515974042000@s.whatsapp.net",
        mensagem:
`Olá, Flávia! 🎯 Tudo bem?

Direto ao ponto para acelerar a nossa conversão e giro de carteira:

Nesta próxima sexta-feira, às 09:30h, teremos o treinamento presencial *O Futuro do Mercado Imobiliário* aqui na Rhema.

O foco é 100% prático: tendências reais de demanda em Santos, onde estão as melhores oportunidades de alto giro para os próximos meses e como transformar esses movimentos em mais visitas agendadas e negócios fechados.

📅 *Data:* Próxima sexta-feira (06/11)
⏰ *Horário:* 09:30h pontual
📍 *Local:* Sede Rhema Imóveis

Organize sua agenda de clientes para garantir presença integral. Vamos com tudo! ⚡`
    },
    {
        nome: "Leniára R. M. Araújo",
        apelido: "Leniára",
        telefone: "5513996461664",
        jid: "5513996461664@s.whatsapp.net",
        mensagem:
`Olá, Leniára. 💼

Alinhamento rápido de agenda:

Nesta próxima sexta-feira, às 09:30h, realizaremos na sede o treinamento *O Futuro do Mercado Imobiliário*.

Pauta direta: movimentações do mercado, perfil do comprador atual e estratégias assertivas para condução e fechamento.

📅 *Data:* Próxima sexta-feira (06/11)
⏰ *Horário:* 09:30h pontual
📍 *Local:* Rhema Imóveis

Sua presença é fundamental. Foco e execução!`
    },
    {
        nome: "Elaine do Nascimento",
        apelido: "Elaine",
        telefone: "5513976008877",
        jid: "5513976008877@s.whatsapp.net",
        mensagem:
`Bom dia, Elaine! 📋 Tudo bem?

Passando para compartilhar um alinhamento estrutural importante para a organização da nossa esteira de atendimentos e planejamento dos próximos ciclos.

Nesta próxima sexta-feira, às 09:30h, teremos nosso treinamento presencial *O Futuro do Mercado Imobiliário* aqui na Rhema.

Vamos mapear as transformações do setor, evolução no comportamento de compra e ferramentas essenciais para estruturar a carteira e o follow-up com os clientes com máxima assertividade.

📅 *Data:* Próxima sexta-feira (06/11)
⏰ *Horário:* 09:30h pontual
📍 *Local:* Sede Rhema Imóveis

Reserve esse espaço no seu planner semanal. Sua participação estruturada enriquece muito a equipe! ☀️`
    },
    {
        nome: "Kaylane Assumpção",
        apelido: "Kaylane",
        telefone: "5513992123879",
        jid: "5513992123879@s.whatsapp.net",
        mensagem:
`Oi, Kaylane! Tudo bem? 🌸✨

Passando para te fazer um convite muito especial e importante para a sua caminhada aqui com a gente na Rhema!

Nesta próxima sexta-feira, às 09:30h, vamos nos reunir na imobiliária para o treinamento *O Futuro do Mercado Imobiliário*.

Será um momento muito bacana e acolhedor de aprendizado, onde vamos ver passo a passo como o mercado imobiliário está se desenhando e como você pode usar isso para se sentir cada vez mais segura, preparada e confiante no atendimento aos clientes.

📅 *Data:* Próxima sexta-feira (06/11)
⏰ *Horário:* 09:30h pontual
📍 *Local:* Sede Rhema Imóveis

Já reserva esse tempinho na sua agenda com carinho. Vai ser ótimo estarmos juntos! Um abraço. 🤗`
    },
    {
        nome: "Andressa Larocca Orlandi Pereira",
        apelido: "Andressa",
        telefone: "5513981512755",
        jid: "5513981512755@s.whatsapp.net",
        mensagem:
`Bora, Andressa! ⚡🔥 Tudo bem?

Momento de imprimir tração forte e colocar a Rhema na vanguarda do mercado!

Nesta próxima sexta-feira, às 09:30h, teremos na imobiliária o treinamento *O Futuro do Mercado Imobiliário*.

Vamos mergulhar em inteligência de mercado, velocidade de resposta, perfil dos novos compradores e estratégias agressivas de captação e posicionamento para você acelerar suas entregas e se destacar na esteira comercial.

📅 *Data:* Próxima sexta-feira (06/11)
⏰ *Horário:* 09:30h pontual
📍 *Local:* Sede Rhema Imóveis

Trava a agenda desde já que o encontro vai ser dinâmico e direto ao ponto. Pra cima! 🚀💪`
    },
    {
        nome: "Ulisses Dias Vieira",
        apelido: "Ulisses",
        telefone: "5513988181515",
        jid: "5513988181515@s.whatsapp.net",
        mensagem:
`Grande Ulisses! 🤝 Tudo certo por aí?

Alinhamento de parceria e visão estratégica de mercado:

Nesta próxima sexta-feira, às 09:30h, nos reuniremos aqui na sede para o treinamento *O Futuro do Mercado Imobiliário*.

Você que tem um perfil muito consultivo e sólido com os clientes vai aproveitar demais: vamos discutir tendências econômicas, novos formatos de negociação, valorização imobiliária em Santos e como estruturar oportunidades de alto nível para investidores e famílias.

📅 *Data:* Próxima sexta-feira (06/11)
⏰ *Horário:* 09:30h pontual
📍 *Local:* Sede Rhema Imóveis

Conto com a sua presença e visão estratégica na nossa mesa. Tamo junto! 👊`
    },
    {
        nome: "Georjana Garcia Gonçalves",
        apelido: "Georjana",
        telefone: "5512991797436",
        jid: "5512991797436@s.whatsapp.net",
        mensagem:
`Olá, Georjana! Tudo bem? 🌟

Passando para te trazer um alinhamento muito importante para o nosso crescimento e consolidação aqui na Rhema.

Nesta próxima sexta-feira, às 09:30h, teremos o nosso encontro presencial sobre *O Futuro do Mercado Imobiliário* na sede da imobiliária.

Vamos debater posicionamento profissional, captação qualificada e como as novas ferramentas e tendências do setor imobiliário potencializam o trabalho de quem atua de forma organizada e consultiva.

📅 *Data:* Próxima sexta-feira (06/11)
⏰ *Horário:* 09:30h pontual
📍 *Local:* Sede Rhema Imóveis

Já deixe reservado esse horário na sua programação. Sua participação é essencial para a nossa equipe! Um abraço. 🤝✨`
    }
];

// Trava inegociável contra envio a Roseli ou Luana
const BLOQUEADOS_JIDS = [
    "5513974103368@s.whatsapp.net", // Roseli
    "5513996960556@s.whatsapp.net", // Luana
];

async function enviarIndividual(dest: Destinatario, sessionId: string) {
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

    return new Promise<{ keyId: string }>((resolve, reject) => {
        let sent = false;
        const timeout = setTimeout(() => {
            try { socket.end(undefined); } catch {}
            if (!sent) reject(new Error("Timeout conectando (25s)"));
        }, 25000);

        socket.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === "open" && !sent) {
                sent = true;
                clearTimeout(timeout);
                try {
                    // Simulação humana de presença
                    await socket.sendPresenceUpdate("composing", dest.jid);
                    await sleep(2000);
                    await socket.sendPresenceUpdate("paused", dest.jid);

                    const result = await socket.sendMessage(dest.jid, { text: dest.mensagem });
                    const keyId = result?.key?.id || `TXT_${Date.now()}`;

                    // Registro no banco de dados da sessão
                    try {
                        const dbSession = await prisma.session.findUnique({ where: { sessionId } });
                        if (dbSession) {
                            await prisma.message.create({
                                data: {
                                    sessionId: dbSession.id,
                                    remoteJid: dest.jid,
                                    senderJid: socket.user?.id || `${sessionId}@s.whatsapp.net`,
                                    fromMe: true,
                                    keyId: keyId,
                                    pushName: "Brunno Anastácio",
                                    type: "TEXT",
                                    content: dest.mensagem,
                                    status: "SENT",
                                    timestamp: new Date()
                                }
                            });
                        }
                    } catch (dbErr) {}

                    await sleep(1500);
                    try { socket.end(undefined); } catch {}
                    resolve({ keyId });
                } catch (sendErr) {
                    try { socket.end(undefined); } catch {}
                    reject(sendErr);
                }
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (!sent && statusCode === DisconnectReason.loggedOut) {
                    clearTimeout(timeout);
                    reject(new Error("Sessão desconectada (Logged Out)"));
                }
            }
        });
    });
}

async function main() {
    console.log("=================================================================");
    console.log("🚀 RHEMA OS — DISPARO DE CONVITE: O FUTURO DO MERCADO IMOBILIÁRIO");
    console.log("=================================================================");

    const gestorSession = await getGestorSession();
    if (!gestorSession) {
        throw new Error("Sessão do Gestor ('5mhrx9') não encontrada no banco.");
    }

    const sessionId = gestorSession.sessionId;
    console.log(`[Configuração] Remetente: Sessão do Gestor ${sessionId} (${gestorSession.name})`);
    console.log(`[Configuração] Total de Corretores Oficiais Ativos: ${DESTINATARIOS.length}`);
    console.log(`[Blindagem de Segurança] Roseli e Luana: TOTALMENTE BLOQUEADAS E EXCLUÍDAS.`);

    // Verificação de segurança adicional
    for (const d of DESTINATARIOS) {
        if (BLOQUEADOS_JIDS.includes(d.jid) || /roseli|luana/i.test(d.nome)) {
            throw new Error(`VIOLAÇÃO GRAVE DE SEGURANÇA: Tentativa de envio para destinatário bloqueado (${d.nome})`);
        }
    }

    let sucessos = 0;
    let falhas = 0;

    for (let i = 0; i < DESTINATARIOS.length; i++) {
        const dest = DESTINATARIOS[i];
        console.log(`\n-------------------------------------------------------------`);
        console.log(`[${i + 1}/${DESTINATARIOS.length}] Enviando para ${dest.nome} (${dest.telefone})...`);

        let retryCount = 0;
        let enviado = false;

        while (retryCount < 2 && !enviado) {
            try {
                const res = await enviarIndividual(dest, sessionId);
                console.log(`✅ [SUCESSO] Entregue para ${dest.apelido}! KeyId: ${res.keyId}`);
                sucessos++;
                enviado = true;
            } catch (err: any) {
                retryCount++;
                console.warn(`⚠️ [TENTATIVA ${retryCount}/2] Erro ao enviar para ${dest.nome}: ${err?.message || err}`);
                if (retryCount < 2) {
                    console.log(`⏳ Aguardando 5s para retentar envio individual...`);
                    await sleep(5000);
                } else {
                    console.error(`❌ [FALHA DEFINITIVA] Não foi possível entregar para ${dest.nome}.`);
                    falhas++;
                }
            }
        }

        // Jitter de segurança entre envios (7 a 12 segundos)
        if (i < DESTINATARIOS.length - 1) {
            const jitterSec = Math.floor(7 + Math.random() * 6);
            console.log(`⏳ Jitter anti-spam: aguardando ${jitterSec}s antes do próximo corretor...`);
            await sleep(jitterSec * 1000);
        }
    }

    console.log(`\n=============================================================`);
    console.log(`🎉 DISPARO FINALIZADO!`);
    console.log(`• Entregues com sucesso: ${sucessos}`);
    console.log(`• Falhas: ${falhas}`);
    console.log(`• Bloqueadas (Roseli / Luana): 0 (100% blindadas)`);
    console.log(`=============================================================`);

    process.exit(0);
}

main().catch((err) => {
    console.error("Erro fatal no disparo:", err);
    process.exit(1);
});
