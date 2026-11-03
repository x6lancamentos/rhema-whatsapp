import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";
const TARGET_PHONE = "5513976008877";
const TARGET_JID = `${TARGET_PHONE}@s.whatsapp.net`;

const MENSAGEM_ELAINE = `Oi Elaine! Entendo perfeitamente a sua dúvida e faço questão de te explicar com total transparência para alinharmos 100%. 🤝

━━━━━━━━━━━━━━━━━━━━━━
🔍 *O QUE ACONTECEU COM A MARIA MELLO (#107 / #836)*
━━━━━━━━━━━━━━━━━━━━━━
• Você iniciou o contato com ela lá atrás em agosto, e seu histórico foi fundamental.
• Ocorre que no dia 14/10 a Maria Mello entrou novamente pelo portal buscando outro imóvel e gerou um atendimento novo na recepção, que caiu na escala para a Tatiana.
• A Tatiana atendeu na hora, requalificou a cliente, ampliou a faixa de busca dela para até R$ 490 mil e *já realizou duas visitas físicas presenciais nos imóveis 9561 e 9789* (dias 19/10 e 26/10).
• Como ela já está com a cliente em campo avançado e em vias de proposta, a regra da diretoria é unificar o atendimento com quem está na ponta final da visita para não gerar descompasso nem queimar a imagem da Rhema com duas corretoras abordando a mesma compradora.

E exatamente por reconhecer seu trabalho e para não deixar sua esteira desfalcada, transferi imediatamente para você o *Rodrigo (Atendimento #113)*!

━━━━━━━━━━━━━━━━━━━━━━
📑 *DOSSIÊ TÁTICO & GUIA DE ABORDAGEM: RODRIGO (#113)*
━━━━━━━━━━━━━━━━━━━━━━
Vi no CRM que você já foi super proativa, ligou e mandou mensagem hoje às 16h46! Parabéns pela rapidez! 👏
Aqui está o raio-x completo para você tirar o melhor proveito deste lead:

👤 *Cliente:* Rodrigo
📱 *WhatsApp:* (13) 99141-6161
🎯 *Perfil Estratégico:* Lead de Indicação/Captação com duplo potencial (Comprador + Potencial Proprietário / Permuta).
💼 *Ticket Médio Estimado:* R$ 500k a R$ 600k

📦 *3 IMÓVEIS DE OURO JÁ NO SEU CARRINHO DO CRM:*
1️⃣ *Cód. 9794 - Boqueirão (R$ 550.000)*
   • 2 Dormitórios | 88m² | 1 Vaga
   • Condomínio super baixo: R$ 763,00 | IPTU: R$ 173,00
   • *Gancho:* Localização nobre no Boqueirão com custo mensal baixíssimo.

2️⃣ *Cód. 6867 - Aparecida (R$ 599.000)*
   • 2 Dormitórios | 96m² | Vaga Demarcada
   • Decorado por arquiteto, pronto para morar, acabamento de alto padrão.
   • *Gancho:* Oportunidade "porteira fechada" de alto valor percebido.

3️⃣ *Cód. 9789 - Ponta da Praia (R$ 550.000)*
   • 3 Dormitórios | Excelente planta e iluminação
   • *Gancho:* Melhor custo por m² para 3 dorms na Ponta da Praia.

━━━━━━━━━━━━━━━━━━━━━━
💡 *SCRIPT RECOMENDADO DE FOLLOW-UP (WhatsApp)*
━━━━━━━━━━━━━━━━━━━━━━
Como ele não atendeu a ligação mais cedo, mande uma mensagem visual despertando a curiosidade:

_"Oi Rodrigo, tudo bem? Aqui é a Elaine da Rhema Imóveis. Te liguei mais cedo sobre o seu projeto imobiliário aqui em Santos!_

_Como o mercado anda bastante dinâmico, separei 3 opções excelentes fora da curva que acabaram de entrar no nosso acervo exclusivo, inclusive um apartamento decorado por arquiteto na Aparecida e outro no Boqueirão com custo de condomínio muito baixo._

_Você prefere que eu te mande os detalhes e fotos por aqui no WhatsApp, ou fica melhor nos falarmos 2 minutinhos no final da tarde?_

_Ah, e caso você tenha algum imóvel para avaliar ou colocar no negócio (permuta), nós cuidamos de toda a estrutura casada para você. Um abraço!"_

━━━━━━━━━━━━━━━━━━━━━━

Conte comigo no que precisar. Foco total no Rodrigo que tem tudo para virar negócio! 🚀🎯`;

async function main() {
    console.log(`[DISPATCH] Conectando ao WhatsApp Auto (Sessão: ${SESSION_ID})...`);

    const dbSession = await prisma.session.findUnique({
        where: { sessionId: SESSION_ID }
    });
    if (!dbSession) throw new Error("Sessao avg78n nao encontrada no banco");

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
                console.log("[CONEXAO OPEN] Baileys conectado com sucesso!");
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

    // Aguardar estabilização do socket
    await new Promise(r => setTimeout(r, 2000));

    console.log(`[ENVIANDO] Disparando dossie para Elaine (${TARGET_PHONE})...`);
    const sent = await socket.sendMessage(TARGET_JID, { text: MENSAGEM_ELAINE });
    console.log(`[SUCESSO] Mensagem entregue com sucesso! KeyId: ${sent?.key?.id}`);

    // Persistir no banco Prisma
    try {
        await prisma.message.create({
            data: {
                sessionId: dbSession.id,
                remoteJid: TARGET_JID,
                senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                fromMe: true,
                keyId: sent?.key?.id || `NOTIF_${Date.now()}`,
                pushName: "Brunno Anastacio",
                type: "TEXT",
                content: MENSAGEM_ELAINE,
                status: "SENT",
                timestamp: new Date()
            }
        });
        console.log("[BANCO OK] Registro persistido na tabela prisma.message");
    } catch (e: any) {
        console.warn("[AVISO BANCO]", e.message);
    }

    await new Promise(r => setTimeout(r, 2000));
    socket.end(undefined);
    console.log("[FINALIZADO] Socket encerrado com sucesso.");
}

main().catch(err => {
    console.error("[ERRO DISPATCH]", err);
    process.exit(1);
});

