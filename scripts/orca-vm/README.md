# Ambiente pessoal isolado

Imagem local `fut-stats-personal-base`. Sem mounts, socket Docker ou encaminhamento de SSH agent. Autenticar Claude, Codex e GitHub dentro do container, somente com contas pessoais. Não copiar o home do host.

O container de autenticação é preservado até o login interativo terminar. A receita final só deve usar a imagem autenticada após conferir a identidade GitHub `joaopedropaixao`. Nunca publicar essa imagem: ela contém credenciais pessoais.

## Uso no Orca

Após integrar `orca.yaml` e estes scripts ao checkout principal do projeto, habilitar Cloud VM em Settings → Experimental. Criar um workspace e escolher Personal Docker em Run on. Workspaces locais existentes não são migrados.

`create.sh` usa somente a imagem local `fut-stats-personal-authenticated`, confirma o usuário GitHub e clona exclusivamente `joaopedropaixao/fut-stats`. A receita não herda tokens do host (`passEnv: []`). Chaves de conexão ficam em `.orca-personal/`, ignorada pelo Git. `destroy.sh` recusa remover containers com mudanças ou commits não enviados. Containers parados precisam ser iniciados para essa verificação.

O login pode expirar: reautenticar no container de autenticação e salvar novamente a imagem. Não publicar imagens autenticadas em registries. A conectividade com serviços do host e ferramentas como Paper precisa de configuração específica; a receita não concede acesso ao Docker socket.
