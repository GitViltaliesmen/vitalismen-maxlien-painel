# Trava sucessora V16 — GET de conversas somente leitura

Data: 2026-08-16.

Status: candidato de implementação local bloqueado por hash; não publicado e não autorizado para produção.

## Objetivo

Esta trava sucede `customer-current-context-v16-20260816` exclusivamente para consolidar o hardening autorizado de `GET /api/whatsapp/chats`.

O endpoint mantém o contrato JSON existente, mas os caminhos fast e enriched passam a derivar o contexto do produto sem persistir em `ContactState`. O caminho enriched também pode consultar a foto do perfil sem gravar o cache durante o GET.

## Supersessões controladas

Arquivos de composição protegidos diretamente pelo V16 e substituídos por esta trava:

- `package.json`, somente para conectar o guard sucessor aos gates e incluir o teste regressivo;
- `src/index.js`, somente para tornar o runtime guard sucessor o único guard de topo.

Supersessão ancestral exclusiva:

- freeze: `customer-data-intelligence-v15-20260815`;
- arquivo: `src/routes/whatsapp.js`;
- motivo: hardening autorizado para impedir persistência em `GET /api/whatsapp/chats`.

Nenhum manifest ou guard V15/V16 é alterado. Todos os demais hashes herdados continuam obrigatórios.

## Contratos protegidos

- fast e enriched são somente leitura;
- o cálculo do contexto do produto permanece preservado;
- persistência do contexto continua disponível apenas por opção explícita fora do GET;
- obtenção de foto permanece disponível, sem persistência de cache no GET;
- resposta JSON existente permanece preservada;
- `markRead`, `markSelectedChatRead`, `POST /api/whatsapp/chats/read` e `metadata.panelLastReadAt` permanecem intactos;
- nenhuma escrita de banco é permitida pelo GET;
- nenhuma chamada externa nova é adicionada;
- nenhuma funcionalidade da Fatia 1 ou da Fatia 2 é alterada;
- produção, VPS, main, staging e production permanecem inalterados.

## Proibições

- não transformar a exceção ancestral em lista genérica ou permissiva;
- não ignorar qualquer outro arquivo protegido por V15 ou V16;
- não importar os runtimes V16 antigo e sucessor em sequência;
- não remover a capacidade de persistência de fluxos explicitamente mutantes;
- não alterar o fluxo de leitura operacional de conversas;
- não alterar banco, schema, WhatsApp/Z-API, Dropi, Meta, funil ou pedidos;
- não interpretar `implementation_candidate_locked` como autorização de deploy.

## Evidência obrigatória

- `tests/whatsapp-chats-readonly.test.mjs` cobre fast, enriched, contrato de resposta, métodos de escrita e timestamps;
- `scripts/guard-whatsapp-chats-readonly-v16.mjs` revalida a semântica V16, os dois callers read-only e o fluxo `markRead` preservado;
- `src/services/whatsappChatsReadonlyFreezeRuntimeGuardV16.js` revalida V12 a V16 e esta trava sucessora.

## Rollback local

Antes de qualquer publicação, o rollback completo desta camada é retornar ao commit pai `d73ad239d14a445e3bebf98b8c4e89a608cbb8db`. Esta documentação não autoriza commit, push, deploy ou alteração de ambiente.
