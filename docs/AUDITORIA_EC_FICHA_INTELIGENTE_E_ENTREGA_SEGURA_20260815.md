# Auditoria da ficha inteligente EC e entrega segura — 2026-08-15

## Resultado desta camada

Esta mudança é limitada ao painel manual do Equador. Ela não altera textos, gatilhos, ordem, memória ou transições do funil automático congelado.

- Reaproveita, sem alteração funcional, os módulos validados da extensão oficial para normalização de dados, extração de conversa e catálogo de agências.
- Extrai dados somente de mensagens recebidas do cliente; mensagens do vendedor e do bot são ignoradas.
- Aceita nome somente quando o candidato contém de 2 a 7 palavras Unicode e não contém telefone, produto, agência, cidade, endereço, quantidade ou outros rótulos de ficha.
- Nunca substitui um dado confiável já preenchido. A automação completa apenas campos vazios ou o nome que ainda era o próprio telefone.
- Usa o catálogo oficial Servientrega para padronizar cidade e inferir província apenas quando a localização é única.
- Pesquisa agência também pelo ponto de referência. A agência só é aplicada automaticamente quando a correspondência é única; ambiguidades ficam como sugestões para escolha humana.
- Preserva a referência quando uma agência é escolhida.
- Para Tex Ultra, preenche valores somente a partir da tabela aprovada: 1 = 35.99, 2 = 70.00, 3 = 80.99 e 6 = 147.99 USD.
- Remove a interface e as chamadas legadas de Colômbia. Não foi criado um falso “rastreamento EC”: a rota estrangeira não tem equivalente EC. O fluxo existente `/api/shipments/manual-guide` e o painel normal de pedidos EC continuam sendo as fontes reais.

## Controles automáticos adicionados

O comando local obrigatório desta camada é:

```powershell
npm run test:customer-form
node scripts/audit-ec-tex-ultra-isolation.mjs
git diff --check
```

O workflow `.github/workflows/ec-panel-quality.yml` executa os mesmos guardas em `pull_request`, em branches `codex/**`, em `main` e manualmente, tanto no Node 20 usado pela VPS quanto no Node 22 atual de desenvolvimento. As actions externas estão fixadas por SHA completo e o token do workflow tem apenas `contents: read`.

## Estado do GitHub encontrado em 2026-08-15

Repositório: `GitViltaliesmen/vitalismen-maxlien-painel`.

- branch padrão: `main`;
- rulesets: nenhum;
- ambientes de deployment: nenhum;
- workflows ativos: nenhum;
- permissão padrão do `GITHUB_TOKEN`: leitura;
- visibilidade: pública.

O quality gate deste branch só se torna uma regra institucional depois de entrar na branch padrão e ser marcado como status check obrigatório. Enquanto isso não acontecer, ele é um teste pronto, mas ainda não bloqueia pushes ou publicações de terceiros.

## Fluxo recomendado para todo trabalho aprovado

1. Cada tarefa nasce em branch/worktree isolado e parte do último baseline oficial conhecido.
2. O agente investiga e cria um ponto de recuperação antes de editar.
3. Testes locais específicos passam; o diff completo e o status são revisados.
4. O agente cria um commit único e intencional e envia a branch ao GitHub.
5. Um pull request registra escopo, arquivos, testes, riscos e rollback.
6. O ruleset de `main` exige pull request, um revisor e os checks `Customer form, Ecuador-only and Tex Ultra` de Node 20 e Node 22 verdes.
7. Depois do merge, um job separado usa o ambiente GitHub `production`, que exige aprovação humana.
8. O job de produção cria release imutável na VPS, troca o symlink `current`, reinicia apenas o processo PM2 autorizado, verifica saúde local e conteúdo público e reverte automaticamente em caso de falha.
9. O deploy registra SHA do commit, release anterior, release nova, hashes dos arquivos críticos, horário e resultado das verificações.

Não se recomenda “auto-commit” direto em `main`: isso elimina a fronteira de aprovação e mistura mudanças. O ganho de velocidade vem de o agente preparar branch, testes, commit e PR; o humano decide somente a promoção para produção.

## Configuração externa ainda necessária

Estas mudanças não devem ser aplicadas automaticamente sem uma autorização específica porque alteram a governança do repositório e o acesso à VPS.

### GitHub

- Incluir o workflow de qualidade na branch padrão.
- Criar ruleset de `main` exigindo pull request, conversa resolvida, branch atualizada e status checks obrigatórios.
- Criar o ambiente `production` com revisor obrigatório, restrição à branch padrão e secrets disponíveis somente nesse ambiente.
- Restringir actions permitidas e exigir SHA completo para actions externas.
- Manter `permissions: contents: read` por padrão; dar permissão adicional somente ao job que realmente precisar.

### VPS

- Criar uma conta de deploy sem acesso administrativo geral.
- Autorizar essa conta somente a executar um script de release auditado, sem shell root amplo.
- Manter credenciais, sessão WhatsApp e dados persistentes fora das releases.
- Preservar o padrão atual de releases imutáveis, symlink `current`, PM2 e rollback.
- Usar `known_hosts` fixado; nunca desativar a verificação da chave SSH.

Não foi criado um workflow de deploy nesta camada porque ainda não existe, no repositório, um script genérico e auditado para o release híbrido atual. Inventar um comando remoto ou entregar a uma Action uma chave root reduziria a confiabilidade. O próximo passo correto é consolidar uma branch oficial comum e versionar primeiro esse script de release no próprio projeto.

## Uso de Codex para auditoria

O Codex pode preparar mudanças e revisar pull requests com instruções persistentes em `AGENTS.md`. A ação `openai/codex-action@v1` pode ser adicionada depois como revisão complementar, com sandbox somente leitura e segredo restrito. Ela não substitui testes determinísticos nem aprovação do ambiente de produção.

As automações agendadas do Codex são adequadas para auditorias recorrentes, como verificar divergência Git/VPS, guardas quebrados e ausência de backup. Elas não devem publicar silenciosamente; o resultado deve abrir uma tarefa ou PR para revisão.

## Conversão, tempo e qualidade da ficha

As decisões desta camada seguem princípios de formulários com menos redigitação, um único campo de nome, validação durante a entrada, feedback claro e teste com dados reais. Fontes consultadas:

- [web.dev — Payment and address form best practices](https://web.dev/articles/payment-and-address-form-best-practices)
- [web.dev — Address forms](https://web.dev/learn/forms/address)
- [GOV.UK Design System — Names](https://design-system.service.gov.uk/patterns/names/)
- [Baymard — Checkout usability research](https://baymard.com/research/checkout-usability)
- [Baymard — Fully automatic address lookup](https://baymard.com/blog/automatic-address-lookup)

Como este é um painel interno que alterna entre clientes, `autocomplete="off"` continua intencional: o autofill do navegador poderia inserir dados de outra pessoa. A redução de digitação é feita por dados da conversa e pelo catálogo oficial, vinculados ao cliente selecionado.

Para medir ganho real sem armazenar PII em analytics, registrar apenas eventos e durações agregadas:

- nome detectado e aceito/rejeitado;
- província inferida;
- agência aplicada automaticamente ou ambígua;
- correção manual após sugestão;
- tempo entre primeira mensagem e ficha completa;
- falha de salvamento;
- rejeição de rota no Dropi;
- confirmação e envio do pedido.

Os indicadores recomendados são taxa de correção manual, taxa de ambiguidade, tempo para completar ficha, pedidos rejeitados por endereço/agência e conversão por produto/quantidade. Nenhuma melhoria deve ser declarada como aumento de conversão sem comparação antes/depois e volume suficiente.

## Rollback desta camada

O ponto de recuperação local é a tag `backup-before-smart-customer-form-20260815`, no commit `033e9e9e21f023979cd26e955ea801c965958e58`.

Para rollback em código, reverta somente o commit desta camada. Para rollback em produção, quando ela for publicada, o symlink deverá voltar para a release imediatamente anterior e o PM2 deverá ser reiniciado com verificação de saúde. Dados e histórico de clientes não são apagados.
