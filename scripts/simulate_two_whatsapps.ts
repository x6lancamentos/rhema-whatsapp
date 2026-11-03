import makeWASocket, {
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  WASocket,
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

class SessionConnection {
  sessionId: string;
  sock: WASocket | null = null;
  isOpen = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async connect(maxWaitMs = 30000): Promise<WASocket> {
    const { state, saveCreds } = await usePrismaAuthState(this.sessionId);
    const { version } = await fetchLatestBaileysVersion();

    return new Promise((resolve, reject) => {
      let resolved = false;

      const init = () => {
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

        this.sock = sock;
        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", (update) => {
          const { connection, lastDisconnect } = update;
          if (connection === "open") {
            this.isOpen = true;
            console.log(`✅ [${this.sessionId}] Conectado e autenticado com sucesso!`);
            if (!resolved) {
              resolved = true;
              resolve(sock);
            }
          } else if (connection === "close") {
            this.isOpen = false;
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`ℹ️ [${this.sessionId}] Conexão fechada (${statusCode}). Reconectar: ${shouldReconnect}`);

            if (shouldReconnect) {
              setTimeout(() => init(), 1500);
            } else if (!resolved) {
              reject(new Error(`Sessão ${this.sessionId} foi desconectada (logged out).`));
            }
          }
        });
      };

      init();

      setTimeout(() => {
        if (!resolved) {
          reject(new Error(`Timeout (${maxWaitMs}ms) aguardando conexão da sessão ${this.sessionId}`));
        }
      }, maxWaitMs);
    });
  }

  async sendBubbleWithPresence(targetJid: string, text: string, roleLabel: string) {
    if (!this.sock) throw new Error(`Socket de ${this.sessionId} não está inicializado.`);

    console.log(`   ✍️ [${roleLabel}] Simulando "digitando..." (composing)...`);
    try {
      await this.sock.sendPresenceUpdate("composing", targetJid);
    } catch {}

    const typingDuration = Math.min(Math.max(text.length * 28, 1200), 2500);
    await sleep(typingDuration);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await this.sock.sendMessage(targetJid, { text });
        return res?.key?.id || "OK";
      } catch (err: any) {
        console.warn(`      Tentativa ${attempt}/3 de envio falhou: ${err?.message}. Aguardando...`);
        if (attempt === 3) throw err;
        await sleep(1500);
      }
    }
  }

  close() {
    try {
      this.sock?.end(undefined);
    } catch {}
    this.isOpen = false;
    this.sock = null;
  }
}

async function runCalibratedSimulation() {
  console.log("========================================================================");
  console.log("🎬 SIMULAÇÃO HUMANA CALIBRADA: SDR (BRUNNO) ↔ LEAD (RHEMA)");
  console.log("   • Split em balões curtos e diretos");
  console.log("   • Presença ativa de digitação ('composing') no WhatsApp");
  console.log("   • Tratamento ágil e consultivo de 3 objeções reais");
  console.log("========================================================================\n");

  const connBrunno = new SessionConnection(SESSIONS.BRUNNO_SDR);
  const connRhema = new SessionConnection(SESSIONS.RHEMA_LEAD);

  console.log("Conectando sessão do Brunno Gerência (5mhrx9)...");
  await connBrunno.connect();
  await sleep(1500);

  console.log("Conectando sessão da Rhema Institucional (59n5i)...");
  await connRhema.connect();
  await sleep(2500);

  console.log("\n🎉 Ambas as sessões estão conectadas e prontas para o diálogo!\n");

  const conversationTurns = [
    {
      turn: 1,
      sender: "SDR (Brunno Gerência)",
      conn: connBrunno,
      targetJid: JIDS.RHEMA_LEAD,
      fase: "ABERTURA & QUALIFICAÇÃO PILAR 1",
      bubbles: [
        "Oi Carlos, tudo bem? Vi que curtiu o apê de 2 quartos no Embaré (#6430). 😊",
        "Pra eu já separar os detalhes certos: você busca pra morar com a família ou pensa mais em investimento?",
      ],
      interTurnPauseMs: 3000,
    },
    {
      turn: 2,
      sender: "LEAD (Rhema - Dr. Carlos)",
      conn: connRhema,
      targetJid: JIDS.BRUNNO_SDR,
      fase: "OBJEÇÃO 1: CUSTO FIXO DE CONDOMÍNIO",
      bubbles: [
        "Olá! É pra morar sim, comigo, minha esposa e nosso filho pequeno.",
        "Mas me tira uma dúvida sincera: prédio no Embaré costuma ter condomínio puxado ou chamada extra. Quanto tá saindo condomínio e IPTU desse?",
      ],
      interTurnPauseMs: 3500,
    },
    {
      turn: 3,
      sender: "SDR (Brunno Gerência)",
      conn: connBrunno,
      targetJid: JIDS.RHEMA_LEAD,
      fase: "QUEBRA OBJEÇÃO 1 + PILAR 3 (PRAZO/MOMENTO)",
      bubbles: [
        "Entendo super a preocupação! Esse prédio passou por reforma de fachada recente, então o condomínio tá super enxuto: R$ 485 já com fundo de reserva e IPTU de R$ 165.",
        "E vocês têm um prazo ideal pra mudar ou estão pesquisando com mais calma?",
      ],
      interTurnPauseMs: 3500,
    },
    {
      turn: 4,
      sender: "LEAD (Rhema - Dr. Carlos)",
      conn: connRhema,
      targetJid: JIDS.BRUNNO_SDR,
      fase: "OBJEÇÃO 2: FORMA DE PAGAMENTO & FGTS / CARRO",
      bubbles: [
        "Poxa, o condomínio tá ótimo mesmo pro padrão do bairro!",
        "A gente queria mudar até o começo do ano. Tenho uma parte em FGTS e precisaria financiar o resto pelo banco, ou entrar um carro. Vocês dão esse suporte de crédito?",
      ],
      interTurnPauseMs: 3500,
    },
    {
      turn: 5,
      sender: "SDR (Brunno Gerência)",
      conn: connBrunno,
      targetJid: JIDS.RHEMA_LEAD,
      fase: "QUEBRA OBJEÇÃO 2 + CONVITE DE VISITA (DUPLA ESCOLHA)",
      bubbles: [
        "Com certeza! Nossa mesa de crédito aprova direto com os bancos e cuidamos de todo o processo de financiamento e FGTS sem custo nenhum pra você.",
        "O que acha de dar um pulo lá pra sentir o apê ao vivo? Fica melhor pra vocês no sábado às 10:30 ou às 15h?",
      ],
      interTurnPauseMs: 3500,
    },
    {
      turn: 6,
      sender: "LEAD (Rhema - Dr. Carlos)",
      conn: connRhema,
      targetJid: JIDS.BRUNNO_SDR,
      fase: "OBJEÇÃO 3: RECEIO DE PRESSÃO + CONFIRMAÇÃO",
      bubbles: [
        "Perfeito, isso me tranquiliza bastante!",
        "Só peço que não fique corretor pressionando porque trabalho a semana toda em SP e meu tempo é curto. Sábado às 10:30 fica ótimo pra nós.",
      ],
      interTurnPauseMs: 3000,
    },
    {
      turn: 7,
      sender: "SDR (Brunno Gerência)",
      conn: connBrunno,
      targetJid: JIDS.RHEMA_LEAD,
      fase: "BLINDAGEM DE CONFIANÇA + AGENDAMENTO CONCLUÍDO",
      bubbles: [
        "Fica 100% em paz! Aqui na Rhema nosso atendimento é zero pressão. O consultor só vai abrir pra vocês avaliarem no tempo de vocês.",
        "Tá confirmado então: sábado às 10:30h no imóvel #6430! O consultor já vai estar com as chaves te esperando pontualmente. Um abraço e boa semana! 🤝",
      ],
      interTurnPauseMs: 1500,
    },
  ];

  for (const t of conversationTurns) {
    console.log(`────────────────────────────────────────────────────────────────────────`);
    console.log(`[TURNO ${t.turn}/7] 💬 ${t.sender}`);
    console.log(`🏷️ FASE: ${t.fase}`);

    for (let bIdx = 0; bIdx < t.bubbles.length; bIdx++) {
      const bubbleText = t.bubbles[bIdx];
      const msgId = await t.conn.sendBubbleWithPresence(t.targetJid, bubbleText, t.sender);
      console.log(`   📨 Balão ${bIdx + 1}/${t.bubbles.length} entregue: "${bubbleText.slice(0, 50)}..." (ID: ${msgId})`);

      if (bIdx < t.bubbles.length - 1) {
        console.log(`   ⏳ Pausa natural de leitura (1.2s)...`);
        await sleep(1200);
      }
    }

    console.log(`⚡ Turno ${t.turn} entregue no WhatsApp com digitação simulada!`);
    console.log(`⏳ Pausa entre turnos (${t.interTurnPauseMs / 1000}s)...`);
    await sleep(t.interTurnPauseMs);
  }

  console.log("\n========================================================================");
  console.log("🎉 SIMULAÇÃO HUMANA CALIBRADA CONCLUÍDA COM SUCESSO!");
  console.log("Todas as 14 mensagens curtas foram entregues com status 'composing' e split!");
  console.log("========================================================================");

  connBrunno.close();
  connRhema.close();
  await prisma.$disconnect();
  process.exit(0);
}

runCalibratedSimulation().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
