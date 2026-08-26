# Backlog — Diligências

Itens combinados e ainda não implementados. Ordem não é prioridade.

## Próxima rodada

- **Relatórios por terceiro** — quanto cada um cumpriu, quanto recebeu, por
  período e por cidade. Agora que existe `demanda_terceiros`, os dados estão
  gravados. Atenção: demandas anteriores à v2.6 não têm participante
  registrado, então o relatório só é confiável a partir dessa data.

- **Notificar o terceiro ao ser vinculado a uma demanda** (e-mail ou WhatsApp).
  Depende de mexer nas Edge Functions `notificar-responsavel` / `notificacoes`,
  que hoje só mapeiam o texto da coluna `responsavel` para um e-mail fixo.
  O cadastro do terceiro já guarda e-mail e WhatsApp para isso.

## Decisões que podem voltar atrás

- A necessidade da diligência ("preciso de dois advogados") é representada
  pelas próprias linhas de participante, com `terceiro_id` nulo enquanto a
  pessoa não foi definida. Chegou a ser cogitada uma coluna
  `funcoes_necessarias` separada, descartada para não guardar a mesma
  informação em dois lugares e ver os dois divergirem.

## Observações técnicas

- O mini-cliente Supabase deste app manda **apenas o primeiro item** quando
  recebe um array em `insert()`. Para gravar várias linhas, inserir em laço.
  (`sincronizarVinculos` já faz assim.)
- A tabela `demandas` é compartilhada com o **fullfin**, que importa as
  diligências pagas. Não renomear nem remover colunas: `responsavel`,
  `valor`, `valor_terceiro`, `data`, `previsao_pagamento` e `plataforma`
  são lidas de fora deste app.
- As Edge Functions que valem são as do repositório **previmater-ops**.
- A coluna `terceiros.tipo` (select antigo de escolha única) foi substituída
  por `funcoes` (array) na v2.7 e não é mais lida. Ficou no banco só para não
  perder o histórico do cadastro.
