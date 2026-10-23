import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";
const GROUP_JID = "120363427965736363@g.us"; // 🚀 Time Rhema
const KARLA_PHONE = "5513997744475";

async function run() {
    console.log(`Iniciando adição de Karla (${KARLA_PHONE}) no grupo Time Rhema (${GROUP_JID})...`);

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

    // 1. Validar JID no WhatsApp
    let targetJid = `${KARLA_PHONE}@s.whatsapp.net`;
    try {
        const check = await socket.onWhatsApp(KARLA_PHONE);
        if (check && check.length > 0 && check[0]?.exists) {
            targetJid = check[0].jid;
            console.log(`JID validado no WhatsApp: ${targetJid}`);
        }
    } catch (e) {
        console.warn("Não foi possível validar JID, usando fallback:", targetJid);
    }

    // 2. Verificar metadados do grupo e permissões
    console.log("Verificando metadados do grupo...");
    let groupMeta: any = null;
    try {
        groupMeta = await socket.groupMetadata(GROUP_JID);
        console.log(`Grupo: "${groupMeta.subject}", Total de membros: ${groupMeta.participants.length}`);
        
        const myJid = socket.user?.id?.split(':')[0] + '@s.whatsapp.net';
        const myLid = (socket.user as any)?.lid;
        const myParticipant = groupMeta.participants.find((p: any) => 
            p.id.split(':')[0] === myJid.split('@')[0] || 
            (myLid && p.id.split(':')[0] === myLid.split('@')[0])
        );

        console.log("Meu usuário no grupo:", myParticipant ? (myParticipant.admin || "membro comum") : "não encontrado");

        // Verificar se Karla já está no grupo
        const karlaAlreadyIn = groupMeta.participants.find((p: any) =>
            p.id.split(':')[0] === targetJid.split('@')[0] ||
            p.id.includes(KARLA_PHONE)
        );
        if (karlaAlreadyIn) {
            console.log("Karla já é participante do grupo!");
            process.exit(0);
        }
    } catch (err: any) {
        console.error("Erro ao buscar metadados do grupo:", err.message);
    }

    // 3. Executar adição
    try {
        console.log(`Executando socket.groupParticipantsUpdate para adicionar ${targetJid}...`);
        const result = await socket.groupParticipantsUpdate(
            GROUP_JID,
            [targetJid],
            "add"
        );

        console.log("RESULTADO DA ADIÇÃO:", JSON.stringify(result, null, 2));

        // Analisar status de retorno
        const participantResult = Array.isArray(result) ? result[0] : (result as any);
        const status = participantResult?.status;

        if (status === "200") {
            console.log("✅ [SUCESSO] Karla foi adicionada com sucesso ao grupo Time Rhema!");
        } else if (status === "403") {
            console.log("⚠️ [RESTRIÇÃO DE PRIVACIDADE] As configurações de privacidade da Karla não permitem adição direta.");
            try {
                const inviteCode = await socket.groupInviteCode(GROUP_JID);
                console.log(`LINK DE CONVITE DO GRUPO: https://chat.whatsapp.com/${inviteCode}`);
            } catch (invErr) {
                console.log("Não foi possível gerar link de convite.");
            }
        } else if (status === "409") {
            console.log("ℹ️ Karla já está no grupo!");
        } else {
            console.log(`Status retornado: ${status}`);
        }

    } catch (err: any) {
        console.error("❌ ERRO AO ADICIONAR:", err.message);
        if (err.message?.includes("not-authorized") || err.message?.includes("forbidden") || err.message?.includes("403")) {
            console.log("Motivo provável: Seu número não é Administrador deste grupo ou não tem permissão para adicionar participantes.");
            try {
                const inviteCode = await socket.groupInviteCode(GROUP_JID);
                console.log(`LINK DE CONVITE DO GRUPO GERADO: https://chat.whatsapp.com/${inviteCode}`);
            } catch (e) {}
        }
    }

    setTimeout(() => process.exit(0), 1000);
}

run().catch((err) => {
    console.error("Erro fatal:", err);
    process.exit(1);
});
