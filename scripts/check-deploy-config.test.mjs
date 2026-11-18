// A checagem de configuração (C9, C10, C14, C26) tem que passar nos arquivos de verdade e reclamar quando alguém
// estraga um deles. Roda com `node --test scripts/`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkAll,
  checkContactEmail,
  isReleaseRun,
  PRIVACY_CONTENT_PATH,
  checkProductionDomain,
  productionHostOf,
  DOMAIN_PLACEHOLDER,
  checkBackupWorkflow,
  checkDespertadorWorkflow,
  checkRender,
  checkVercel,
  parseRenderYaml,
  PROD_VERCEL_SAMPLE_HOSTS,
  routeApiHost,
  STAGING_SAMPLE_HOSTS,
  UNKNOWN_SAMPLE_HOSTS,
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
  it('C9 C10 C14 C26: a configuração do repositório passa nas checagens (fora da release)', () => {
    const { problems, warnings } = checkAll(ROOT, {});
    assert.deepEqual(problems, []);
    // Só podem avisar o marcador do domínio e o do e-mail de contato (os dois somem quando o dono preenche).
    for (const warning of warnings) {
      assert.ok(warning.includes(DOMAIN_PLACEHOLDER) || /e-mail de contato/.test(warning), warning);
    }
  });
});

describe('C33: e-mail de contato da Política de Privacidade', () => {
  const privacy = read(PRIVACY_CONTENT_PATH);
  const LINE = /^export const CONTACT_EMAIL(?::\s*string)?\s*=\s*[^;]+;/m;
  /** O arquivo de verdade com o valor do CONTACT_EMAIL trocado por `valor` (código, ex.: `'a@b.com'`). */
  const withValue = (valor) => {
    assert.ok(LINE.test(privacy), 'o arquivo deveria ter o export const CONTACT_EMAIL');
    return privacy.replace(LINE, `export const CONTACT_EMAIL: string = ${valor};`);
  };
  const placeholder = /^export const CONTACT_EMAIL_PLACEHOLDER\s*=\s*'(.*)';/m.exec(privacy)?.[1];

  it('C33: com o marcador, avisa fora da release e barra na release (PR para a main)', () => {
    for (const marcador of ['CONTACT_EMAIL_PLACEHOLDER', `'${placeholder}'`]) {
      const text = withValue(marcador);
      const fora = checkContactEmail(text);
      assert.deepEqual(fora.problems, []);
      assert.equal(fora.warnings.length, 1);
      const release = checkContactEmail(text, { release: true });
      assert.ok(has(release.problems, /marcador do e-mail de contato/));
    }
  });

  it('C33: com um e-mail de verdade passa, na release e fora dela, sem aviso', () => {
    const text = withValue(`'dono.da.pelada@exemplo.com'`);
    assert.deepEqual(checkContactEmail(text), { problems: [], warnings: [] });
    assert.deepEqual(checkContactEmail(text, { release: true }), { problems: [], warnings: [] });
  });

  it('C33: valor que não é e-mail é recusado', () => {
    for (const valor of [`'sem-arroba'`, `''`, `'a@b'`, 'OUTRA_CONSTANTE']) {
      assert.ok(has(checkContactEmail(withValue(valor)).problems, /tem que ser um e-mail/), valor);
    }
  });

  it('C33: release é PR para a main ou push na main; PR para a develop não é', () => {
    assert.equal(isReleaseRun({ GITHUB_BASE_REF: 'main' }), true);
    assert.equal(isReleaseRun({ GITHUB_REF_NAME: 'main' }), true);
    assert.equal(isReleaseRun({ GITHUB_BASE_REF: 'develop', GITHUB_REF_NAME: '78/merge' }), false);
    assert.equal(isReleaseRun({}), false);
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
  const PROD = 'https://fut-stats-api-2qh1.onrender.com/api/:path*';
  const STAGING = 'https://fut-stats-api-staging.onrender.com/api/:path*';

  it('C10: a configuração de verdade, com o domínio de hoje, com o marcador ou com outro domínio, passa', () => {
    assert.ok(realHost && !realHost.endsWith('.vercel.app'));
    assert.deepEqual(checkVercel(vercel(), realHost), []);
    assert.deepEqual(checkVercel(comMarcador(), DOMAIN_PLACEHOLDER), []);
    assert.deepEqual(checkVercel(comDominio(), host), []);
  });

  it('C10: o /api do domínio próprio e de todo host do projeto fut-stats-app (deploy único, git-main) vai para a produção', () => {
    for (const h of [realHost, ...PROD_VERCEL_SAMPLE_HOSTS]) {
      assert.equal(routeApiHost(vercel(), h), PROD, h);
    }
  });

  it('C10: o /api dos hosts do projeto de staging (fut-stats) vai para o staging, inclusive previews', () => {
    for (const h of STAGING_SAMPLE_HOSTS) assert.equal(routeApiHost(vercel(), h), STAGING, h);
  });

  it('C10: host desconhecido falha fechado: o /api não chega a API nenhuma (cai no index.html)', () => {
    for (const h of UNKNOWN_SAMPLE_HOSTS) assert.equal(routeApiHost(vercel(), h), 'index.html', h);
    // Nem um host que só contém o nome do projeto (a regra casa o host inteiro).
    assert.equal(routeApiHost(vercel(), 'x-fut-stats-app.vercel.app.evil.com'), 'index.html');
  });

  it('C10 (code review): a regra antiga, staging sem condição, mandava deploy único e git-main da produção para o staging', () => {
    const antiga = {
      rewrites: [
        { source: '/api/:path*', has: [{ type: 'host', value: realHost }], destination: PROD },
        {
          source: '/api/:path*',
          has: [{ type: 'host', value: 'fut-stats-app.vercel.app' }],
          destination: PROD,
        },
        { source: '/api/:path*', destination: STAGING },
        { source: '/(.*)', destination: '/index.html' },
      ],
    };
    const problems = checkVercel(antiga, realHost);
    assert.ok(has(problems, /fut-stats-app-a1b2c3d4e-.* deve ir para a produção/));
    assert.ok(has(problems, /fut-stats-app-git-main-.* deve ir para a produção/));
    assert.ok(has(problems, /host desconhecido \(exemplo\.com\.br\)/));
    assert.ok(has(problems, /toda regra de \/api tem condição de host/));
  });

  it('C10: sem a regra do domínio, com destino trocado ou com o index.html fora do fim é recusado', () => {
    const semDominio = comDominio();
    semDominio.rewrites.splice(0, 1);
    assert.ok(has(checkVercel(semDominio, host), /meupelada\.com\.br deve ir para a produção/));

    const hostDiferente = comDominio();
    assert.ok(
      has(checkVercel(hostDiferente, 'outro.com.br'), /outro\.com\.br deve ir para a produção/),
    );

    const destino = comDominio();
    destino.rewrites[0].destination = STAGING;
    assert.ok(has(checkVercel(destino, host), /meupelada\.com\.br deve ir para a produção/));

    const estranho = comDominio();
    estranho.rewrites[1].destination = 'https://outra-api.example.com/api/:path*';
    assert.ok(has(checkVercel(estranho, host), /destino de \/api desconhecido/));

    const indexNoMeio = comDominio();
    indexNoMeio.rewrites.reverse();
    assert.ok(has(checkVercel(indexNoMeio, host), /index\.html deve ser a última/));

    const stagingSemCondicao = comDominio();
    delete stagingSemCondicao.rewrites[2].has;
    assert.ok(has(checkVercel(stagingSemCondicao, host), /host desconhecido/));
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
    // O vercel.json de verdade tem o host de hoje; com o do render.yaml trocado, o /api do novo não vai para a produção.
    assert.ok(has(checkVercel(vercel(), emRender), /meupelada\.com\.br deve ir para a produção/));
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
