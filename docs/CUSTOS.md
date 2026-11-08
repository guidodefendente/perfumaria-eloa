# Custos — por que a Perfumaria Eloá não gera cobrança

Validação feita em 07/11/2026 nas páginas oficiais da Cloudflare (links no fim).
Regra do projeto, definida pelo Guido: **nenhuma cobrança no cartão, em hipótese alguma.**

## Resumo

A operação usa apenas produtos que, no plano gratuito, **param de funcionar ao
atingir o limite em vez de cobrar**, e a conta da Cloudflare **não tem forma
de pagamento cadastrada**. Sem cartão na conta não existe como haver fatura —
nem por excesso de uso, nem por um upgrade clicado sem querer.

O pior cenário possível é o site ficar fora do ar até as 21h (meia-noite UTC),
quando os limites diários zeram. Nunca uma cobrança.

## O que usamos e como cada limite se comporta

| Serviço | Para quê | Gratuito | Ao passar do limite | Pode cobrar? |
|---|---|---|---|---|
| Workers (plano Free) | Painel, API, páginas de produto | 100 mil requisições/dia, 10 ms de CPU | Erro 1027 até 21h | **Não** |
| Arquivos estáticos | HTML, CSS, JS, fontes, fotos antigas, painel | Ilimitado | — | **Não** |
| D1 (plano Free) | Produtos, categorias, usuários | 5 mi linhas lidas/dia, 100 mil gravadas/dia, 5 GB | Consultas falham até 21h | **Não** |
| KV (plano Free) | Fotos enviadas pelo painel | 1 GB, 100 mil leituras e 1 mil gravações/dia | Operação falha | **Não** |
| Email Routing (envio a endereço verificado) | E-mail de recuperação de senha | Grátis em qualquer plano | — | **Não** |
| Cron Triggers | Limpeza diária | Incluído no Free | — | **Não** |
| DNS + CDN + SSL (plano Free) | Domínio, HTTPS | Grátis | — | **Não** |

## O que foi descartado e por quê

**R2 (proposta original para as fotos).** A Cloudflare exige cartão para ativar o
R2 e **cobra automaticamente** o que passar da franquia, sem teto. Os "budget
alerts" da Cloudflare só mandam e-mail — não pausam nem limitam nada. Com R2
dá para tornar a cobrança improvável, mas não impossível. Por isso as fotos
ficam no **KV**, que no plano gratuito simplesmente recusa a operação.

**Cloudflare Images / transformações de imagem.** Desnecessário: o próprio celular
otimiza as fotos antes do envio (ver `painel/imagens.js`).

**Workers Paid (US$ 5/mês).** Não é necessário para o volume da loja.

## Quanto da franquia a loja usa

Estimativa conservadora, considerando 1.000 visitas por dia (muito acima do
esperado para uma loja de bairro):

| Recurso | Uso por visita | 1.000 visitas/dia | Limite diário | Folga |
|---|---|---|---|---|
| Requisições ao Worker | 2–6 (catálogo, página do produto, fotos novas) | ~6.000 | 100.000 | ~16× |
| Linhas lidas no D1 | 1–2 (o catálogo já fica pronto numa única linha) | ~2.000 | 5.000.000 | ~2.500× |
| Leituras no KV | só fotos novas fora do cache | < 6.000 | 100.000 | > 16× |
| Gravações no KV | 2 por foto enviada (limitado a 150 fotos/dia no painel) | ≤ 300 | 1.000 | > 3× |
| Espaço no KV | ~250 KB por foto | 800 MB de teto no painel ≈ 3.200 fotos | 1 GB | — |

As fotos que já estavam no site (67 produtos) continuam como arquivos estáticos,
que são ilimitados e não contam no limite do Worker.

## Travas adicionais no código

Mesmo no plano gratuito, o painel impõe limites próprios abaixo dos da Cloudflare,
para nunca chegar perto deles:

- no máximo **150 fotos por dia** (300 gravações no KV, de 1.000 permitidas);
- no máximo **800 MB** de fotos no total (de 1 GB);
- cada foto até 1,5 MB, cada miniatura até 400 KB;
- fotos órfãs (removidas ou de produtos excluídos) são apagadas automaticamente após 7 dias.

## Regras para manter assim

1. **Nunca cadastrar cartão ou PayPal na conta Cloudflare.** Se alguma tela pedir
   pagamento, é porque o serviço é pago — pare e consulte o Guido.
2. **Nunca ativar** R2, Images, Stream, Workers Paid, Argo, Load Balancing ou qualquer
   plano Pro/Business, sem autorização expressa do Guido.
3. Qualquer mudança em `wrangler.jsonc` que adicione um serviço novo precisa ser
   conferida contra esta página antes.

## Custo que existe fora da Cloudflare

O domínio **perfumariaeloa.com.br** é registrado no Registro.br em nome do Guido
e tem **renovação anual** paga ao Registro.br. Isso já existia antes do painel e
não muda com ele. Ver `ENTREGA.md` para a transferência de titularidade.

## Fontes (consultadas em 07/11/2026)

- Workers — preços: https://developers.cloudflare.com/workers/platform/pricing/
- Workers — limites (erro 1027 no plano Free): https://developers.cloudflare.com/workers/platform/limits/
- D1 — preços: https://developers.cloudflare.com/d1/platform/pricing/
- D1 — limites do plano Free aplicados a partir de 01/09/2026: https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/
- R2 — preços: https://developers.cloudflare.com/r2/pricing/
- Budget alerts (só informativos): https://developers.cloudflare.com/billing/manage/budget-alerts/
- Envio de e-mail para endereços verificados (grátis): https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/
