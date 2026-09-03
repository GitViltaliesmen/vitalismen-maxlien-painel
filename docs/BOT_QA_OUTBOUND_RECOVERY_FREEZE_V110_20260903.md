# Freeze V110 — recuperação do outbound real no QA oficial

Data: 2026-09-03
Escopo: entrada Z-API e sessão temporária do telefone QA `5515998038637`
Pai: V109 (`7243cf43d7418843195f62757274e27ea4b285d8`)

## Causa comprovada

O webhook público recebeu e persistiu uma entrada nova do QA, mas não a enviou
ao roteador. A ficha já continha `vslProductKey=tex_ultra_ec` de uma sessão
antiga; como o contexto VSL completo estava vencido, o código recusava detectar
novamente a assinatura oficial e produzia `publicVslLeadEntry=false`. Para o
telefone brasileiro de teste, isso torna `routeToBot=false` mesmo depois do
reset humano V78 correto.

O mesmo controle V78 consumia o permit depois da primeira entrada. Essa regra é
segura para um canário único, mas impossibilita a prova multi-turn exigida para
quantidade, preço, logística e confirmação.

## Correção mínima

- um contexto VSL vencido pode ser renovado pela assinatura oficial nova;
- contexto ainda vigente continua soberano e não é refeito;
- a escolha manual do produto do pedido continua preservada pelo
  `vslProductAssignmentPolicy` existente;
- a primeira entrada QA continua exigindo a assinatura estruturada oficial;
- depois dela, a mesma autorização root-only pode aceitar no máximo mais sete
  entradas do telefone QA, totalizando oito IDs únicos;
- a janela continua limitada pelo `expiresAt` do permit V78, dura no máximo dez
  minutos e processa uma mensagem por vez;
- cada ID finalizado é persistido no ledger da sessão e não pode ser reutilizado;
- contenção restaura o `human.mode` anterior e arquiva o permit.
- o guard sucessor V101 reconhece a rota Z-API alterada somente quando ela está
  declarada por um sucessor já validado e ainda contém o contrato V110; hashes
  históricos continuam imutáveis.

## Preservado

Clientes Ecuador não recebem bypass novo. Dashboard, ficha, edição manual,
cidade/província, pedido novo, recompra, pedido 3469, Dropi manual/BFF,
anti-duplicidade Dropi, Meta/CAPI, Nginx, número oficial, textos, preços, mídias,
pós-venda e schedulers não são alterados.

## Publicação e rollback

A V110 precisa seguir stage, guards, publicação V70, permit de ativação e troca
atômica de `current`. Antes do canário, o reset V78 deve ser autorizado e
aplicado somente ao QA. Em falha, conter o reset QA e reativar a release V109;
nenhum dado comercial precisa ser restaurado.
