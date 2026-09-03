# V89 — Isolamento do control plane PM2

## Causa comprovada

O bundle operacional V78 exporta o `NODE_OPTIONS` canônico antes do restart.
O cliente `/usr/bin/pm2` também é um processo Node e, por isso, carregava o
guard V78 no diretório de controle `/root`. O V79 falhava fechado antes de o
restart chegar ao processo Vitalismen. PID, runtime e health permaneciam no
perfil seguro, e o permit V78 não era consumido.

## Correção mínima

O control plane V89 inicia um processo Node sem `NODE_OPTIONS`, valida o pacote
PM2 6.x e só então injeta o `NODE_OPTIONS` V78 no ambiente enviado por RPC ao
processo `vitalismen-automation`. Depois do restart, o shell controlador remove
`NODE_OPTIONS` antes de consultar health, registrar auditoria ou conter falha.

Uma autorização que falhou antes do restart pode ser arquivada somente quando
o health confirma `SAFE_OBSERVATION_ONLY/STRICT_READ_ONLY`, zero scheduler e
Dropi APPLY bloqueado. Essa ação não chama PM2.

## Preservado

- runtime e guards V88/V78 permanecem obrigatórios no processo-alvo;
- retries de health continuam em 30 tentativas de 2 segundos;
- schedulers mutantes permanecem em zero;
- Dropi permanece sem APPLY e Meta Purchase permanece bloqueado;
- nenhum produto, preço, CTA, áudio, mídia, funil ou regra de pedido mudou;
- tráfego de clientes reais permanece não autorizado.

## Rollback

Até validação completa, o rollback operacional é a V88 publicada em
`SAFE_OBSERVATION_ONLY/STRICT_READ_ONLY`.
