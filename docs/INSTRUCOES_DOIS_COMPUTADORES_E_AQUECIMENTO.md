# Instrucoes Para Trabalhar Em Dois Computadores

Arquivo principal tambem salvo em:

```text
/Users/greson/Documents/Aquecimento WhatsApp/INSTRUCOES_DOIS_COMPUTADORES.md
```

## Regra Curta

Vitalismen, Maxlien e Aquecimento nao devem ser misturados.

Pastas oficiais no Mac:

```text
/Users/greson/Documents/Vitalismen Automacao
/Users/greson/Documents/Aquecimento WhatsApp
```

Pastas recomendadas no Windows:

```text
C:\Codex\vitalismen-automacao
C:\Codex\aquecimento-whatsapp
```

## Rotina Segura Com Git

Antes de programar:

```bash
git status
git pull
```

Depois de programar:

```bash
git status
git diff
git add caminho/do/arquivo
git commit -m "descricao curta"
git push
```

No outro computador:

```bash
git pull
```

Nunca trabalhe nos dois computadores ao mesmo tempo no mesmo arquivo sem sincronizar.

## Nunca Versionar

```text
.env
.env.*
auth/
auth-*/
node_modules/
logs/
backups/
exports/
media/
*.sqlite
*.sqlite-shm
*.sqlite-wal
*.db
```

## Vitalismen

Local:

```text
/Users/greson/Documents/Vitalismen Automacao
```

VPS:

```text
/opt/vitalismen-automacao/current
```

Servico:

```bash
pm2 status vitalismen-automation
```

## Maxlien

VPS:

```text
/opt/maxlien-mvp/app.py
```

Servico:

```bash
systemctl status maxlien-mvp
```

Antes de alterar:

```bash
cp /opt/maxlien-mvp/app.py /root/codex_deploy_backups/app.py-$(date +%Y%m%d_%H%M%S)
```

Depois de alterar:

```bash
python3 -m py_compile /opt/maxlien-mvp/app.py
systemctl restart maxlien-mvp
systemctl is-active maxlien-mvp
```

## Aquecimento

Local:

```text
/Users/greson/Documents/Aquecimento WhatsApp
```

VPS:

```text
/opt/melhor-aquecimento-whatsapp
```

Ele foi baixado separado e sem arquivos sensiveis. Nao copiar sessoes WhatsApp dele para Vitalismen e nem da Vitalismen para ele.

## Forma Recomendada Para Usar Numeros Ja Conectados

Nao conectar os mesmos numeros em dois projetos.

Modelo certo:

```text
Aquecimento local
  -> API segura
Vitalismen/Gateway na VPS
  -> numeros ja conectados 2958/8416
```

Assim a VPS controla cotas, intervalo minimo, prioridade e historico.

Prioridade:

```text
1. Cliente real Vitalismen
2. Comprar depois
3. Pedido enviado / pos-venda
4. Aquecimento
```

## Proximo Passo Recomendado

Criar dois repositorios Git privados separados:

```text
vitalismen-automacao
aquecimento-whatsapp
```

Depois clonar no Windows e trabalhar sempre com `pull -> alterar -> testar -> commit -> push`.
