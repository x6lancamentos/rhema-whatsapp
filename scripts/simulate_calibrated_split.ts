import makeWASocket, {
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import pino from "pino";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";
import { prisma } from "../src/lib/prisma";

const SESSIONS = {
  BRUNNO_SDR: "5mhrx9",
  RHEMA_LEAD: "59n5i",
};

const JIDS = {
  BRUNNO_SDR: "5513955437609@s.whatsapp.net",
  RHEMA_LEAD: "5513991588225@s.whatsapp.net",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendTurnBubbles(
  sessionId: string,
  targetJid: string,
  bubbles: string[],
  roleLabel: string,
  turnNumber: number,
  fase: string
) {
  console.log(`────────────────────────────────────────────────────────────────────────`);
  console.log(`[TURNO ${turnNumber}/7] 💬 ${roleLabel}`);
  console.log(`🏷️ FASE: ${fase}`);

  const { state, saveCreds } = await usePrismaAuthState(sessionId);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }) as any,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }) as any),
    },
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);

  // Wait for open
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      sock.end(undefined);
      reject(new Error(`Timeout ao conectar sessão ${sessionId}`));
    }, 20000);

    sock.ev.on("connection.update", (u) => {
      if (u.connection === "open") {
        clearTimeout(timeout);
        resolve();
      } else if (u.connection === "close") {
        const code = (u.lastDisconnect?.error as any)?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          clearTimeout(timeout);
          reject(new Error(`Sessão ${sessionId} desconectada (logged out)`));
        }
      }
    });
  });

  // 2.5s de estabilização pós-handshake para garantir integridade do stream
  await sleep(2500);

  for (let bIdx = 0; bIdx < bubbles.length; bIdx++) {
    const bubbleText = bubbles[bIdx];

    // Presença de "digitando..."
    console.log(`   ✍️ [${roleLabel}] Simulando presença "digitando..." no WhatsApp...`);
    try {
      await sock.sendPresenceUpdate("composing", targetJid);
    } catch {}

    const typingDuration = Math.min(Math.max(bubbleText.length * 28, 1400), 2600);
    await sleep(typingDuration);

    const res = await sock.sendMessage(targetJid, { text: bubbleText });
    const msgId = res?.key?.id || "OK";
    console.log(`   📨 Balão ${bIdx + 1}/${bubbles.length} entregue: "${bubbleText.slice(0, 48)}..." (ID: ${msgId})`);

    if (bIdx < bubbles.length - 1) {
      console.log(`   ⏳ Pausa natural de leitura (1.2s)...`);
      await sleep(1200);
    }
  }

  // Finaliza a conexão deste turno de forma limpa
  await sleep(2000);
  sock.end(undefined);
  console.log(`⚡ Turno ${turnNumber} concluído com sucesso e socket liberado.`);
}

async function runSimulation() {
  console.log("========================================================================");
  console.log("🎬 SIMULAÇÃO HUMANA CALIBRADA: SDR (BRUNNO) ↔ LEAD (RHEMA)");
  console.log("   • Split em balões curtos e diretos (max 1-2 linhas)");
  console.log("   • Presença ativa de digitação ('composing') no WhatsApp");
  console.log("   • Tratamento ágil e consultivo de 3 objeções reais");
  console.log("========================================================================\n");

  const turns = [
    {
      turn: 1,
      senderSession: SESSIONS.BRUNNO_SDR,
      targetJid: JIDS.RHEMA_LEAD,
      role: "SDR (Brunno Gerência)",
      fase: "ABERTURA & QUALIFICAÇÃO PILAR 1",
      bubbles: [
        "Oi Carlos, tudo bem? Vi seu interesse no apê do Embaré (#6430). 😊",
        "Você busca pra morar com a família ou pensa mais em investimento?",
      ],
    },
    {
      turn: 2,
      senderSession: SESSIONS.RHEMA_LEAD,
      targetJid: JIDS.BRUNNO_SDR,
      role: "LEAD (Rhema - Dr. Carlos)",
      fase: "OBJEÇÃO 1: CUSTO FIXO DE CONDOMÍNIO",
      bubbles: [
        "Olá! É pra morar sim, comigo, esposa e nosso filho pequeno.",
        "Quanto tá saindo condomínio e IPTU desse imóvel?",
      ],
    },
    {
      turn: 3,
      senderSession: SESSIONS.BRUNNO_SDR,
      targetJid: JIDS.RHEMA_LEAD,
      role: "SDR (Brunno Gerência)",
      fase: "QUEBRA OBJEÇÃO 1 + PILAR 3 (PRAZO/MOMENTO)",
      bubbles: [
        "O condomínio tá super enxuto: R$ 485 já com fundo de reserva e IPTU de R$ 165.",
        "E vocês têm um prazo ideal pra mudar ou estão pesquisando com mais calma?",
      ],
    },
    {
      turn: 4,
      senderSession: SESSIONS.RHEMA_LEAD,
      targetJid: JIDS.BRUNNO_SDR,
      role: "LEAD (Rhema - Dr. Carlos)",
      fase: "OBJEÇÃO 2: FORMA DE PAGAMENTO & FGTS / CARRO",
      bubbles: [
        "O condomínio tá ótimo mesmo! Queríamos mudar até o início do ano.",
        "Tenho FGTS e precisaria financiar o resto pelo banco. Vocês dão esse suporte?",
      ],
    },
    {
      turn: 5,
      senderSession: SESSIONS.BRUNNO_SDR,
      targetJid: JIDS.RHEMA_LEAD,
      role: "SDR (Brunno Gerência)",
      fase: "QUEBRA OBJEÇÃO 2 + CONVITE DE VISITA (DUPLA ESCOLHA)",
      bubbles: [
        "Com certeza! Aprovamos direto com os bancos e cuidamos de todo o processo.",
        "Bora conhecer o apê no sábado? Fica melhor pra vocês às 10:30 ou às 15h?",
      ],
    },
    {
      turn: 6,
      senderSession: SESSIONS.RHEMA_LEAD,
      targetJid: JIDS.BRUNNO_SDR,
      role: "LEAD (Rhema - Dr. Carlos)",
      fase: "OBJEÇÃO 3: RECEIO DE PRESSÃO + CONFIRMAÇÃO",
      bubbles: [
        "Legal! Só peço que não fique corretor pressionando, meu tempo é curto.",
        "Sábado às 10:30 fica ótimo pra nós.",
      ],
    },
    {
      turn: 7,
      senderSession: SESSIONS.BRUNNO_SDR,
      targetJid: JIDS.RHEMA_LEAD,
      role: "SDR (Brunno Gerência)",
      fase: "BLINDAGEM DE CONFIANÇA + AGENDAMENTO CONCLUÍDO",
      bubbles: [
        "Fica 100% em paz! Nosso atendimento é zero pressão, você avalia no seu tempo.",
        "Tá confirmado: sábado às 10:30h no imóvel #6430 com as chaves na mão! 🤝",
      ],
    },
  ];

  for (const t of turns) {
    await sendTurnBubbles(t.senderSession, t.targetJid, t.bubbles, t.role, t.turn, t.fase);
    console.log(`⏳ Intervalo entre turnos (3.5s)...\n`);
    await sleep(3500);
  }

  console.log("========================================================================");
  console.log("🎉 SIMULAÇÃO HUMANA CALIBRADA CONCLUÍDA COM 100% DE SUCESSO!");
  console.log("Todos os 7 turnos (14 balões) foram entregues com status 'digitando...' e split!");
  console.log("========================================================================");

  await prisma.$disconnect();
  process.exit(0);
}

runSimulation().catch(async (err) => {
  console.error("❌ Erro fatal na simulação:", err);
  await prisma.$disconnect();
  process.exit(1);
});

