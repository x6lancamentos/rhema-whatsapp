import fs from "fs";
import path from "path";
import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";
const RAIZ_RHEMA = path.resolve(__dirname, "../../Sistema Rhema - Imoview");

interface BrokerPlaybook {
    nome: string;
    jid: string;
    telefone: string;
    slug: string;
    caption: string;
}

const DESTINATARIOS: BrokerPlaybook[] = [
    {
        nome: "Elaine do Nascimento",
        jid: "5513976008877@s.whatsapp.net",
        telefone: "5513976008877",
        slug: "elaine",
        caption: `📄 *Playbook Comercial & Instruções Táticas • Elaine do Nascimento*\n\nOlá, Elaine! Conforme alinhado, segue em anexo o seu *Playbook Oficial em PDF* com os 5 novos atendimentos direcionados para você.\n\n🎯 *O que você encontra no documento:*\n• Diagnóstico comercial detalhado de cada cliente (Aline, Luiz, Zoraide, Lara e Cristina)\n• Estratégia de abordagem e diferenciais da Ponta da Praia, Embaré e Campo Grande\n• Roteiros prontos de ligação/WhatsApp para você iniciar o contato\n• Como contornar objeções comuns\n• Imóveis do nosso estoque já incluídos no carrinho do Imoview\n\nBons contatos e ótimas vendas! 🚀`
    },
    {
        nome: "André Felipe O. Cavalcante",
        jid: "5513981404451@s.whatsapp.net",
        telefone: "5513981404451",
        slug: "andre",
        caption: `📄 *Playbook Comercial & Instruções Táticas • André Felipe*\n\nFala, André! Segue em anexo o seu *Playbook Oficial em PDF* com os 5 atendimentos quentes com visitas recentes direcionados para o seu usuário.\n\n🎯 *O que você encontra no documento:*\n• Histórico de visitas e diagnóstico dos clientes (Keyla, Leonardo, Tassi, Bruna/Paulo e Gabriela)\n• Estratégia de reaquecimento focada em fechar negócio\n• Roteiros de abordagem com gatilhos de fechamento e agendamento de nova visita\n• Como quebrar objeções de indecisão\n• Imóveis do estoque já vinculados no carrinho do Imoview\n\nBora pra cima virar essas visitas em propostas! 🚀`
    },
    {
        nome: "Leniára R. M. Araújo",
        jid: "5513996461664@s.whatsapp.net",
        telefone: "5513996461664",
        slug: "leniara",
        caption: `📄 *Playbook Comercial & Instruções Táticas • Leniára Araújo*\n\nOlá, Leniára! Segue em anexo o seu *Playbook Oficial em PDF* com a análise completa e detalhada dos 5 atendimentos transferidos para a sua carteira.\n\n🎯 *O que você encontra no documento:*\n• Diagnóstico dos clientes (Samara, Rose, Felipe, Ne Braga e Edgar)\n• Perfil de busca por bairros (Macuco, José Menino, Embaré, Boqueirão e Aparecida)\n• Roteiro estratégico de abertura para ligação e WhatsApp\n• Dicas táticas para conduzir compradores de fora de Santos (SP e RJ)\n• Códigos dos imóveis do estoque adicionados no carrinho\n\nSucesso nas abordagens e ótimas negociações! 🚀`
    },
    {
        nome: "Roseli de Carvalho Lopes",
        jid: "5513974103368@s.whatsapp.net",
        telefone: "5513974103368",
        slug: "roseli",
        caption: `📄 *Playbook Comercial & Instruções Táticas • Roseli Lopes*\n\nOlá, Roseli! Segue em anexo o seu *Playbook Oficial em PDF* com as orientações completas para os 5 novos atendimentos direcionados para você.\n\n🎯 *O que você encontra no documento:*\n• Diagnóstico comercial dos clientes (Karen, Sheila, Otamar, Eloisa e Ana Luiza)\n• Leads em fase ativa e visita na Ponta da Praia, Embaré, Santa Maria e Itararé\n• Roteiros de abordagem prontos para ligação e mensagem\n• Como contornar objeções e travar data de visita presencial\n• Opções do estoque já abastecidas no carrinho do CRM\n\nÓtimo trabalho e excelentes atendimentos! 🚀`
    }
];

async function main() {
    console.log("=== INICIANDO DISPARO DOS 4 PLAYBOOKS EM PDF VIA WHATSAPP ===");

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
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado do WhatsApp"));
                }
            }
        });
    });

    console.log("[CONEXÃO WHATSAPP OK] Socket pronto para envio de documentos!");

    const dbSession = await prisma.session.findUnique({ where: { sessionId: SESSION_ID } });

    for (let i = 0; i < DESTINATARIOS.length; i++) {
        const dest = DESTINATARIOS[i];
        const pdfPath = path.join(RAIZ_RHEMA, `relatorios/Playbook_${dest.slug}.pdf`);

        if (!fs.existsSync(pdfPath)) {
            console.error(`[ERRO] Arquivo PDF não encontrado: ${pdfPath}`);
            continue;
        }

        console.log(`\n[${i + 1}/4] Enviando PDF para ${dest.nome} (${dest.telefone})...`);
        const pdfBuffer = fs.readFileSync(pdfPath);
        const fileName = `Playbook_Atendimentos_Rhema_${dest.slug.toUpperCase()}.pdf`;

        const sent = await socket.sendMessage(dest.jid, {
            document: pdfBuffer,
            mimetype: "application/pdf",
            fileName: fileName,
            caption: dest.caption
        });

        console.log(`[SUCESSO] PDF entregue para ${dest.nome}! Key: ${sent?.key?.id}`);

        // Registrar no Prisma
        try {
            if (dbSession) {
                await prisma.message.create({
                    data: {
                        sessionId: dbSession.id,
                        remoteJid: dest.jid,
                        senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                        fromMe: true,
                        keyId: sent?.key?.id || `DOC_${Date.now()}`,
                        pushName: "Brunno Anastácio",
                        type: "DOCUMENT",
                        content: `[DOCUMENTO PDF: ${fileName}] ${dest.caption}`,
                        status: "SENT",
                        timestamp: new Date()
                    }
                });
            }
        } catch (e) {}

        if (i < DESTINATARIOS.length - 1) {
            console.log("Aguardando 4 segundos antes do próximo envio...");
            await new Promise(r => setTimeout(r, 4000));
        }
    }

    console.log("\n=======================================================");
    console.log("🎉 TODOS OS 4 PLAYBOOKS EM PDF FORAM ENVIADOS COM SUCESSO!");
    console.log("=======================================================");

    await new Promise(r => setTimeout(r, 2000));
    process.exit(0);
}

main().catch(err => {
    console.error("Erro fatal no envio dos PDFs:", err);
    process.exit(1);
});
