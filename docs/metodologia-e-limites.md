# Metodologia e limites

Como o simulador calcula, de onde vêm os dados e o que ele não garante.

## De onde vêm os dados

| Dado | Fonte |
| --- | --- |
| Consumo a gasolina | PBE Veicular/Inmetro 2026 — Argo Drive 1.3 AT (CVT-7): 12,8 km/l na cidade |
| Preço da gasolina | API pública, por estado, com data da coleta exibida na tela |
| Preço da gasolina (reserva) | `data/simulator.json` → `fuel.snapshot`, usado quando a API falha |
| Autonomia e bateria | Fichas dos modelos, com as premissas explícitas no JSON |
| Mensalidades | **Fictícias**, apenas para demonstrar o comparativo |

Sobre o consumo: usamos o número de cidade com gasolina, conforme a tabela do PBE 2026 de 14/08/2026 — não estrada, não combinado. A foto do Argo é ilustrativa: o asset foi obtido para a versão Drive 1.0 e não confirma os equipamentos da versão CVT.

## Premissas do elétrico

| Premissa | Valor | Por quê |
| --- | --- | --- |
| Autonomia considerada | 80% da nominal | ar-condicionado, relevo e estilo de condução |
| Janela de bateria | 20% a 80% | prática recomendada de recarga |
| Perdas no carregador | 10% | conversão de energia na recarga |
| Margem de segurança | 30% sobre o km diário | evita decidir em cima do limite |

As duas primeiras juntas definem a autonomia útil entre recargas:

```text
autonomia útil = autonomia nominal × 0,8 × 0,6
```

## Como o cálculo funciona

```text
kmMês          = kmDia × dias de uso
autonomiaÚtil  = autonomia × 0,8 × 0,6
consumo        = bateria ÷ (autonomia × 0,8)          [kWh/km]
custoEnergia   = kmMês × consumo ÷ 0,9 × tarifaCasa
custoGasolina  = kmMês ÷ 12,8 × preçoGasolina
```

Tarifa considerada: recarga em casa, R$ 1,20/kWh.

### Status da rotina

| Situação | O que a tela mostra |
| --- | --- |
| `kmDia × 1,3` cabe na autonomia útil | estimativa compatível |
| `kmDia × 1,3` não cabe | rever a rotina ou a recarga |
| recarga fora de casa | pede ajuste antes de concluir |

O fluxo atual considera recarga em casa. O estado de ajuste fica reservado para cenários fora de casa, que não estão nesta versão.

## Assinatura + uso

O comparativo soma a mensalidade ao gasto de rodagem:

```text
totalElétrico = mensalidadeElétrica + custoEnergia
totalGasolina = mensalidadeGasolina + custoGasolina
diferença     = totalGasolina − totalElétrico
```

Regras aplicadas:

- Prazo e franquia são os mesmos para os dois carros da comparação.
- Mensalidade ausente gera **comparação pendente**, nunca economia inventada.
- Rotina acima da franquia transforma os totais em **subtotais** e a diferença em **parcial**, porque o custo do km excedente não está na conta.
- O preço da gasolina muda por estado; a data da coleta aparece junto do valor.
- Economia de energia não é economia total: o que vale é a diferença entre as somas.

## O que é fictício

- As mensalidades de exemplo nos dois pares. Não são médias de mercado nem ofertas da Localiza.
- Os valores digitados na interface não são gravados e somem ao recarregar a página.

## O que o MVP não faz

- Não garante autonomia nem consumo reais.
- Não confirma acesso a carregador e não cobre instalação.
- Não inclui instalação, taxas extras ou km excedente no total.
- Não cota, não contrata e não é proposta comercial.
- Não atende frota corporativa nem outras categorias de veículo.
- Não mede conversão. Isso exigiria um piloto controlado, com grupo comparável.

## Como reproduzir

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8000`. O JSON exige um servidor estático: por `file://` o navegador bloqueia a leitura. A demo publicada no GitHub Pages dispensa esse passo.

Para alterar premissas, modelos ou mensalidades de exemplo, edite `data/simulator.json`. As fórmulas ficam em `js/calculations.js` e não dependem do JSON para funcionar.
