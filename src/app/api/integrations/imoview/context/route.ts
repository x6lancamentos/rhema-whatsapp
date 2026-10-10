import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { getImoviewContextByJidOrPhone, cleanDigitsPhone, formatToJid } from "@/lib/imoview-context";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jid = searchParams.get("jid");
    const phone = searchParams.get("phone");

    const identifier = jid || phone;
    if (!identifier) {
      return NextResponse.json(
        { status: false, message: "Parâmetro jid ou phone é obrigatório." },
        { status: 400 }
      );
    }

    // 1. Try first in cached ImoviewContactContext
    const context = await getImoviewContextByJidOrPhone(identifier);
    if (context) {
      return NextResponse.json({
        status: true,
        source: "cache_db",
        data: context,
      });
    }

    // 2. Fallback: Check if lead was part of a broadcast campaign with variables
    const clean = cleanDigitsPhone(identifier);
    const variants = [clean, "55" + clean, clean.replace(/^55/, "")].filter(Boolean);
    const jidVariants = variants.map((v) => `${v}@s.whatsapp.net`);

    const recipient = await prisma.broadcastRecipient.findFirst({
      where: {
        OR: [
          { jid: { in: jidVariants } },
        ],
      },
      include: {
        broadcastLog: {
          select: { name: true, templateName: true, startedAt: true },
        },
      },
      orderBy: { sentAt: "desc" },
    });

    if (recipient && recipient.variables) {
      const vars = recipient.variables as Record<string, any>;
      // Construct an ad-hoc context from campaign variables
      const fallbackContext = {
        phone: clean,
        jid: recipient.jid,
        tipoRelacionamento: vars.proprietario ? "proprietario" : "lead",
        nome: recipient.name || vars.nome || vars.cliente || null,
        codigoImovel: vars.codigo || vars.codigoImovel || null,
        tituloImovel: vars.titulo || vars.tipo ? `${vars.tipo || "Imóvel"} em ${vars.bairro || "Santos"}` : null,
        tipoImovel: vars.tipo || null,
        valor: vars.valor || null,
        valorCondominio: vars.condominio || null,
        valorIptu: vars.iptu || null,
        bairro: vars.bairro || null,
        cidade: vars.cidade || null,
        quartos: vars.quartos || null,
        vagas: vars.vagas || null,
        corretorNome: recipient.imoviewCorretor || null,
        campaignName: recipient.broadcastLog?.name || "Disparo Inicial",
      };

      // Save into DB cache so next call is instant
      try {
        await prisma.imoviewContactContext.upsert({
          where: { phone: clean },
          create: {
            ...fallbackContext,
            phone: clean,
            tipoRelacionamento: fallbackContext.tipoRelacionamento,
            dadosCompletos: vars,
          },
          update: {
            ...fallbackContext,
            tipoRelacionamento: fallbackContext.tipoRelacionamento,
            dadosCompletos: vars,
          },
        });
      } catch {}

      return NextResponse.json({
        status: true,
        source: "campaign_log",
        data: fallbackContext,
      });
    }

    return NextResponse.json({
      status: true,
      source: "none",
      data: null,
      message: "Nenhum vínculo do Imoview encontrado para este contato.",
    });
  } catch (error: any) {
    console.error("Imoview Context GET error:", error);
    return NextResponse.json(
      { status: false, message: "Erro ao buscar contexto do Imoview", error: error.message },
      { status: 500 }
    );
  }
}

// POST: Save or link property/context to contact
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const phone = cleanDigitsPhone(body.phone || body.jid || "");
    if (!phone || phone.length < 8) {
      return NextResponse.json(
        { status: false, message: "Telefone ou JID inválido." },
        { status: 400 }
      );
    }

    const jid = formatToJid(phone);

    const updated = await prisma.imoviewContactContext.upsert({
      where: { phone },
      create: {
        phone,
        jid,
        tipoRelacionamento: body.tipoRelacionamento || "lead",
        nome: body.nome || null,
        codigoImovel: body.codigoImovel || null,
        tituloImovel: body.tituloImovel || null,
        tipoImovel: body.tipoImovel || null,
        finalidade: body.finalidade || null,
        valor: body.valor || null,
        valorCondominio: body.valorCondominio || null,
        valorIptu: body.valorIptu || null,
        nomeCondominio: body.nomeCondominio || null,
        bairro: body.bairro || null,
        cidade: body.cidade || null,
        quartos: body.quartos || null,
        vagas: body.vagas || null,
        corretorId: body.corretorId || null,
        corretorNome: body.corretorNome || null,
        fotoPrincipal: body.fotoPrincipal || null,
        isRhemaProprio: !!body.isRhemaProprio,
        dadosCompletos: body.dadosCompletos || body,
      },
      update: {
        jid,
        tipoRelacionamento: body.tipoRelacionamento || undefined,
        nome: body.nome || undefined,
        codigoImovel: body.codigoImovel || undefined,
        tituloImovel: body.tituloImovel || undefined,
        tipoImovel: body.tipoImovel || undefined,
        finalidade: body.finalidade || undefined,
        valor: body.valor || undefined,
        valorCondominio: body.valorCondominio || undefined,
        valorIptu: body.valorIptu || undefined,
        nomeCondominio: body.nomeCondominio || undefined,
        bairro: body.bairro || undefined,
        cidade: body.cidade || undefined,
        quartos: body.quartos || undefined,
        vagas: body.vagas || undefined,
        corretorId: body.corretorId || undefined,
        corretorNome: body.corretorNome || undefined,
        fotoPrincipal: body.fotoPrincipal || undefined,
        isRhemaProprio: body.isRhemaProprio !== undefined ? !!body.isRhemaProprio : undefined,
        dadosCompletos: body.dadosCompletos || body,
      },
    });

    return NextResponse.json({
      status: true,
      message: "Contexto do Imoview atualizado e vinculado com sucesso!",
      data: updated,
    });
  } catch (error: any) {
    console.error("Imoview Context POST error:", error);
    return NextResponse.json(
      { status: false, message: "Erro ao atualizar contexto do Imoview", error: error.message },
      { status: 500 }
    );
  }
}
