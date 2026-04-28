# Go-Live Checklist

Checklist vivo para colocar o painel no ar com seguranca e operacao redonda.

## 1. Base e deploy

- [x] Repositório principal definido: `GitViltaliesmen/vitalismen-maxlien-painel`
- [x] Projeto Cloudflare Pages definido
- [x] Dominio final definido: `painel.maxlien.shop`
- [x] Dominio publicado com `HTTP 200`
- [x] SSL valido no dominio final
- [x] Titulo novo publicado: `Painel Maxlien | Operacao interna`
- [x] Protecao basica ativa: `noindex`, `nosniff`, `referrer-policy`, `permissions-policy`
- [x] Fluxo Git por SSH configurado nesta maquina
- [ ] Confirmar no Cloudflare que o projeto publicado esta conectado diretamente ao repo certo
- [ ] Remover qualquer fluxo de deploy paralelo que possa causar confusao futura

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

- [ ] Definir quem usa o painel no dia a dia
- [ ] Definir rotina de backup dos `.json` exportados
- [ ] Definir regra de uso para cada status
- [ ] Definir frequencia de revisao dos agendados
- [ ] Criar rotina simples de inicio e fim do dia

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

Fechar a etapa `2. Validacao funcional`, porque a base e o deploy ja estao praticamente resolvidos.
