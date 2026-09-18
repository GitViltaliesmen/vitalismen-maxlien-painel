# V181 — alinhamento sucessor do teste browser V51

Data: 2026-09-18
Base imutável: V179 `1c0e1457e0feedf8cd08e76a1593c9018a7ac3a1`
Candidato V180 preservado e não integrado: `2bb439145d1eb80a2b44e99788d4129c2a35c0ef`

## Escopo autorizado

Esta camada altera somente a expectativa obsoleta de
`scripts/test-panel-customer-selection-browser-v51.mjs` e cria os registros e
guards V181 necessários para suceder formalmente o hash ancestral V51.

Produção, painel funcional, backend e integrações permanecem inalterados. Não
há autorização para publicar, fazer push, criar tag, preparar release, trocar
`/current` ou reiniciar serviço.

## Falha reproduzida no baseline V179

O teste V51 antigo esperava que a agência `Guayaquil Los Almendros` fosse
aplicada automaticamente assim que a sugestão aparecesse. No V179 puro, o
campo permaneceu vazio e a asserção falhou com valor atual `''` e esperado
`'guayaquil los almendros'`.

O mesmo resultado já havia sido observado sem o candidato V180. Portanto:

- causa: `STALE_V51_BROWSER_EXPECTATION_CONFLICTS_WITH_V146_SUCCESSOR_CONTRACT`;
- `V180_CAUSED_V51_FAILURE=NO`.

## Contrato sucessor validado

- a resposta atrasada da busca de Mira não pode contaminar o cliente novo de
  Guayaquil;
- nenhum PATCH do cliente novo pode conter cidade, província ou agência de
  Mira;
- `Guayaquil Los Almendros` aparece apenas como sugestão destacada;
- antes do clique, o campo de agência continua vazio e a sugestão não gera
  autosave de agência;
- o clique explícito aplica agência, cidade, província e modalidade, gerando
  exatamente um autosave legítimo;
- clicar novamente na mesma agência não gera novo autosave e
  `agencySuggestionChangesForm` retorna `false`;
- seleção ativa e ausência de erros de página continuam protegidas.

## Preservado

Não foram alterados `public/qr.html`, o helper V51, inteligência da ficha,
serviço Servientrega, rotas, modelos, VSL, bot, funil, status, produtos, preços,
Dropi, Meta, Pixel, CAPI, Purchase, Z-API, áudios, pós-venda, MongoDB ou Nginx.

A V146 permanece autoridade: o melhor resultado é somente sugestão visual e
nunca pode ser aplicado sem clique do operador.
