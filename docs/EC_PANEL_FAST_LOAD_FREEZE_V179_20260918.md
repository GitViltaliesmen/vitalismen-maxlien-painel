# V179 — carregamento rápido do painel operacional

Data: 2026-09-18
Base imutável: V178 `6590b17b2abf10b7f371400f893cfb58920f383d`
Release observada: `20260918T023837Z_production-20260918-6590b17`

## Escopo autorizado

Melhorar somente o carregamento da lista operacional do painel Vitalismen,
preservando integralmente a ficha detalhada do cliente e a gravação dos nove
status congelada na V178.

## Auditoria somente leitura em produção

Medição feita no endpoint local oficial, sem autenticação externa e sem escrita:

- `GET /api/whatsapp/chats?country=EC&fast=1`;
- tempo observado: `13.006249s`;
- resposta observada: `1.922.627 bytes`;
- conversas retornadas: `219`;
- `customerDraft`: `1.246.544 bytes`;
- `customerDraft.dataResolution`: `948.988 bytes`;
- intervalo de atualização do painel: `3.500ms`.

Também foi medido que 350 projeções detalhadas reais do `ContactState` de
produção consumiam `5.729ms` somente na reconstrução da resolução da ficha.
Essa reconstrução era repetida para toda a lista, embora o perfil detalhado já
tenha uma rota própria executada quando o operador seleciona o cliente.

## Causa comprovada

1. A lista `fast=1` chamava `projectPanelCustomerReadModel` com resolução
   detalhada para cada conversa.
2. O navegador disparava novo `loadChats()` a cada 3,5 segundos mesmo quando a
   consulta anterior continuava ativa.
3. `loadChats()` transformava essa nova chamada em fila e iniciava outra carga
   250ms depois da conclusão, mantendo o painel quase continuamente ocupado.

## Correção congelada

- `projectPanelCustomerReadModel` mantém resolução detalhada por padrão.
- Somente a lista `fast=1` usa `includeCustomerDataResolution: false`.
- A rota `customer-profile/:phone` continua usando o comportamento detalhado.
- O polling periódico não chama `loadChats()` enquanto
  `state.chatsLoading === true`.
- O intervalo de 3,5 segundos e a atualização em tempo real permanecem
  preservados quando não existe consulta ativa.

## Evidência sintética determinística

Benchmark com as mesmas 219 conversas da medição de produção:

- projeção detalhada: `1.153.578 bytes`;
- projeção rápida: `211.881 bytes`;
- redução de payload: `81,6%`;
- redução de tempo medida na execução: `94,6%`;
- ficha detalhada preservada: `PASS`;
- dados operacionais essenciais preservados: `PASS`.

Tempos de benchmark são evidência comparativa do mesmo processo e podem variar
entre máquinas; a trava automática exige a redução estrutural de payload, não
um limite absoluto de milissegundos.

## Preservado

- V178 e os nove status;
- cliente selecionado e fila de autosave;
- V177, V176 e V175;
- VSL e persistência de entrada;
- bot, funil, produtos, preços e áudios;
- Dropi, Meta, Pixel, CAPI e Purchase;
- Z-API, Baileys, MongoDB e Nginx;
- rotas de mutação e efeitos externos.

Nenhuma mensagem, pedido, Dropi ou evento Meta foi gerado pela auditoria. Esta
camada permanece candidata local congelada; produção só pode mudar após nova
autorização explícita e passagem integral pelo pipeline oficial.
