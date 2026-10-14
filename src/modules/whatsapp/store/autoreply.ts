import { prisma } from "@/lib/prisma";
import type { WASocket } from "@whiskeysockets/baileys";
import { normalizeMessageContent } from "@whiskeysockets/baileys";
import { logger } from "@/lib/logger";
import { getAiAgentConfig, processOwnerMessage } from "@/lib/ai/agent-service";

// Helper for permission check (Deduplicate from command-handler if possible, but keep simple here)
function canAutoReply(config: any, fromMe: boolean, senderJid: string): boolean {
    if (!config || !config.enabled) return false;

    // Auto Reply Specific Mode
    const mode = config.autoReplyMode || 'ALL';

    if (fromMe) {
        // If mode is OWNER, it triggers for ME? 
        // Auto Reply usually replies TO someone. 
        // If I send a message, and mode is OWNER, should it reply to me? 
        // User requested "Self Mode" -> Use case: Snippets.
        // So yes, if fromMe checks out.

        // However, standard auto-reply logic (replying to incoming) should be blocked if fromMe is true AND mode is ALL?
        // No, typically Auto Reply doesn't trigger on own messages to prevent unexpected loops.
        // But for "Self Mode" (Macros), it MUST trigger on own messages.

        if (mode === 'OWNER') return true;
        if (mode === 'ALL') return false; // Standard auto-reply ignores self

        // Specific? 
        return false;
    } else {
        // Incoming message from others
        if (mode === 'OWNER') return false; // Owner only acts on Owner messages
        if (mode === 'ALL') return true;

        if (mode === 'SPECIFIC') {
            const allowedJids = config.autoReplyAllowedJids || [];
            if (Array.isArray(allowedJids)) {
                return allowedJids.some((jid: string) => senderJid.includes(jid));
            }
        }

        if (mode === 'BLACKLIST') {
            const blockedJids = config.autoReplyBlockedJids || [];
            if (Array.isArray(blockedJids)) {
                const isBlocked = blockedJids.some((jid: string) => senderJid.includes(jid));
                return !isBlocked; // Return true if NOT blocked
            }
            return true; // If blacklist empty, allow all
        }
    }

    return false;
}

export async function bindAutoReply(sock: WASocket, sessionId: string) {
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        // Fetch session ID and Bot Config once per batch (optimization)
        const session = await prisma.session.findUnique({
            where: { sessionId },
            // @ts-ignore
            include: { botConfig: true }
        });

        if (!session) return;

        // @ts-ignore
        let config = (session as any).botConfig;

        if (!config) {
            logger.warn("AutoReply", "No config found, creating default...");
            config = await prisma.botConfig.create({
                data: {
                    sessionId: session.id,
                    enabled: true,
                    botMode: 'OWNER',
                    autoReplyMode: 'ALL'
                }
            });
        }

        logger.debug("AutoReply", `Processing for ${sessionId}. Config: ${config ? "Found" : "Missing"}, ${config?.enabled ? "Enabled" : "Disabled"}`);

        if (!config || !config.enabled) return;

        for (const msg of messages) {
            const fromMe = msg.key.fromMe || false;
            const remoteJid = msg.key.remoteJid;

            // Standardized Sender Logic
            const isGroup = remoteJid?.endsWith("@g.us") || false;
            const remoteJidAlt = msg.key.remoteJidAlt;
            let senderJid = (isGroup ? (msg.key.participant || msg.participant) : remoteJid);

            if (!isGroup && remoteJidAlt) {
                senderJid = remoteJidAlt;
            }

            if (!remoteJid || !senderJid) continue;

            // Check Permissions
            if (!canAutoReply(config, fromMe, senderJid)) continue;

            const content = normalizeMessageContent(msg.message);
            const text = content?.conversation || content?.extendedTextMessage?.text || ""; // Caption?

            if (!text) continue;

            // ==========================================
            // INTEGRAÇÃO AGENTE AUTÔNOMO DE IA (CAMILA AI)
            // ==========================================
            try {
                const prefix = (config as any)?.prefix || "#";
                const isCommand = text.startsWith(prefix);

                // A Camila AI só atende conversas privadas (nunca grupos), que não sejam comandos e que não sejam nossas mensagens
                if (!isGroup && !fromMe && !isCommand) {
                    const cleanPhone = remoteJid.replace(/@.*$/, "").replace(/\D/g, "");

                    // 1. Verifica se este contato pertence a um disparo com Camila AI habilitada
                    const aiBroadcastRecipient = await prisma.broadcastRecipient.findFirst({
                        where: {
                            OR: [
                                { jid: remoteJid },
                                { jid: senderJid },
                                { jid: `${cleanPhone}@s.whatsapp.net` },
                            ],
                            status: { in: ["sent", "responded"] },
                            broadcastLog: {
                                enableAiAgent: true,
                            },
                        },
                        orderBy: { sentAt: "desc" },
                        include: { broadcastLog: true },
                    });

                    // 2. Ou se já possui uma conversa agêntica ativa em andamento
                    let activeConv = null;
                    if (!aiBroadcastRecipient) {
                        activeConv = await prisma.aiAgentConversation.findFirst({
                            where: {
                                OR: [
                                    { jid: remoteJid },
                                    { phone: cleanPhone },
                                ],
                                status: "ACTIVE",
                            },
                        });
                    }

                    const shouldHandleWithAi = !!aiBroadcastRecipient || (!!activeConv && activeConv.status === "ACTIVE");

                    if (shouldHandleWithAi) {
                        const aiConfig = await getAiAgentConfig();
                        const apiKey = (aiConfig.apiKey || process.env.OPENROUTER_API_KEY || "").trim();

                        if (apiKey) {
                            logger.info("AIAgent", `Lead de disparo detectado (${remoteJid}). Camila AI iniciando atendimento.`);

                            // Atualiza status do destinatário no disparo como respondido
                            if (aiBroadcastRecipient) {
                                const isFirstResponse = aiBroadcastRecipient.status !== "responded";
                                await prisma.broadcastRecipient.update({
                                    where: { id: aiBroadcastRecipient.id },
                                    data: {
                                        status: "responded",
                                        respondedAt: new Date(),
                                        responseMessage: text,
                                    },
                                });

                                if (isFirstResponse) {
                                    await prisma.broadcastLog.update({
                                        where: { id: aiBroadcastRecipient.broadcastLogId },
                                        data: {
                                            responded: { increment: 1 },
                                        },
                                    });

                                    const io = (global as any).io;
                                    if (io) {
                                        io.to(sessionId).emit("broadcast.response", {
                                            broadcastId: aiBroadcastRecipient.broadcastLogId,
                                            recipientJid: remoteJid,
                                            responseMessage: text,
                                        });
                                    }
                                }
                            }

                            const recipientVars = (aiBroadcastRecipient?.variables as Record<string, any>) || {};
                            const codigoImovel = recipientVars.codigo_imovel || recipientVars.codigo || recipientVars.imovel || undefined;
                            const contactName = aiBroadcastRecipient?.name || recipientVars.nome || msg.pushName || undefined;

                            // Simular digitação humana
                            if (aiConfig.simulateTypingDelay) {
                                const minSec = aiConfig.minTypingSeconds || 3;
                                const maxSec = aiConfig.maxTypingSeconds || 6;
                                const delaySec = Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
                                await sock.sendPresenceUpdate('composing', remoteJid).catch(() => {});
                                await new Promise(r => setTimeout(r, delaySec * 1000));
                            }

                            const aiResult = await processOwnerMessage({
                                sessionId,
                                jid: remoteJid,
                                phone: cleanPhone,
                                contactName,
                                codigoImovelOverride: codigoImovel ? String(codigoImovel) : undefined,
                                messageText: text,
                                simulateOnly: false,
                            });

                            if (aiResult.replyText) {
                                await sock.sendMessage(remoteJid, { text: aiResult.replyText }, { quoted: msg });
                                logger.info("AIAgent", `Resposta da Camila AI enviada com sucesso para ${remoteJid}`);
                            }

                            if (aiConfig.simulateTypingDelay) {
                                await sock.sendPresenceUpdate('paused', remoteJid).catch(() => {});
                            }

                            // Mensagem tratada com sucesso pela Camila AI
                            continue;
                        } else {
                            logger.warn("AIAgent", `Lead do disparo (${remoteJid}) respondeu, mas OpenRouter API Key não está configurada.`);
                        }
                    }
                }
            } catch (err: any) {
                logger.error("AIAgent", `Erro no processamento da Camila AI para ${remoteJid}:`, err);
            }

            try {
                // Fetch rules for this session
                const rules = await prisma.autoReply.findMany({
                    where: {
                        session: {
                            sessionId: sessionId
                        }
                    }
                });

                for (const rule of rules) {
                    let match = false;
                    const keyword = rule.keyword.toLowerCase();
                    const incoming = text.toLowerCase();

                    switch (rule.matchType) {
                        case 'EXACT':
                            match = incoming === keyword;
                            break;
                        case 'CONTAINS':
                            match = incoming.includes(keyword);
                            break;
                        case 'REGEX':
                            try {
                                const regex = new RegExp(rule.keyword, 'i');
                                match = regex.test(text); // Use original case for regex
                            } catch (e) {
                                logger.error("AutoReply", "Invalid regex in auto-reply", rule.keyword);
                            }
                            break;
                    }

                    if (match) {
                        // Check trigger context (GROUP, PRIVATE, or ALL)
                        const isGroup = remoteJid.endsWith('@g.us');
                        const triggerType = (rule as any).triggerType || 'ALL'; // Default to ALL if undefined

                        if (triggerType === 'GROUP' && !isGroup) continue;
                        if (triggerType === 'PRIVATE' && isGroup) continue;

                        logger.info("AutoReply", `Match: ${rule.keyword} -> ${remoteJid}`);

                        if (rule.isMedia && rule.mediaUrl) {
                            const url = rule.mediaUrl;
                            const type = (rule as any).mediaType || "document";
                            
                            let payload: any = {};
                            if (rule.response) {
                                payload.caption = rule.response;
                            }

                            if (type === "image") {
                                payload.image = { url };
                            } else if (type === "video") {
                                payload.video = { url };
                            } else if (type === "audio") {
                                payload = { audio: { url } };
                            } else {
                                payload.document = { url };
                                payload.mimetype = 'application/octet-stream';
                                payload.fileName = url.split('/').pop() || 'document';
                            }
                            
                            try {
                                await sock.sendMessage(remoteJid, payload, { quoted: msg });
                            } catch (err: any) {
                                logger.error("AutoReply", `Failed to send media auto-reply from URL: ${err.message}. Falling back to text if response exists.`);
                                if (rule.response) {
                                    await sock.sendMessage(remoteJid, { text: rule.response }, { quoted: msg });
                                }
                            }
                        } else if (rule.response) {
                            await sock.sendMessage(remoteJid, { text: rule.response }, { quoted: msg });
                        }

                        break;
                    }
                }

            } catch (e) {
                logger.error("AutoReply", "Error executing auto-reply", e);
            }
        }
    });
}
