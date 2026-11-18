// Primeiro import do main.ts (efeito colateral de propósito): os arquivos de ambiente entram no `process.env` antes de
// o `AppModule` ser montado e antes de o Sentry ligar. Sem isto, `TICK_SECRET` e `SENTRY_DSN` do arquivo local eram
// ignorados (o `ConfigModule` só lê os arquivos depois), e o local se comportava diferente do Render.
import { loadEnvFiles, repositoryRoot } from './config/load-env-files';

loadEnvFiles(repositoryRoot());
