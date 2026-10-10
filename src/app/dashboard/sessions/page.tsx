import { auth } from "@/lib/auth";
import { SessionManager } from "@/components/dashboard/session-manager";
import { SessionsHeader } from "@/components/dashboard/sessions-header";

export default async function SessionsPage() {
    const session = await auth();

    return (
        <div>
            <SessionsHeader />
            <SessionManager user={session?.user} />
        </div>
    );
}
