// A checagem de configuração (C9, C10, C14, C26) tem que passar nos arquivos de verdade e reclamar quando alguém
// estraga um deles. Roda com `node --test scripts/`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkAll,
  checkProductionDomain,
  productionHostOf,
  DOMAIN_PLACEHOLDER,
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
    const { problems, warnings } = checkAll(ROOT);
    assert.deepEqual(problems, []);
    // Enquanto o domínio não foi comprado o marcador gera um aviso (e só ele); depois da troca, nenhum.
    assert.ok(
      warnings.length === 0 || (warnings.length === 1 && warnings[0].includes(DOMAIN_PLACEHOLDER)),
    );
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

  it('C9: variável obrigatória faltando e branch trocada são recusados', () => {
    const semDsn = mutate(render, '      - key: SENTRY_DSN\n        sync: false\n', '');
    assert.ok(has(checkRender(semDsn), /falta a variável SENTRY_DSN/));

    const semVapid = mutate(render, '      - key: VAPID_SUBJECT\n        sync: false\n', '');
    assert.ok(has(checkRender(semVapid), /falta a variável VAPID_SUBJECT/));

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

// Os testes não dependem do domínio escolhido: o host é o que está no render.yaml de verdade, e as variantes (com o
// marcador, com outro domínio) saem dele por troca de texto.
const realHost = productionHostOf(render);
const OTHER = 'meupelada.com.br';
const swapHost = (text, from, to) => text.replaceAll(from, to);

describe('C10: vercel.json', () => {
  const host = OTHER;
  /** O vercel.json de verdade, com o host de produção trocado por `host` (o que o R0 faz com o marcador). */
  const comDominio = () => JSON.parse(swapHost(JSON.stringify(vercel()), realHost, host));
  const comMarcador = () =>
    JSON.parse(swapHost(JSON.stringify(vercel()), realHost, DOMAIN_PLACEHOLDER));

  it('C10: a configuração de verdade, com o domínio de hoje, com o marcador ou com outro domínio, passa', () => {
    assert.ok(realHost && !realHost.endsWith('.vercel.app'));
    assert.deepEqual(checkVercel(vercel(), realHost), []);
    assert.deepEqual(checkVercel(comMarcador(), DOMAIN_PLACEHOLDER), []);
    assert.deepEqual(checkVercel(comDominio(), host), []);
  });

  it('C10: produção vale para o domínio próprio e para o endereço padrão da Vercel, antes do staging', () => {
    const rules = vercel().rewrites.filter((rule) => rule.source === '/api/:path*');
    assert.deepEqual(
      rules.map((rule) => [rule.has?.[0]?.value, rule.destination]),
      [
        [realHost, 'https://fut-stats-api.onrender.com/api/:path*'],
        ['fut-stats-app.vercel.app', 'https://fut-stats-api.onrender.com/api/:path*'],
        [undefined, 'https://fut-stats-api-staging.onrender.com/api/:path*'],
      ],
    );
  });

  it('C10: sem a regra de um dos hosts, com destino trocado ou com o index.html fora do fim é recusado', () => {
    const semDominio = comDominio();
    semDominio.rewrites.splice(0, 1);
    assert.ok(
      has(checkVercel(semDominio, host), /esperava as regras|falta a regra .* host meupelada/),
    );

    const semVercelApp = comDominio();
    semVercelApp.rewrites.splice(1, 1);
    assert.ok(
      has(checkVercel(semVercelApp, host), /esperava as regras|fut-stats-app\.vercel\.app/),
    );

    const hostDiferente = comDominio();
    assert.ok(has(checkVercel(hostDiferente, 'outro.com.br'), /falta a regra .* outro\.com\.br/));
    assert.ok(has(checkVercel(hostDiferente, 'outro.com.br'), /host que não é o de produção/));

    const semHas = comDominio();
    delete semHas.rewrites[0].has;
    assert.ok(has(checkVercel(semHas, host), /um único type host/));

    const destino = comDominio();
    destino.rewrites[0].destination = 'https://fut-stats-api-staging.onrender.com/api/:path*';
    assert.ok(has(checkVercel(destino, host), /\/api de produção deve ir para/));

    const indexNoMeio = comDominio();
    indexNoMeio.rewrites.reverse();
    assert.ok(has(checkVercel(indexNoMeio, host), /index\.html deve ser a última/));

    const stagingComCondicao = comDominio();
    stagingComCondicao.rewrites[2].has = [{ type: 'host', value: 'x' }];
    assert.ok(has(checkVercel(stagingComCondicao, host), /staging não pode ter condição/));
  });
});

describe('domínio de produção (APP_URL do render.yaml)', () => {
  const comUrl = (url) => mutate(render, `value: https://${realHost}`, `value: ${url}`);
  const comMarcador = swapHost(render, realHost, DOMAIN_PLACEHOLDER);

  it('o domínio de hoje não avisa nem reclama', () => {
    assert.deepEqual(checkProductionDomain(render), { problems: [], warnings: [] });
  });

  it('com o marcador, só avisa (não falha o pnpm test), em voz alta', () => {
    const { problems, warnings } = checkProductionDomain(comMarcador);
    assert.deepEqual(problems, []);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes(`produção ainda com ${DOMAIN_PLACEHOLDER}`));
    assert.match(warnings[0], /trocar pelo domínio comprado antes da release/);
    assert.equal(productionHostOf(comMarcador), DOMAIN_PLACEHOLDER);
  });

  it('com outro domínio próprio, não avisa nem reclama', () => {
    assert.deepEqual(checkProductionDomain(comUrl(`https://${OTHER}`)), {
      problems: [],
      warnings: [],
    });
  });

  it('*.vercel.app como domínio de produção é recusado (o Google não aceita)', () => {
    const { problems } = checkProductionDomain(comUrl('https://fut-stats-app.vercel.app'));
    assert.ok(has(problems, /\*\.vercel\.app/));
  });

  it('APP_URL com caminho, http ou host inválido é recusado', () => {
    for (const url of [`https://${OTHER}/app`, `http://${OTHER}`, 'https://nome sem ponto']) {
      assert.ok(checkProductionDomain(comUrl(url)).problems.length > 0, url);
    }
    assert.ok(has(checkProductionDomain(comUrl('https://semponto')).problems, /host inválido/));
  });

  it('o host do vercel.json tem que ser o do APP_URL de produção', () => {
    const emRender = productionHostOf(comUrl(`https://${OTHER}`));
    assert.equal(emRender, OTHER);
    // O vercel.json de verdade tem o host de hoje; com o do render.yaml trocado, ele destoa.
    assert.ok(has(checkVercel(vercel(), emRender), /falta a regra .* meupelada\.com\.br/));
    assert.ok(
      has(
        checkVercel(vercel(), emRender),
        new RegExp(`host que não é o de produção \\(${realHost.replaceAll('.', '\\.')}\\)`),
      ),
    );
  });
});

describe('C14 e C26: segredo nunca vai para o log (QA volta 1)', () => {
  const leaks = [
    [
      '- run: de uma linha com secrets.BACKUP_PASSPHRASE',
      '      - run: echo "${{ secrets.BACKUP_PASSPHRASE }}"',
    ],
    ['- run: de uma linha com secrets.TICK_SECRET', '      - run: echo ${{ secrets.TICK_SECRET }}'],
    [
      'secrets.X dentro de um bloco run',
      '      - run: |\n          curl -H "x: ${{ secrets.TICK_SECRET }}" https://x',
    ],
    ['echo do $TICK_SECRET', '          echo "$TICK_SECRET"'],
    ['echo da ${BACKUP_PASSPHRASE}', '          echo ${BACKUP_PASSPHRASE}'],
    ['printf do segredo', '          printf "%s" "$TICK_SECRET"'],
    ['cat do segredo', '          cat <<< "$BACKUP_PASSPHRASE"'],
    ['tee do segredo', '          printf %s "$TICK_SECRET" | tee /tmp/x'],
    ['redirecionamento do segredo', '          echo x; true "$TICK_SECRET" > /tmp/segredo'],
    ['set -x', '          set -x'],
    ['printenv com o nome do segredo', '          printenv TICK_SECRET'],
    ['env com o nome do segredo', '          env | grep BACKUP_PASSPHRASE'],
    ['printenv de um segredo numa linha só', '      - run: printenv BACKUP_PASSPHRASE'],
    ['shell: bash -x num passo', '      - shell: bash -x {0}\n        run: true'],
    ['bash -x chamando o script', '          bash -x scripts/backup-db.sh'],
    ['defaults.run.shell com -x', '    defaults:\n      run:\n        shell: bash -eux {0}'],
    ['bash -x via xtrace', '          set -o xtrace'],
  ];
  const withLine = (text, line) => text.replace(/\n    steps:\n/, `\n    steps:\n${line}\n`);

  for (const [name, text, check] of [
    ['backup.yml', backup, checkBackupWorkflow],
    ['despertador.yml', despertador, checkDespertadorWorkflow],
  ]) {
    for (const [what, line] of leaks) {
      it(`${name}: ${what} é recusado`, () => {
        const mutated = withLine(text, line);
        assert.notEqual(mutated, text);
        assert.ok(check(mutated).length > 0, `deveria recusar: ${line.trim()}`);
      });
    }
    it(`${name}: o arquivo de verdade (segredo só em env: e usado como variável) passa`, () => {
      assert.deepEqual(check(text), []);
    });
  }
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
        /imprime ou redireciona um segredo/,
      ),
    );
    assert.ok(
      has(checkDespertadorWorkflow(mutate(despertador, '--silent', '--verbose')), /verbose/),
    );
  });
});
