# Matriz de compatibilidade de dados e runtime — pós-venda V66

Esta matriz é normativa. `UNSAFE` e `NOT_SUPPORTED` significam `ROLLBACK_BLOCKED`.

| Dados gravados por | Baseline `cc85952` | Runtime V65 `1a3b9a5` | Runtime V66 / safety bridge |
| --- | --- | --- | --- |
| baseline | SAFE | SAFE | SAFE |
| V65 | UNSAFE — ignora suppression e pode replayar | SAFE enquanto ativo, mas startup apply continua inseguro para nova ativação | SAFE — lê suppression e materializa ledger/markers |
| V66 (`dataCompatibilityVersion=66`) | NOT_SUPPORTED | NOT_SUPPORTED | SAFE |

## Classes

- `SAFE`: runtime compreende o contrato persistido e suas travas de startup.
- `UNSAFE`: existe caminho demonstrado de replay/mutação apesar de o processo poder tecnicamente iniciar.
- `NOT_SUPPORTED`: a versão persistente mínima é superior à versão do runtime; inicialização operacional deve ser tecnicamente bloqueada.

## Versão persistente

Coleção: `operational_safety_states`
Documento: `_id=post-sale-safety-v66`

Campos normativos:

```text
dataCompatibilityVersion=66
minRuntimeVersion=66
writerRuntimeVersion=66
bridgeComplete=true
```

Ausência desse documento não autoriza automação V66: significa somente que a API pode iniciar em `SAFE_OBSERVATION_ONLY`. Ele é criado apenas pelo bridge explicitamente autorizado.

## Política de target

Antes de ativar ou fazer rollback:

1. identificar a versão numérica do runtime target;
2. ler o documento persistente sem alterá-lo;
3. executar `scripts/assert-post-sale-data-compatibility-v66.mjs --runtime=<versão>`;
4. se `runtime < minRuntimeVersion`, retornar `ROLLBACK_BLOCKED` e não tocar em symlink/PM2;
5. nunca reduzir a versão no banco para acomodar código antigo.

O staging oficial `scripts/deploy-vps-ready.mjs` inclui a classe de
compatibilidade na metadata imutável da release e executa o preflight V66 antes
dos demais gates. O helper root transacional deve rejeitar metadata ausente ou
um target cuja classe não satisfaça o mesmo contrato antes de alterar symlink
ou PM2.

Para rollback, a forma normativa é:

```text
node /opt/vitalismen-automacao/current/scripts/assert-post-sale-data-compatibility-v66.mjs \
  --target-metadata=/opt/vitalismen-automacao/releases/<target>/.release-source.json
```

Target sem metadata/classe V66 retorna `ROLLBACK_BLOCKED`, mesmo que possua
markers legados. Isso bloqueia especificamente `cc85952` e V65 após o bridge.

Markers dual-write oferecem defesa em profundidade para leitores antigos, mas não concedem suporte ao baseline/V65: eles ainda possuem startup e caminhos de envio incompatíveis com a política V66.
