import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface ApiAuthResult {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    role: string;
  } | null;
  error: NextResponse | null;
}

/**
 * Middleware utilitário de borda para rotas Next.js App Router (NextRequest).
 * Valida sessão NextAuth, Bearer token (API_SECRET_KEY) ou x-api-key,
 * e verifica se o perfil do usuário pertence a allowedRoles.
 */
export async function requireApiAuth(
  req: NextRequest,
  allowedRoles: string[] = ["ADMIN", "SUPERADMIN"]
): Promise<ApiAuthResult> {
  // 1. Checa Token de Serviço (M2M) via Authorization: Bearer <API_SECRET_KEY>
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (process.env.API_SECRET_KEY && token === process.env.API_SECRET_KEY) {
      return {
        user: { id: "system", role: "SUPERADMIN", name: "System Service", email: "system@rhemaos.internal" },
        error: null,
      };
    }
  }

  // 2. Checa header X-API-KEY para integrações M2M e microserviços
  const xApiKey = req.headers.get("x-api-key");
  if (xApiKey) {
    if (process.env.API_SECRET_KEY && xApiKey === process.env.API_SECRET_KEY) {
      return {
        user: { id: "system", role: "SUPERADMIN", name: "System Service", email: "system@rhemaos.internal" },
        error: null,
      };
    }

    try {
      const apiUser = await prisma.user.findUnique({
        where: { apiKey: xApiKey },
        select: { id: true, email: true, name: true, role: true, isActive: true },
      });

      if (apiUser && apiUser.isActive !== false) {
        if (allowedRoles.includes(apiUser.role)) {
          return { user: apiUser, error: null };
        }
        return {
          error: NextResponse.json(
            { success: false, error: "Acesso negado para o perfil da API Key fornecida." },
            { status: 403 }
          ),
          user: null,
        };
      }
    } catch {
      // Ignora erro de banco e cai na checagem de sessão
    }
  }

  // 3. Checa Sessão NextAuth do Navegador
  let session: any = null;
  try {
    session = await auth();
  } catch {
    // Caso invocado fora do request-store do Next.js ou erro de cookie, trata como não autenticado
    session = null;
  }

  if (!session?.user) {
    return {
      error: NextResponse.json(
        { success: false, error: "Não autenticado. Faça login para continuar." },
        { status: 401 }
      ),
      user: null,
    };
  }

  const userRole = (session.user as any).role || "USER";
  if (!allowedRoles.includes(userRole)) {
    return {
      error: NextResponse.json(
        { success: false, error: "Acesso negado para este perfil de usuário." },
        { status: 403 }
      ),
      user: null,
    };
  }

  return { user: session.user as any, error: null };
}
