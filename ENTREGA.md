# Entrega do projeto — Perfumaria Eloá

Guia para transferir a propriedade completa do site (código, domínio e a automação de
catálogo) do Guido para o novo responsável. Nem o Guido nem o irmão são técnicos — este
documento existe para a pessoa que for contratada para manutenção conseguir assumir sem
precisar reconstruir o histórico da conversa.

## O que existe hoje, e onde mora

| Peça | Onde está | Transfere com o código? |
|---|---|---|
| Site (HTML/CSS/JS estático) | [github.com/guidodefendente/perfumaria-eloa](https://github.com/guidodefendente/perfumaria-eloa) | ✅ sim — é o repositório |
| Hospedagem | GitHub Pages, configurado no próprio repositório | ✅ sim — vem com o repositório |
| Domínio | `perfumariaeloa.com.br`, registrado no Registro.br em nome do Guido | ❌ não — processo separado, ver abaixo |
| Cadastro/exclusão automático de produtos | Scripts em `~/.hermes/scripts/eloa_*.py` **no Mac pessoal do Guido**, usando o Gmail dele e a conta dele no Claude Code | ❌ não — não é parte do repositório, ver abaixo |

## 1. Repositório GitHub — pendente

Falta o **username do GitHub** de quem vai assumir. Assim que tiver:

```bash
gh repo edit guidodefendente/perfumaria-eloa --transfer-owner <username>
```

(ou pelo site: Settings → General → Transfer ownership). A pessoa recebe um convite por
e-mail e precisa aceitar. O domínio customizado (`perfumariaeloa.com.br`) configurado no
GitHub Pages continua funcionando depois da transferência, sem precisar reconfigurar nada.

**Se ainda não existe ninguém definido:** não é preciso esperar contratar alguém para
resolver isso — dá para transferir para uma conta GitHub do próprio irmão (gratuita, leva
2 minutos para criar em github.com) e o futuro contratado ganha acesso como colaborador
depois.

## 2. Domínio `.br` — o Guido precisa fazer isso, ninguém mais pode

`perfumariaeloa.com.br` está registrado no Registro.br em nome de Guido Defendente da
Silva (CPF do titular). Mudança de titularidade de domínio `.br` **exige o titular atual**
— nenhuma ferramenta de terceiros ou automação consegue fazer isso, é um processo oficial
do Registro.br:

1. Acesse [registro.br](https://registro.br) e faça login com a conta do Guido.
2. No domínio `perfumariaeloa.com.br`, procure "Alterar titular" (nas configurações do
   domínio).
3. É preciso o **CPF/CNPJ e e-mail do novo titular**. O Registro.br envia uma confirmação
   para as duas partes; o processo só se completa quando o novo titular aceitar.
4. Enquanto a mudança não é aceita, o domínio continua em nome do Guido — não há risco de
   ficar "no meio do caminho" sem dono.

Se decidirem manter o domínio em nome do Guido por enquanto (só passando o site e a
gestão), pular esta etapa não quebra nada — é só uma questão de em nome de quem o registro
fica.

## 3. A automação de cadastro/exclusão — o que NÃO transfere e por quê

Hoje, quando alguém preenche o formulário (`admin/enviar.html`) para cadastrar ou remover
um produto:

```
Formulário → FormSubmit → guido.defendente@gmail.com → Hermes (agente no Mac do Guido)
  → Claude Code (conta do Guido) → PR no GitHub → merge automático → site atualizado
```

As três dependências abaixo são **pessoais do Guido** e não vêm com o repositório:

- **O e-mail de destino do formulário.** `admin/enviar.html` envia para
  `guido.defendente@gmail.com` via FormSubmit. Se o Guido parar de monitorar essa caixa,
  as submissões continuam chegando ali e simplesmente não são processadas — sem aviso
  nenhum pra ninguém. **Isso precisa ser decidido antes de o Guido sair do circuito.**
- **O agente Hermes**, instalado no Mac do Guido, que lê esse e-mail e decide o que fazer.
- **A conta do Claude Code** do Guido, que os scripts do Hermes chamam para editar o
  repositório, gerar as páginas, rodar os testes e abrir o PR.

**Três caminhos possíveis**, para decidirem com quem for contratado:

1. **Guido continua rodando essa parte por um tempo**, como favor/serviço, enquanto o
   contratado assume só o código e o domínio. Simples de fazer agora, mas depende do
   Guido continuar disponível.
2. **O contratado reconstrói o próprio pipeline** (Hermes ou qualquer outra automação, com
   o Gmail e a conta de IA dele). Os scripts ficam documentados em
   `~/.hermes/scripts/eloa_*.py` (fora deste repositório) como referência do que cada
   etapa faz — cadastro, exclusão, validação, tratamento de imagem, geração de páginas,
   verificação SEO.
3. **Desligar a automação e gerenciar `assets/js/products.js` manualmente.** O README do
   projeto (seção "Como atualizar o catálogo") explica como editar o catálogo à mão, sem
   precisar de nenhum agente. É o caminho mais simples se o contratado só for atualizar o
   site ocasionalmente.

Nenhuma dessas opções precisa ser decidida hoje — o site continua no ar e o formulário
continua funcionando (ou não, se o caminho 3 for escolhido) independente disso.

## 4. Como o catálogo funciona (para quem for assumir a manutenção)

- **Fonte da verdade:** `assets/js/products.js` — um array `PRODUCTS`, sem banco de dados.
- **Depois de editar `products.js` manualmente ou via automação:**
  ```bash
  node tools/gerar-paginas.mjs   # gera produto/<id>/index.html e o sitemap.xml
  node tools/verificar-seo.mjs   # confere integridade e SEO — trava se algo estiver errado
  ```
- **Nunca editar** `produto/<id>/index.html` ou `sitemap.xml` à mão — são gerados.
- Mais detalhes em `README.md` (seção "Como atualizar o catálogo") e no histórico de
  decisões em `DECISOES.md`.

## 5. Pendências conhecidas nesta entrega (24/09/2026)

- **`po-iluminador-amor-anjo`** — publicado com a foto que chegou (mostra perfume, não pó
  iluminador). Precisa da foto correta.
- **`pompom`** — marca cadastrada como "Perfumaria" (não é uma marca real, foi o que a
  loja enviou). Precisa confirmar o nome/marca real.
- **`lip-gloss-cherry`** — pode ser o mesmo produto que `lip-gloss-holding-morning`
  (preços diferentes: R$ 12 vs R$ 19,90). Precisa decidir se são o mesmo item.
- Detalhes completos de cada um em `DECISOES.md` (Sprint 6).
- O log `Submissões-Eloá.md` (no computador do Guido, fora deste repositório) ficou
  desatualizado nessas publicações — não afeta o site, só o histórico de auditoria.

## 6. Resumo do que falta para a entrega ficar completa

- [ ] Username do GitHub de quem vai assumir → transferir o repositório
- [ ] Guido decidir se/quando iniciar a mudança de titularidade do domínio no Registro.br
- [ ] Decidir um dos 3 caminhos da seção 3 para a automação de cadastro/exclusão
- [ ] Se o caminho escolhido não incluir o Guido, trocar o e-mail de destino do
      formulário em `admin/enviar.html` (linha `action="https://formsubmit.co/..."`) para
      um e-mail que a pessoa responsável de fato monitora
