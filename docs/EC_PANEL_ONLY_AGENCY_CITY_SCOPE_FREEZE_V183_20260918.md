# V183 — escopo de agência por cidade exclusivo do painel

Data: 2026-09-18
Base imutável V179: `1c0e1457e0feedf8cd08e76a1593c9018a7ac3a1`
V181 test-only integrada: `2e4d1bd95e5fbd3ebf0109eaacb0eeefbd243ea3`

## Objetivo congelado

O painel operacional pode solicitar o filtro estrito de cidade por meio do
parâmetro autenticado `strictCity=1`. A rota traduz exclusivamente esse valor
para `strictCityScope: true` no serviço compartilhado.

Sem o opt-in explícito, `findServientregaEcuadorAgencies` conserva exatamente
a semântica da V179. O valor padrão de `strictCityScope` é `false` e a simples
presença de `city` nunca ativa o modo estrito.

## Escopo funcional

- `public/qr.html`: envia `strictCity=1` e não executa fallback nacional quando
  a cidade está preenchida;
- `src/routes/shipments.js`: converte somente `strictCity=1` em opt-in;
- `src/services/servientregaEcuadorAgencyService.js`: aplica hard-scope somente
  quando `strictCityScope === true`.

Nenhum callsite do bot recebe a opção nova. `conversationEngine.js` e
`observerAttentiveReaderService.js` permanecem byte a byte iguais à V179.

## Contrato do painel

- `Huaquillas + El Oro`: duas agências de Huaquillas;
- `Huaquillas + Principal`: somente `Huaquillas Principal`;
- `Huaquillas + Arenillas`: lista vazia;
- cidade sem província: somente a cidade;
- província sem cidade: comportamento amplo da V179;
- cidade desconhecida: lista vazia.

## Preservado

VSL, Protocolo-G, Pixel, CAPI, bridge, funil, roteamento, outbound, Dropi,
Meta, Z-API, áudios, pós-venda, produtos, preços e banco permanecem
inalterados. A V181 continua test-only e exige clique manual único para aplicar
uma agência sugerida.

## Publicação

Esta camada é candidata local. Não há autorização para push, tag, stage,
deploy, alteração de `/current`, reinício, escrita em banco ou mudança de
produção.
