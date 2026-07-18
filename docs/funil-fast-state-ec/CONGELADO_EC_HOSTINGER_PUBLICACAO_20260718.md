# Congelado — EC Hostinger e ec.maxlien.shop

Data: 2026-07-18

## Escopo aprovado

Camada EC do fluxo de retirada Dropi e do painel WhatsApp, incluindo o commit anterior `9d9e10be567b64a498a9a46eb229c73836b2cef0`.

Não houve alteração de Colômbia, domínio CO, VSL CO, dados de CO, Pixel, banco, Dropi ou WhatsApp de outro país.

## Estado publicado

- Hostinger oficial EC: release ativo sob `/opt/vitalismen-automacao/current`.
- Domínio público: `https://ec.maxlien.shop`.
- Backend: `online`, Z-API conectada e WhatsApp pronto.
- PM2: `vitalismen-automation` deve executar o `src/index.js` do release ativo.

## Validações

- `/`, `/n/`, `/painel/` e `/api/health/` retornaram HTTP 200.
- A VSL mantém o comportamento aprovado: desktop mostra a página informativa; a lógica da VSL preserva o conteúdo e CTA para visitante móvel.
- CTA: mensagens EC em JSON válido em espanhol; preflight do endpoint `/api/whatsapp/vsl-entry` aceito sem criar lead.
- Painel EC abre com Z-API conectada, campo de mensagem, atalho Ctrl/Cmd+B e fluxo de edição de mensagem enviada presentes.
- A camada de retirada mantém consulta Dropi para pedidos pendentes sem guia, deduplicação e intervalo mínimo de 30 minutos.
- O teste operacional do pedido final `2862` ficou registrado no banco como retirada pronta e com entregas Z-API confirmadas.
- A guarda de teste público `2800` permanece limitada ao número autorizado e exige os três indicadores de teste; não é porta local nem número da instância Z-API.

## Git e recuperação

- O worktree do release estava limpo antes do congelamento.
- Backup do release é obrigatório antes de uma nova troca de release.
- O repositório Git no VPS não possui `origin`; o cliente GitHub `gh` não está instalado. Nenhum remoto foi adivinhado ou alterado. A sincronização GitHub depende de informar/configurar o repositório remoto oficial.

## Regra final

Para retirada em agência, a automação consulta o estado Dropi antes de decidir e só avisa o cliente quando houver status de retirada e guia válidos. Avisos previamente enviados são reconhecidos para evitar duplicidade; reenvio forçado requer ação explícita do operador.
