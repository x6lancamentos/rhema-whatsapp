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

async function run() {
    console.log("=== EXTRAINDO PARTICIPANTES DOS GRUPOS 'VAMOS ORAR' ===");

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
            if (connection === "open") resolve();
            if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) reject(new Error("Desconectado"));
            }
        });
    });

    console.log("[OK] Conectado ao WhatsApp! Buscando todos os grupos participantes...");

    const allGroups = await socket.groupFetchAllParticipating();
    const groupEntries = Object.values(allGroups);

    console.log(`Total de grupos encontrados na conta: ${groupEntries.length}`);

    // Filtrar grupos que contenham "Vamos Orar" (case-insensitive)
    const matchingGroups = groupEntries.filter((g: any) =>
        (g.subject || "").toLowerCase().includes("vamos orar")
    );

    if (matchingGroups.length === 0) {
        console.log("Nenhum grupo com o termo 'Vamos Orar' foi encontrado diretamente.");
        process.exit(0);
    }

    const outputDir = path.join(process.cwd(), "data", "exports");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const resultsSummary: any[] = [];

    for (const group of matchingGroups) {
        console.log(`\n======================================================`);
        console.log(`GRUPO: ${group.subject} (${group.id})`);
        console.log(`Descrição: ${group.desc || "Sem descrição"}`);
        console.log(`Total de Participantes: ${group.participants.length}`);
        console.log(`======================================================`);

        const participantsData: any[] = [];

        for (const p of group.participants) {
            let phone = "";
            let lid = "";

            if ((p as any).phoneNumber) {
                phone = (p as any).phoneNumber.replace(/[^0-9]/g, "");
            } else if (p.id.endsWith("@s.whatsapp.net")) {
                phone = p.id.split("@")[0].replace(/[^0-9]/g, "");
            } else if (p.id.endsWith("@lid")) {
                lid = p.id;
            }

            // Tentar buscar contato no DB para obter o nome se existir
            let contactName = "";
            try {
                const contact = await prisma.contact.findFirst({
                    where: {
                        OR: [
                            { jid: p.id },
                            { lid: p.id },
                            { remoteJidAlt: p.id },
                            ...(phone ? [{ jid: `${phone}@s.whatsapp.net` }] : [])
                        ]
                    },
                    select: { name: true, notify: true, verifiedName: true }
                });
                if (contact) {
                    contactName = contact.name || contact.notify || contact.verifiedName || "";
                }
            } catch (e) {}

            const role = p.admin === "superadmin" ? "Criador / Superadmin" : p.admin === "admin" ? "Administrador" : "Membro";

            participantsData.push({
                phone: phone ? `+${phone}` : "(LID: " + p.id + ")",
                rawPhone: phone,
                jid: p.id,
                name: contactName || "-",
                role
            });
        }

        // Salvar CSV para este grupo
        const safeName = group.subject.replace(/[^a-zA-Z0-9]/g, "_");
        const csvPath = path.join(outputDir, `participantes_${safeName}.csv`);
        const csvContent = [
            "Número;Nome;Função;JID",
            ...participantsData.map(p => `"${p.phone}";"${p.name}";"${p.role}";"${p.jid}"`)
        ].join("\n");

        fs.writeFileSync(csvPath, "\uFEFF" + csvContent, "utf-8"); // UTF-8 BOM para Excel ler acentos perfeitamente
        console.log(`Arquivo CSV salvo: ${csvPath}`);

        resultsSummary.push({
            subject: group.subject,
            jid: group.id,
            total: participantsData.length,
            csvPath,
            participants: participantsData
        });
    }

    // Salvar JSON resumo
    const jsonSummaryPath = path.join(outputDir, "vamos_orar_participantes.json");
    fs.writeFileSync(jsonSummaryPath, JSON.stringify(resultsSummary, null, 2), "utf-8");

    console.log(`\nArquivo JSON consolidado salvo em: ${jsonSummaryPath}`);
    setTimeout(() => process.exit(0), 1000);
}

run().catch((err) => {
    console.error("Erro:", err);
    process.exit(1);
});
