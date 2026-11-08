-- Destaques passam a ser ordenados pelo mais recentemente cadastrado/alterado
-- (decisão do Guido, 08/11/2026). Reordena os destaques atuais uma vez por
-- atualizado_em (mais recente primeiro); empates mantêm a ordem que já existia.
-- Daqui em diante o próprio Worker mantém a regra a cada cadastro/edição.
UPDATE produtos SET destaque_pos = (
  SELECT COUNT(*) FROM produtos o
  WHERE o.destaque_pos IS NOT NULL
    AND (o.atualizado_em > produtos.atualizado_em
         OR (o.atualizado_em = produtos.atualizado_em AND o.destaque_pos < produtos.destaque_pos)
         OR (o.atualizado_em = produtos.atualizado_em AND o.destaque_pos = produtos.destaque_pos AND o.id < produtos.id))
) + 1
WHERE destaque_pos IS NOT NULL;
