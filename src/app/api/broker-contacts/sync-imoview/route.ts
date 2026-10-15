import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, isAdmin, canUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { fetchImoviewBrokers } from "@/lib/imoview";

// POST /api/broker-contacts/sync-imoview
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const canAccess = isAdmin(user.role) || (await canUser(user.id, "management.broker_support_radar"));
    if (!canAccess) {
      return NextResponse.json(
        { status: false, message: "Acesso restrito ao perfil de gestão comercial." },
        { status: 403 }
      );
    }

    const imoviewBrokers = await fetchImoviewBrokers();
    if (!imoviewBrokers || imoviewBrokers.length === 0) {
      return NextResponse.json({
        status: false,
        message: "Nenhum corretor encontrado na API do Imoview no momento.",
      });
    }

    let createdCount = 0;
    let existingCount = 0;

    for (const b of imoviewBrokers) {
      if (!b.nome || !b.id) continue;

      // Verifica se já existe por código Imoview ou nome aproximado
      const existing = await prisma.brokerContact.findFirst({
        where: {
          OR: [
            { imoviewCodigo: String(b.id) },
            { nome: { equals: b.nome.trim() } },
          ],
        },
      });

      if (existing) {
        // Se já existe mas faltava o código Imoview, atualiza
        if (!existing.imoviewCodigo) {
          await prisma.brokerContact.update({
            where: { id: existing.id },
            data: { imoviewCodigo: String(b.id) },
          });
        }
        existingCount++;
      } else {
        // Cria novo registro com telefone padrão da região para edição posterior
        await prisma.brokerContact.create({
          data: {
            nome: b.nome.trim(),
            imoviewCodigo: String(b.id),
            telefone: b.telefone ? b.telefone.replace(/\D/g, "") : "",
            email: b.email || null,
            equipe: "Vendas",
            ativo: true,
            observacoes: "Importado automaticamente do Imoview CRM",
          },
        });
        createdCount++;
      }
    }

    return NextResponse.json({
      status: true,
      message: `Sincronização concluída! ${createdCount} novo(s) corretor(es) cadastrado(s) e ${existingCount} já existente(s).`,
      createdCount,
      existingCount,
      totalImoview: imoviewBrokers.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Erro ao sincronizar corretores do Imoview", error: error.message },
      { status: 500 }
    );
  }
}
