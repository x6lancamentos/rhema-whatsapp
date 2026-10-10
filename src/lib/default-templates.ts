export interface DefaultTemplate {
  name: string;
  category: "Prospecção" | "Recuperação" | "Boas-Vindas" | "Agendamento" | "Proprietários" | "Pós-Venda" | "Geral";
  content: string;
}

export const REAL_ESTATE_DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: "Follow-up de Leads Parados (Resgate)",
    category: "Recuperação",
    content: `{Olá|Oi} {{primeiro_nome}}, tudo bem? Aqui é da Rhema Imóveis.

Vi aqui no sistema que você estava buscando {{tipo_imovel}} na região {de {{bairro}}|da cidade}.

Ainda está à procura de opções ou já encontrou o imóvel ideal?`,
  },
  {
    name: "Boas-Vindas a Novo Lead",
    category: "Boas-Vindas",
    content: `Olá {{primeiro_nome}}, seja muito bem-vindo(a) à Rhema Imóveis! 🏡

Recebemos seu interesse no imóvel cód. {{codigo_imovel}} ({{tipo_imovel}} em {{bairro}}).

Meu nome é {{corretor}} e estou à sua disposição. Gostaria de receber mais fotos e informações ou prefere agendar uma visita presencial?`,
  },
  {
    name: "Apresentação de Imóvel Selecionado",
    category: "Prospecção",
    content: `{Olá|Oi} {{primeiro_nome}}, tudo bem? Separei uma excelente oportunidade que se encaixa no perfil que você procura:

✨ *{{tipo_imovel}} no {{bairro}}*
💰 *Valor:* {{valor}}
🛏 *Quartos:* {{quartos}} | 🚗 *Vagas:* {{vagas}}
🔖 *Código de Referência:* {{codigo_imovel}}

Gostaria de ver o book de fotos completo ou o vídeo do imóvel?`,
  },
  {
    name: "Convite para Agendamento de Visita",
    category: "Agendamento",
    content: `Olá {{primeiro_nome}}! O que acha de darmos o próximo passo e conhecer de perto o {{tipo_imovel}} em {{bairro}}?

Tenho horários disponíveis nesta semana. Qual dia e período (manhã ou tarde) fica mais confortável para você?`,
  },
  {
    name: "Lembrete de Visita Agendada",
    category: "Agendamento",
    content: `Olá {{primeiro_nome}}, tudo bem? Passando para confirmar nossa visita agendada ao imóvel cód. {{codigo_imovel}} em {{bairro}}.

📍 Nosso corretor {{corretor}} estará no local pontualmente para te acompanhar.
Caso precise de algum ajuste de horário ou rota, é só nos responder por aqui!`,
  },
  {
    name: "Confirmação de Disponibilidade & Valor (Proprietário)",
    category: "Proprietários",
    content: `{Olá|Oi} {{nome_proprietario}}, tudo bem? Aqui é da Rhema Imóveis a respeito do seu imóvel cód. {{codigo_imovel}} ({{tipo_imovel}} em {{bairro}}).

Estamos atualizando nossa base ativa para direcionar novos compradores e locatários qualificados.

Gostaria de confirmar se o imóvel continua disponível para negociação e se os valores permanecem atualizados:
💰 *Valor:* {{valor}}
🏢 *Condomínio:* {{condominio}}
📄 *IPTU:* {{iptu}}

Podemos confirmar estas informações?`,
  },
  {
    name: "Atualização Cadastral & Taxas (Condomínio e IPTU)",
    category: "Proprietários",
    content: `{Olá|Oi} {{nome_proprietario}}, tudo bem? Aqui é da Rhema Imóveis.

Estamos revisando o cadastro do seu imóvel cód. {{codigo_imovel}} ({{tipo_imovel}} no {{bairro}}).

Para mantermos as informações 100% corretas para apresentação a clientes e propostas, você poderia nos confirmar os valores atuais de:
🏢 *Condomínio:* {{condominio}}
📄 *IPTU:* {{iptu}}
💰 *Valor pedido:* {{valor}}

Houve alguma alteração recente nestes valores?`,
  },
  {
    name: "Aviso de Proposta / Imóvel Vendido (Proprietário)",
    category: "Proprietários",
    content: `Prezado(a) {{nome_proprietario}}, tudo bem? Aqui é da equipe de atendimento da Rhema Imóveis.

Gostaríamos de conversar sobre o andamento do seu imóvel cód. {{codigo_imovel}} em {{bairro}}. Tivemos novas movimentações e queremos alinhar os próximos passos com você.

Qual o melhor horário para uma breve ligação hoje?`,
  },
  {
    name: "Captação de Novos Imóveis (Proprietário)",
    category: "Proprietários",
    content: `Olá {{nome_proprietario}}, esperamos que esteja bem!

Como você já é nosso cliente parceiro com o imóvel cód. {{codigo_imovel}}, gostaríamos de saber: você possui algum outro imóvel que gostaria de disponibilizar para venda ou locação com a nossa equipe?

Temos demanda ativa de clientes buscando imóveis na sua região!`,
  },
  {
    name: "Pesquisa de Satisfação & Pós-Venda",
    category: "Pós-Venda",
    content: `Olá {{primeiro_nome}}, como foi sua experiência de atendimento com a Rhema Imóveis?

Sua opinião é fundamental para aprimorarmos nossos serviços. Em uma escala de 1 a 5, qual nota você daria para o nosso atendimento?

Muito obrigado pela confiança!`,
  },
];
