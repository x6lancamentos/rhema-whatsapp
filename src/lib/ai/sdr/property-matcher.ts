import { logger } from "@/lib/logger";
import { fetchRecentStockProperties, parseCurrencyNumber, RadarProperty } from "@/lib/imoview-broker-radar";

/**
 * Retorna a URL oficial e padronizada do imóvel no portal da Rhema Imóveis
 */
export function formatPropertyDetailsUrl(codigo: string | number): string {
  const codeStr = String(codigo || "").trim();
  return `https://www.rhemaimoveis.com.br/imovel/detalhes/${encodeURIComponent(codeStr)}`;
}

export interface SdrPropertyOption {
  codigo: string;
  titulo: string;
  bairro: string;
  tipo: string;
  valorFormatado: string;
  valorNumerico: number;
  quartos: number;
  vagas: number;
  areaPrivativa?: number;
  linkRhema: string;
  motivoAderencia: string;
  score: number;
}

/**
 * Busca até 3 opções de imóveis alternativos do acervo ativo da Rhema que sejam
 * ESTRITAMENTE aderentes ao perfil do cliente (score >= 70).
 */
export async function findMatchingAlternativeProperties(params: {
  imovelOrigemCodigo?: string;
  bairro?: string;
  tipoImovel?: string;
  valorNumerico?: number;
  quartosMin?: number;
  exigeElevador?: boolean;
  limite?: number;
}): Promise<SdrPropertyOption[]> {
  const {
    imovelOrigemCodigo,
    bairro = "Santos",
    tipoImovel = "Apartamento",
    valorNumerico = 0,
    quartosMin = 2,
    exigeElevador = false,
    limite = 3,
  } = params;

  try {
    const stock = await fetchRecentStockProperties({ limite: 50, forceRefresh: false });
    if (!stock || stock.length === 0) {
      logger.warn("PropertyMatcher", "Acervo de imóveis vazio ou inacessível no momento.");
      return [];
    }

    const scoredOptions: SdrPropertyOption[] = [];

    const norm = (s: string) =>
      (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const targetBairro = norm(bairro);
    const targetTipo = norm(tipoImovel);

    for (const p of stock) {
      // 1. Exclui o próprio imóvel de interesse original
      if (imovelOrigemCodigo && String(p.codigo) === String(imovelOrigemCodigo)) {
        continue;
      }

      // 2. Veto de escada caso o cliente exija elevador
      if (exigeElevador && p.hasEscada) {
        continue;
      }

      let score = 50;
      const reasons: string[] = [];

      // Bairro
      const pBairro = norm(p.bairro);
      if (pBairro && targetBairro) {
        if (pBairro === targetBairro || pBairro.includes(targetBairro) || targetBairro.includes(pBairro)) {
          score += 25;
          reasons.push(`Mesmo bairro (${p.bairro})`);
        } else {
          // Bairros core vizinhos na orla de Santos
          const coreSantos = ["embare", "aparecida", "gonzaga", "boqueirao", "ponta da praia"];
          if (coreSantos.includes(pBairro) && coreSantos.includes(targetBairro)) {
            score += 15;
            reasons.push(`Bairro vizinho na orla (${p.bairro})`);
          }
        }
      }

      // Tipo de Imóvel
      const pTipo = norm(p.tipo);
      if (pTipo && targetTipo) {
        if (pTipo === targetTipo || pTipo.includes(targetTipo) || targetTipo.includes(pTipo)) {
          score += 15;
          reasons.push(p.tipo);
        }
      }

      // Quartos
      if (p.quartos && quartosMin) {
        if (p.quartos >= quartosMin) {
          score += 10;
          reasons.push(`${p.quartos} dorms`);
        } else {
          score -= 20; // Penaliza menos quartos que o mínimo
        }
      }

      // Faixa de valor (+/- 25%)
      if (valorNumerico > 0 && p.valorNumerico > 0) {
        const diffRatio = Math.abs(p.valorNumerico - valorNumerico) / valorNumerico;
        if (diffRatio <= 0.15) {
          score += 15;
          reasons.push("Faixa de valor perfeita");
        } else if (diffRatio <= 0.25) {
          score += 5;
          reasons.push("Valor compatível");
        } else if (diffRatio > 0.35) {
          score -= 30; // Fora do orçamento
        }
      }

      // Só aceita opções com pontuação mínima de aderência (>= 70)
      if (score >= 70) {
        scoredOptions.push({
          codigo: String(p.codigo),
          titulo: p.titulo || `${p.tipo} no ${p.bairro}`,
          bairro: p.bairro,
          tipo: p.tipo,
          valorFormatado: p.valor || "Consulte",
          valorNumerico: p.valorNumerico || 0,
          quartos: p.quartos || 0,
          vagas: p.vagas || 0,
          linkRhema: formatPropertyDetailsUrl(p.codigo),
          motivoAderencia: reasons.join(" · "),
          score,
        });
      }
    }

    // Ordena pelo maior score e limita a no máximo 3 opções
    scoredOptions.sort((a, b) => b.score - a.score);
    const finalSelection = scoredOptions.slice(0, Math.min(limite, 3));

    logger.info("PropertyMatcher", `Encontradas ${finalSelection.length} opções alternativas com aderência >= 70.`);
    return finalSelection;
  } catch (err: any) {
    logger.error("PropertyMatcher", "Erro ao buscar alternativas:", err);
    return [];
  }
}
