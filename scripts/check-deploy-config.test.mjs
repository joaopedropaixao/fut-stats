// A checagem de configuração (C9, C10, C14, C26) tem que passar nos arquivos de verdade e reclamar quando alguém
// estraga um deles. Roda com `node --test scripts/`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkAll,
  checkBackupWorkflow,
  checkDespertadorWorkflow,
  checkRender,
  checkVercel,
  parseRenderYaml,
} from './check-deploy-config.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const render = read('render.yaml');
const vercel = () => JSON.parse(read('apps/web/vercel.json'));
const backup = read('.github/workflows/backup.yml');
const despertador = read('.github/workflows/despertador.yml');

/** Troca `de` por `para` e garante que a troca aconteceu (o teste não pode passar à toa). */
function mutate(text, de, para) {
  assert.ok(text.includes(de), `o trecho "${de}" deveria existir`);
  return text.replace(de, para);
}

const has = (problems, pattern) => problems.some((problem) => pattern.test(problem));

describe('arquivos de verdade', () => {
  it('C9 C10 C14 C26: a configuração do repositório passa nas checagens', () => {
    assert.deepEqual(checkAll(ROOT), []);
  });
});

describe('C9: render.yaml', () => {
  it('C9: lê os dois serviços e as variáveis de cada um', () => {
    const services = parseRenderYaml(render);
    assert.deepEqual(
      services.map((s) => [s.name, s.branch]),
      [
        ['fut-stats-api-staging', 'develop'],
        ['fut-stats-api', 'main'],
      ],
    );
    assert.ok(services.every((s) => s.healthCheckPath === '/api/health'));
  });

  it('C9: produção sem TICK_SECRET, com valor nele ou com o relógio ligado é recusada', () => {
    const semTick = mutate(render, '      - key: TICK_SECRET\n        sync: false\n', '');
    assert.ok(has(checkRender(semTick), /falta TICK_SECRET/));

    const comValor = mutate(
      render,
      '      - key: TICK_SECRET\n        sync: false',
      '      - key: TICK_SECRET\n        value: abc',
    );
    assert.ok(has(checkRender(comValor), /TICK_SECRET/));

    const relogio = mutate(render, "value: '0'", "value: '60000'");
    assert.ok(has(checkRender(relogio), /VOTING_CLOSER_INTERVAL_MS deve ser 0/));
  });

  it('C9: staging com TICK_SECRET é recusado', () => {
    const [staging] = render.split('\n  - type: web\n    name: fut-stats-api\n');
    const comTick = mutate(
      render,
      '      - key: SENTRY_ENVIRONMENT\n        value: staging\n',
      '      - key: SENTRY_ENVIRONMENT\n        value: staging\n      - key: TICK_SECRET\n        sync: false\n',
    );
    assert.ok(staging.length < render.length);
    assert.ok(has(checkRender(comTick), /staging\): não deve ter TICK_SECRET/));
  });

  it('C9: segredo escrito no arquivo é recusado', () => {
    const vazado = mutate(
      render,
      '      - key: GOOGLE_CLIENT_SECRET\n        sync: false',
      '      - key: GOOGLE_CLIENT_SECRET\n        value: GOCSPX-abc',
    );
    assert.ok(has(checkRender(vazado), /GOOGLE_CLIENT_SECRET tem valor escrito/));
  });

  it('C9: variável obrigatória faltando, endereço errado e branch trocada são recusados', () => {
    const semDsn = mutate(render, '      - key: SENTRY_DSN\n        sync: false\n', '');
    assert.ok(has(checkRender(semDsn), /falta a variável SENTRY_DSN/));

    const semVapid = mutate(render, '      - key: VAPID_SUBJECT\n        sync: false\n', '');
    assert.ok(has(checkRender(semVapid), /falta a variável VAPID_SUBJECT/));

    const url = mutate(
      render,
      'value: https://fut-stats-app.vercel.app',
      'value: https://outro.vercel.app',
    );
    assert.ok(has(checkRender(url), /APP_URL deve ser https:\/\/fut-stats-app\.vercel\.app/));

    const branch = mutate(render, 'branch: main', 'branch: develop');
    assert.ok(has(checkRender(branch), /produção deve buildar a branch main/));

    const semHealth = mutate(render, '    healthCheckPath: /api/health\n', '');
    assert.ok(has(checkRender(semHealth), /falta healthCheckPath/));
  });

  it('C9: só um serviço é recusado', () => {
    const [primeiro] = render.split('\n  - type: web\n    name: fut-stats-api\n');
    assert.ok(has(checkRender(primeiro), /esperava 2 serviços/));
  });
});

describe('C10: vercel.json', () => {
  it('C10: sem a regra por host, com destino trocado ou com o index.html fora do fim é recusado', () => {
    const semHost = vercel();
    delete semHost.rewrites[0].has;
    assert.ok(has(checkVercel(semHost), /type host/));

    const destino = vercel();
    destino.rewrites[0].destination = 'https://fut-stats-api-staging.onrender.com/api/:path*';
    assert.ok(has(checkVercel(destino), /\/api de produção deve ir para/));

    const hostErrado = vercel();
    hostErrado.rewrites[0].has[0].value = 'fut-stats-three.vercel.app';
    assert.ok(has(checkVercel(hostErrado), /type host/));

    const indexNoMeio = vercel();
    indexNoMeio.rewrites.reverse();
    assert.ok(has(checkVercel(indexNoMeio), /index\.html deve ser a última/));

    const stagingComCondicao = vercel();
    stagingComCondicao.rewrites[1].has = [{ type: 'host', value: 'x' }];
    assert.ok(has(checkVercel(stagingComCondicao), /staging não pode ter condição/));
  });
});

describe('C14: backup.yml', () => {
  it('C14: sem agenda diária, sem dispatch, sem retenção de 30 dias ou com segredo no log é recusado', () => {
    assert.ok(
      has(checkBackupWorkflow(mutate(backup, "cron: '0 6 * * *'", "cron: '0 * * * *'")), /diário/),
    );
    assert.ok(
      has(checkBackupWorkflow(mutate(backup, '  workflow_dispatch:\n', '')), /workflow_dispatch/),
    );
    assert.ok(
      has(
        checkBackupWorkflow(mutate(backup, 'retention-days: 30', 'retention-days: 90')),
        /retention-days: 30/,
      ),
    );
    assert.ok(
      has(
        checkBackupWorkflow(mutate(backup, 'secrets.PROD_DIRECT_URL', 'secrets.OUTRO')),
        /PROD_DIRECT_URL/,
      ),
    );
    assert.ok(has(checkBackupWorkflow(mutate(backup, 'set -eu', 'set -eux')), /set -x/));
    assert.ok(
      has(
        checkBackupWorkflow(
          mutate(backup, 'set -eu\n', 'set -eu\n          echo "$BACKUP_PASSPHRASE"\n'),
        ),
        /imprime um segredo/,
      ),
    );
  });
});

describe('C26: despertador.yml', () => {
  it('C26: agenda errada, curl sem retry ou com segredo no log é recusado', () => {
    assert.ok(
      has(checkDespertadorWorkflow(mutate(despertador, '*/30 * * * *', '*/15 * * * *')), /\*\/30/),
    );
    assert.ok(
      has(
        checkDespertadorWorkflow(mutate(despertador, '  workflow_dispatch:\n', '')),
        /workflow_dispatch/,
      ),
    );
    assert.ok(has(checkDespertadorWorkflow(mutate(despertador, '--retry 1 ', '')), /--retry 1/));
    assert.ok(
      has(
        checkDespertadorWorkflow(mutate(despertador, '--retry-all-errors', '')),
        /--retry-all-errors/,
      ),
    );
    assert.ok(
      has(
        checkDespertadorWorkflow(mutate(despertador, '--max-time 120', '--max-time 10')),
        /--max-time 120/,
      ),
    );
    assert.ok(has(checkDespertadorWorkflow(mutate(despertador, '--fail', '')), /--fail/));
    assert.ok(
      has(
        checkDespertadorWorkflow(mutate(despertador, 'secrets.PROD_TICK_URL', 'secrets.X')),
        /PROD_TICK_URL/,
      ),
    );
    assert.ok(has(checkDespertadorWorkflow(mutate(despertador, 'set -eu', 'set -eux')), /set -x/));
    assert.ok(
      has(
        checkDespertadorWorkflow(
          mutate(despertador, 'set -eu\n', 'set -eu\n          echo "$TICK_SECRET"\n'),
        ),
        /imprime um segredo/,
      ),
    );
    assert.ok(
      has(checkDespertadorWorkflow(mutate(despertador, '--silent', '--verbose')), /verbose/),
    );
  });
});
