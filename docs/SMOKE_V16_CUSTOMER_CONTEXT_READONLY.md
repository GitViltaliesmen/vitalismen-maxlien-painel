# Smoke test controlado — V16 Customer Context read-only

Data da execução: 2026-08-16

Branch: `codex/v16-customer-current-context-readonly-20260816`

HEAD auditado: `00040747d755d8be7fdce4d46afa5c3fb6ba31bc`

Rota: `GET /api/customer-context/:phone`

## 1. Resultado executivo

A Fatia 1 passou no smoke local isolado para os treze cenários solicitados e para um cenário adicional de saturação dos limites. Foram feitas 20 amostras por cenário, totalizando 280 respostas HTTP 200 autenticadas. O teste também confirmou HTTP 400 para telefone inválido e HTTP 401 sem autenticação.

O estado das fixtures permaneceu exatamente igual antes e depois das consultas. Não houve inserção, atualização, exclusão, criação de lock, novo pedido nem chamada a Meta, Dropi, WhatsApp/Z-API ou OpenAI. Nenhum banco, serviço ou dado de produção foi acessado.

Classificação do smoke após o fechamento do cache do 401: **APROVADO**.

O risco inicialmente encontrado no 401 foi fechado por um middleware local do router V16, executado antes de `authMiddleware`. Assim, 200, 400, 401 e os erros tratados pela rota recebem `Cache-Control: no-store` sem mudar a política global de login ou o corpo da resposta de autenticação. As medições de desempenho continuam limitadas ao agregador, ao servidor HTTP local e às fixtures em memória; elas não medem latência de rede, plano de execução ou índices de um Mongo real.

## 2. Ambiente seguro utilizado

### 2.1 Seleção do ambiente

A ordem de preferência solicitada foi avaliada assim:

1. **Banco de teste já existente:** não localizado. Não existem `MONGODB_TEST_URI`, `TEST_MONGODB_URI` ou `MONGO_TEST_URI` no ambiente do processo, nem referências equivalentes no projeto.
2. **Snapshot local sanitizado:** não localizado.
3. **Fixture derivada da estrutura real, sem dados sensíveis:** disponível e escolhida.
4. **Base temporária isolada:** não foi necessária. O executável `mongod` também não está disponível localmente.

O smoke usou fixtures sintéticas e sanitizadas com a forma dos modelos `ContactState`, `Message`, `Order`, `Shipment` e `VslVisit`. O catálogo oficial local `src/data/agencia_LISTA.json` foi consultado somente por leitura para o cenário de agência conhecida.

### 2.2 Isolamento aplicado

- servidor Express efêmero em interface e porta locais;
- roteador oficial `src/routes/customerContext.js` montado em `/api/customer-context`;
- handler e serviço oficiais, sem duplicar a lógica da rota;
- middleware `authMiddleware` existente exercitado com JWT efêmero e usuário sanitizado somente leitura;
- `src/index.js` deliberadamente não importado, pois seu boot conecta banco, scheduler e sessões WhatsApp;
- métodos `find()` dos cinco modelos substituídos apenas durante o processo de smoke por leitores de fixture que preservam `select()`, `sort()`, `limit()` e `lean()`;
- todos os métodos de mutação dos modelos transformados em bloqueios que fariam o teste falhar imediatamente;
- `fetch`, HTTPS externo e HTTP fora do servidor local bloqueados e contabilizados;
- nenhum `.env` foi aberto;
- nenhum URI de produção foi usado;
- nenhum acesso ao VPS ou ao GitHub foi realizado durante o smoke.

O harness transitório permaneceu em `.codex-tmp/`, pasta ignorada pelo Git, e foi removido após a coleta dos resultados. Ele não faz parte do worktree entregue.

## 3. Cenários funcionais

| Cenário | Resultado observado | Estado |
|---|---|---|
| Cliente novo | histórico vazio; nenhum pedido atual inventado | OK |
| Cliente com 1 pedido entregue | pedido apenas no histórico; envio entregue e retirado | OK |
| Cliente com pedido não retirado | pedido apenas no histórico; envio devolvido e `pickedUp: false` | OK |
| Cliente com múltiplos pedidos | `AMBIGUO`; conflito `MULTIPLE_ACTIVE_ORDERS`; nenhum pedido escolhido | OK |
| VSL Vit Power + negociação Tex Ultra | VSL `vit_power_ec`; produto atual `tex_ultra_ec`; divergência preservada | OK |
| VSL Tex Ultra + negociação Vit Power | VSL `tex_ultra_ec`; produto atual `vit_power_ec`; divergência preservada | OK |
| Nome confirmado | valor extraído da confirmação do cliente; `CONFIRMADO`; não inferido | OK |
| Nome inferido | nome de perfil; `PROVAVEL`; `inferred: true` | OK |
| Cidade ambígua | valor nulo; `AMBIGUO`; nenhuma escolha silenciosa | OK |
| Agência conhecida | agência e modalidade `AGENCIA` preservadas; endereço obtido do catálogo local | OK |
| Produto desconhecido | valor nulo; `DESCONHECIDO`; nenhum fallback legado | OK |
| Telefone ambíguo | cauda com dois candidatos; `PHONE_MATCH_AMBIGUOUS`; vínculo bloqueado | OK |
| Cliente antigo com nova negociação | pedido entregue permanece histórico; nova negociação Vit Power permanece atual | OK |
| Limites 20/200 | limites aplicados a todas as queries observadas | OK |

Todos os cenários acima foram executados 20 vezes por HTTP usando a rota real montada no servidor isolado.

## 4. Resultados HTTP e autenticação

| Caso | Resultado | `Cache-Control` | `readOnly` | `applicationAllowed` |
|---|---:|---|---:|---:|
| 14 cenários válidos, 280 requisições | 200 em 280/280 | `no-store` em 280/280 | `true` | `false` |
| Telefone inválido | 400 | `no-store` | `true` | `false` |
| Sem autenticação | 401 | `no-store` | não aplicável ao corpo de erro | não aplicável ao corpo de erro |

O caso sem autenticação devolveu somente:

```json
{
  "error": "No token provided"
}
```

A causa original era a ordem de execução: `authMiddleware` encerrava a requisição 401 antes de o handler V16 executar `res.set('Cache-Control', 'no-store')`. O fechamento adicionou `customerContextNoStore` ao router `/api/customer-context` antes da rota autenticada. O middleware apenas define o cabeçalho e chama `next()`; `authMiddleware` permaneceu inalterado.

O teste de regressão comprova que:

- o status continua 401;
- o corpo continua exatamente `{ "error": "No token provided" }`;
- `Cache-Control` agora é `no-store`;
- o handler de leitura não é alcançado;
- a contagem de consultas de cliente permanece zero.

## 5. Desempenho

### 5.1 Critério de classificação

Para este smoke local:

- **OK:** todas as respostas corretas, limites respeitados e p95 até 250 ms;
- **ATENÇÃO:** p95 acima de 250 ms e até 1.000 ms, ou limitação metodológica relevante;
- **BLOQUEANTE:** p95 acima de 1.000 ms, erro HTTP, excesso de limite ou violação do contrato.

Cada linha contém 20 amostras. `Queries dados` não inclui a leitura autenticada do usuário; `Auth` é mostrada separadamente. `Docs dados` conta documentos retornados por query, de modo que o mesmo envio pode ser contabilizado na busca direta por telefone e na busca vinculada por pedido.

| Cenário | Amostras | Total ms | Média ms | p95 ms | Máx. ms | Queries dados | Auth | Docs dados | Docs auth | Maior query ms | Classe |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Cliente novo | 20 | 140,840 | 7,042 | 9,241 | 47,040 | 5 | 1 | 0 | 1 | 1,103 | OK |
| 1 pedido entregue | 20 | 78,871 | 3,944 | 5,521 | 5,792 | 6 | 1 | 3 | 1 | 0,681 | OK |
| Pedido não retirado | 20 | 70,310 | 3,516 | 4,351 | 4,991 | 6 | 1 | 3 | 1 | 0,528 | OK |
| Múltiplos pedidos | 20 | 73,537 | 3,677 | 4,277 | 4,583 | 6 | 1 | 2 | 1 | 0,426 | OK |
| VSL Vit / negociação Tex | 20 | 644,888 | 32,244 | 34,015 | 63,013 | 5 | 1 | 2 | 1 | 0,489 | OK |
| VSL Tex / negociação Vit | 20 | 548,793 | 27,440 | 28,939 | 29,452 | 5 | 1 | 2 | 1 | 0,506 | OK |
| Nome confirmado | 20 | 518,571 | 25,929 | 26,939 | 27,109 | 5 | 1 | 1 | 1 | 0,433 | OK |
| Nome inferido | 20 | 236,149 | 11,807 | 13,439 | 15,569 | 5 | 1 | 1 | 1 | 0,467 | OK |
| Cidade ambígua | 20 | 217,363 | 10,868 | 12,193 | 13,205 | 5 | 1 | 2 | 1 | 0,485 | OK |
| Agência conhecida | 20 | 209,968 | 10,498 | 11,835 | 11,861 | 5 | 1 | 1 | 1 | 0,475 | OK |
| Produto desconhecido | 20 | 266,090 | 13,305 | 14,958 | 15,894 | 5 | 1 | 2 | 1 | 0,500 | OK |
| Telefone ambíguo | 20 | 51,705 | 2,585 | 2,873 | 3,123 | 5 | 1 | 2 | 1 | 0,469 | OK |
| Cliente antigo / nova negociação | 20 | 502,088 | 25,104 | 26,079 | 26,395 | 6 | 1 | 4 | 1 | 0,461 | OK |
| Saturação 20/200 | 20 | 611,503 | 30,575 | 33,245 | 33,250 | 6 | 1 | 300 | 1 | 1,620 | OK |

### 5.2 Limites observados

Todas as queries do agregador usaram projeção, ordenação, limite e `lean()`.

- `ContactState`: limite 20;
- `Message`: limite 200;
- `Order`: limite 20;
- `Shipment` direto: limite 20;
- `Shipment` vinculado aos pedidos: limite 20;
- `VslVisit`: limite 20.

No cenário de saturação, a fixture continha 25 estados, 215 mensagens, 25 pedidos, 25 envios e 25 visitas para o mesmo telefone. O máximo lido por query permaneceu em 20 para estados/pedidos/envios/visitas e em 200 para mensagens. O volume total de 300 documentos de dados nessa chamada corresponde a 20 estados + 200 mensagens + 20 pedidos + 20 envios diretos + 20 envios vinculados + 20 visitas.

Os tempos classificam o processamento local como **OK**, mas não comprovam desempenho de Mongo real. Não foram medidos round-trip de rede, seleção de índice, concorrência, cache do sistema operacional ou volume real das coleções.

## 6. Prova de zero side effects

### 6.1 Contagens antes e depois

| Estrutura | Antes | Depois | Diferença |
|---|---:|---:|---:|
| `ContactState` | 29 | 29 | 0 |
| `Message` | 223 | 223 | 0 |
| `Order` | 30 | 30 | 0 |
| `Shipment` | 28 | 28 | 0 |
| `VslVisit` | 27 | 27 | 0 |

Além das contagens, a serialização integral das fixtures antes e depois foi idêntica. Isso cobre conteúdo, `createdAt`, `updatedAt` e demais timestamps presentes nos documentos.

### 6.2 Operações e integrações

| Verificação | Resultado |
|---|---:|
| Inserts | 0 |
| Updates | 0 |
| Deletes | 0 |
| Tentativas de mutação bloqueadas | 0 |
| Novos pedidos | 0 |
| Campos de lock antes/depois | 0 / 0 |
| Eventos/chamadas Meta | 0 |
| Chamadas Dropi | 0 |
| Mensagens/chamadas WhatsApp ou Z-API | 0 |
| Chamadas OpenAI | 0 |
| Conexões externas tentadas | 0 |

Os métodos `save`, `updateOne`, `updateMany`, `findOneAndUpdate`, `insertOne`, `create`, `deleteOne`, `deleteMany` e `bulkWrite` foram substituídos no processo de smoke por guards que encerrariam o teste em qualquer tentativa. Nenhum guard foi acionado.

## 7. Segurança da resposta

As fixtures continham sentinelas não reais em campos deliberadamente proibidos, inclusive:

- `Message.providerPayload`;
- `Shipment.raw`;
- payload Meta bruto;
- token, cookie, credencial e URI de banco sintéticos.

Mesmo com o leitor de fixture entregando os objetos completos ao serviço, nenhuma sentinela apareceu nas 280 respostas válidas. A validação recursiva da allowlist também não encontrou chaves externas ao contrato público esperado.

Resultado:

| Item proibido | Exposto? |
|---|---:|
| `providerPayload` | não |
| `Shipment.raw` | não |
| tokens | não |
| cookies | não |
| credenciais | não |
| DSN/URI de banco | não |
| payload Meta bruto | não |
| campos fora da allowlist validada | não |

Todas as ocorrências de `applicationAllowed` encontradas recursivamente na resposta tinham valor `false`. O topo da resposta manteve `readOnly: true` em todos os casos válidos e no erro de telefone inválido.

## 8. Regressão

### `npm run senior:check`

Resultado: **APROVADO**.

- runtime guard `customer-current-context-v16-20260816`: aprovado;
- testes: 38/38 aprovados;
- falhas: 0;
- senior guard: aprovado.

### Testes V16 isolados

Comando:

```powershell
node --test tests/customer-current-context.test.mjs tests/customer-current-context-route.test.mjs
```

Resultado: **25/25 aprovados**, 0 falhas.

### Integridade do diff

`git diff --check`: aprovado, sem erros.

## 9. Riscos restantes

1. **Desempenho de Mongo real não medido — ATENÇÃO.** O smoke comprova limites, quantidade de queries, custo do agregador e contrato HTTP, mas não comprova índices nem latência das coleções reais.
2. **Fixture, não snapshot — ATENÇÃO.** A estrutura e os conflitos são realistas e sanitizados, porém não cobrem irregularidades desconhecidas de documentos legados reais.
3. **Boot completo não exercitado — ATENÇÃO controlada.** `src/index.js` não foi iniciado para impedir conexão a banco, schedulers e WhatsApp. O registro da rota no index continua coberto pelo teste automatizado e pelo runtime guard.
4. **Leitura duplicada de Shipment — observação.** Quando há pedido, o serviço executa busca direta por telefone e busca por `orderId`; no pior cenário de fixture isso contribuiu com até 40 documentos lidos, embora o mapa final elimine duplicatas. Não foi otimizado nesta tarefa.

Nenhum risco **BLOQUEANTE** foi encontrado no comportamento somente leitura exercitado.

## 10. Aptidão para receber interface

**Sim, a Fatia 1 está apta para receber uma interface estritamente somente leitura em uma próxima tarefa isolada.** O contrato autenticado, os cenários funcionais, a ambiguidade conservadora, a separação VSL/produto atual, a allowlist e a ausência de efeitos colaterais foram comprovados no ambiente seguro.

Essa conclusão autoriza apenas a evolução local posterior da interface, quando solicitada. Ela não autoriza deploy. Antes de qualquer publicação futura, ainda será necessário validar a rota contra um banco de teste ou snapshot sanitizado com índices representativos. O 401 já está coberto por `Cache-Control: no-store` e por teste de não acesso aos dados do cliente.

Nenhum painel, extensão, banco, VPS, produção, branch protegida ou integração externa foi alterado neste smoke.
