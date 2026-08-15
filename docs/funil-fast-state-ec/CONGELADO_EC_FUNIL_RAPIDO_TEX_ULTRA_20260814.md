# Congelamento — funil rapido manual Tex Ultra EC

Data de aprovacao: 14/08/2026 (America/Sao_Paulo)

## Estado aprovado

O painel EC possui no rodape do atendimento um menu `Funil rapido` exclusivo
para clientes classificados como `Tex Ultra Ecuador`.

O menu contem 21 atalhos manuais:

- 4 variacoes curtas para solicitar o nome completo;
- 4 variacoes para solicitar cidade e provincia;
- 4 variacoes sobre envio para agencia Servientrega;
- 1 oferta completa com 1, 2, 3 e 6 frascos;
- 2 confirmacoes para cada quantidade de 1, 2, 3 e 6 frascos.

Precos aprovados:

- 1 frasco: USD 35,99;
- 2 frascos: USD 70,00;
- 3 frascos: USD 80,99;
- 6 frascos: USD 147,99.

## Regras congeladas

- O clique em um atalho apenas preenche a caixa de resposta.
- Nenhum atalho envia mensagem automaticamente.
- O atendente deve revisar o texto e clicar em `Enviar`.
- Os atalhos ficam desabilitados sem cliente selecionado.
- Os atalhos ficam desabilitados para Nitrix, Vit Power e outros produtos.
- Os 21 atalhos ficam habilitados somente para Tex Ultra EC.
- A opcao manual de 2 frascos nao altera nem amplia o funil automatico.
- A fila aprovada `Novas/Lidas` permanece independente e inalterada.

## Evidencias de validacao

- 21 de 21 atalhos encontrados e conferidos.
- 21 de 21 textos comparados integralmente.
- 0 chamadas automaticas ao endpoint de envio.
- 0 erros JavaScript observados no teste funcional.
- isolamento para Tex Ultra EC aprovado;
- bloqueio para Nitrix e sem cliente aprovado;
- teste responsivo aprovado em 1440, 1100, 900, 720 e 680 pixels;
- guard `audit-ec-tex-ultra-isolation.mjs` aprovado;
- `git diff --check` aprovado;
- pagina publica e servico validados depois da publicacao;
- WhatsApp Web e Z-API permaneceram conectados ao numero 5515991418416.

## Codigo aprovado

- Branch: `codex/ec-panel-quick-funnel-20260815`
- Commit funcional: `3aac498b980b656b4a7933338a7794f418392397`
- Arquivo funcional alterado: `public/qr.html`

## Producao aprovada

- Release: `/opt/vitalismen-automacao/releases/20260815T013307Z_ec_tex_ultra_quick_funnel`
- Hash da interface: `e06edb7219616e0c493b265e6c9ed7455f5d928326e84c706daf872015f8d8d9`
- Hash preservado da rota WhatsApp: `9893c02f7c7c092e66d39785e22fa555a671bd3ce441b8193943388dfcff0d26`

## Backup e rollback

- Backup: `/root/codex_deploy_backups/20260815T013307Z_ec_tex_ultra_quick_funnel`
- Release anterior: `/opt/vitalismen-automacao/releases/20260815T010747Z_ec_panel_default_new`

Para rollback, apontar atomicamente `/opt/vitalismen-automacao/current` para a
release anterior e reiniciar `vitalismen-automation` pelo PM2.

## Restricao para mudancas futuras

Qualquer alteracao nos textos, precos, protecao por produto, modo manual,
posicao no rodape ou comportamento de envio exige nova solicitacao, testes de
regressao, publicacao reversivel e nova aprovacao explicita.
