import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";
const DIRETOIRA_GROUP_JID = "120363426753225157@g.us";

const MESSAGE_CONTENT = `🎯 *SOLICITAÇÃO DE APROVAÇÃO — COMUNICADO GERAL PARA OS CORRETORES* 📢

Olá, Diretoria! Tudo bem com vocês?

Elaborei a proposta de comunicado abaixo para alinharmos toda a equipe comercial sobre a nova fase da Rhema Imóveis, mudanças estruturais, rotina e foco em resultados.

Gostaria da avaliação e aprovação de vocês antes de realizarmos os disparos (que faremos tanto nos grupos oficiais quanto individualmente no privado de cada corretor).

---

👇 *PROPOSTA DO COMUNICADO PARA A EQUIPE:*

🚨 *COMUNICADO OFICIAL — ALINHAMENTO COMERCIAL, ESTRUTURA & CULTURA DO RESULTADO* 🚀

Fala, Time Rhema! Tudo bem com vocês?

Quem acompanha o dia a dia da imobiliária já percebeu: estamos crescendo em ritmo acelerado! E crescer exige mudanças, postura profissional e, acima de tudo, ESPÍRITO DE EQUIPE. Toda evolução estrutural tem um propósito muito claro: criar as condições ideais para que cada um de vocês venda mais e supere suas metas.

Nesta nova fase, estamos fortalecendo na Rhema uma *FORTE CULTURA DO RESULTADO*: acreditamos e praticamos a meritocracia. O esforço, o comprometimento no dia a dia e o desempenho individual de cada corretor serão monitorados, reconhecidos e valorizados pela gestão. Quem se empenha, atende rápido e corre atrás colhe os melhores frutos da casa!

Com a expansão da equipe comercial e a chegada de novos parceiros, estabelecemos as seguintes diretrizes operacionais imediatas:

━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ *AMBIENTE DINÂMICO E ORGANIZADO* 🏢
Com a casa cheia e novas contratações ativas, organização é inegociável. Manter as bancadas limpas, sem acúmulo de papéis ou itens pessoais ao final do expediente, reflete o padrão de excelência que apresentamos aos nossos clientes.

2️⃣ *INVESTIMENTO EM FERRAMENTAS & NOTEBOOKS* 💻
A Rhema segue aprimorando a infraestrutura de apoio, e é fundamental que cada corretor também invista na sua própria carreira. Tenha o seu notebook como ferramenta primária de atendimento. No médio prazo, os computadores fixos de mesa serão descontinuados, restando apenas um número reduzido para uso coletivo e adaptação inicial de novos corretores.

3️⃣ *ESTAÇÕES DE TRABALHO FLEXÍVEIS* 🔄
As estações de trabalho não são mais fixas nem nominais. O espaço é dinâmico e deve ser ocupado por qualquer corretor conforme a ordem de chegada na empresa.

4️⃣ *CLIMATIZAÇÃO & QUALIDADE DO AR (NR-17)* ❄️
Com as duas salas com ocupação completa, o ar-condicionado precisa permanecer ligado para circulação contínua e bem-estar coletivo. Conforme a norma NR-17 de ergonomia e conforto térmico, a temperatura padrão deve ser ajustada entre 22°C e 24°C, garantindo conforto sem extremos.

5️⃣ *REGRA DOS 7 DIAS: REDISTRIBUIÇÃO AUTOMÁTICA DE LEADS* ⏱️
Atenção máxima: a partir de segunda-feira começa a redistribuição automática de leads por falta de atendimento no CRM. 
O prazo máximo de inatividade é de 7 dias — no 8º dia sem registro de contato, o lead sobe para a roleta e é transferido.
Ao revisarmos a carteira de atendimentos de quem saiu, identificamos OPORTUNIDADES QUENTÍSSIMAS que foram deixadas na mesa. Nenhum lead pode ficar desassistido!

6️⃣ *COMPROMISSO E PRESENÇA AOS SÁBADOS* 🎯
Sábado é o dia com maior índice de agendamentos, visitas e fechamentos de contratos da semana. A presença de cada um de vocês aqui na sede aos sábados é essencial. Corretor em campo e no plantão é corretor fechando negócio!

7️⃣ *VALORIZAÇÃO DO MÉRITO & RECONHECIMENTO INDIVIDUAL* 🏆
Aqui na Rhema, dedicação e resultado não passam despercebidos. O corretor que se destaca pela consistência, respeito às regras de CRM, pontualidade e fechamento de vendas terá prioridade em novas oportunidades comerciais, destaque perante a diretoria e recompensas à altura da sua entrega.
━━━━━━━━━━━━━━━━━━━━━━━━━━

Estamos preparando o terreno para os maiores resultados da história da Rhema, e queremos todos remando juntos com a mesma energia, disciplina e foco no resultado!

Contamos com o empenho e o profissionalismo de cada um!

Bons negócios e vamos com tudo! 🎯🔥
*Diretoria Rhema Imóveis*

---

📌 *Por favor, avaliem o texto acima. Estando aprovado ou havendo qualquer ajuste, nos dêem o retorno por aqui para darmos andamento ao envio para os corretores!*

Abraço,  
*Brunno Anastácio*`;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log("=== INICIANDO ENVIO PARA O GRUPO DA DIRETORIA ===");

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
                console.log("[OK] Conexão com o WhatsApp estabelecida!");
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado do WhatsApp"));
                }
            }
        });
    });

    console.log(`Enviando mensagem para o grupo da Diretoria (${DIRETOIRA_GROUP_JID})...`);

    const sent = await socket.sendMessage(DIRETOIRA_GROUP_JID, { text: MESSAGE_CONTENT });
    console.log(`✅ [SUCESSO] Mensagem enviada para o Grupo da Diretoria! Key ID: ${sent?.key?.id}`);

    // Salvar no histórico de mensagens do banco
    try {
        await prisma.message.create({
            data: {
                sessionId: dbSession.id,
                remoteJid: DIRETOIRA_GROUP_JID,
                senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                fromMe: true,
                keyId: sent?.key?.id || `DIR_${Date.now()}`,
                pushName: "Brunno Anastácio",
                type: "TEXT",
                content: MESSAGE_CONTENT,
                status: "SENT",
                timestamp: new Date()
            }
        });
        console.log("💾 Mensagem registrada com sucesso no banco de dados.");
    } catch (e: any) {
        console.warn("Aviso ao salvar no banco:", e.message);
    }

    await sleep(2000);
    process.exit(0);
}

run().catch((err) => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
});
