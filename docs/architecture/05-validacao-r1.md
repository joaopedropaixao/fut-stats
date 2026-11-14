# Validação da rodada 1

## Estado e escopo

- Revisão documental sobre a base inicial `024186f0cc935f3c835bd5e93e98e9a59654b37c`, analisada em 14/11/2026.
- QA3 aprovou C1–C5 e C7–C9. A única falha foi C6/A1: status `V/P` não definido e tipo de contrato confundido com componente visual.
- Correção aplicada em [A1 do catálogo](./04-requisitos-r1.md): prévia de convite consta como verificada (V), identificando separadamente UI, contrato e API. Conferência focada pelo coordenador/QA fresco pendente; apresentação ao dono pendente. Não aprovado pelo dono.
- Sem execução de API, banco, Docker ou testes da aplicação, conforme escopo documental.

## Evidência visual nativa

QA3 importou os arquivos `.excalidraw` completos por drag/drop na página Excalidraw do navegador Orca e inspecionou os pixels dos screenshots. Confirmou conteúdo correspondente à fonte, textos e setas legíveis, ausência de sobreposições e coerência de legenda. A prancha 03 tem pontas de setas que terminam antes dos nós de destino, mas indicam os ramos sem ambiguidade.

| Fonte | SHA-256 da fonte | Evidência | SHA-256 da evidência |
|---|---|---|---|
| [01-contexto-atores.excalidraw](./diagrams/01-contexto-atores.excalidraw) | `1a65dd77c8702d65b80c7b33c4903256c5439bef2661e01f8131703c07665676` | [01-contexto.png](../design/prints/revisao-arquitetura/qa3-01-contexto.png) | `5c77fd882858358a9f5132c2f61453769fa799422baea60dd703f3af11093db5` |
| [02-jornada-raias.excalidraw](./diagrams/02-jornada-raias.excalidraw) | `a11916bfb76ab3b9dba40551dc51fcfdcb71e5636c7b5e3c7a598394981f68eb` | [02-jornada.png](../design/prints/revisao-arquitetura/qa3-02-jornada.png) | `66819015dff925bbcb9fc9be173f4ccc740cf846528e4a555c3ec3ed04e64171` |
| [03-resultado-pessoal.excalidraw](./diagrams/03-resultado-pessoal.excalidraw) | `97ec374313cf6cc46e35506f059f1054bb07935a1fe9b58bf300ecd5e01d8aac` | [03-resultado.png](../design/prints/revisao-arquitetura/qa3-03-resultado.png) | `d0110f4a823d322d03457592310f355c01ff41e7cd14ad81ee408ea400c4fe4a` |

O relatório QA3 completo usado para a síntese está em `/tmp/fut-stats-arquitetura-qa3-relatorio.md`; esta tabela e o álbum são as evidências portáteis versionadas.

## Histórico

| Volta | Resultado | Tratamento |
|---|---|---|
| QA1 | C6 falhou (A11 já implementado classificado como H); C7 falhou (colisões e inspeção nativa pendente) | A11 passou a V, A12 separou auditoria futura, diagramas corrigidos. |
| QA2 | C1–C5/C8–C9 passaram; C6 falhou (status P para scout em jogo); C7 pendente (sem importação nativa pelo QA) | Diagrama 02 passou a distinguir jogo bloqueado e POST_MATCH por autoria, ambos V. |
| QA3 | C1–C5/C7–C9 passaram; C6/A1 falhou; audit-tree sem alterações do QA, salvo álbum autorizado | A1 corrigido; conferência focada pendente. QA3 importou os três arquivos nativos e salvou as evidências acima. |

Verificações após correção A1: links locais, hashes das fontes/prints, parse JSON e IDs únicos dos diagramas, `git diff --check`, status/diff limitados às áreas autorizadas.
