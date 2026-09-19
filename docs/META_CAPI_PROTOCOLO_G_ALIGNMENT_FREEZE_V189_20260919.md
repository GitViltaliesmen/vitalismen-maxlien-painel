# V189 — Alinhamento Meta CAPI do Protocolo-G

Estado congelado em 2026-09-19 para a rota exclusiva do Protocolo-G Tex Ultra Ecuador.

## Destino canônico

- Dataset CAPI: `920532663934291`
- Browser Pixel: `920532663934291`
- origem: `https://vilaliemen.shop/protocolo-g`
- token: somente `META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G`
- fallback para `META_ACCESS_TOKEN_EC`: proibido

## Escopo de roteamento

A rota dedicada somente é selecionada quando país, produto, funil e URL de origem satisfazem simultaneamente o contrato oficial do Protocolo-G. A camada Sales V148 não pode sobrepor esse destino específico. Tráfego EC fora desse contrato mantém o destino geral anterior.

## Preservado

VSL, motor do bot, painel `qr.html`, métricas V185–V187, pós-venda V188, Dropi e Z-API permanecem byte a byte preservados pelos hashes do manifesto V189. Nenhuma fila foi limpa, nenhum histórico foi reprocessado e nenhum evento Purchase real foi usado como teste.

## Operação

O código de Test Event `TEST61236` foi apenas evidência externa fornecida pelo operador. Ele não é persistido no projeto nem no ambiente de produção. A falta do token específico bloqueia a rota dedicada; nunca ocorre fallback para a credencial geral.
