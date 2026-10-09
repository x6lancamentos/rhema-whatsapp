import { prisma } from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const { sessionId } = await params;

        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
        const offset = parseInt(searchParams.get("offset") || "0");

        const [logs, total, aggregates] = await Promise.all([
            prisma.broadcastLog.findMany({
                where: { sessionId },
                orderBy: { startedAt: "desc" },
                take: limit,
                skip: offset,
                include: {
                    _count: { select: { recipients: true } }
                }
            }),
            prisma.broadcastLog.count({ where: { sessionId } }),
            prisma.broadcastLog.aggregate({
                where: { sessionId },
                _sum: {
                    sent: true,
                    failed: true,
                    total: true,
                    responded: true,
                }
            })
        ]);

        const totalSent = aggregates._sum.sent || 0;
        const totalFailed = aggregates._sum.failed || 0;
        const totalResponded = aggregates._sum.responded || 0;
        const totalTargeted = aggregates._sum.total || 0;
        const successRate = totalSent + totalFailed > 0 ? Math.round((totalSent / (totalSent + totalFailed)) * 100) : 100;
        const responseRate = totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : 0;

        return NextResponse.json({
            status: true,
            data: logs,
            total,
            limit,
            offset,
            metrics: {
                totalCampaigns: total,
                totalSent,
                totalFailed,
                totalResponded,
                totalTargeted,
                successRate,
                responseRate,
            }
        });
    } catch (e) {
        console.error("Broadcast history error:", e);
        return NextResponse.json({ status: false, message: "Failed to fetch history" }, { status: 500 });
    }
}
