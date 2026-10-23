import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";
const GROUP_JID = "120363427965736363@g.us"; // 🚀 Time Rhema

const ANDRE_PHONE = "5513981404451";
const ULISSES_PHONE = "5513988181515";

// Lista de contatos da Diretoria e ADM
const ADM_CONTACTS = [
    {
        name: "Ana Maria Lisboa",
        role: "Dona / Diretoria",
        phone: "5513991673717",
        category: "DIRETORIA"
    },
    {
        name: "Miguel Lisboa",
        role: "Dono / Diretoria",
        phone: "5513991368031",
        category: "DIRETORIA"
    },
    {
        name: "Nice Saloes",
        role: "Gerente Administrativa",
        phone: "5513997787173",
        category: "DIRETORIA"
    },
    {
        name: "Rhema ADM",
        role: "Administração Central",
        phone: "5513991488850",
        category: "ADM"
    },
    {
        name: "Camila (Recepção Rhema)",
        role: "Recepção / Atendimento",
        phone: "5513991588225",
        category: "ADM"
    },
    {
        name: "Kaylane",
        role: "Corretora / Auxiliar Administrativa",
        phone: "5513992123879",
        category: "ADM"
    }
];

const CORRETORES = [
    { name: "Flávia", phone: "5515974042000", hasCreci: true },
    { name: "Tatiana", phone: "5513981854677", hasCreci: true },
    { name: "Elaine", phone: "5513976008877", hasCreci: true },
    { name: "Ulisses", phone: "5513988181515", hasCreci: true },
    { name: "Leniara", phone: "5513996461664", hasCreci: true },
    { name: "André", phone: "5513981404451", hasCreci: false },
    { name: "Karla Gomes", phone: "5513997744475", hasCreci: false },
    { name: "Andressa", phone: "5513981512755", hasCreci: false }
];

async function run() {
    console.log("=== 1. SALVANDO CONTATOS DE DIRETORIA E ADM NO SISTEMA ===");

    const dbSession = await prisma.session.findUnique({
        where: { sessionId: SESSION_ID }
    });
    if (!dbSession) throw new Error("Sessão não encontrada no banco");

    // Salvar no Prisma Contact
    for (const c of ADM_CONTACTS) {
        const jid = `${c.phone}@s.whatsapp.net`;
        await prisma.contact.upsert({
            where: { sessionId_jid: { sessionId: dbSession.id, jid } },
            create: {
                sessionId: dbSession.id,
                jid,
                name: c.name,
                notify: c.name,
                verifiedName: c.role,
                data: { role: c.role, category: c.category }
            },
            update: {
                name: c.name,
                notify: c.name,
                verifiedName: c.role,
                data: { role: c.role, category: c.category }
            }
        });
        console.log(`  ✅ Contato salvo no banco: ${c.name} (${c.role}) - +${c.phone}`);
    }

    // Salvar arquivo estruturado local em data/rhema-contacts.json
    const fullContactList = {
        updatedAt: new Date().toISOString(),
        diretoria_e_adm: ADM_CONTACTS,
        corretores_ativos: CORRETORES
    };

    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const jsonPath = path.join(dataDir, "rhema-contacts.json");
    fs.writeFileSync(jsonPath, JSON.stringify(fullContactList, null, 2), "utf-8");
    console.log(`  📁 Lista estruturada salva em: ${jsonPath}`);

    console.log("\n=== 2. CONECTANDO AO WHATSAPP PARA BOAS-VINDAS (ANDRÉ E ULISSES) ===");

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
                    reject(new Error("Desconectado"));
                }
            }
        });
    });

    // Buscar participantes do grupo
    console.log("Buscando membros do grupo Time Rhema...");
    const groupMeta = await socket.groupMetadata(GROUP_JID);
    const allParticipantJids = groupMeta.participants.map((p: any) => p.id);
    console.log(`Grupo: "${groupMeta.subject}", Total de membros: ${allParticipantJids.length}`);

    // Mensagem de boas-vindas com menção oficial
    const welcomeMessage = `🎉 *BOAS-VINDAS OFICIAIS AOS NOVOS CORRETORES!* 🚀

Equipe, aproveitando o momento, queremos registrar também as nossas boas-vindas oficiais ao @${ANDRE_PHONE} e ao @${ULISSES_PHONE}, que entraram para o nosso time ontem! 👏

André e Ulisses, sejam muito bem-vindos à família Rhema! Que seja uma jornada de muito crescimento, grandes parcerias e muitas vendas fechadas. Contem com todos nós para o que precisarem no dia a dia!

Bora pra cima acelerar esse final de mês com tudo! 🎯🤝🔥`;

    console.log("Enviando mensagem para o grupo com menção a todos...");
    const sent = await socket.sendMessage(GROUP_JID, {
        text: welcomeMessage,
        mentions: allParticipantJids
    });

    console.log(`✅ [SUCESSO] Mensagem de boas-vindas enviada para o Time Rhema! Key ID: ${sent?.key?.id}`);

    // Registrar no banco
    try {
        await prisma.message.create({
            data: {
                sessionId: dbSession.id,
                remoteJid: GROUP_JID,
                senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                fromMe: true,
                keyId: sent?.key?.id || `WELCOME_ANDRE_ULISSES_${Date.now()}`,
                pushName: "Brunno Anastácio",
                type: "TEXT",
                content: welcomeMessage,
                status: "SENT",
                timestamp: new Date()
            }
        });
    } catch (e) {}

    setTimeout(() => process.exit(0), 1000);
}

run().catch((err) => {
    console.error("Erro fatal:", err);
    process.exit(1);
});
