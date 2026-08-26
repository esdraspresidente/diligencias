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

## Observações técnicas

- O mini-cliente Supabase deste app manda **apenas o primeiro item** quando
  recebe um array em `insert()`. Para gravar várias linhas, inserir em laço.
  (`sincronizarVinculos` já faz assim.)
- A tabela `demandas` é compartilhada com o **fullfin**, que importa as
  diligências pagas. Não renomear nem remover colunas: `responsavel`,
  `valor`, `valor_terceiro`, `data`, `previsao_pagamento` e `plataforma`
  são lidas de fora deste app.
- As Edge Functions que valem são as do repositório **previmater-ops**.
