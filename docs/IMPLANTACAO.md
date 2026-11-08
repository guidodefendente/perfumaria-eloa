# Implantação — da hospedagem atual (GitHub Pages) para a Cloudflare

Roteiro único, feito uma vez. **O site atual continua no ar o tempo todo**: o
GitHub Pages só deixa de responder no passo 7, quando o Worker já foi testado.

Legenda: 👤 = só o Guido (ou o irmão) pode fazer · 🤖 = automático/Claude

---

## 0. Antes de começar

- [ ] Confirmar os e-mails que terão acesso ao painel (o do irmão e, como
      reserva, o do Guido). Eles vão no segredo `ADMIN_EMAILS` — **nunca** em arquivo do repositório.
- [ ] Se algum produto foi alterado em `assets/js/products.js` depois deste
      PR, rodar `node scripts/gerar-seed.mjs` para atualizar a carga inicial. 🤖

## 1. 👤 Criar a conta Cloudflare (sem cartão)

1. Em https://dash.cloudflare.com/sign-up, criar a conta **com o e-mail do irmão**.
2. **Não cadastrar cartão nem PayPal.** Nenhum passo deste roteiro precisa disso.
   Se alguma tela pedir pagamento, pare: é um serviço pago (ver `CUSTOS.md`).
3. Recomendado: ativar a verificação em duas etapas (Perfil → Autenticação).

## 2. 👤 Colocar o domínio na Cloudflare (plano Free)

1. No painel da Cloudflare: **Adicionar domínio** → `perfumariaeloa.com.br` → plano **Free**.
2. A Cloudflare copia os registros DNS atuais (os 4 registros A do GitHub Pages:
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`).
   Confira se eles aparecem — é isso que mantém o site no ar durante a troca.
3. Anote os **dois nameservers** que a Cloudflare mostrar (algo como `xxx.ns.cloudflare.com`).
4. No **Registro.br** (conta do Guido, titular do domínio):
   - se o **DNSSEC** estiver ativo, desative-o primeiro;
   - em **DNS → Alterar servidores DNS**, troque pelos dois nameservers da Cloudflare.
5. Aguarde a Cloudflare mostrar o domínio como **Ativo** (minutos a algumas horas).

## 3. 👤 Ativar o e-mail de recuperação de senha

1. Cloudflare → domínio → **Email** → **Email Routing** → **Ativar** (aceite
   adicionar os registros MX/SPF/DKIM que ela sugere).
2. Em **Endereços de destino**, adicione cada e-mail de `ADMIN_EMAILS`.
3. Cada pessoa abre o e-mail da Cloudflare e clica em **Verify email address**.
   Sem isso, o e-mail de "criar senha" não chega para aquele endereço.

## 4. 👤 Criar o token de acesso para a publicação automática

Cloudflare → ícone do perfil → **Meu perfil** → **Tokens de API** → **Criar token**
→ modelo **"Editar Cloudflare Workers"**, e ajuste as permissões para:

| Tipo | Permissão | Nível |
|---|---|---|
| Conta | Workers Scripts | Editar |
| Conta | Workers KV Storage | Editar |
| Conta | D1 | Editar |
| Conta | Account Settings | Ler |
| Zona (perfumariaeloa.com.br) | Workers Routes | Editar |
| Zona (perfumariaeloa.com.br) | DNS | Editar |
| Zona (perfumariaeloa.com.br) | Zone | Ler |
| Usuário | User Details / Memberships | Ler |

Remova do modelo a permissão **Workers R2 Storage** (não usamos R2).
Copie o token (ele só aparece uma vez). Anote também o **ID da conta**
(aparece na barra lateral da página inicial do painel da Cloudflare).

## 5. 👤 Guardar os segredos no GitHub

GitHub → repositório → **Settings → Secrets and variables → Actions → New repository secret**:

| Nome | Valor |
|---|---|
| `CLOUDFLARE_API_TOKEN` | o token do passo 4 |
| `CLOUDFLARE_ACCOUNT_ID` | o ID da conta |
| `ADMIN_EMAILS` | ex.: `irmao@gmail.com,guido@gmail.com` |

Ninguém mais (nem o Claude) precisa ver esses valores.

## 6. 🤖 Configurar e publicar

1. GitHub → **Actions → Configurar Cloudflare → Run workflow**.
   Cria o banco (com os 67 produtos atuais) e o espaço de fotos, publica o
   Worker e gera o segredo das senhas. Pode ser repetido sem estragar nada.
2. O Worker fica acessível num endereço provisório `*.workers.dev` para conferência.

## 7. 🤖 Ligar o domínio ao Worker (a virada)

1. No `wrangler.jsonc`, ativar as rotas do domínio:
   ```jsonc
   "routes": [
     { "pattern": "perfumariaeloa.com.br", "custom_domain": true },
     { "pattern": "www.perfumariaeloa.com.br", "custom_domain": true }
   ],
   ```
   A Cloudflare pede que os registros A/CNAME antigos de `perfumariaeloa.com.br`
   e `www` sejam apagados antes (Cloudflare → DNS) — são os do GitHub Pages.
2. Commit no `main` → o fluxo **Publicar na Cloudflare** roda sozinho.
3. Conferir:
   - [ ] https://perfumariaeloa.com.br abre, catálogo com 67 produtos;
   - [ ] uma página de produto, ex. `/produto/arbo/`;
   - [ ] `/sitemap.xml`;
   - [ ] carrinho e link do WhatsApp;
   - [ ] `/admin/enviar.html` redireciona para `/painel/`.

## 8. 👤 Primeiro acesso ao painel

Cada pessoa de `ADMIN_EMAILS`: https://perfumariaeloa.com.br/painel/ →
**Esqueci minha senha · Primeiro acesso** → e-mail → criar senha.
Ver `GUIA-DO-PAINEL.md`.

## 9. Desligar o que ficou para trás

- [ ] 👤 GitHub → Settings → Pages → remover o domínio personalizado e desativar o Pages.
- [ ] 👤 Desligar o agente Hermes no Mac do Guido (scripts `~/.hermes/scripts/eloa_*.py`)
      e o encaminhamento do FormSubmit — não são mais necessários.
- [ ] 🤖 Remover do repositório o que o Worker substituiu: `produto/`, `sitemap.xml`,
      `admin/enviar.html`, `tools/gerar-paginas.mjs`, `tools/verificar-seo.mjs`.
      (Ficam até a virada para o GitHub Pages continuar funcionando.)
- [ ] 👤 Google Search Console: reenviar `https://perfumariaeloa.com.br/sitemap.xml`.

---

## Plano de volta (se algo der errado na virada)

O GitHub Pages continua configurado até o passo 9. Para voltar:

1. Cloudflare → Workers → perfumaria-eloa → **Domínios** → remover os domínios personalizados.
2. Cloudflare → DNS → recriar os 4 registros A do GitHub Pages (IPs acima),
   com a nuvem **cinza** (somente DNS).
3. Em poucos minutos o site volta a ser o do GitHub Pages, como antes.

Nenhum dado se perde: o banco D1 continua lá para a próxima tentativa.
