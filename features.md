# 📋 Roadmap & Central de Funcionalidades — Rhema WhatsApp Auto

Documento oficial de consolidação e priorização de ideias, melhorias e novas funcionalidades do sistema.

---

## 🧭 Visão Geral do Sistema

O **Rhema WhatsApp Auto** é uma plataforma de automação, mensageria e atendimento via WhatsApp integrada ao CRM Imoview, desenvolvida sob medida para a operação de vendas e captação imobiliária da Rhema Imóveis.

---

## 📌 Categorias de Funcionalidades

```
├── 1. Integração CRM Imoview & Gestão de Imóveis
├── 2. Disparador em Massa (Broadcast) & Campanhas
├── 3. Modo Agente IA & Auto-Reply Inteligente
├── 4. Central de Chat & Atendimento ao Cliente
├── 5. Modelos de Mensagens (Templates) & Cadências
├── 6. Agendamento & Automação de Tarefas
└── 7. Internacionalização (PT-BR) & Interface (UI/UX)
```

---

## 1. 🏢 Integração CRM Imoview & Gestão de Imóveis

- [x] **Resgate de Leads Parados**: Filtro avançado por período sem interação (predefinições > 7d, 15d, 30d, 60d, 90d, 180d, dias personalizados mínimo/máximo e intervalo de datas por calendário), corretor responsável e situação; puxa atendimentos ativos diretamente da API do Imoview.
- [x] **Variáveis do Imóvel no Lead**: Extração inteligente de dados do imóvel associado (`{{codigo_imovel}}`, `{{tipo_imovel}}`, `{{bairro}}`, `{{cidade}}`, `{{valor}}`, `{{quartos}}`, `{{vagas}}`).
- [x] **Módulo de Contato com Proprietários (Captação & Atualização)**:
  - Puxar via Imoview a base real de proprietários de imóveis ativos (`/dashboard/imoview`) com nomes e WhatsApps reais dos donos.
  - Filtro por finalidade fiel (Venda e Locação com tags coloridas distintas).
  - Filtro para imóveis/proprietários sem atualização há mais de 30, 60 ou 90 dias, além de intervalos customizados e datas específicas.
  - **Suporte a Imóveis Próprios da Rhema (Patrimônio da Casa)**: Seleção dedicada de imóveis próprios da Rhema sem sobrescrever indevidamente os donos reais dos imóveis regulares.
  - **Variáveis de Condomínio e IPTU**: Extração de valores e nomes (`{{condominio}}`, `{{valor_condominio}}`, `{{iptu}}`, `{{valor_iptu}}`, `{{nome_condominio}}`) disponíveis como variáveis dinâmicas e chips de inserção rápida no disparador em massa.
  - Disparo em massa para confirmação de disponibilidade, preço e dados do imóvel.
  - Template de "Imóvel Vendido" para proprietários (notificação de fechamento e solicitação de novas captações).
- [ ] **Automação de Status no Imoview**:
  - Atualização automática da fase/situação do atendimento quando o cliente responder a uma campanha ou confirmar interesse.
- [x] **Registro de Histórico de Interações**: Gravação do disparo no histórico do atendimento via `App_IncluirInteracao`.

---

## 2. 📢 Disparador em Massa (Broadcast) & Campanhas

- [x] **Visualização e Edição Rápida da Lista**: Modal para conferir, editar números/nomes e excluir destinatários antes de disparar.
- [x] **Gestão de Listas Salvas**: Edição inline de listas salvas com sincronização no banco de dados.
- [x] **Distribuição de Carga Multi-Sessão (Multi-Chip / Round-Robin)**:
  - Selecionar múltiplas contas conectadas no momento do disparo.
  - Distribuição automática e equilibrada da fila entre as sessões para reduzir drasticamente o risco de bloqueio pelo WhatsApp.
- [x] **Auditoria & Histórico Completo de Broadcasts**:
  - Tabela `BroadcastLog` no banco com registro de data, hora, lista, sessão utilizada, template e status por lead (Enviado, Falha, Respondeu).
  - Dashboard de métricas de conversão e entrega das campanhas.
- [x] **Pausa e Retomada de Campanhas**: Botão para pausar um disparo em andamento e retomar posteriormente.

---

## 3. 🤖 Modo Agente IA & Auto-Reply Inteligente

- [ ] **Agente Virtual Pré-Programado (Qualificação 24/7)**:
  - Agente conversacional que atende leads de campanhas ou novos contatos instantaneamente.
  - Identificação de preferências: localização desejada, faixa de valor, forma de pagamento (financiamento / FGTS / à vista) e urgência de compra.
- [ ] **Transbordo Inteligente para o Corretor (Handoff)**:
  - Quando o lead pede para falar com uma pessoa ou solicita agendamento de visita, o agente:
    1. Marca o chat com etiqueta `Lead Quente` / `Visita Solicitada`.
    2. Notifica o corretor responsável via WhatsApp ou push.
    3. Pausa a IA naquele chat para permitir intervenção humana.
- [ ] **Auto-Reply Fora do Expediente**:
  - Resposta configurável por horário de funcionamento (noites e fins de semana), coletando os primeiros dados do cliente sem deixá-lo no vácuo.
- [ ] **Respostas por Palavras-Chave**:
  - Gatilhos automáticos baseados no conteúdo da mensagem (ex: "aluguel", "comprar", "financiamento", "tabela").

---

## 4. 💬 Central de Chat & Atendimento ao Cliente

- [x] **Correção na Quebra de Texto das Mensagens**:
  - Substituição de `break-all` por `break-words [overflow-wrap:anywhere]` para evitar palavras do português cortadas ao meio.
- [x] **Player de Áudio Moderno (Voz / PTT WhatsApp)**:
  - Suporte completo a áudios gravados no WhatsApp (formato Opus/OGG).
  - Controle de velocidade de reprodução (`1x`, `1.5x`, `2x`) e barra de progresso com waveform interativo.
- [x] **Renderização de Mensagens Especiais**:
  - **Localização**: Card com link direto para o Google Maps e preview das coordenadas.
  - **Contatos (vCard)**: Card com nome, telefone brasileiro formatado, botão para iniciar conversa direta e copiar telefone.
  - **Reações**: Exibição sutil de emojis de reação vinculados ao balão da mensagem.
- [x] **Ticks Visuais de Entrega e Leitura**:
  - Indicadores de status no balão em tempo real via socket: 1 check cinza (Enviado), 2 checks cinzas (Entregue) e 2 checks azuis (Lido).
- [x] **Formatador de Telefone Brasileiro**:
  - Exibição de telefones no padrão `(XX) 9XXXX-XXXX` nos cabeçalhos, listas de conversas, modal de nova conversa e balões.

---

## 5. 📝 Modelos de Mensagens (Templates) & Cadências

- [x] **Seleção Dinâmica de Templates no Broadcast**: Selecionar modelos salvos e visualizar prévia com substituição de variáveis em tempo real.
- [x] **Biblioteca de Templates por Etapa do Funil**:
  - Biblioteca completa calibrada para a Rhema Imóveis em `/dashboard/templates`.
  - **Prospecção**: Apresentação de imóveis com dados dinâmicos (`{{tipo_imovel}}`, `{{bairro}}`, `{{valor}}`).
  - **Recuperação**: Follow-up de leads parados com perguntas objetivas.
  - **Boas-Vindas**: Recepção imediata de novos leads gerados em portais ou site.
  - **Agendamento**: Convite para visita presencial ao imóvel.
  - **Lembrete de Visita**: Disparo D-1 e H-2 para evitar faltas em visitas.
  - **Proprietários**: Confirmação de disponibilidade, atualização de valor e notificação de imóvel vendido.
  - **Pós-Venda**: Acompanhamento após fechamento de negócio e pedido de indicação.
- [ ] **Régua de Relacionamento Automatizada (Cadências / Drip)**:
  - Envio sequencial pré-programado (ex: D+0, D+2, D+5, D+10).
  - Interrupção automática da cadência assim que o lead responder.

---

## 6. ⏰ Agendamento & Automação de Tarefas

- [x] **Agendador de Mensagens Pontuais e Recorrentes**: Fila de agendamento com suporte a mensagens únicas ou cron.
- [ ] **Automação de Lembretes de Visita**:
  - Integração com a agenda de visitas do Imoview para disparar lembrete automático 2 horas antes da visita agendada.

---

## 7. 🌐 Internacionalização (PT-BR / EN) & Interface (UI/UX)

- [x] **Dark Mode Polido & Design System Premium**: Adaptação visual consistente em todas as telas, cards e componentes com gradientes sutis, glassmorphism e microinterações.
- [x] **Barra de Rolagem Moderna (Sleek Scrollbar)**: Scrollbar fina, estilizada e integrada ao tema escuro.
- [x] **Modo Bilíngue Dinâmico (PT-BR e EN)**:
  - Seletor interativo de idiomas no Header (dropdown e pill toggle com bandeiras `🇧🇷 PT` e `🇺🇸 EN`).
  - `LanguageProvider` com persistência em `localStorage` e padrão em Português do Brasil (`pt-BR`).
  - Tradução em tempo real de navegação lateral, grupos, cabeçalhos, ações rápidas, métricas, sessões e popovers.
- [x] **Padrão Numérico e Monetário do Brasil**:
  - Formatação nativa de moeda (`R$ 1.250.000,00`) e datas por extenso em português.

---

## 8. 🛡️ Níveis de Permissões, Multi-Corretor & Gestão de Equipe (RBAC / DLP)

- [x] **Isolamento Total Multi-Corretor**:
  - Cada corretor conecta seu próprio WhatsApp pessoal/corporativo via QR Code isolado.
  - Nenhum corretor acessa, visualiza ou dispara pelo WhatsApp ou conversas de outro corretor.
  - Administradores visualizam painel de monitoramento de chips online (sem bisbilhotar conversas particulares).
- [x] **Perfil Pré-Vendas / Recepção (Camila)**:
  - Papel dedicado `PRE_VENDAS` para qualificação inicial e primeiro atendimento de leads.
  - Acesso de visualização ampliada dos leads do Imoview para triagem e distribuição aos corretores.
  - Exportação de planilhas bloqueada por padrão para segurança de dados.
- [x] **Matriz Visual de Permissões por Toggles**:
  - Configuração granular de permissões por Nível/Perfil (`ADMIN`, `PRE_VENDAS`, `CORRETOR`, `STAFF`) com switches interativos em tempo real.
  - Possibilidade de overrides individuais por usuário (permissões customizadas para membros específicos).
- [x] **Isolamento de Carteiras no Imoview CRM**:
  - Corretor com permissão restrita enxerga **estritamente seus próprios leads e imóveis sob sua captação**.
  - Dropdowns de corretores travados automaticamente para o corretor logado com badge de segurança.
- [x] **Proteção contra Vazamento de Dados (DLP - Data Loss Prevention)**:
  - Permissão específica `imoview.export_sheets`: controle de quem pode baixar planilhas Excel da base de clientes da imobiliária.
- [x] **Dashboard de Produtividade da Equipe**:
  - Painel executivo para gestores com métricas individuais de cada corretor: status do chip, campanhas disparadas, mensagens enviadas, respostas de leads e taxa percentual de conversão.

---

*Última atualização: Outubro de 2026 — Antigravity Pair Programming*

