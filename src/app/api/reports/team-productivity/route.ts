import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, isAdmin, canUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const canViewReport = await canUser(user.id, "reports.view_team_productivity");
    if (!isAdmin(user.role) && !canViewReport) {
      return NextResponse.json(
        { status: false, message: "Sem autorização para visualizar relatórios da equipe." },
        { status: 403 }
      );
    }

    // Fetch team members with their sessions and recent activity
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        imoviewCorretorCodigo: true,
        imoviewCorretorNome: true,
        isActive: true,
        createdAt: true,
        sessions: {
          select: {
            id: true,
            sessionId: true,
            name: true,
            status: true,
            updatedAt: true,
            _count: {
              select: {
                messages: true,
                contacts: true,
              },
            },
          },
        },
      },
    });

    // Get all broadcast metrics grouped by session
    const broadcastLogs = await prisma.broadcastLog.findMany({
      select: {
        sessionId: true,
        sent: true,
        responded: true,
        failed: true,
        total: true,
        status: true,
        startedAt: true,
      },
    });

    // Map metrics per session
    const sessionMetricsMap = new Map<string, {
      totalCampaigns: number;
      sent: number;
      responded: number;
      failed: number;
      lastCampaignAt: Date | null;
    }>();

    for (const b of broadcastLogs) {
      const cur = sessionMetricsMap.get(b.sessionId) || {
        totalCampaigns: 0,
        sent: 0,
        responded: 0,
        failed: 0,
        lastCampaignAt: null,
      };
      cur.totalCampaigns += 1;
      cur.sent += b.sent;
      cur.responded += b.responded;
      cur.failed += b.failed;
      if (!cur.lastCampaignAt || b.startedAt > cur.lastCampaignAt) {
        cur.lastCampaignAt = b.startedAt;
      }
      sessionMetricsMap.set(b.sessionId, cur);
    }

    // Build productivity summary for each member
    const teamProductivity = users.map((member) => {
      let totalCampaigns = 0;
      let totalSent = 0;
      let totalResponded = 0;
      let totalFailed = 0;
      let totalChatMessages = 0;
      let totalContacts = 0;
      let lastActivity: Date | null = null;

      const hasConnectedSession = member.sessions.some((s) => s.status === "CONNECTED");

      for (const s of member.sessions) {
        totalChatMessages += s._count.messages;
        totalContacts += s._count.contacts;
        const metrics = sessionMetricsMap.get(s.sessionId);
        if (metrics) {
          totalCampaigns += metrics.totalCampaigns;
          totalSent += metrics.sent;
          totalResponded += metrics.responded;
          totalFailed += metrics.failed;
          if (!lastActivity || (metrics.lastCampaignAt && metrics.lastCampaignAt > lastActivity)) {
            lastActivity = metrics.lastCampaignAt;
          }
        }
      }

      const responseRate = totalSent > 0 ? Number(((totalResponded / totalSent) * 100).toFixed(1)) : 0;

      return {
        id: member.id,
        name: member.name || "Sem nome",
        email: member.email,
        role: member.role,
        imoviewCorretorNome: member.imoviewCorretorNome,
        imoviewCorretorCodigo: member.imoviewCorretorCodigo,
        isActive: member.isActive,
        sessionsCount: member.sessions.length,
        hasConnectedSession,
        sessions: member.sessions,
        totalCampaigns,
        totalSent,
        totalResponded,
        totalFailed,
        responseRate,
        totalChatMessages,
        totalContacts,
        lastActivity,
      };
    });

    const summary = {
      totalMembers: teamProductivity.length,
      activeMembers: teamProductivity.filter((m) => m.isActive).length,
      connectedChips: teamProductivity.filter((m) => m.hasConnectedSession).length,
      totalMessagesSent: teamProductivity.reduce((acc, m) => acc + m.totalSent, 0),
      totalResponses: teamProductivity.reduce((acc, m) => acc + m.totalResponded, 0),
    };

    return NextResponse.json({
      status: true,
      data: {
        summary,
        team: teamProductivity,
      },
    });
  } catch (error: any) {
    console.error("Team productivity report error:", error);
    return NextResponse.json(
      { status: false, message: "Erro ao gerar relatório de produtividade", error: error.message },
      { status: 500 }
    );
  }
}
