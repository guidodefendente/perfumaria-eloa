# Segurança do painel

## Quem pode entrar

- **Não existe cadastro público.** Só entra quem está no segredo `ADMIN_EMAILS`
  (Cloudflare e GitHub). Tirar um e-mail da lista corta o acesso na hora, mesmo
  com sessão aberta.
- A primeira senha é criada pelo próprio dono do e-mail, pelo link de
  "Esqueci minha senha · Primeiro acesso". Nenhuma senha passa por terceiros.
- O e-mail de recuperação só pode ser entregue a endereços **verificados** no
  Email Routing da conta Cloudflare. Mesmo com um bug, o sistema não consegue
  mandar e-mail para outro endereço.

## Como a senha é guardada

O plano gratuito do Workers dá 10 ms de CPU por requisição. Um hash de senha
forte (PBKDF2 com 100 mil iterações) já gasta ~13 ms. A solução é o padrão de
"estiramento no cliente" (o mesmo princípio usado por gerenciadores de senha):

```
celular:   chave = PBKDF2-SHA256(senha, sal aleatório, 600.000 iterações)   ← ~0,5–2 s, de propósito
servidor:  verificador = HMAC-SHA256(AUTH_PEPPER, "eloa:v1:" + chave)        ← < 1 ms
banco:     guarda só sal, iterações e verificador
```

- A senha **nunca sai do aparelho**.
- Se o banco vazar, sem o `AUTH_PEPPER` (segredo do Worker, fora do banco e do
  repositório) não dá nem para testar palpites; com ele, cada palpite custa
  600 mil iterações.
- 600 mil iterações seguem a recomendação da OWASP para PBKDF2-SHA256.
- O servidor recusa chaves derivadas com menos de 300 mil iterações.
- E-mails sem conta recebem um sal falso e estável: não dá para descobrir quem
  tem acesso testando e-mails.

## Sessão

- Cookie `__Host-eloa_sessao`: `HttpOnly` (JavaScript não lê), `Secure` (só HTTPS),
  `SameSite=Strict` (não vai em requisições vindas de outros sites), 30 dias.
- O banco guarda só o SHA-256 do token.
- Trocar ou redefinir a senha derruba as outras sessões.
- "Sair de todos os aparelhos" na tela Conta.

## Proteções

| Ameaça | Proteção |
|---|---|
| Adivinhar senha | 5 erros → e-mail bloqueado 15 min; 30 erros por IP → IP bloqueado 15 min |
| Abuso do "esqueci a senha" | 3 e-mails/hora por endereço, 10 pedidos/hora por IP; resposta sempre igual |
| Link de redefinição vazado | vale 30 min, uso único, fica no fragmento `#` da URL (não vai para logs) |
| CSRF (outro site agindo em nome do usuário) | cookie SameSite=Strict + conferência do cabeçalho `Origin` em toda alteração |
| Painel dentro de iframe (clickjacking) | `X-Frame-Options: DENY` e `frame-ancestors 'none'` |
| Script injetado (XSS) | todo texto é escapado; CSP do painel só permite scripts do próprio site; JSON-LD com `<` escapado |
| Arquivo malicioso disfarçado de foto | formato conferido pelos bytes (WebP/JPEG), tamanho máximo, chave aleatória |
| Painel indexado no Google | `noindex` no HTML e no cabeçalho `X-Robots-Tag` |

## Segredos

| Segredo | Onde fica | Observação |
|---|---|---|
| `AUTH_PEPPER` | Cloudflare (Worker) | Gerado aleatoriamente pelo fluxo "Configurar Cloudflare". Ninguém precisa conhecer. **Trocar invalida todas as senhas** — aí é só usar "Esqueci minha senha". |
| `ADMIN_EMAILS` | GitHub e Cloudflare | Lista de quem pode entrar. Editar no GitHub e rodar "Publicar na Cloudflare". |
| `CLOUDFLARE_API_TOKEN` | GitHub | Token com permissões mínimas (ver `IMPLANTACAO.md`). |

O repositório é **público**: nunca coloque e-mails, tokens ou senhas em arquivos versionados.

## O formulário antigo

`admin/enviar.html` (FormSubmit → e-mail do Guido → agente no Mac) publicava
alterações usando o próprio link do formulário como "chave". Com o Worker no ar,
`/admin/*` redireciona para `/painel/`, e o formulário deixa de ser servido.
