import { prisma } from "@/lib/prisma";
import type { ImoviewProperty, ImoviewLead } from "@/lib/imoview";

// Helper to normalize phone to clean digits and handle Brazilian phone numbers
export function cleanDigitsPhone(phoneOrJid: string): string {
  if (!phoneOrJid) return "";
  const raw = phoneOrJid.split("@")[0].replace(/\D/g, "");
  return raw;
}

export function formatToJid(phone: string): string {
  let clean = cleanDigitsPhone(phone);
  if ((clean.length === 10 || clean.length === 11) && !clean.startsWith("55")) {
    clean = "55" + clean;
  }
  return `${clean}@s.whatsapp.net`;
}

/**
 * Upserts a list of Imoview Properties into ImoviewContactContext table
 * for immediate zero-latency cached lookup in chat and throughout the app.
 */
export async function upsertImoviewPropertiesContext(properties: ImoviewProperty[]) {
  if (!properties || properties.length === 0) return 0;

  let savedCount = 0;
  for (const prop of properties) {
    const rawPhone = prop.proprietarioTelefone || "";
    const cleanPhone = cleanDigitsPhone(rawPhone);
    if (!cleanPhone || cleanPhone.length < 8) continue;

    const jid = formatToJid(cleanPhone);
    const tipoRel = prop.isRhemaProprio
      ? "imovel_proprio"
      : prop.finalidade === "Locação"
      ? "locador"
      : "proprietario";

    try {
      await prisma.imoviewContactContext.upsert({
        where: { phone: cleanPhone },
        create: {
          phone: cleanPhone,
          jid,
          tipoRelacionamento: tipoRel,
          nome: prop.proprietarioNome || "Proprietário",
          codigoImovel: prop.codigo,
          tituloImovel: prop.titulo,
          tipoImovel: prop.tipo,
          finalidade: prop.finalidade,
          valor: prop.valor,
          valorCondominio: prop.valorCondominio || null,
          valorIptu: prop.valorIptu || null,
          nomeCondominio: prop.nomeCondominio || null,
          bairro: prop.bairro || null,
          cidade: prop.cidade || null,
          quartos: prop.quartos || null,
          vagas: prop.vagas || null,
          corretorId: prop.corretorId || null,
          corretorNome: prop.corretorNome || null,
          diasSemContato: prop.diasSemAtualizacao || 0,
          fotoPrincipal: prop.fotoPrincipal || null,
          isRhemaProprio: !!prop.isRhemaProprio,
          dadosCompletos: prop as any,
        },
        update: {
          jid,
          tipoRelacionamento: tipoRel,
          nome: prop.proprietarioNome || undefined,
          codigoImovel: prop.codigo,
          tituloImovel: prop.titulo,
          tipoImovel: prop.tipo,
          finalidade: prop.finalidade,
          valor: prop.valor,
          valorCondominio: prop.valorCondominio || null,
          valorIptu: prop.valorIptu || null,
          nomeCondominio: prop.nomeCondominio || null,
          bairro: prop.bairro || null,
          cidade: prop.cidade || null,
          quartos: prop.quartos || null,
          vagas: prop.vagas || null,
          corretorId: prop.corretorId || null,
          corretorNome: prop.corretorNome || null,
          diasSemContato: prop.diasSemAtualizacao || 0,
          fotoPrincipal: prop.fotoPrincipal || null,
          isRhemaProprio: !!prop.isRhemaProprio,
          dadosCompletos: prop as any,
        },
      });
      savedCount++;
    } catch (e) {
      // Continue on isolated record error
    }
  }

  return savedCount;
}

/**
 * Upserts a list of Imoview Stalled Leads into ImoviewContactContext table.
 */
export async function upsertImoviewLeadsContext(leads: ImoviewLead[]) {
  if (!leads || leads.length === 0) return 0;

  let savedCount = 0;
  for (const lead of leads) {
    const cleanPhone = cleanDigitsPhone(lead.telefone);
    if (!cleanPhone || cleanPhone.length < 8) continue;

    const jid = formatToJid(cleanPhone);

    try {
      await prisma.imoviewContactContext.upsert({
        where: { phone: cleanPhone },
        create: {
          phone: cleanPhone,
          jid,
          tipoRelacionamento: "lead",
          nome: lead.clienteNome || "Lead Interessado",
          codigoImovel: lead.codigoImovel || null,
          tituloImovel: lead.tipoImovel ? `${lead.tipoImovel} em ${lead.bairroInteresse || "Santos"}` : null,
          tipoImovel: lead.tipoImovel || null,
          finalidade: lead.finalidade || null,
          valor: lead.valorInteresse || null,
          bairro: lead.bairroInteresse || null,
          cidade: lead.cidadeInteresse || null,
          quartos: lead.quartos || null,
          vagas: lead.vagas || null,
          corretorId: lead.corretorId || null,
          corretorNome: lead.corretorNome || null,
          diasSemContato: lead.diasSemContato || 0,
          ultimoHistorico: lead.ultimoHistorico || null,
          dadosCompletos: lead as any,
        },
        update: {
          jid,
          tipoRelacionamento: "lead",
          nome: lead.clienteNome || undefined,
          codigoImovel: lead.codigoImovel || undefined,
          tipoImovel: lead.tipoImovel || undefined,
          finalidade: lead.finalidade || undefined,
          valor: lead.valorInteresse || undefined,
          bairro: lead.bairroInteresse || undefined,
          cidade: lead.cidadeInteresse || undefined,
          quartos: lead.quartos || undefined,
          vagas: lead.vagas || undefined,
          corretorId: lead.corretorId || undefined,
          corretorNome: lead.corretorNome || undefined,
          diasSemContato: lead.diasSemContato || 0,
          ultimoHistorico: lead.ultimoHistorico || undefined,
          dadosCompletos: lead as any,
        },
      });
      savedCount++;
    } catch (e) {
      // Continue
    }
  }

  return savedCount;
}

/**
 * Fast zero-latency lookup for a contact's Imoview context.
 * Checks phone number variations (with and without 55, 9th digit variations).
 */
export async function getImoviewContextByJidOrPhone(jidOrPhone: string) {
  if (!jidOrPhone) return null;

  const clean = cleanDigitsPhone(jidOrPhone);
  if (!clean) return null;

  const phoneVariants: string[] = [clean];

  // If starts with 55, also try without 55
  if (clean.startsWith("55") && clean.length >= 12) {
    phoneVariants.push(clean.slice(2));
  } else if (!clean.startsWith("55") && (clean.length === 10 || clean.length === 11)) {
    phoneVariants.push("55" + clean);
  }

  // 9th digit variations for Brazilian mobile numbers (e.g. 13999998888 vs 1399998888)
  phoneVariants.forEach((p) => {
    if (p.length === 11 && p.slice(2, 3) === "9") {
      phoneVariants.push(p.slice(0, 2) + p.slice(3)); // 8 digits
    } else if (p.length === 10) {
      phoneVariants.push(p.slice(0, 2) + "9" + p.slice(2)); // 9 digits
    }
    if (p.startsWith("55") && p.length === 13 && p.slice(4, 5) === "9") {
      phoneVariants.push("55" + p.slice(2, 4) + p.slice(5));
    }
  });

  const uniqueVariants = Array.from(new Set(phoneVariants));

  const found = await prisma.imoviewContactContext.findFirst({
    where: {
      OR: [
        { phone: { in: uniqueVariants } },
        { jid: { in: [jidOrPhone, ...uniqueVariants.map(v => `${v}@s.whatsapp.net`)] } },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  return found;
}
