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

- [ ] Criar um lead novo
- [ ] Editar um lead existente
- [ ] Remover um lead
- [ ] Trocar entre Colombia, Equador e Todos
- [ ] Validar busca por nome, telefone e cidade
- [ ] Validar filtro por status
- [ ] Validar status `agendado` com data desejada
- [ ] Validar exportacao de leads em `.json`
- [ ] Validar `restaurar demo`
- [ ] Validar persistencia apos recarregar a pagina

## 3. Precos e oferta

- [ ] Colombia: `1 = 149.000`
- [ ] Colombia: `2 = 260.000`
- [ ] Colombia: `3 = 290.000`
- [ ] Colombia: `6 = 510.000`
- [ ] Equador: `1 = 39.99`
- [ ] Equador: `2 = 69.99`
- [ ] Equador: `3 = 95.99`
- [ ] Equador: `6 = 167.99`
- [ ] Produto muda automaticamente conforme pais + quantidade

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
