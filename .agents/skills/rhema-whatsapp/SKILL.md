---
name: rhema-whatsapp
description: >-
  Especialista em automação de WhatsApp para a Rhema Imóveis. Gerencia disparos individuais
  e coletivos para corretores, diretoria e grupos (Time Rhema, Avisos Rhema, Diretoria),
  aplicando regras de negócio como segmentação por CRECI, Spintax obrigatório, proteção
  anti-spam (delays randômicos entre 15s e 75s) e gestão de membros de grupos.
---

# Rhema WhatsApp — Skill de Automação & Disparos

Esta Skill capacita o assistente a gerenciar o sistema de WhatsApp da **Rhema Imóveis**, automatizando disparos de comunicados, alinhamentos, gestão de grupos e regras de negócio da imobiliária.

---

## 🏛️ 1. Infraestrutura e Sessão Ativa

* **Instância Padrão**: `WA Business` (`avg78n`)
* **Proprietário da Sessão**: Brunno Anastácio (`5513955437609`)
* **Banco de Dados**: MariaDB (`wa_gateway_db` na porta `3306`)
* **Credenciais**: Salvas na tabela `AuthState` do Prisma via `usePrismaAuthState("avg78n")`.

---

## 👥 2. Catálogo Oficial da Equipe e Regras de Negócio

Consulte o arquivo [`references/team.json`](./references/team.json) para a lista sempre atualizada.

### 🛡️ Regra Fundamental da Casa (CRECI):
> **ATENÇÃO CRÍTICA:** Corretores **SEM CRECI** (`hasCreci: false`) **NUNCA** devem receber mensagens com dados diretos do proprietário (como liberação de telefone).  
> Qualquer comunicado sobre liberação de dados confidenciais deve ser bifurcado:
> * **Com CRECI**: Recebem o comunicado completo.
> * **Sem CRECI**: Recebem apenas as regras gerais de atendimento/cadastro, sem menção a contatos de proprietários.

### Corretores Mapeados:
| Corretor | Telefone | Tem CRECI? |
| :--- | :--- | :---: |
| **Flávia** | `5515974042000` | Sim |
| **Tatiana** | `5513981854677` | Sim |
| **Elaine** | `5513976008877` | Sim |
| **Ulisses** | `5513988181515` | Sim |
| **Leniara** | `5513996461664` | Sim |
| **André** | `5513981404451` | **Não** |
| **Karla Gomes** | `5513997744475` | **Não** |
| **Andressa** | `5513981512755` | **Não** |

### Grupos Oficiais:
* **`🚀 Time Rhema`**: `120363427965736363@g.us` (Grupo geral de corretores e operações)
* **`Avisos Rhema`**: `120363417825887441@g.us` (Comunicados oficiais da diretoria)
* **`🎯🚀 Diretoria RHEMA`**: `120363426753225157@g.us` (Alinhamentos entre sócios e gerência)

### Diretoria e Administrativo:
* **Ana Maria Lisboa** *(Dona / Sócia)*: `5513991673717`
* **Miguel Lisboa** *(Dono / Sócio)*: `5513991368031`
* **Nice Saloes** *(Gerente Administrativa)*: `5513997787173`
* **Rhema ADM** *(Central)*: `5513991488850`
* **Camila** *(Recepção Rhema)*: `5513991588225`
* **Kaylane** *(Aux. Administrativa)*: `5513992123879`

---

## 🛡️ 3. Boas Práticas e Segurança Anti-Spam (Obrigatório)

Em todos os disparos individuais ou em massa:
1. **Spintax Obrigatório**: Variar saudações e frases usando sintaxe `{Olá|Oi|Fala}, {nome}! {Tudo bem?|Como você tá?}`.
2. **Intervalo Randômico**: Aguardar entre **15 e 75 segundos** entre cada mensagem enviada para números privados.
3. **Persistência no Banco**: Gravar cada mensagem na tabela `prisma.message` do banco com `status: "SENT"` para histórico no painel web.
4. **Validação de JID**: Usar `socket.onWhatsApp(phone)` antes de enviar para garantir o JID exato no servidor da Meta.

---

## 🛠️ 4. Gestão de Grupos

* **Adicionar Membros**: Usar `socket.groupParticipantsUpdate(groupJid, [targetJid], 'add')`.
* **Boas-Vindas com Menção Geral**: Obter `socket.groupMetadata(groupJid)` e passar todos os `p.id` em `mentions` no payload para notificar a equipe inteira.
* **Moderação**:
  * Fechar grupo para apenas admins falarem: `socket.groupSettingUpdate(groupJid, 'announcement')`.
  * Reabrir grupo para todos: `socket.groupSettingUpdate(groupJid, 'not_announcement')`.

---

## 💻 5. Scripts Utilitários Disponíveis

* [`scripts/broadcast.ts`](./scripts/broadcast.ts): Utilitário programático para disparos em massa.
* [`scripts/group-manage.ts`](./scripts/group-manage.ts): Funções de adição de membros, anúncios e controle de permissões.
