"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { KeyRound, Lock, Eye, EyeOff, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function FirstLoginPasswordModal() {
  const { data: session, update } = useSession();
  // @ts-ignore
  const mustChange = session?.user?.mustChangePassword === true;
  const userName = session?.user?.name || "Corretor";

  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mustChange) {
      setOpen(true);
    }
  }, [mustChange]);

  if (!mustChange && !open) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (newPassword === "Rhema@2026!") {
      toast.error("Por favor, escolha uma senha pessoal diferente da senha inicial padrão.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas informadas não coincidem.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (res.ok && data.status) {
        toast.success("Sua senha pessoal foi salva com sucesso!");
        setOpen(false);
        // Atualiza a sessão NextAuth para desativar o flag de primeiro login
        await update({ mustChangePassword: false });
      } else {
        toast.error(data.message || "Erro ao atualizar a senha.");
      }
    } catch (err: any) {
      toast.error(`Falha na atualização: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-6 bg-card/95 backdrop-blur-xl border-border/60 shadow-2xl">
        <DialogHeader className="text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="h-6 w-6 animate-pulse" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            Defina sua Senha Pessoal
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Olá, <strong>{userName}</strong>! Você está utilizando a senha inicial padrão (<code>Rhema@2026!</code>). Para sua privacidade e segurança nos atendimentos, atualize para uma senha pessoal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Nova Senha Pessoal</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo de 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="pr-10 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Confirmar Nova Senha</Label>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Digite a mesma senha novamente"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="text-xs"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[11px] text-destructive">As senhas não coincidem.</p>
            )}
            {confirmPassword && newPassword === confirmPassword && (
              <p className="text-[11px] text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Senhas conferem!
              </p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-xs shadow-md shadow-amber-500/20"
            >
              {loading ? "Salvando Nova Senha..." : "Salvar Senha Pessoal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
