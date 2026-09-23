# Freeze V186 — sucessor canônico das métricas V185

Data: 2026-09-18
Escopo: linhagem de guards e contexto sucessor; nenhuma mudança funcional V185 e nenhuma ativação.

## Causa raiz

O staging da V185 executou o preload canônico até V168B antes de o contexto sucessor V185 estar visível. O V168B encontrou o hash aprovado da página na candidata, mas ainda comparou contra o hash ancestral e abortou corretamente.

## Correção formal

O bootstrap sucessor V144 mantém V184 como primeiro contexto, carrega V186 em seguida e somente depois entra no preload V168B. V186 preserva o descriptor instalado por V184, delega a ele a formação do contexto V170 e acrescenta a autorização V185 sem apagar arquivos ou hashes predecessores.

Como o freeze V184 protege o próprio ponto de integração V144, a única linha sucessora atualizada no manifest V184 é o hash desse bootstrap. A V186 volta a proteger explicitamente tanto o manifest V184 atualizado quanto o bootstrap final. Nenhum hash funcional V184, V185 ou V168B foi alterado.

A interseção calculada entre os 12 arquivos do delta V184→V185 e os `protectedFiles` dos 181 manifests ancestrais encontrados em 248 arquivos JSON contém exatamente:

- `public/funnel-metrics.html`
- `src/routes/funnelMetrics.js`

O serviço novo `src/services/creativeSalesMetricsV185Service.js` também permanece explicitamente autorizado como arquivo funcional congelado da V185. Não há wildcard.

## Preservado

- Todos os dez arquivos protegidos pelo freeze V185, incluindo os três funcionais, permanecem byte a byte.
- VSL, Bot, painel `public/qr.html`, Protocolo-G, Pixel, CAPI, Dropi, Z-API, Baileys, MongoDB e Nginx não foram alterados.
- V168B, seus hashes e asserts, o runtime guard V71 e seu manifest não foram alterados.
- Produção V184 permanece sem ativação e sem restart.

Qualquer ativação da V186 exige autorização explícita posterior.
