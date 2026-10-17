import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsedCredentials = z
          .object({ email: z.string().min(3), password: z.string().min(1) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email: rawLogin, password } = parsedCredentials.data;
          const login = rawLogin.trim();
          const cleanPhone = login.replace(/\D/g, "");

          // Busca flexível por email exato, telefone (DDD+Número) ou com código do país (55)
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: login },
                ...(cleanPhone.length >= 10
                  ? [
                      { phone: cleanPhone },
                      { phone: cleanPhone.startsWith("55") ? cleanPhone.slice(2) : cleanPhone },
                      { phone: cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}` },
                      { email: `${cleanPhone.startsWith("55") ? cleanPhone.slice(2) : cleanPhone}@rhemaimoveis.com.br` },
                      { email: `${cleanPhone}@rhemaimoveis.com.br` },
                    ]
                  : []),
              ],
            },
          });

          if (!user || user.isActive === false) return null;

          const passwordsMatch = await bcrypt.compare(password, user.password);

          if (passwordsMatch) {
            return user;
          }
        }
        return null;
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
});
