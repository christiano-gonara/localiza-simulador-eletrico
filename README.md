# O elétrico na sua rotina

MVP de apresentação para o Case 1 do hackathon Localiza: ajudar o cliente a avaliar um elétrico por assinatura na sua rotina.

## Organização

```text
index.html               # Estrutura da página
css/styles.css           # Aparência e layout
js/app.js                # Telas, interações e consulta à API
js/calculations.js       # Cálculos de autonomia e assinatura + uso
js/assets.js             # Ícones e caminhos das imagens
data/simulator.json      # Modelos, consumo, premissas e exemplos de preços
assets/images/           # Fotos e ilustrações locais
```

Os dados ficam no JSON; as fórmulas continuam no JavaScript. O JSON não é um banco de dados e não cria um backend.

## Como abrir

Na pasta do projeto, execute:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8000` no navegador. Encerre com `Ctrl+C`.

Este servidor só entrega os arquivos estáticos. Não há backend de aplicação, banco de dados, instalação de dependências ou etapa de build. Se hospedar a pasta em um serviço de páginas estáticas, não precisa rodar esse comando.

Não abra `index.html` por duplo clique: o navegador pode bloquear a leitura do JSON pelo endereço `file://`. O simulador exibe uma orientação nesse caso, em vez de deixar a tela vazia.

## O que funciona

- Estimativa de autonomia a partir da distância diária e dos dias de uso.
- Comparação de assinatura + energia e assinatura + gasolina.
- Mensalidades separadas por par de modelos, com prazo e franquia iguais.
- Prazos de 12, 24, 36 e 48 meses; trocar o plano exige novas mensalidades.
- BYD Dolphin Mini GS × Fiat Argo Drive 1.3 CVT automático.
- BYD Dolphin GS × Fiat Argo Drive 1.3 CVT automático.
- Recarga em casa, com cenários de rotina curta ou distância longa.
- Preço da gasolina por estado, com data da coleta e dados salvos se a API falhar.
- Alerta para franquia excedida e para distância que exige rever a recarga.
- Checklist antes de assinar, resumo copiável e moldura de iPhone.

## Como editar os dados

Edite `data/simulator.json` e recarregue a página:

- `cars`: modelos, bateria, autonomia e consumo do carro a gasolina.
- `defaults`: rotina e premissas iniciais do cálculo.
- `subscription`: prazos, franquias e mensalidades de exemplo.
- `fuel.snapshot`: última coleta salva de gasolina, com fonte e data.

As mensalidades iniciais são **fictícias, apenas para demonstração**. Não são médias de mercado nem ofertas da Localiza. A troca do Argo manual pelo automático não determina uma nova mensalidade: use cotações equivalentes de prazo e franquia para comparar ofertas reais. Os valores inseridos na interface não são gravados no JSON e não persistem quando a página é recarregada.

## Limites

O total soma assinatura e uso. Não inclui instalação, km excedentes ou outras taxas. Quando a rotina ultrapassa a franquia, a comparação é parcial. O MVP não garante autonomia, não confirma acesso a carregadores e não realiza contratação.

Os arquivos locais funcionam sem consulta a serviços externos, desde que o servidor estático esteja ativo. Só a atualização do preço da gasolina depende de internet.

## Dados e créditos

- Gasolina: Combustível API, com data da coleta exibida na interface.
- Veículos: referências do PBE Veicular/Inmetro 2026 e premissas explícitas no simulador. Para o Argo Drive 1.3 AT (CVT-7), usamos 12,8 km/l com gasolina na cidade, conforme a tabela de 14/08/2026. O Argo tem a mesma mensalidade fictícia nos dois pares. A comparação aproxima a proposta de transmissão automática, mas não estabelece equivalência de porte ou equipamentos.
- Ícones: Phosphor Duotone, licença MIT preservada no HTML; ilustrações 3dicons.
- Foto ilustrativa do Argo: site oficial Fiat Argo; asset originalmente obtido para o Drive 1.0, não uma confirmação dos equipamentos da versão CVT. Imagens e marcas de veículos pertencem aos respectivos titulares.

Protótipo de hackathon não oficial. Os PDFs do case e os materiais de apresentação não fazem parte deste repositório.
