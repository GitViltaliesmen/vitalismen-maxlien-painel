# Agencia e Domicilio

## Prioridade

Agencia Servientrega e o caminho principal porque reduz erro logistico e aumenta seguranca.

Domicilio entra quando:

- cliente pede domicilio/casa;
- cliente rejeita agencia;
- cidade/regiao nao tem agencia viavel;
- operador decide manualmente.

## Cidade e provincia

Se o cliente responder apenas cidade:

```text
Cuenca
```

O sistema deve buscar em `src/data/agencia_LISTA.json`, encontrar provincia/departamento e gravar:

```json
{
  "city": "Cuenca",
  "province": "Azuay"
}
```

Nao perguntar provincia novamente se ela foi inferida com confianca.

## Agencia

Pergunta:

```text
Puedo enviar su pedido para retirar en una agencia Servientrega?
```

Se aceitar:

```text
Por favor, elija una agencia:

1) Servientrega ...
...
```

Depois disso o estado fica travado em `aguardando_agencia`.

## Domicilio

Pergunta curta:

```text
Perfecto. Envieme su direccion completa con referencia, color de casa o local cercano.
```

## Formatacao de endereco baguncado

Prompt operacional aprovado:

```text
Formate o seguinte endereco em uma unica linha para fins logisticos no Equador, seguindo a ordem:
[Rua Principal e Intersecao], [Ponto de Referencia com andar e cor da casa], [Cidade], [Provincia/Departamento], [Pais].
Use virgulas para separar e mantenha o texto limpo para copiar e colar.
```

Saida esperada:

```json
{
  "addressRaw": "texto original do cliente",
  "addressFormatted": "Av. Remigio Crespo, atras del Tia, casa verde segundo piso, Cuenca, Azuay, Ecuador",
  "city": "Cuenca",
  "province": "Azuay",
  "reference": "atras del Tia, casa verde segundo piso",
  "missing": []
}
```

Resposta ao cliente:

```text
Lo tengo asi:

Av. Remigio Crespo, atras del Tia, casa verde segundo piso, Cuenca, Azuay.

Esta correcto?
```

Se faltar referencia:

```text
Solo me falta una referencia: color de casa, local cercano o piso.
```

Se faltar cidade:

```text
Gracias. En que ciudad esta?
```
