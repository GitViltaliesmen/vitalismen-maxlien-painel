# Freeze V26 — intencao forte e pergunta soberana Tex Ultra

Data: 2026-08-18

Estado: candidato local validado e autorizado para publicacao controlada; ainda nao ativado.

## Evidencia do teste

No telefone de QA `5515998038637`, a entrada inicial recebeu a cadencia da release antiga entre 10:32 e 10:34. As novas mensagens `Hola, quiero el tratamiento.` chegaram as 11:11 e 11:12, mas nao exibiram resposta no painel.

A ausencia do emoji confirma que a V25 ainda nao estava ativa. O `current` permanecia em `20260818T042423Z_production-20260818-bb2d92f`, pois o staging root da V25 nao havia sido liberado.

## Causa funcional

O roteador geral ja classificava `quiero` como intencao de compra, mas `src/services/texUltraFunnelService.js` reconhecia somente preco, uso, quantidade isolada e confirmacoes curtas. A frase observada nao era reconhecida como compra forte e caia no fallback generico. Esse fallback tambem podia ser bloqueado pelos guards persistentes de antirrepeticao de um telefone de teste nao zerado.

## Decisao V26

- `Hola, quiero el tratamiento.` e variantes inequivocas passam a ser intencao `purchase`;
- durante a cadencia, essa intencao cancela as midias restantes e pergunta imediatamente a quantidade;
- depois da oferta, pergunta imediatamente `1, 2, 3 ou 6` sem repetir audio, prova, frasco ou tabela;
- `Quiero 3 frascos` e frases equivalentes capturam a quantidade contextual;
- perguntas livres seguem ao atendimento humano mesmo quando a cadencia ja terminou;
- a entrada inicial `Hola, quiero informacion de Tex Ultra` continua iniciando a cadencia normal;
- o fallback corrige `com` para `con` e inclui o pacote oficial de 2 frascos.

## Preservado

- frase, emojis e minutagem V25;
- produtos, precos e midias oficiais;
- memoria, locks e antirrepeticao;
- isolamento Nitrix/Vit Power;
- pedidos, Dropi, Meta/CAPI, pixel, Z-API e numero WhatsApp;
- PM2, `current`, banco oficial e producao.

## Validacao sem envio

- `tests/tex-ultra-strong-intent-v26.test.mjs`;
- `tests/tex-ultra-entry-interrupt-v25.test.mjs`;
- `npm run senior:check`;
- guards EC e anti-spam.

Nenhum teste desta implementacao envia mensagem real.

## Publicacao

Em 2026-08-18T14:38:20Z, o operador autorizou expressamente o deploy controlado da V26 para teste exclusivo no telefone `5515998038637`. A autorizacao libera commit, PR, tag, staging e ativacao pelo helper transacional; nao permite contornar sudoers, permit root de uso unico, guards, rollback ou validacoes de health.

## Rollback

Descartar somente o diff V26 e retornar ao commit de producao Git `e268e61f6d18c4057bb3b01e4e30c0df0c3ae725`. A producao ativa continua na release anterior enquanto nao houver staging e ativacao transacional.
