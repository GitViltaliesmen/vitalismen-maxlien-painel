# Trava candidata V16 — Contexto atual do cliente

Data: 2026-08-16.

Status: candidato de implementação local bloqueado por hash; ainda não aprovado para publicação ou produção.

## Escopo protegido

- serviço agregador somente leitura;
- rota autenticada `GET /api/customer-context/:phone`;
- contrato JSON assistivo com `applicationAllowed: false`;
- testes de prioridade, ambiguidade, histórico e ausência de efeitos colaterais;
- registro mínimo da rota no servidor;
- camada visual assistiva e somente leitura no painel oficial;
- oito blocos visuais: identidade, localização, produto atual, origem/VSL, pedido atual, histórico, funil e conflitos;
- estados seguros de carregamento, ausência de dados, ambiguidade, erro e incompatibilidade de contrato;
- proteção contra resposta atrasada sobrescrever o cliente selecionado mais recentemente.

## Herança

Esta trava sucede tecnicamente `customer-data-intelligence-v15-20260815` apenas nos arquivos de composição `package.json`, `src/index.js` e `public/qr.html`. Todos os demais hashes e contratos do V15 e de seus ancestrais continuam obrigatórios.

A Fatia 2 é aditiva. O serviço, a rota, o contrato autenticado e as provas de zero efeitos colaterais da Fatia 1 permanecem congelados pelos mesmos hashes. A interface consome exclusivamente `GET /api/customer-context/:phone` por meio da autenticação já existente no painel.

## Proibições permanentes desta fatia

- nenhuma escrita no banco;
- nenhuma mudança de schema;
- nenhum envio WhatsApp ou Z-API;
- nenhuma chamada Dropi;
- nenhum evento Meta/CAPI;
- nenhuma chamada OpenAI;
- nenhum scheduler, autosave, OCR automático ou avanço de funil;
- nenhuma edição, botão, autosave ou aplicação automática a partir do contexto assistivo;
- nenhuma alteração na extensão;
- nenhuma exposição de payload bruto, credencial, token ou identificador técnico de fonte;
- nenhuma resposta obsoleta de um cliente anterior sobre o cliente atualmente selecionado;
- nenhum deploy ou publicação automática.

O status `implementation_candidate_locked` não significa aprovação funcional nem autorização de deploy. Uma promoção futura exige validação, commit, preservação remota e autorização explícita em tarefas separadas.
