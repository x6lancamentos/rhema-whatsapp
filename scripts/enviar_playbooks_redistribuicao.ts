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
const PLAYBOOKS_DIR = "C:\\Users\\brunn\\OneDrive\\Documentos\\Sistemas\\Rhema HUB\\docs\\Reuniao_Diretoria_30_10_2026\\08_PLAYBOOKS_CORRETORES";

interface Destinatario {
    nome: string;
    jid: string;
    telefone: string;
    pdfFile: string;
    caption: string;
}

const DESTINATARIOS: Destinatario[] = [
    {
        nome: "Flávia Mara de Mattos",
        jid: "5515974042000@s.whatsapp.net",
        telefone: "5515974042000",
        pdfFile: "PLAYBOOK_ATENDIMENTO_FLAVIA.pdf",
        caption: `Olá, Flávia! 🎯 Tudo bem?\n\nA diretoria concluiu a redistribuição de carteira e você recebeu *11 leads de alto giro* no seu CRM Imoview.\n\n📌 *Seu Playbook exclusivo está em anexo:*\n• 11 clientes mapeados com telefone, tipologia e bairros.\n• 2 opções do portfólio da Rhema já sugeridas para cada um.\n• Script rápido de abordagem pronto para copiar e colar.\n\n⚡ *SLA:* Primeiro contato com os 4 leads críticos nas próximas 24h.\nBora agendar visita na rua! Conte com a gente. 💪`
    },
    {
        nome: "Ulisses Dias Vieira",
        jid: "5513988181515@s.whatsapp.net",
        telefone: "5513988181515",
        pdfFile: "PLAYBOOK_ATENDIMENTO_ULISSES.pdf",
        caption: `Grande Ulisses! 🚀\n\nAssim como você destravou o case de R$ 645 mil em apenas 4 dias, alocamos *10 atendimentos estratégicos da esteira de resgate* para a sua gestão direta no Imoview.\n\n📌 *Seu Playbook completo está em anexo:*\n• Dados completos dos 10 clientes e dias sem contato.\n• Imóveis do estoque Rhema recomendados para ofertar hoje.\n• Scripts calibrados para restabelecer conexão rápida.\n\nBora puxar proposta na mesa com esses clientes! Tamo junto. 👊`
    },
    {
        nome: "Tatiana Gonçalves de Oliveira",
        jid: "5513981854677@s.whatsapp.net",
        telefone: "5513981854677",
        pdfFile: "PLAYBOOK_ATENDIMENTO_TATIANA.pdf",
        caption: `Tatiana! 🦁🔥\n\nQuem tem a sua energia e poder de convencimento faz a diferença. Foram transferidos *8 clientes prontos para o seu toque comercial* no Imoview.\n\n📌 *Seu Playbook exclusivo está no PDF anexo:*\n• Clientes e necessidades específicas mapeadas.\n• Sugestões pontuais de imóveis para visita imediata.\n• Roteiro de abordagem para ligar e puxar para a mesa.\n\nBora colocar visita na rua e fechar negócio! Vai com tudo! 💥`
    },
    {
        nome: "Andressa Larocca",
        jid: "5513981512755@s.whatsapp.net",
        telefone: "5513981512755",
        pdfFile: "PLAYBOOK_ATENDIMENTO_ANDRESSA.pdf",
        caption: `Bora, Andressa! ⚡🔥\n\nMomento de acelerar tração! Você recebeu *10 oportunidades selecionadas* no CRM para imprimir ritmo forte e velocidade de conversão.\n\n📌 *Seu Playbook está no PDF anexo:*\n• 10 leads com perfil e imóveis sugeridos para oferta imediata.\n• Scripts de recontato rápido via WhatsApp.\n• Foco: converter contatos em visitas e buscar o bônus de Dia Consistente (+20 pts).\n\nPra cima! 🚀`
    },
    {
        nome: "Elaine do Nascimento",
        jid: "5513976008877@s.whatsapp.net",
        telefone: "5513976008877",
        pdfFile: "PLAYBOOK_ATENDIMENTO_ELAINE.pdf",
        caption: `Bom dia, Elaine! 📋 Tudo bem?\n\nEstruturamos a passagem de *9 atendimentos organizados* para a sua esteira de follow-up no Imoview.\n\n📌 *Segue em anexo o seu Playbook de Atendimento:*\n• Listagem dos 9 leads com histórico e estágio atual no funil.\n• 2 imóveis recomendados do portfólio Rhema por cliente.\n• Scripts padronizados para cadência de retorno.\n\nExcelente sequência de atendimentos! Conte com a diretoria. ☀️`
    },
    {
        nome: "Leniára Araújo",
        jid: "5513996461664@s.whatsapp.net",
        telefone: "5513996461664",
        pdfFile: "PLAYBOOK_ATENDIMENTO_LENIARA.pdf",
        caption: `Olá, Leniára. 💼\n\nRedistribuição concluída no CRM: você recebeu *7 leads estratégicos* para atuação direta e objetiva.\n\n📌 *Playbook anexo com:*\n• Identificação dos 7 atendimentos e dias sem interação.\n• Opções de estoque já filtradas para envio rápido.\n• Script assertivo para reativar o cliente sem rodeios.\n\nFoco e execução!`
    },
    {
        nome: "André Felipe O. Cavalcante",
        jid: "5513981404451@s.whatsapp.net",
        telefone: "5513981404451",
        pdfFile: "PLAYBOOK_ATENDIMENTO_ANDRE_FELIPE.pdf",
        caption: `Bom dia, André! 🙏\n\nCom a sua autoridade e 16 anos de mercado em Santos, direcionamos *7 atendimentos que demandam posicionamento estratégico e consultoria imobiliária* no Imoview.\n\n📌 *Em anexo está o seu Playbook:*\n• 7 clientes com perfil de compra detalhado.\n• Imóveis do portfólio Rhema selecionados para posicionamento de liquidez e valor.\n• Script consultivo de reaproximação institucional.\n\nÓtima condução estratégica e grandes negócios! Abraço. 🤝`
    },
    {
        nome: "Georjana Garcia (via Gestão Brunno)",
        jid: "556293856483@s.whatsapp.net",
        telefone: "556293856483",
        pdfFile: "PLAYBOOK_ATENDIMENTO_GEORJANA.pdf",
        caption: `📄 *Playbook de Atendimento • Georjana Garcia (10 Leads)*\n\nBrunno, segue em anexo o Playbook exclusivo da Georjana com o mapeamento completo dos 10 atendimentos transferidos no CRM, 2 imóveis sugeridos por lead e scripts táticos de abordagem.\n\nEnviando diretamente para você repassar a ela no WhatsApp ou alinhar na reunião. 🚀`
    }
];

async function run() {
    console.log("=== INICIANDO DISPARO DOS PLAYBOOKS VIA WHATSAPP (BAILEYS) ===");

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
                console.log("[CONEXÃO ABERTA] WhatsApp Socket conectado!");
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado do WhatsApp (Logged Out)"));
                }
            }
        });
        setTimeout(() => reject(new Error("Timeout conectando ao WhatsApp (20s)")), 20000);
    });

    // Warm-up de 3 segundos
    await new Promise(r => setTimeout(r, 3000));

    let sucessos = 0;
    let falhas = 0;

    const dbSession = await prisma.session.findUnique({ where: { sessionId: SESSION_ID } });

    for (let i = 0; i < DESTINATARIOS.length; i++) {
        const dest = DESTINATARIOS[i];
        const pdfFullPath = path.join(PLAYBOOKS_DIR, dest.pdfFile);

        if (!fs.existsSync(pdfFullPath)) {
            console.error(`[ERRO] Arquivo não encontrado: ${pdfFullPath}`);
            falhas++;
            continue;
        }

        const b64 = fs.readFileSync(pdfFullPath).toString("base64");
        const dataUri = `data:application/pdf;base64,${b64}`;
        console.log(`\n[${i + 1}/${DESTINATARIOS.length}] Enviando para ${dest.nome} (${dest.telefone})...`);

        try {
            const sentMsg = await socket.sendMessage(dest.jid, {
                document: { url: dataUri },
                mimetype: "application/pdf",
                fileName: dest.pdfFile,
                caption: dest.caption
            });

            console.log(`✓ [ENVIADO COM SUCESSO] Key: ${sentMsg?.key?.id}`);
            sucessos++;

            if (dbSession) {
                try {
                    await prisma.message.create({
                        data: {
                            sessionId: dbSession.id,
                            remoteJid: dest.jid,
                            senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                            fromMe: true,
                            keyId: sentMsg?.key?.id || `DOC_${Date.now()}`,
                            pushName: "Brunno Anastácio",
                            type: "DOCUMENT",
                            content: `[PLAYBOOK EM ANEXO: ${dest.pdfFile}] ${dest.caption}`,
                            status: "SENT",
                            timestamp: new Date()
                        }
                    });
                } catch (e: any) {
                    console.warn(`[AVISO PRISMA] ${e.message}`);
                }
            }
        } catch (err: any) {
            console.error(`✗ [FALHA NO ENVIO] ${dest.nome}: ${err.message}`);
            falhas++;
        }

        // Intervalo de segurança anti-ban entre envios
        await new Promise(r => setTimeout(r, 4000));
    }

    console.log(`\n==================================================`);
    console.log(`DISPARO FINALIZADO!`);
    console.log(`Total: ${DESTINATARIOS.length} | Sucessos: ${sucessos} | Falhas: ${falhas}`);
    console.log(`==================================================`);

    await new Promise(r => setTimeout(r, 2000));
    socket.end(undefined);
}

run().catch(console.error).finally(() => process.exit(0));
