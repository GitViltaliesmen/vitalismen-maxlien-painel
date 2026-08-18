# Freeze V27 — payload multilinha da VSL Tex Ultra

Data: 2026-08-18

Estado: candidato local validado; publicacao e deploy nao autorizados.

## Evidencia visual

A VSL oficial envia uma unica mensagem WhatsApp no formato:

```text
Hola, quiero el tratamiento.
Nombre: Luis Zapata
CIUDAD: Salcedo
PROVINCIA: Cotopaxi
```

A VSL nao sera alterada neste ciclo. O backend deve aceitar esse contrato existente.

## Decisao V27

- a primeira linha oficial continua iniciando a cadencia Tex Ultra aprovada;
- `Nombre`, `CIUDAD` e `PROVINCIA` sao extraidos somente quando aparecem em linhas rotuladas depois da CTA oficial;
- os valores sao gravados no `customerDraft` antes do inicio da cadencia, permitindo que a saudacao use o nome;
- dados ja existentes ou corrigidos manualmente nunca sao sobrescritos pelo payload;
- depois que o cliente escolhe `1`, `2`, `3` ou `6` frascos, o funil aproveita nome, cidade e provincia e pede diretamente entrega/endereco;
- campos diferentes dos tres autorizados sao ignorados por esta microcamada;
- payload sem a CTA oficial na primeira linha nao recebe esse tratamento automatico.

## Preservado

- frase, rodizio de emojis e minutagem total de 90–112 segundos;
- interrupcao imediata da cadencia quando o cliente responde;
- intencao forte, quantidade contextual e entrega humana da V26;
- produtos, precos, audios, imagens e prova social;
- isolamento Tex Ultra/Nitrix/Vit Power;
- pedidos, Dropi, Meta/CAPI, pixel, Z-API e numero WhatsApp;
- locks, antirrepeticao, scheduler, PM2, `current`, banco oficial e producao.

## Validacao sem envio

- `tests/tex-ultra-vsl-payload-v27.test.mjs` cobre exatamente o payload observado;
- regressao V26 e atribuicao generica da VSL permanecem cobertas;
- nenhum teste envia mensagem, cria pedido, abre Dropi ou dispara Meta/CAPI.

## Publicacao

A autorizacao de deploy da V26 nao e reutilizada porque a V27 altera o artefato que seria publicado. Commit remoto, PR, tag, staging, reset do telefone e ativacao exigem nova autorizacao explicita para a V27.

## Rollback

Descartar somente o diff V27 e retornar ao commit Git `23a395e9a4eec72450cee0608ba4bb32606fa53e`. A producao ativa permanece na release `20260818T042423Z_production-20260818-bb2d92f` enquanto nao houver nova autorizacao e ativacao transacional.
