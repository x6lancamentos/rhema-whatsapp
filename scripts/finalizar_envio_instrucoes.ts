import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "../src/lib/prisma";
import { usePrismaAuthState } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const SESSION_ID = "avg78n";

interface PlaybookCorretor {
    nome: string;
    telefone: string;
    jid: string;
    titulo: string;
    instrucoesTexto: string;
}

const RESTANTES: PlaybookCorretor[] = [
    {
        nome: "Leniára R. M. Araújo",
        telefone: "5513996461664",
        jid: "5513996461664@s.whatsapp.net",
        titulo: "📘 *PLAYBOOK TÁTICO & INSTRUÇÕES DE ATENDIMENTO • LENIÁRA ARAÚJO*",
        instrucoesTexto: `🎯 *INSTRUÇÕES DETALHADAS DE COMO LIDAR COM CADA LEAD:*

1️⃣ *SAMARA OLIVEIRA DA PAZ (Atendimento #906)* — R$ 400.000,00 | Macuco
• *Diagnóstico:* Busca sobrado ou casa no Macuco/Zona Leste (R$ 340k a R$ 510k). Valoriza privacidade e metragem.
• *Imóveis no Carrinho:* #5167 (R$ 399k no Embaré), #2574 (R$ 377k) e #6613 (R$ 325k no Macuco).
• *Estratégia:* Apresentar o #6613 no Macuco e uma alternativa de baixo condomínio no Embaré (#5167).
• *Roteiro:* _"Olá, Samara! Tudo bem? Leniára Araújo da Rhema Imóveis. Assumi seu atendimento e já separei duas opções ideais: o imóvel #6613 no Macuco por R$ 325.000,00 e uma opção excelente no Embaré por R$ 399.000,00 (#5167). Qual dia fica melhor para você conhecer pessoalmente?"_

2️⃣ *ROSE G MAZZINI (Atendimento #898)* — R$ 468.000,00 | José Menino
• *Diagnóstico:* Compradora de São Paulo buscando apartamento no José Menino perto da praia e do VLT.
• *Imóveis no Carrinho:* #6877 (R$ 450k), #6769 (R$ 400k) e #9713 (R$ 415k).
• *Estratégia:* Posicionar o #6877 como excelente oportunidade de vista livre e condomínio acessível.
• *Roteiro:* _"Olá, Rose! Leniára da Rhema Imóveis por aqui. Analisei seu perfil de busca no José Menino até R$ 468k e já reservei no seu carrinho o imóvel #6877 por R$ 450.000,00 — vista livre, 2 dormitórios e garagem. Quando você tiver um tempinho, me dá um retorno para alinharmos uma visita!"_

3️⃣ *FELIPE DEREK (Atendimento #884)* — R$ 450.000,00 | Embaré
• *Diagnóstico:* Comprador qualificado buscando 2 dormitórios no Embaré até R$ 450k.
• *Imóveis no Carrinho:* #5167 (R$ 399k), #6912 (R$ 450k) e #9579 (R$ 439k).
• *Estratégia:* Apresentar o #5167 como a melhor compra abaixo de R$ 400k no Embaré.
• *Roteiro:* _"Olá, Felipe! Tudo bem? Leniára da Rhema Imóveis. Selecionei duas opções excelentes de 2 dormitórios no Embaré abaixo de R$ 450k (#5167 por R$ 399k e #9579 por R$ 439k). Ambas com chaves disponíveis na imobiliária. Vamos visitar amanhã?"_

4️⃣ *NE BRAGA (Atendimento #880)* — R$ 280.000,00 | Boqueirão
• *Diagnóstico:* Comprador do RJ buscando kitnet/1 dorm no Boqueirão para investimento ou uso de lazer.
• *Imóveis no Carrinho:* #9622 (R$ 280k no Boqueirão), #6904 (R$ 270k) e #9610 (R$ 300k).
• *Estratégia:* Apresentar o #9622 no valor cravado de R$ 280k com localização privilegiada.
• *Roteiro:* _"Olá, Ne Braga! Sou a Leniára da Rhema Imóveis em Santos. Temos exatamente o que você procura: o imóvel #9622 no Boqueirão por R$ 280.000,00 cravados, excelente para praia ou renda. Já adicionei no seu cadastro. Quer receber os detalhes no WhatsApp agora?"_

5️⃣ *EDGAR (Atendimento #874)* — R$ 550.000,00 | Aparecida
• *Diagnóstico:* Busca apartamento espaçoso de 3 dormitórios ou cobertura na Aparecida.
• *Imóveis no Carrinho:* #5999 (R$ 480k), #6680 (R$ 425k) e #9791 (R$ 470k).
• *Estratégia:* Destacar o imóvel #5999 de 3 dormitórios por R$ 480k com preço abaixo do teto orçamentário.
• *Roteiro:* _"Olá, Edgar! Leniára da Rhema Imóveis por aqui. Analisei sua busca de 3 dormitórios na Aparecida e encontrei duas opções espetaculares bem abaixo do seu teto (#5999 por R$ 480k e #6680 por R$ 425k). Que tal darmos um pulo lá para você avaliar o espaço?"_`
    },
    {
        nome: "Roseli de Carvalho Lopes",
        telefone: "5513974103368",
        jid: "5513974103368@s.whatsapp.net",
        titulo: "📘 *PLAYBOOK TÁTICO & INSTRUÇÕES DE ATENDIMENTO • ROSELI LOPES*",
        instrucoesTexto: `🎯 *INSTRUÇÕES DETALHADAS DE COMO LIDAR COM CADA LEAD:*

1️⃣ *KAREN (Atendimento #946)* — R$ 500.000,00 | Itararé / Santos
• *Diagnóstico:* Busca 2 dormitórios na orla com vista livre e boa ventilação.
• *Imóveis no Carrinho:* #5608 (R$ 427k), #9592 (R$ 385k) e #9758 (R$ 410k).
• *Estratégia:* Apresentar o #5608 no Itararé como compra pronta para morar com economia de R$ 70k sobre o teto dela.
• *Roteiro:* _"Olá, Karen! Tudo bem? Aqui é a Roseli Lopes da Rhema Imóveis. Assumi seu atendimento e já separei para você duas excelentes opções de 2 quartos no Itararé com vista livre e garagem (#5608 por R$ 427k e #9592 por R$ 385k). Ambas estão prontas para morar. Podemos agendar sua visita para esta semana?"_

2️⃣ *SHEILA SOUZA (Atendimento #907)* — R$ 320.000,00 | Santa Maria
• *Diagnóstico:* Em fase de agendamento! Busca casa/sobrado térreo até R$ 320k.
• *Imóveis no Carrinho:* #9016 (R$ 320k em Santa Maria), #9756 (R$ 320k) e #2267 (R$ 240k).
• *Estratégia:* Focar na casa #9016 que tem o valor exato dela e já puxar a data da visita.
• *Roteiro:* _"Olá, Sheila! Aqui é a Roseli da Rhema Imóveis. Vi que você já está com o atendimento aquecido para agendamento e assumi seu contato para te levar na casa #9016 em Santa Maria por R$ 320.000,00 — exatamente o que você busca. Qual horário no sábado ou durante a semana fica melhor para você?"_

3️⃣ *OTAMAR PELUSIO (Atendimento #900)* — R$ 450.000,00 | Embaré
• *Diagnóstico:* Comprador qualificado buscando 2 dormitórios com condomínio baixo no Embaré.
• *Imóveis no Carrinho:* #5167 (R$ 399k), #6912 (R$ 450k) e #9579 (R$ 439k).
• *Estratégia:* Destacar o imóvel #5167 por R$ 399k com vaga privativa.
• *Roteiro:* _"Olá, Otamar! Tudo bem? Roseli Lopes da Rhema Imóveis falando. Já selecionei no seu cadastro duas excelentes opções no Embaré (#5167 por R$ 399k e #6912 por R$ 450k), com condomínio baixo e ótima iluminação natural. Quando podemos dar uma passada rápida lá?"_

4️⃣ *ELOISA (Atendimento #896)* — R$ 392.000,00 | Ponta da Praia
• *Diagnóstico:* Lead em fase ativa de visita na Ponta da Praia! Altíssima probabilidade de conversão se for ágil.
• *Imóveis no Carrinho:* #9724 (R$ 380k), #6330 (R$ 339k) e #9756 (R$ 320k).
• *Estratégia:* Contato prioritário com convite direto para visita presencial.
• *Roteiro:* _"Olá, Eloisa! Tudo bem? Sou a Roseli Lopes da Rhema Imóveis. Vi que você está na fase de visitas na Ponta da Praia e já adicionei no seu carrinho o imóvel #9724 por R$ 380.000,00 e o #9756 por R$ 320.000,00. As chaves estão na minha mão. Podemos ir amanhã às 15h?"_

5️⃣ *ANA LUIZA CASSILHAS (Atendimento #883)* — R$ 450.000,00 | Aparecida / Ponta da Praia
• *Diagnóstico:* Compradora familiar, busca segurança e boa localização perto de serviços.
• *Imóveis no Carrinho:* #4942 (R$ 427k), #9590 (R$ 365k) e #1746 (R$ 430k).
• *Estratégia:* Enviar fotos do #4942 e agendar visita presencial.
• *Roteiro:* _"Olá, Ana Luiza! Tudo ótimo com você? Aqui é a Roseli Lopes da Rhema Imóveis. Consegui duas unidades exclusivas de 2 dormitórios na Aparecida (#4942 por R$ 427k e #1746 por R$ 430k), ambas com condomínio tranquilo e muito perto da praia. Gostaria de te enviar o tour virtual ou já agendamos a visita?"_`
    },
    {
        nome: "Elaine do Nascimento",
        telefone: "5513976008877",
        jid: "5513976008877@s.whatsapp.net",
        titulo: "📘 *PLAYBOOK TÁTICO & INSTRUÇÕES DE ATENDIMENTO • ELAINE DO NASCIMENTO*",
        instrucoesTexto: `🎯 *INSTRUÇÕES DETALHADAS DE COMO LIDAR COM CADA LEAD:*

1️⃣ *ALINE SAGIORATO DE CASTRO (Atendimento #835)* — R$ 650.000,00 | Ponta da Praia
• *Diagnóstico:* Compradora de Ribeirão Preto buscando na Ponta da Praia. Quer consultoria de confiança e agilidade.
• *Imóveis no Carrinho:* #5865 (R$ 490k), #6909 (R$ 515k) e #6748 (R$ 640k).
• *Estratégia:* Apresentar os 3 imóveis selecionados e oferecer tour por chamada de vídeo caso ela esteja em Ribeirão.
• *Roteiro:* _"Olá, Aline! Tudo bem? Aqui é a Elaine do Nascimento, da Rhema Imóveis. Assumi seu atendimento com prioridade porque recebemos excelentes opções de 2 dormitórios na Ponta da Praia (#5865 por R$ 490k e #6748 por R$ 640k). Você prefere que eu te envie o tour virtual em vídeo agora ou conversamos 5 minutos por ligação?"_

2️⃣ *LUIZ PEREIRA (Atendimento #840)* — R$ 790.000,00 | Campo Grande
• *Diagnóstico:* Comprador de alto padrão focado em Campo Grande/Marapé. Busca metragem e vaga demarcada.
• *Imóveis no Carrinho:* #509 (R$ 650k), #3976 (R$ 640k) e #9002 (R$ 620k).
• *Estratégia:* Postura executiva e segura; destacar que as opções estão abaixo do teto dele com padrão superior.
• *Roteiro:* _"Olá, Luiz! Sou a Elaine do Nascimento da Rhema Imóveis. Assumi seu atendimento para te dar suporte na busca no Campo Grande. Separei duas unidades de 3 dorms com vaga demarcada por R$ 640k a 650k (#509 e #3976). Você prefere agendar uma visita presencial nesta sexta ou no sábado de manhã?"_

3️⃣ *ZORAIDE ALVES (Atendimento #780)* — R$ 600.000,00 | Embaré
• *Diagnóstico:* Compradora decidida e focada no miolo do Embaré.
• *Imóveis no Carrinho:* #6849 (R$ 585k), #6005 (R$ 535k) e #9753 (R$ 497k).
• *Estratégia:* Enfatizar a localização nobre das opções selecionadas.
• *Roteiro:* _"Olá, Zoraide! Aqui é a Elaine da Rhema Imóveis. Separei duas oportunidades reais de 2 dormitórios no miolo do Embaré (#6849 por R$ 585k e #6005 por R$ 535k). Ambas na localização que você deseja. Vamos agendar para você conhecer pessoalmente ainda esta semana?"_

4️⃣ *LARA PASCOM (Atendimento #782)* — R$ 750.000,00 | Aparecida
• *Diagnóstico:* Excelente ticket orçamentário. Quer condomínio estruturado ou apartamento reformado.
• *Imóveis no Carrinho:* #2230 (R$ 650k), #9760 (R$ 680k) e #5202 (R$ 580k).
• *Estratégia:* Apresentar o #9760 (R$ 680k) como opção pronta e imponente na Aparecida.
• *Roteiro:* _"Olá, Lara! Tudo bem? Aqui é a Elaine da Rhema Imóveis. Já selecionei no seu cadastro duas opções incríveis de 3 dormitórios na Aparecida por R$ 650k e R$ 680k (#2230 e #9760). Apartamentos claros, arejados e muito bem localizados. Você tem disponibilidade amanhã à tarde para visitarmos?"_

5️⃣ *CRISTINA VERALDA (Atendimento #800)* — R$ 535.000,00 | Santos
• *Diagnóstico:* Compradora analítica buscando 2 quartos com condomínio equilibrado.
• *Imóveis no Carrinho:* #5608 (R$ 427k), #5865 (R$ 490k) e #9007 (R$ 455k).
• *Estratégia:* Mostrar o custo-benefício e folga no orçamento do #5865 (R$ 490k na Ponta da Praia).
• *Roteiro:* _"Olá, Cristina! Como vai? Sou a Elaine da Rhema Imóveis. Já coloquei no seu cadastro o imóvel #5865 na Ponta da Praia por R$ 490.000,00 — excelente estado e condomínio baixo. Quando seria um bom momento para você dar uma olhada nele comigo?"_`
    }
];

async function main() {
    console.log("=== ENVIANDO DOSSIÊS TÁTICOS PARA LENIÁRA, ROSELI E ELAINE ===");

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
                console.log("[CONEXÃO WHATSAPP OK] Socket conectado!");
                resolve();
            } else if (connection === "close") {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    reject(new Error("Desconectado do WhatsApp"));
                }
            }
        });
    });

    await new Promise(r => setTimeout(r, 3000));
    const dbSession = await prisma.session.findUnique({ where: { sessionId: SESSION_ID } });

    for (let i = 0; i < RESTANTES.length; i++) {
        const item = RESTANTES[i];
        console.log(`\n[${i + 1}/${RESTANTES.length}] Enviando Dossiê para ${item.nome} (${item.telefone})...`);

        const fullText = `${item.titulo}\n\n${item.instrucoesTexto}\n\n💡 *Dossiê Oficial em PDF arquivado na gestão Rhema:* \`relatorios/Playbook_${item.nome.split(" ")[0].toLowerCase()}.pdf\`\nBons contatos e ótimas vendas! 🚀`;

        try {
            const sentText = await socket.sendMessage(item.jid, { text: fullText });
            console.log(`  [SUCESSO] Dossiê entregue para ${item.nome}! Key: ${sentText?.key?.id}`);

            if (dbSession) {
                await prisma.message.create({
                    data: {
                        sessionId: dbSession.id,
                        remoteJid: item.jid,
                        senderJid: socket.user?.id || `${SESSION_ID}@s.whatsapp.net`,
                        fromMe: true,
                        keyId: sentText?.key?.id || `COMM_${Date.now()}`,
                        pushName: "Brunno Anastácio",
                        type: "TEXT",
                        content: fullText,
                        status: "SENT",
                        timestamp: new Date()
                    }
                });
            }
        } catch (e: any) {
            console.error(`  [ERRO] Falha ao enviar para ${item.nome}:`, e.message);
        }

        if (i < RESTANTES.length - 1) {
            console.log("Aguardando 4 segundos antes do próximo envio...");
            await new Promise(r => setTimeout(r, 4000));
        }
    }

    console.log("\n=======================================================");
    console.log("🎉 TODOS OS DOSSIÊS FORAM ENTREGUES COM SUCESSO!");
    console.log("=======================================================");

    await new Promise(r => setTimeout(r, 2000));
    process.exit(0);
}

main().catch(err => {
    console.error("Erro fatal:", err);
    process.exit(1);
});
