# Congelado - Correcao quantidade e nome no funil Z-API

Data: 2026-05-26

Problema observado:
- Cliente respondeu `Deseo 2`.
- O bot aceitou 2 frascos como pacote oficial e criou estado incorreto.
- Depois, ao receber nome completo, o funil voltou a confirmar 1 frasco e confundiu a etapa.

Regra corrigida:
- Pacotes oficiais do funil: 1, 3 e 6 frascos.
- 2 frascos deve ser tratado como quantidade nao disponivel e o bot deve oferecer 1, 3 ou 6.
- Quando o funil esta aguardando nome, texto com formato de nome completo nao pode ser reinterpretado como quantidade.
- Fallback de checkout deve receber `customerContext` para nao quebrar com erro fatal.

Resultado esperado:
- Se cliente escrever `Deseo 2`, o bot responde que 2 frascos nao esta ativo e pede escolher 1, 3 ou 6.
- Se cliente escrever `Gerson Lourenco` ou `Joao Pedro`, o bot salva como nome e segue a etapa correta.
