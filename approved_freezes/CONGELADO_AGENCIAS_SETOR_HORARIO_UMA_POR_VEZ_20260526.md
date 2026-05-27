# Congelado - Agencias Servientrega por setor e horario

Data: 2026-05-26

Regra aprovada:
- Para cidades com muitas agencias, o bot continua oferecendo uma agencia por vez.
- A mensagem da agencia deve mostrar nome, setor, endereco e horario quando estes dados existirem.
- O cliente nao precisa escolher A/B/C.
- Se a agencia nao servir, o cliente pode responder com outra cidade, outro setor ou avenida.
- A proxima agencia deve vir uma por vez, sem texto grande.

Formato operacional:
```
Esta agencia de Servientrega le sirve?

SERVIENTREGA, [NOME]
Sector: [SETOR]
[ENDERECO]
Horario: [HORARIO]
Sabado: [HORARIO FDS]

Si le sirve, me dice que esta bien. Si no le sirve, me escribe otra ciudad, sector o avenida.
```

Objetivo:
- Reduzir confusao de clientes com baixa leitura.
- Usar melhor a base oficial `agencia_LISTA.json`, principalmente campos de setor e horarios.
- Evitar retorno para logica antiga de varias opcoes A/B/C.
