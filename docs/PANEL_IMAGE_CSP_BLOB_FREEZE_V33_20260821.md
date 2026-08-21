# Freeze V33 — imagem autenticada no painel

Data: 2026-08-21

País: EC

Base: `14ad0a797c10a7133235b75509c00eb6b57777ee`

Pai: `official-whatsapp-phone-test-v32-20260821`

## Evidência e causa

- O telefone QA enviou três imagens novas pela Z-API.
- As três mensagens terminaram em `READY` e os JPEGs foram validados no storage compartilhado.
- O endpoint autenticado entregou os arquivos com MIME correto e suporte a `Range`.
- O painel criou URLs locais `blob:`, mas os elementos `<img>` ficaram com largura natural zero.
- A resposta pública possuía `media-src 'self' data: blob: https:`, porém `img-src 'self' data: https:`.
- O navegador bloqueou as imagens por Content Security Policy; áudio continuou funcionando porque sua diretiva já aceitava `blob:`.

## Contrato aprovado

1. `img-src` passa a aceitar exatamente `'self'`, `data:`, `blob:` e `https:`.
2. `media-src` permanece inalterado.
3. O painel continua baixando o endpoint protegido com Bearer e aplicando a URL `blob:` sem token na URL.
4. Nenhuma rota de mídia fica pública.
5. `default-src`, `object-src`, `script-src` e as demais diretivas Helmet permanecem preservadas.
6. Nenhum arquivo histórico, cliente, pedido ou mídia persistida é removido.

## Autorização

O operador solicitou expressamente o ajuste para que as imagens recebidas apareçam no painel em 2026-08-21. A publicação é limitada a esta correção visual e não autoriza disparos de WhatsApp ou mudanças comerciais.

## Rollback

Retornar à release V32 `/opt/vitalismen-automacao/releases/20260821T222100Z_production-20260821-4dbb541`. Preservar `/opt/vitalismen-automacao/shared/media/inbound`.
