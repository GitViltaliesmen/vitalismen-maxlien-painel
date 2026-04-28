# Go-Live Checklist

Checklist vivo para colocar o painel no ar com seguranca e operacao redonda.

## Status atual

- [x] Painel atualizado, publicado no repositório e aceito em teste visual/funcional inicial.
- [x] Dashboard reorganizado com filtros e acoes na lateral esquerda.
- [x] Funcionalidades principais validadas no navegador local.
- [ ] Validacoes destrutivas opcionais pendentes: remover lead e restaurar demo.
- [x] Pendencias finais agora sao de deploy/operacao/acesso, nao de construcao do painel.

## 1. Base e deploy

- [x] Repositório principal definido: `GitViltaliesmen/vitalismen-maxlien-painel`
- [x] Projeto Cloudflare Pages definido
- [x] Dominio final definido: `painel.maxlien.shop`
- [x] Dominio publicado com `HTTP 200`
- [x] SSL valido no dominio final
- [x] Titulo novo publicado: `Painel Maxlien | Operacao interna`
- [x] Protecao basica ativa: `noindex`, `nosniff`, `referrer-policy`, `permissions-policy`
- [x] Fluxo Git por SSH configurado nesta maquina
- [x] Confirmar deploy publico atualizado apos push no repo certo
- [ ] Remover qualquer fluxo de deploy paralelo que possa causar confusao futura

### Validado em 2026-04-28

- Dominio `https://painel.maxlien.shop/` carregou com `HTTP 200`.
- HTML publico confirmou a versao nova: `styles.css?v=20260428a`.
- Lateral nova com `Menu`, `Filtros` e `Dados` carregou no dominio final.
- Navegador abriu o dominio final sem erros de console.

## 2. Validacao funcional

- [x] Criar um lead novo
- [x] Editar um lead existente
- [ ] Remover um lead
- [x] Trocar entre Colombia, Equador e Todos
- [x] Validar busca por nome, telefone e cidade
- [x] Validar filtro por status
- [x] Validar status `agendado` com data desejada
- [x] Validar exportacao de leads em `.json`
- [ ] Validar `restaurar demo`
- [x] Validar persistencia apos recarregar a pagina

### Validado em 2026-04-28

- Lead de teste criado em `Equador` com quantidade `2` e preco automatico `69.99`.
- Persistencia confirmada apos recarregar a pagina no navegador local.
- Lead editado para `agendado` com data desejada de `2026-04-28`.
- Filtros de pais, status, busca e `agenda de hoje` confirmados no navegador local.
- Copia de nome, telefone normalizado e endereco confirmada via clipboard.
- Exportacao `.json` acionada sem erro no navegador local.
- Remocao de lead e restauracao demo ainda dependem de confirmacao, porque apagam dados locais.

### Sequencia pratica do teste funcional

1. Criar um lead novo em `Equador`
2. Salvar e confirmar que ele aparece no topo da fila
3. Recarregar a pagina e confirmar que o lead continua salvo
4. Editar esse lead e mudar para `agendado`
5. Definir uma data desejada
6. Salvar e confirmar a agenda na tabela
7. Usar o filtro rapido `agenda de hoje` quando a data for hoje
8. Testar `copiar > nome`, `telefone` e `endereco`
9. Testar busca pelo nome do lead
10. Testar filtro por status
11. Exportar leads em `.json`
12. Restaurar demo so depois de validar tudo

## 3. Precos e oferta

- [x] Colombia: `1 = 149.000`
- [x] Colombia: `2 = 260.000`
- [x] Colombia: `3 = 290.000`
- [x] Colombia: `6 = 510.000`
- [x] Equador: `1 = 39.99`
- [x] Equador: `2 = 69.99`
- [x] Equador: `3 = 95.99`
- [x] Equador: `6 = 167.99`
- [x] Produto muda automaticamente conforme pais + quantidade

### Validado em 2026-04-28

- Tabela `PRICE_TABLE` confirmada em `app.js`.
- Produtos automaticos confirmados por `PRODUCT_BASE`: Colombia usa `Vital Core`; Equador usa `Vital Men`.
- Fluxo de troca de pais e quantidade no formulario abriu e alternou sem erro no navegador local.

## 4. Operacao interna

- [x] Definir quem usa o painel no dia a dia
- [x] Definir rotina de backup dos `.json` exportados
- [x] Definir regra de uso para cada status
- [x] Definir frequencia de revisao dos agendados
- [x] Criar rotina simples de inicio e fim do dia

### Definido em 2026-04-28

- Guia operacional criado em `OPERACAO.md`.
- Horario recomendado: `09:00` ate `18:00`.
- Revisao de agendados: `09:00` e `16:30`.
- Backup `.json`: todo fim de expediente.
- Uso recomendado: um operador principal por navegador/dispositivo na versao estatica atual.

## 5. Seguranca e acesso

- [ ] Revogar tokens antigos expostos
- [ ] Revisar acessos ao GitHub
- [ ] Revisar acessos ao Cloudflare
- [ ] Confirmar que apenas a conta correta controla DNS e Pages

## 6. Trafego pago

- [ ] Validar painel no celular
- [ ] Validar painel no desktop
- [ ] Confirmar pagina de campanha e oferta final
- [ ] Confirmar capacidade da equipe para atender o volume inicial
- [ ] Fazer um teste real com volume pequeno antes de escalar

## Proximo passo

Finalizar a operacao ao redor do painel:

1. Confirmar no Cloudflare Pages que `painel.maxlien.shop` esta conectado diretamente ao repo `GitViltaliesmen/vitalismen-maxlien-painel`.
2. Remover deploys paralelos antigos, se existirem.
3. Definir usuario(s), rotina de backup `.json` e regra de uso dos status.
4. Revisar acessos GitHub/Cloudflare e revogar tokens antigos.
5. Fazer teste real com baixo volume antes de escalar trafego pago.
