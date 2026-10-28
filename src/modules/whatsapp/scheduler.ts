import { prisma } from "@/lib/prisma";
import { waManager } from "./manager";
import { logger } from "@/lib/logger";
import { executarRotinaDiariaRhema, type RotinaRhemaTipo } from "@/lib/ai/rhema-daily-routines";

const rotinasDisparadasPorData = new Set<string>();

async function checkRhemaDailyRoutines() {
    try {
        const now = new Date();
        // Horário de Brasília (UTC-3)
        const brTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const dayOfWeek = brTime.getDay(); // 0=Dom, 6=Sáb
        if (dayOfWeek === 0 || dayOfWeek === 6) return;

        const dateStr = brTime.toISOString().slice(0, 10);
        const hhmm = `${String(brTime.getHours()).padStart(2, "0")}:${String(brTime.getMinutes()).padStart(2, "0")}`;

        const mapaHorarios: Record<string, RotinaRhemaTipo> = {
            "07:30": "BRIEFING_MATINAL_0730",
            "08:00": "ONBOARDING_CORRETORES_0800",
            "14:00": "SLA_DEAD_DEAL_CPR_1400",
            "17:30": "COLETA_FECHAMENTO_1730",
            "18:15": "FECHAMENTO_EXECUTIVO_1815",
        };
        if (dayOfWeek === 5) {
            mapaHorarios["17:00"] = "DOSSIE_PDI_OKR_SEXTA_1700";
        }

        const rotinaAlvo = mapaHorarios[hhmm];
        if (!rotinaAlvo) return;

        const chaveUnica = `${dateStr}|${rotinaAlvo}`;
        if (rotinasDisparadasPorData.has(chaveUnica)) return;
        rotinasDisparadasPorData.add(chaveUnica);

        const defaultSession = await prisma.session.findFirst({
            where: { status: "CONNECTED" },
        });

        await executarRotinaDiariaRhema({
            rotina: rotinaAlvo,
            sessionId: defaultSession?.sessionId,
            dispararWhatsApp: Boolean(defaultSession?.sessionId),
        });
        logger.info("Scheduler", `Rotina autônoma Rhema OS executada: ${rotinaAlvo} (${hhmm})`);
    } catch (err) {
        logger.warn("Scheduler", "Aviso ao checar rotinas diárias Rhema OS:", err);
    }
}

const checkScheduledMessages = async () => {
    try {
        const now = new Date();
        logger.debug("Scheduler", `Checking for messages due before ${now.toISOString()}...`);

        const pendingMessages = await prisma.scheduledMessage.findMany({
            where: {
                status: "PENDING",
                sendAt: { lte: now }
            }
        });

        if (pendingMessages.length > 0) {
            logger.info("Scheduler", `Found ${pendingMessages.length} pending messages.`);
        }

        for (const msg of pendingMessages) {
            const instance = waManager.getInstance(msg.sessionId);

            if (instance?.socket) {
                try {
                    let content: any = {};
                    if (msg.mediaUrl) {
                        const url = msg.mediaUrl;
                        const type = msg.mediaType || 'image'; // Default to image if null

                        const res = await fetch(url);
                        if (!res.ok) throw new Error(`Failed to fetch media from URL: ${res.status} ${res.statusText}`);
                        const buffer = Buffer.from(await res.arrayBuffer());

                        if (type === 'video') {
                            content = { video: buffer, caption: msg.content };
                        } else if (type === 'document') {
                            content = { document: buffer, caption: msg.content, fileName: url.split('/').pop() || 'file', mimetype: 'application/octet-stream' };
                        } else {
                            content = { image: buffer, caption: msg.content };
                        }
                    } else {
                        content = { text: msg.content };
                    }

                    await instance.socket.sendMessage(msg.jid, content);

                    await prisma.scheduledMessage.update({
                        where: { id: msg.id },
                        data: { status: "SENT" }
                    });
                    logger.success("Scheduler", `Msg ${msg.id} sent to ${msg.jid}`);

                } catch (err) {
                    logger.error("Scheduler", `Failed to send scheduled msg ${msg.id}`, err);
                    await prisma.scheduledMessage.update({
                        where: { id: msg.id },
                        data: { status: "FAILED" }
                    });
                }
            } else {
                logger.warn("Scheduler", `Session ${msg.sessionId} not connected for scheduled msg ${msg.id}`);
                // Optionally mark as failed or leave pending
            }
        }
    } catch (e) {
        logger.error("Scheduler", "Error executing scheduler loop:", e);
    }
};

export function startScheduler() {
    logger.info("Scheduler", "Starting Message Scheduler & Rhema OS Autonomous Routines...");

    // Run immediately on start
    checkScheduledMessages();
    checkRhemaDailyRoutines();

    // Then run every 30 seconds
    setInterval(() => {
        checkScheduledMessages();
        checkRhemaDailyRoutines();
    }, 30 * 1000);
}
