# Contexto do Case 1

Resumo do desafio, do diagnóstico e do recorte que este MVP ataca. Escrito a partir do material do case enviado pela Localiza; o documento original não faz parte deste repositório.

## Qual é o case

- **Título:** A assinatura como porta de entrada para a mobilidade elétrica.
- **Pergunta central:** como usar o modelo de assinatura para reduzir as barreiras que impedem as pessoas de migrar para o carro elétrico?
- **O que se espera da entrega:** transformar interesse em novas assinaturas, com estratégia priorizada e impacto claro para o cliente e para o negócio.
- **Direção pedida:** que a assinatura seja percebida como a forma mais completa e segura de ter um elétrico.

## O diagnóstico

O interesse por elétricos cresceu rápido. A decisão de migrar não acompanhou.

| Sinal | Número |
| --- | --- |
| Leads de elétricos | de 1% para 29% em menos de um ano |
| Conversão de leads de elétricos comparada à de combustão | 3× menor |
| Entre quem assinou e avaliou elétricos | 80% escolheu combustão |
| Participação de eletrificados no Brasil | 18%, contra 42,16% no mundo |
| Clientes que dizem que a vontade de assinar aumenta ao pensar em eletrificado | 59% |

A leitura que fizemos: o problema não é falta de interesse, é **percepção de risco**. Comprar um elétrico hoje significa assumir sozinho depreciação, revenda e uma infraestrutura de recarga ainda em formação.

## Dores do cliente

- Insegurança sobre autonomia e disponibilidade de recarga.
- Dificuldade para comparar o custo-benefício entre elétrico e combustão.
- Falta de um jeito seguro de adotar o elétrico sem assumir um grande investimento.
- Dúvidas sobre manutenção, depreciação e valor de revenda.
- Dificuldade em transformar curiosidade em experimentação prática.

## Dores do negócio

- Conversão baixa: o interesse entra, a assinatura não sai.
- Necessidade de educar o consumidor sobre o que muda no dia a dia.
- Oportunidade de ampliar a participação dos elétricos na frota de forma sustentável.
- Onboarding do cliente em um universo novo: recarga, instalação e uso.

## A jornada que o case descreve

```text
tem interesse → pesquisa informações → percebe risco na troca
→ dúvidas de autonomia, recarga e custo → adia ou abandona a decisão
```

## O recorte deste MVP

O case tem várias barreiras. Este MVP ataca **uma**: a dúvida de custo total e de adequação à rotina no momento anterior à assinatura.

Antes de contratar, a pessoa quer responder três perguntas:

1. **Cabe na minha rotina?** A distância diária cabe na estimativa de autonomia, com margem?
2. **Quanto custa por mês?** Assinatura mais energia, comparado com assinatura mais gasolina.
3. **O que eu ganho e o que eu abro mão?** Diferenciais por versão e o que muda na rotina.

## Hipótese

Se a pessoa enxergar o custo mensal completo e o trajeto dela couber na estimativa, com a recarga esclarecida, a insegurança cai e a assinatura passa a ser vista como o caminho mais seguro para ter um elétrico.

A conversão é **hipótese a testar**, não resultado comprovado. Medir isso exigiria um piloto com grupo comparável.

## Público

- Pessoa física considerando um elétrico por assinatura.
- Fora do escopo: frota corporativa, motorista de aplicativo e venda de seminovos.

## Como isso conversa com os critérios da banca

| Critério | Onde aparece |
| --- | --- |
| Profundidade do diagnóstico | barreiras mapeadas e números do case citados acima |
| Impacto para cliente e negócio | custo total e adequação à rotina antes de contratar |
| Viabilidade de implementação | front-end estático, API pública, sem backend |
| Qualidade da jornada | da rotina ao comparativo, com estados de alerta |
| Criatividade com propósito | comparação honesta, inclusive quando o elétrico não vence |
