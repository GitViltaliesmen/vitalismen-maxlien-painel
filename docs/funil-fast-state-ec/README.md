# Funil Fast State Vit Power EC

Projeto para criar um funil conversacional curto, humano e com memoria por estado para Vit Power no Ecuador.

## Objetivo

Fechar vendas pelo WhatsApp com menos atrito, sem transformar o atendimento em arvore rigida e sem ignorar o que o cliente perguntou.

O funil deve:

- responder primeiro a pergunta real do cliente;
- guiar para a compra em micro-passos;
- usar textos curtos;
- usar audio quando a explicacao for maior;
- usar memoria permanente para nao perguntar o que o cliente ja informou;
- evitar repeticao de texto, audio e perguntas;
- entrar primeiro em dry-run/piloto, sem interferir no funil atual.

## Nome do projeto

`Funil Fast State Vit Power EC`

## Regra de isolamento

Este projeto nao substitui o funil atual ate passar por:

1. dry-run;
2. auditoria de conversas;
3. piloto com numeros permitidos;
4. validacao de conversao/erro;
5. aprovacao manual para ativar.

Memoria separada prevista:

```text
ContactState.metadata.fastFunnel
```

## Arquivos

- `ESTADOS_E_TRANSICOES.md`: mapa dos estados e caminhos do funil.
- `REGRAS_CONVERSA.md`: regras de texto curto, humanizacao e nao repeticao.
- `MAPA_AUDIO_IMAGEM.md`: lista de audios/imagens existentes e novos nomes sugeridos.
- `AGENCIA_DOMICILIO.md`: como tratar Servientrega, cidade/provincia e endereco baguncado.
- `PLANO_IMPLANTACAO.md`: implantacao sem quebrar o funil ativo.
- `BACKLOG.md`: proximas tarefas.
