# Plano de Implantacao Segura

## Nao interferir no funil atual

O funil novo so roda se:

```text
VIT_POWER_FAST_FUNNEL_ENABLED=true
cliente novo ou sem pedido ativo
mensagem tem intencao clara de compra/quantidade
nao esta em atendimento humano
nao tem Dropi enviado
nao esta em pos-venda/guia/retirada
```

Se qualquer condicao falhar, cai no funil atual.

## Modos

```text
VIT_POWER_FAST_FUNNEL_MODE=off
VIT_POWER_FAST_FUNNEL_MODE=dry_run
VIT_POWER_FAST_FUNNEL_MODE=pilot
VIT_POWER_FAST_FUNNEL_MODE=active
```

## Fases

1. Documentacao e mapa de estados.
2. Testar audios/imagens existentes.
3. Criar memoria em `ContactState.metadata.fastFunnel`.
4. Criar roteador de intencao/estado em dry-run.
5. Auditar decisoes em conversas reais sem enviar.
6. Liberar piloto para numeros permitidos.
7. Criar 5 versoes por audio aprovado.
8. Adicionar imagens novas aprovadas.
9. Comparar conversao e erros.
10. Publicar por etapa.

## Arquivos provaveis

```text
src/services/vitPowerFastFunnel/memory.js
src/services/vitPowerFastFunnel/stateMachine.js
src/services/vitPowerFastFunnel/replyPolicy.js
src/services/vitPowerFastFunnel/agencyChoice.js
src/services/vitPowerFastFunnel/addressFormatter.js
src/services/vitPowerFastFunnel/mediaPlan.js
```

## Gates

Antes de ativar:

- `node scripts/senior-guard.mjs`
- `node scripts/official-state-audit.mjs`
- teste dry-run com 20 conversas;
- nenhum reenvio Dropi;
- nenhum texto acima de 180 caracteres;
- nenhum dado ja salvo perguntado de novo;
- nenhuma repeticao de audio na mesma etapa;
- fallback limpo para funil atual.

## Observador

A pagina `painel-observacao.html` da VPS mostrou uma arquitetura util:

- laboratorio do observador;
- funil ideal;
- roteiro mestre;
- cerebro estrategico;
- receitas de venda;
- gates de publicacao segura.

Nao usar como motor direto agora. Aproveitar a arquitetura para auditoria e dry-run.
