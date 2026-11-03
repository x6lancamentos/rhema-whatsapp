import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
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

// André Felipe já recebeu com sucesso (KeyId: 3EB00892900A90CAA0C2E2)
// Lista dos 8 corretores restantes:
const DESTINATARIOS_RESTANTES: Destinatario[] = [
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

async function enviarUm(dest: Destinatario, sessionId: string): Promise<string> {
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

    return new Promise<string>((resolve, reject) => {
        let sent = false;
        const timeout = setTimeout(() => {
            try { socket.end(undefined); } catch {}
            if (!sent) reject(new Error("Timeout após 30 segundos"));
        }, 30000);

        socket.ev.on("connection.update", async (update) => {
            const { connection } = update;
            if (connection === "open" && !sent) {
                sent = true;
                clearTimeout(timeout);
                try {
                    console.log(`🟢 [CONECTADO] Disparando para ${dest.nome} (${dest.telefone})...`);
                    const result = await socket.sendMessage(dest.jid, { text: dest.mensagem });
                    const keyId = result?.key?.id || `TXT_${Date.now()}`;
                    console.log(`✅ [SUCESSO] Entregue para ${dest.apelido}! KeyId: ${keyId}`);

                    // Registra no banco
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
                    } catch (e) {}

                    await sleep(2000);
                    try { socket.end(undefined); } catch {}
                    resolve(keyId);
                } catch (sendErr) {
                    try { socket.end(undefined); } catch {}
                    reject(sendErr);
                }
            }
        });
    });
}

async function main() {
    console.log("=================================================================");
    console.log("🚀 RHEMA OS — DISPARO PARA OS 8 CORRETORES RESTANTES");
    console.log("=================================================================");

    const gestorSession = await getGestorSession();
    if (!gestorSession) throw new Error("Sessão do Gestor não encontrada.");

    const sessionId = gestorSession.sessionId;

    // Dupla checagem de trava de segurança
    for (const d of DESTINATARIOS_RESTANTES) {
        if (BLOQUEADOS_JIDS.includes(d.jid) || /roseli|luana/i.test(d.nome)) {
            throw new Error(`VIOLAÇÃO: Destinatário bloqueado na lista (${d.nome})`);
        }
    }

    let sucessos = 0;
    let falhas = 0;

    for (let i = 0; i < DESTINATARIOS_RESTANTES.length; i++) {
        const dest = DESTINATARIOS_RESTANTES[i];
        console.log(`\n[${i + 1}/${DESTINATARIOS_RESTANTES.length}] Preparando envio para ${dest.nome}...`);

        let retry = 0;
        let enviado = false;

        while (retry < 3 && !enviado) {
            try {
                await enviarUm(dest, sessionId);
                sucessos++;
                enviado = true;
            } catch (err: any) {
                retry++;
                console.warn(`⚠️ [TENTATIVA ${retry}/3] Aviso ao enviar para ${dest.nome}: ${err?.message || err}`);
                if (retry < 3) {
                    console.log("⏳ Aguardando 4s para reconectar...");
                    await sleep(4000);
                } else {
                    console.error(`❌ [FALHA DEFINITIVA] Não foi possível entregar para ${dest.nome}`);
                    falhas++;
                }
            }
        }

        // Jitter de segurança anti-ban entre corretores
        if (i < DESTINATARIOS_RESTANTES.length - 1) {
            const jitterSec = Math.floor(6 + Math.random() * 5);
            console.log(`⏳ Jitter anti-spam: aguardando ${jitterSec}s antes do próximo corretor...`);
            await sleep(jitterSec * 1000);
        }
    }

    console.log("\n=============================================================");
    console.log(`🎉 DISPARO CONCLUÍDO!`);
    console.log(`• Enviados nesta rodada: ${sucessos}`);
    console.log(`• André Felipe (enviado anteriormente): 1`);
    console.log(`• Total entregues na equipe: ${sucessos + 1}/9`);
    console.log(`• Falhas: ${falhas}`);
    console.log(`• Blindagem (Roseli / Luana): 100% preservadas e não contatadas.`);
    console.log("=============================================================");
    process.exit(0);
}

main().catch(err => {
    console.error("Erro fatal:", err);
    process.exit(1);
});

