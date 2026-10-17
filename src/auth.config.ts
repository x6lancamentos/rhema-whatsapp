import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    pages: {
        signIn: '/auth/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
            
            if (isOnDashboard) {
                if (isLoggedIn) return true;
                return false; // Redirect unauthenticated users to login page
            } else if (isLoggedIn && nextUrl.pathname === '/auth/login') {
                return Response.redirect(new URL('/dashboard', nextUrl));
            }
            return true;
        },
        async jwt({ token, user, trigger, session: updateSession }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.mustChangePassword = (user as any).mustChangePassword;
                token.phone = (user as any).phone;
            }
            if (trigger === "update" && updateSession) {
                if (updateSession.mustChangePassword !== undefined) {
                    token.mustChangePassword = updateSession.mustChangePassword;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                (session.user as any).role = token.role;
                (session.user as any).mustChangePassword = token.mustChangePassword;
                (session.user as any).phone = token.phone;
            }
            return session;
        }
    },
    providers: [], // Configured in auth.ts
    session: {
        strategy: 'jwt'
    },
    trustHost: true,
} satisfies NextAuthConfig;
