import { prisma } from "@/lib/prisma";
import { waManager } from "@/modules/whatsapp/manager";
import { processPersonalizedMessage } from "@/lib/spintax";
import { recordImoviewInteraction } from "@/lib/imoview";
import type { AnyMessageContent } from "@whiskeysockets/baileys";
import path from "path";
import { existsSync, readFileSync } from "fs";

function resolveMediaSource(url: string): any {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return { url };
  }
  const clean = url.startsWith("/") ? url.slice(1) : url;
  const absPath = path.resolve(process.cwd(), "public", clean);
  if (existsSync(absPath)) {
    return readFileSync(absPath);
  }
  return { url };
}

// Helper to check if current time is within business hours in Brazil (America/Sao_Paulo)
export function isWithinBusinessHours(startH = 8, endH = 20): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
    });
    const currentHour = parseInt(formatter.format(now), 10);
    return currentHour >= startH && currentHour < endH;
  } catch {
    const localHour = new Date().getHours();
    return localHour >= startH && localHour < endH;
  }
}

// Active broadcast lock map to avoid duplicate parallel runs of the same broadcastId
const activeBroadcasts = new Set<string>();

export async function executeBroadcast(broadcastId: string): Promise<void> {
  if (activeBroadcasts.has(broadcastId)) {
    console.log(`[BroadcastEngine] Broadcast ${broadcastId} is already running.`);
    return;
  }

  activeBroadcasts.add(broadcastId);

  try {
    const log = await prisma.broadcastLog.findUnique({
      where: { id: broadcastId },
      include: {
        recipients: {
          orderBy: { id: "asc" },
        },
      },
    });

    if (!log) {
      console.error(`[BroadcastEngine] Broadcast ${broadcastId} not found.`);
      return;
    }

    if (log.status === "cancelled" || log.status === "completed") {
      console.log(`[BroadcastEngine] Broadcast ${broadcastId} is already ${log.status}.`);
      return;
    }

    // Mark as running in DB
    await prisma.broadcastLog.update({
      where: { id: broadcastId },
      data: { status: "running" },
    });

    // Find user who owns the primary session
    const primarySession = await prisma.session.findUnique({
      where: { sessionId: log.sessionId },
      select: { userId: true },
    });

    // Check Blacklist for this user
    let blacklistedPhones = new Set<string>();
    let blacklistedJids = new Set<string>();
    if (primarySession?.userId) {
      const blacklistedEntries = await prisma.blacklist.findMany({
        where: { userId: primarySession.userId },
        select: { phone: true, jid: true },
      });
      blacklistedPhones = new Set(blacklistedEntries.map((b) => b.phone));
      blacklistedJids = new Set(blacklistedEntries.map((b) => b.jid));
    }

    // Prepare session rotation list (multi-chip)
    let candidateSessions: string[] = [log.sessionId];
    if (Array.isArray(log.sessionIds) && log.sessionIds.length > 0) {
      for (const s of log.sessionIds as string[]) {
        if (typeof s === "string" && !candidateSessions.includes(s)) {
          candidateSessions.push(s);
        }
      }
    }

    const io = (global as any).io;
    const pendingRecipients = log.recipients.filter((r) => r.status === "pending");

    let sent = log.sent;
    let failed = log.failed;
    const total = log.total;

    for (let i = 0; i < pendingRecipients.length; i++) {
      const recipient = pendingRecipients[i];

      // 1. Check live status (cancellation or pause)
      let currentStatusCheck = await prisma.broadcastLog.findUnique({
        where: { id: broadcastId },
        select: { status: true },
      });

      if (currentStatusCheck?.status === "cancelled") {
        console.log(`[BroadcastEngine] Broadcast ${broadcastId} was cancelled.`);
        break;
      }

      while (currentStatusCheck?.status === "paused") {
        await new Promise((r) => setTimeout(r, 2000));
        currentStatusCheck = await prisma.broadcastLog.findUnique({
          where: { id: broadcastId },
          select: { status: true },
        });
        if (currentStatusCheck?.status === "cancelled") break;
      }

      if (currentStatusCheck?.status === "cancelled") break;

      // 2. Business Hours Check (wait if outside window)
      if (log.businessHoursOnly) {
        const startH = log.startHour ?? 8;
        const endH = log.endHour ?? 20;

        while (!isWithinBusinessHours(startH, endH)) {
          console.log(`[BroadcastEngine] Outside business hours (${startH}h-${endH}h). Waiting 60s...`);
          if (io) {
            candidateSessions.forEach((s) => {
              io.to(s).emit("broadcast.outside_hours", {
                broadcastId,
                startHour: startH,
                endHour: endH,
              });
            });
          }
          await new Promise((r) => setTimeout(r, 60000));

          // Check if cancelled during sleep
          const check = await prisma.broadcastLog.findUnique({
            where: { id: broadcastId },
            select: { status: true },
          });
          if (check?.status === "cancelled") break;
        }
      }

      // 3. Blacklist / Opt-out check
      const recipientPhone = recipient.jid.replace(/@.*$/, "");
      if (blacklistedPhones.has(recipientPhone) || blacklistedJids.has(recipient.jid)) {
        console.log(`[BroadcastEngine] Recipient ${recipient.jid} is blacklisted (Opt-Out). Skipping.`);
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "failed",
            error: "Destinatário bloqueado por Lista Negra / Opt-Out",
          },
        });
        failed++;
        continue;
      }

      // 4. Multi-chip rotation: Pick connected session
      const connectedSessions = candidateSessions.filter((sId) => {
        const inst = waManager.getInstance(sId);
        return !!inst?.socket;
      });

      if (connectedSessions.length === 0) {
        console.warn(`[BroadcastEngine] No connected sessions available for broadcast ${broadcastId}.`);
        await prisma.broadcastLog.update({
          where: { id: broadcastId },
          data: { status: "paused" },
        });
        if (io) {
          candidateSessions.forEach((s) => {
            io.to(s).emit("broadcast.disconnected_pause", {
              broadcastId,
              message: "Todas as sessões selecionadas foram desconectadas. Disparo pausado.",
            });
          });
        }
        break;
      }

      const activeSessionId = connectedSessions[i % connectedSessions.length];
      const activeInstance = waManager.getInstance(activeSessionId);
      const activeSocket = activeInstance?.socket;

      if (!activeSocket) {
        failed++;
        continue;
      }

      let personalizedText = "";

      try {
        // 5. Spintax & Variables personalization
        const vars = (recipient.variables as Record<string, any>) || {};
        const allVars = {
          ...vars,
          nome: recipient.name || vars.nome || "",
          telefone: recipientPhone,
        };

        personalizedText = processPersonalizedMessage(log.message, allVars);

        // 6. Simulate Human Typing or Recording
        if (log.simulateTyping) {
          try {
            if (log.isPtt && log.audioUrl) {
              await activeSocket.sendPresenceUpdate("recording", recipient.jid);
              const recTime = Math.floor(Math.random() * 2000) + 2500; // 2.5s to 4.5s
              await new Promise((r) => setTimeout(r, recTime));
              await activeSocket.sendPresenceUpdate("paused", recipient.jid);
            } else {
              await activeSocket.sendPresenceUpdate("composing", recipient.jid);
              // Typing time: ~30 chars per second, clamped between 1.5s and 6s
              const typingTime = Math.min(
                6000,
                Math.max(1500, Math.round((personalizedText.length / 30) * 1000))
              );
              await new Promise((r) => setTimeout(r, typingTime));
              await activeSocket.sendPresenceUpdate("paused", recipient.jid);
            }
          } catch (presenceErr) {
            // Non-critical: continue even if presence update fails
          }
        }

        // 7. Send payload
        if (log.isPtt && log.audioUrl) {
          // Native WhatsApp Voice Note (green mic)
          const audioPayload = resolveMediaSource(log.audioUrl);
          await activeSocket.sendMessage(recipient.jid, {
            audio: audioPayload,
            ptt: true,
            mimetype: "audio/ogg; codecs=opus",
          });

          // If there is also text content, send text as follow-up
          if (personalizedText.trim().length > 0) {
            await new Promise((r) => setTimeout(r, 1200));
            await activeSocket.sendMessage(recipient.jid, { text: personalizedText });
          }
        } else if (log.mediaUrl) {
          const mediaPayload = resolveMediaSource(log.mediaUrl);
          let messageContent: AnyMessageContent;
          if (log.mediaType === "document") {
            messageContent = {
              document: mediaPayload,
              caption: personalizedText,
              mimetype: "application/pdf",
              fileName: "documento.pdf",
            };
          } else if (log.mediaType === "video") {
            messageContent = {
              video: mediaPayload,
              caption: personalizedText,
            };
          } else {
            messageContent = {
              image: mediaPayload,
              caption: personalizedText,
            };
          }
          await activeSocket.sendMessage(recipient.jid, messageContent);
        } else {
          await activeSocket.sendMessage(recipient.jid, { text: personalizedText });
        }

        sent++;

        // Update recipient record
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            resolvedMessage: personalizedText,
          },
        });

        // Automatic Imoview history recording
        const atendimentoId =
          recipient.imoviewAtendimentoId ||
          (vars.atendimentoId as string) ||
          (vars.codigo_atendimento as string);

        if (atendimentoId) {
          recordImoviewInteraction(
            atendimentoId,
            `Tentativa de contato via WhatsApp realizada com sucesso para o número ${recipientPhone}. Mensagem: "${personalizedText.substring(0, 100)}..."`
          ).catch((e) =>
            console.error(`[BroadcastEngine] Error logging to Imoview for atendimento ${atendimentoId}:`, e)
          );
        }
      } catch (err: any) {
        failed++;
        const errorMsg = err?.message || "Unknown error";
        console.error(`[BroadcastEngine] Error sending to ${recipient.jid}:`, err);

        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "failed",
            error: errorMsg,
            resolvedMessage: personalizedText || null,
          },
        });
      }

      // Update counters in DB
      await prisma.broadcastLog.update({
        where: { id: broadcastId },
        data: { sent, failed },
      });

      const progress = Math.round(((sent + failed) / total) * 100);

      // Emit socket event to all participating sessions
      if (io) {
        const payload = {
          broadcastId,
          status: "running",
          total,
          sent,
          failed,
          current: recipient.jid,
          currentName: recipient.name || null,
          currentMessage: personalizedText,
          currentSession: activeSessionId,
          progress,
        };

        candidateSessions.forEach((s) => io.to(s).emit("broadcast.progress", payload));
      }

      // 8. Delay handling between messages
      if (i < pendingRecipients.length - 1) {
        if (log.batchSize && log.batchPause && (i + 1) % log.batchSize === 0) {
          const pauseSec = log.batchPause;
          console.log(`[BroadcastEngine] Batch pause for ${pauseSec}s...`);
          if (io) {
            candidateSessions.forEach((s) =>
              io.to(s).emit("broadcast.batch_pause", {
                broadcastId,
                pauseSeconds: pauseSec,
                completedBatch: i + 1,
              })
            );
          }
          await new Promise((r) => setTimeout(r, pauseSec * 1000));
        } else {
          const minDelay = log.minDelay ?? 2000;
          const maxDelay = log.maxDelay ?? 5000;
          const randomDelay =
            minDelay >= maxDelay
              ? minDelay
              : Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

          await new Promise((r) => setTimeout(r, randomDelay));
        }
      }
    }

    // 9. Completion Check
    const finalLog = await prisma.broadcastLog.findUnique({
      where: { id: broadcastId },
      select: { status: true },
    });

    if (finalLog?.status !== "cancelled" && finalLog?.status !== "paused") {
      await prisma.broadcastLog.update({
        where: { id: broadcastId },
        data: { status: "completed", completedAt: new Date(), sent, failed },
      });

      if (io) {
        candidateSessions.forEach((s) =>
          io.to(s).emit("broadcast.progress", {
            broadcastId,
            status: "completed",
            total,
            sent,
            failed,
            progress: 100,
            completedAt: new Date().toISOString(),
          })
        );
      }
      console.log(`[BroadcastEngine] Broadcast ${broadcastId} completed.`);
    }
  } catch (globalErr) {
    console.error(`[BroadcastEngine] Fatal error in broadcast ${broadcastId}:`, globalErr);
  } finally {
    activeBroadcasts.delete(broadcastId);
  }
}
