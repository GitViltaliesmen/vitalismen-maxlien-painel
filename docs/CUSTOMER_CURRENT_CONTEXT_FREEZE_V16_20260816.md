# Trava candidata V16 — Contexto atual do cliente

Data: 2026-08-16.

Status: candidato de implementação local bloqueado por hash; ainda não aprovado para publicação ou produção.

## Escopo protegido

- serviço agregador somente leitura;
- rota autenticada `GET /api/customer-context/:phone`;
- contrato JSON assistivo com `applicationAllowed: false`;
- testes de prioridade, ambiguidade, histórico e ausência de efeitos colaterais;
- registro mínimo da rota no servidor.

## Herança

Esta trava sucede tecnicamente `customer-data-intelligence-v15-20260815` apenas nos arquivos de composição `package.json` e `src/index.js`. Todos os demais hashes e contratos do V15 e de seus ancestrais continuam obrigatórios.

## Proibições permanentes desta fatia

- nenhuma escrita no banco;
- nenhuma mudança de schema;
- nenhum envio WhatsApp ou Z-API;
- nenhuma chamada Dropi;
- nenhum evento Meta/CAPI;
- nenhuma chamada OpenAI;
- nenhum scheduler, autosave, OCR automático ou avanço de funil;
- nenhuma interface, botão ou alteração na extensão;
- nenhum deploy ou publicação automática.

O status `implementation_candidate_locked` não significa aprovação funcional nem autorização de deploy. Uma promoção futura exige validação, commit, preservação remota e autorização explícita em tarefas separadas.
