
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });

    try {
        const userRole = session.user.role;
        const whereClause: any = { userId: session.user.id };

        // Restrict WA-AKG and SYSTEM notifications exclusively to SUPERADMIN
        if (userRole !== "SUPERADMIN") {
            whereClause.NOT = [
                { type: "SYSTEM" },
                { title: { contains: "WA-AKG" } },
                { title: { contains: "Update" } },
                { title: { contains: "Versão" } },
                { message: { contains: "WA-AKG" } },
                { message: { contains: "GitHub" } },
            ];
        }

        const notifications = await prisma.notification.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit to last 50
        });
        return NextResponse.json({ status: true, message: "Notifications fetched successfully", data: notifications });
    } catch (e) {
        return NextResponse.json({ status: false, message: "Error fetching notifications", error: "Error fetching notifications" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });

    // Only SUPERADMIN can send global notifications
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user?.role !== "SUPERADMIN") {
        return NextResponse.json({ status: false, message: "Forbidden: Only Superadmin can send notifications", error: "Forbidden" }, { status: 403 });
    }

    try {
        const { title, message, type, href, targetUserId, broadcast } = await req.json();

        if (broadcast) {
            // Restrict SYSTEM/WA-AKG notifications strictly to SUPERADMIN recipients
            const isSystemOrAkg = type === "SYSTEM" || title?.includes("WA-AKG") || message?.includes("WA-AKG");
            const targetUsers = isSystemOrAkg
                ? await prisma.user.findMany({ where: { role: "SUPERADMIN" }, select: { id: true } })
                : await prisma.user.findMany({ select: { id: true } });

            const notifications = targetUsers.map((u: { id: string }) => ({
                userId: u.id,
                title,
                message,
                type: type || "INFO",
                href,
                read: false
            }));

            await prisma.notification.createMany({ data: notifications });

            // Emit Socket.IO event for target users
            const io = (global as any).io;
            if (io) {
                targetUsers.forEach((u: { id: string }) => {
                    io.to(`user:${u.id}`).emit('notification:new', {
                        userId: u.id,
                        title,
                        message,
                        type: type || "INFO",
                        href,
                        createdAt: new Date().toISOString(),
                        read: false
                    });
                });
            }

            return NextResponse.json({ status: true, message: "Notifications broadcasted successfully", data: { count: targetUsers.length } });
        } else if (targetUserId) {
            // Send to specific user
            const notification = await prisma.notification.create({
                data: {
                    userId: targetUserId,
                    title,
                    message,
                    type: type || "INFO",
                    href,
                }
            });

            // Emit Socket.IO event
            const io = (global as any).io;
            if (io) {
                io.to(`user:${targetUserId}`).emit('notification:new', {
                    id: notification.id,
                    userId: targetUserId,
                    title,
                    message,
                    type: type || "INFO",
                    href,
                    createdAt: notification.createdAt
                });
            }

            return NextResponse.json({ status: true, message: "Notification sent successfully" });
        }

        return NextResponse.json({ status: false, message: "Invalid Request", error: "Provide targetUserId or broadcast=true" }, { status: 400 });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ status: false, message: "Error creating notification", error: "Error creating notification" }, { status: 500 });
    }
}
