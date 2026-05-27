# Congelado - Base mae do funil Z-API Vit Power

Data: 2026-05-26

Esta base manda em todas as camadas futuras.

## Oferta
- Produto oficial: Vit Power Ecuador.
- Vitrine inicial publica: 1, 3 e 6 frascos.
- A opcao de 2 frascos nao aparece na vitrine inicial.
- Camada especial: se o cliente pedir 2 frascos espontaneamente, aceitar 2 frascos por 70 USD e seguir o mesmo fluxo.

## Fluxo principal
- O bot pode responder fora de ordem, mas nao pode pular dados obrigatorios.
- Antes de fechar, precisa ter:
  - nome completo confiavel;
  - quantidade;
  - confirmacao do valor;
  - cidade;
  - provincia/departamento;
  - tipo de entrega;
  - agencia Servientrega validada ou endereco completo de domicilio;
  - ponto de referencia quando for domicilio;
  - resumo final;
  - autorizacao do cliente.

## Memoria
- Se o cliente ja informou nome, cidade, provincia, quantidade ou agencia, o bot deve reaproveitar e confirmar, nao perguntar de novo.
- Um dado novo so pode sobrescrever dado antigo se for claramente uma correcao.
- Texto de agencia, cidade, setor ou endereco nao pode virar nome.
- Texto de nome completo nao pode virar quantidade.

## Agencias
- Servientrega deve ser oferecida uma agencia por vez.
- Nao usar A/B/C.
- Quando existir, mostrar setor e horario.
- Se nao servir, pedir outra cidade, setor ou avenida.

## Domicilio
- Endereco completo e ponto de referencia sao obrigatorios.
- Endereco final deve ser limpo para logistica: rua/intersecao, referencia, cidade, provincia/departamento, pais.

## Cierre
- Depois que o cliente autorizar o despacho, nao reiniciar venda.
- Agradecimento curto, audio aprovado e bonus/retirada seguem como pos-fechamento.

## Regra de trabalho
- Toda alteracao futura entra como camada pequena, testada e congelada.
- Uma camada nao pode apagar a base mae.
