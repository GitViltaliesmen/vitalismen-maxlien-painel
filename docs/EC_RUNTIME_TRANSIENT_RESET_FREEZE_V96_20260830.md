# Congelamento V96 — reset transitório do PM2 EC

## Objetivo único

Limpar a identidade operacional V78 somente no ambiente transitório do restart
PM2 seguro, preservando byte a byte o overlay staged congelado do helper oficial.

## Implementação

- o conteúdo de `safe_profile_content` permanece ancestral e imutável;
- `safe_pm2` força o flag operacional para `false` e esvazia versão/hash V78;
- a verificação PM2 exige esses valores antes do health;
- o controlador operacional V78 continua sendo a única via para religar o bot;
- nenhuma release ou helper do sistema é editado em produção.

## Preservado

VSL móvel, página informativa, Pixel/Dataset, CTA, banco, Z-API, mensagens,
funil, Dropi, schedulers, preços e infraestrutura de outro país não foram alterados. Hashes externos:

- desktop: `ddf1a65ff3696a10ce7105523397592a85566cb837447210eecb100d3953cf27`;
- celular: `59b1d47e1c9d7613d1fc30884ce7df78080f9544c730e9435079a0aa39bdfe7b`.
