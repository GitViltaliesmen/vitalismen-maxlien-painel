# Snapshot do helper instalado

`vitalismen-stage.installed-20260826.sh` é o snapshot byte a byte, somente para
auditoria, do helper encontrado em produção em 2026-08-26:

```text
/usr/local/sbin/vitalismen-stage
SHA256 0c2cf0d0b13d0149ad8c76ff8c94e4b7295d42c474ae6d45ff21a2cf1767b9b6
```

Ele não é a fonte para instalação. A fonte canônica candidata passou a ser
`ops/vitalismen-stage`. O snapshot preserva a evidência do comportamento anterior
e permite comparação reproduzível com `git diff --no-index`.

O snapshot não deve ser executado, instalado nem promovido.
