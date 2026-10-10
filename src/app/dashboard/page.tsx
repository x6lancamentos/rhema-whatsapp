import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getAccessibleSessions } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { DashboardClientView } from "@/components/dashboard/dashboard-client-view";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    const sessions = await getAccessibleSessions(session.user.id!, session.user.role || "OWNER");

    const totalSessions = sessions.length;
    const connectedSessions = sessions.filter(s => s.status === 'CONNECTED').length;
    const disconnectedSessions = totalSessions - connectedSessions;

    // Fetch auto-reply count for accessible sessions
    let autoReplyCount = 0;
    try {
        const sessionIds = sessions.map(s => s.sessionId);
        if (sessionIds.length > 0) {
            autoReplyCount = await prisma.autoReply.count({
                where: { sessionId: { in: sessionIds } }
            });
        }
    } catch {
        // If auto-reply table doesn't exist yet, just show 0
    }

    return (
        <DashboardClientView
            totalSessions={totalSessions}
            connectedSessions={connectedSessions}
            disconnectedSessions={disconnectedSessions}
            autoReplyCount={autoReplyCount}
            sessions={sessions.map(s => ({
                id: s.id,
                sessionId: s.sessionId,
                name: s.name,
                status: s.status,
            }))}
        />
    );
}
