"use client";

import { useLanguage } from "@/components/language-provider";

export function SessionsHeader() {
    const { t } = useLanguage();
    return (
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-6">
            {t("sessions.title")}
        </h1>
    );
}
