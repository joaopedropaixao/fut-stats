// Confere a configuração de deploy (C9, C10, C14 e C26 do spec `producao`): render.yaml, apps/web/vercel.json e os
// workflows backup.yml e despertador.yml. Sem dependência: o YAML é lido como texto, com regras simples para o formato
// que esses arquivos usam. Roda no `pnpm test` da raiz: `node scripts/check-deploy-config.mjs`.
// Cada função de checagem devolve a lista de problemas (vazia = ok), em português.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Marcador do domínio próprio de produção: vale até o dono comprar o nome (docs/deploy.md, R0). */
// Montado em pedaços de propósito: o comando de troca do R0 (docs/deploy.md) não pode reescrever esta constante.
export const DOMAIN_PLACEHOLDER = `<${'DOMINIO'}>`;
/** Endereço padrão do projeto de produção na Vercel: continua existindo e também precisa ir para a API de produção. */
export const PROD_VERCEL_HOST = 'fut-stats-app.vercel.app';
const STAGING_SERVICE = 'fut-stats-api-staging';
const PROD_SERVICE = 'fut-stats-api';

/** Variáveis que o Render precisa conhecer nos dois serviços. */
const REQUIRED_VARS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'APP_URL',
  'SENTRY_DSN',
  'SENTRY_ENVIRONMENT',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
];
/** Só estas podem ter `value:` escrito no arquivo; todas as outras são segredo (`sync: false` ou `generateValue`). */
const PLAIN_VALUE_VARS = new Set(['APP_URL', 'SENTRY_ENVIRONMENT', 'VOTING_CLOSER_INTERVAL_MS']);

const unquote = (value) => value.replace(/^(['"])(.*)\1$/, '$2').trim();
const stripComment = (line) => line.replace(/(^|\s)#.*$/, '');

/**
 * Lê o `render.yaml` no formato usado aqui: `services:` com itens `  - type: web`, chaves simples com 4 espaços e
 * `envVars:` com itens `      - key: X` seguidos de `value`, `sync` ou `generateValue` (8 espaços).
 */
export function parseRenderYaml(text) {
  const services = [];
  let service = null;
  let envVar = null;
  let inEnvVars = false;
  let inBuildFilter = false;
  for (const raw of text.split('\n')) {
    const line = stripComment(raw).replace(/\s+$/, '');
    if (!line.trim()) continue;
    if (/^ {2}- /.test(line)) {
      service = { envVars: [], buildFilterPaths: [] };
      services.push(service);
      envVar = null;
      inEnvVars = false;
      inBuildFilter = false;
      const [key, ...rest] = line.slice(4).split(':');
      service[key.trim()] = unquote(rest.join(':'));
      continue;
    }
    if (!service) continue;
    let match;
    if ((match = /^ {4}(\w+):\s*(.*)$/.exec(line))) {
      inEnvVars = match[1] === 'envVars';
      inBuildFilter = match[1] === 'buildFilter';
      envVar = null;
      if (!inEnvVars && !inBuildFilter) service[match[1]] = unquote(match[2]);
      continue;
    }
    if (inEnvVars && (match = /^ {6}- (\w+):\s*(.*)$/.exec(line))) {
      envVar = { [match[1]]: unquote(match[2]) };
      service.envVars.push(envVar);
      continue;
    }
    if (inEnvVars && envVar && (match = /^ {8}(\w+):\s*(.*)$/.exec(line))) {
      envVar[match[1]] = unquote(match[2]);
      continue;
    }
    if (inBuildFilter && (match = /^ {8}- (.*)$/.exec(line))) {
      service.buildFilterPaths.push(unquote(match[1]));
    }
  }
  return services;
}

const envVarOf = (service, key) => service.envVars.find((item) => item.key === key);

/** C9: render.yaml. */
export function checkRender(text) {
  const problems = [];
  const services = parseRenderYaml(text);
  if (services.length !== 2) {
    return [`render.yaml: esperava 2 serviços (staging e produção) e achei ${services.length}`];
  }
  const staging = services.find((service) => service.name === STAGING_SERVICE);
  const production = services.find((service) => service.name === PROD_SERVICE);
  if (!staging) problems.push(`render.yaml: falta o serviço ${STAGING_SERVICE}`);
  if (!production) problems.push(`render.yaml: falta o serviço ${PROD_SERVICE}`);
  if (!staging || !production) return problems;

  if (staging.branch !== 'develop')
    problems.push('render.yaml: o staging deve buildar a branch develop');
  if (production.branch !== 'main')
    problems.push('render.yaml: a produção deve buildar a branch main');

  for (const service of [staging, production]) {
    const label = `render.yaml (${service.name})`;
    if (service.plan !== 'free') problems.push(`${label}: o plano deve ser free`);
    if (service.healthCheckPath !== '/api/health')
      problems.push(`${label}: falta healthCheckPath: /api/health`);
    if (!service.buildCommand?.includes('db:deploy'))
      problems.push(`${label}: o build deve rodar as migrations (db:deploy)`);
    if (!service.startCommand) problems.push(`${label}: falta startCommand`);
    for (const key of REQUIRED_VARS) {
      if (!envVarOf(service, key)) problems.push(`${label}: falta a variável ${key}`);
    }
    for (const item of service.envVars) {
      if (item.value !== undefined && !PLAIN_VALUE_VARS.has(item.key)) {
        problems.push(
          `${label}: ${item.key} tem valor escrito no arquivo (segredo vai com sync: false)`,
        );
      }
      if (item.value === undefined && item.sync !== 'false' && item.generateValue !== 'true') {
        problems.push(`${label}: ${item.key} sem value, sync: false nem generateValue`);
      }
    }
    if (envVarOf(service, 'JWT_SECRET')?.generateValue !== 'true') {
      problems.push(`${label}: JWT_SECRET deve usar generateValue: true`);
    }
    for (const key of REQUIRED_VARS.filter(
      (k) => !['JWT_SECRET', ...PLAIN_VALUE_VARS].includes(k),
    )) {
      if (envVarOf(service, key) && envVarOf(service, key).sync !== 'false') {
        problems.push(`${label}: ${key} deve ser sync: false`);
      }
    }
  }

  if (envVarOf(production, 'SENTRY_ENVIRONMENT')?.value !== 'production') {
    problems.push('render.yaml (produção): SENTRY_ENVIRONMENT deve ser production');
  }
  if (envVarOf(staging, 'SENTRY_ENVIRONMENT')?.value !== 'staging') {
    problems.push('render.yaml (staging): SENTRY_ENVIRONMENT deve ser staging');
  }
  const tick = envVarOf(production, 'TICK_SECRET');
  if (!tick) problems.push('render.yaml (produção): falta TICK_SECRET');
  else if (tick.sync !== 'false' || tick.value !== undefined) {
    problems.push('render.yaml (produção): TICK_SECRET deve ser sync: false, sem valor');
  }
  if (envVarOf(production, 'VOTING_CLOSER_INTERVAL_MS')?.value !== '0') {
    problems.push(
      'render.yaml (produção): VOTING_CLOSER_INTERVAL_MS deve ser 0 (o despertador fecha as votações)',
    );
  }
  if (envVarOf(staging, 'TICK_SECRET'))
    problems.push('render.yaml (staging): não deve ter TICK_SECRET (despertador só em produção)');
  if (envVarOf(staging, 'VOTING_CLOSER_INTERVAL_MS')?.value === '0') {
    problems.push(
      'render.yaml (staging): o relógio interno deve seguir ligado (sem VOTING_CLOSER_INTERVAL_MS=0)',
    );
  }
  return problems;
}

/** O host do `APP_URL` de produção no `render.yaml` (ou `undefined` se não der para ler). */
export function productionHostOf(renderText) {
  const production = parseRenderYaml(renderText).find((service) => service.name === PROD_SERVICE);
  const url = production && envVarOf(production, 'APP_URL')?.value;
  return /^https:\/\/([^/]+)$/.exec(url ?? '')?.[1];
}

/**
 * Domínio de produção: `APP_URL` do `render.yaml` sem caminho, em https, e que não seja `*.vercel.app` (o Google não
 * aceita esse domínio como autorizado). Com o marcador `<DOMINIO>` ainda lá, só avisa (a troca é no R0 do roteiro).
 */
export function checkProductionDomain(renderText) {
  const problems = [];
  const warnings = [];
  const production = parseRenderYaml(renderText).find((service) => service.name === PROD_SERVICE);
  const url = production && envVarOf(production, 'APP_URL')?.value;
  const host = productionHostOf(renderText);
  if (!host) {
    problems.push('render.yaml (produção): APP_URL deve ser https://<domínio>, sem caminho');
  } else if (host === DOMAIN_PLACEHOLDER) {
    warnings.push(
      `produção ainda com ${DOMAIN_PLACEHOLDER}: trocar pelo domínio comprado antes da release (R0 em docs/deploy.md)`,
    );
  } else if (host.endsWith('.vercel.app')) {
    problems.push(
      `render.yaml (produção): APP_URL ${url} é *.vercel.app; produção precisa de domínio próprio (o Google não aceita *.vercel.app)`,
    );
  } else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    problems.push(`render.yaml (produção): APP_URL com host inválido (${host})`);
  }
  return { problems, warnings };
}

/**
 * C10: vercel.json. `primaryHost` é o host de produção (o do `APP_URL` do `render.yaml`): as regras de produção, com
 * `has` de host, vêm antes da do staging e cobrem esse host e o endereço padrão do projeto (`fut-stats-app.vercel.app`).
 */
export function checkVercel(json, primaryHost) {
  const problems = [];
  const rewrites = Array.isArray(json.rewrites) ? json.rewrites : [];
  const apiRules = rewrites.filter((rule) => rule.source === '/api/:path*');
  if (apiRules.length < 3) {
    problems.push(
      'vercel.json: esperava as regras de /api/:path* de produção (uma por host) e a do staging, por último',
    );
    return problems;
  }
  const prodRules = apiRules.slice(0, -1);
  const stagingRule = apiRules.at(-1);
  const hosts = new Set();
  for (const rule of prodRules) {
    const conditions = rule.has ?? [];
    if (conditions.length !== 1 || conditions[0].type !== 'host' || !conditions[0].value) {
      problems.push('vercel.json: cada regra de /api de produção deve ter has: um único type host');
    } else {
      hosts.add(conditions[0].value);
    }
    if (rule.destination !== `https://${PROD_SERVICE}.onrender.com/api/:path*`) {
      problems.push(
        `vercel.json: o /api de produção deve ir para https://${PROD_SERVICE}.onrender.com/api/:path*`,
      );
    }
  }
  const expected = [primaryHost, PROD_VERCEL_HOST].filter(Boolean);
  for (const host of expected) {
    if (!hosts.has(host))
      problems.push(`vercel.json: falta a regra de /api de produção para o host ${host}`);
  }
  for (const host of hosts) {
    if (!expected.includes(host)) {
      problems.push(
        `vercel.json: regra de /api de produção para um host que não é o de produção (${host})`,
      );
    }
  }
  if (stagingRule.has) {
    problems.push(
      'vercel.json: a regra do staging não pode ter condição (é o padrão) e vem depois das de produção',
    );
  }
  if (stagingRule.destination !== `https://${STAGING_SERVICE}.onrender.com/api/:path*`) {
    problems.push(
      `vercel.json: o /api padrão deve ir para https://${STAGING_SERVICE}.onrender.com/api/:path*`,
    );
  }
  const last = rewrites.at(-1);
  if (last?.source !== '/(.*)' || last?.destination !== '/index.html') {
    problems.push('vercel.json: a regra do index.html deve ser a última');
  }
  return problems;
}

/** Todo segredo dos workflows: nenhum pode ser impresso, em nenhum dos dois arquivos. */
const ALL_SECRETS = [
  'TICK_SECRET',
  'PROD_TICK_URL',
  'BACKUP_PASSPHRASE',
  'DIRECT_URL',
  'PROD_DIRECT_URL',
];

/**
 * Procura jeitos de imprimir segredo no log. Duas regras, valendo para qualquer linha (inclusive `- run:` de uma linha e
 * blocos `run: |`):
 * 1. `secrets.X` só pode aparecer como valor de uma chave (`env:`/`with:`), nunca dentro de um comando: o segredo passa
 *    por variável de ambiente e o script o usa como `$NOME`;
 * 2. uma linha que usa `$NOME` (ou `${NOME}`) de um segredo não pode imprimir (`echo`, `printf`, `cat`, `tee`), redirecionar
 *    (`>`, `>>`) nem ligar o eco de comandos (`set -x`, `xtrace`).
 */
function secretLeaks(text, secrets) {
  const problems = [];
  if (/^\s*(-\s*run:\s*)?set\s+-\w*x/m.test(text) || /xtrace/.test(text)) {
    problems.push('liga o eco dos comandos (`set -x`), que imprimiria os segredos');
  }
  if (/\bcurl\b[^\n]*\s(-v|--verbose|-vv)\b/.test(text)) problems.push('usa curl --verbose');
  if (/^\s*(-\s*run:\s*)?(printenv|env)\s*([|>]|$)/m.test(text))
    problems.push('imprime o ambiente');
  if (/ACTIONS_STEP_DEBUG|ACTIONS_RUNNER_DEBUG/.test(text))
    problems.push('liga o debug do Actions');
  const asValue = /^\s*-?\s*[\w-]+:\s*\$\{\{\s*secrets\.\w+\s*\}\}\s*$/;
  const printing = /(^|[\s;&|(`])(echo|printf|cat|tee)(\s|$)|>|\bset\s+-\w*x/;
  for (const line of text.split('\n')) {
    const code = line.replace(/^\s*#.*$/, '');
    if (/secrets\.\w+/.test(code) && !asValue.test(code)) {
      problems.push(`usa segredo direto no comando (passe por env:): ${line.trim()}`);
    }
    const mentions = secrets.some((name) => new RegExp(`\\$(\\{${name}\\}|${name}\\b)`).test(code));
    if (mentions && printing.test(code)) {
      problems.push(`imprime ou redireciona um segredo: ${line.trim()}`);
    }
  }
  return problems;
}

const cronOf = (text) => [...text.matchAll(/^\s*-\s*cron:\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);

/** C14: backup.yml. */
export function checkBackupWorkflow(text) {
  const problems = [];
  const crons = cronOf(text);
  if (crons.length !== 1 || !/^\d+ \d+ \* \* \*$/.test(crons[0]))
    problems.push('backup.yml: o agendamento deve ser diário (cron "M H * * *")');
  if (!/^\s*workflow_dispatch:/m.test(text)) problems.push('backup.yml: falta workflow_dispatch');
  for (const name of ['PROD_DIRECT_URL', 'BACKUP_PASSPHRASE']) {
    if (!text.includes(`secrets.${name}`))
      problems.push(`backup.yml: falta usar o segredo ${name}`);
  }
  if (!/uses:\s*actions\/upload-artifact@/.test(text))
    problems.push('backup.yml: falta actions/upload-artifact');
  if (!/^\s*retention-days:\s*30\s*$/m.test(text))
    problems.push('backup.yml: o artefato deve ter retention-days: 30');
  if (!text.includes('postgresql-client-17'))
    problems.push('backup.yml: instale o cliente do PostgreSQL 17 (a versão do Neon)');
  for (const leak of secretLeaks(text, ALL_SECRETS)) {
    problems.push(`backup.yml: ${leak}`);
  }
  return problems;
}

/** C26: despertador.yml. */
export function checkDespertadorWorkflow(text) {
  const problems = [];
  const crons = cronOf(text);
  if (crons.length !== 1 || crons[0] !== '*/30 * * * *')
    problems.push('despertador.yml: o agendamento deve ser "*/30 * * * *"');
  if (!/^\s*workflow_dispatch:/m.test(text))
    problems.push('despertador.yml: falta workflow_dispatch');
  for (const name of ['PROD_TICK_URL', 'TICK_SECRET']) {
    if (!text.includes(`secrets.${name}`))
      problems.push(`despertador.yml: falta usar o segredo ${name}`);
  }
  const curl = text.split('\n').find((line) => /^\s*curl\b/.test(line)) ?? '';
  const curlBlock = text.slice(text.indexOf(curl));
  const command = curlBlock.replace(/\\\n\s*/g, ' ').split('\n')[0] ?? '';
  for (const flag of [
    '--fail',
    '--max-time 120',
    '--retry 1',
    '--retry-all-errors',
    '-X POST',
    'Authorization: Bearer $TICK_SECRET',
  ]) {
    if (!command.includes(flag)) problems.push(`despertador.yml: o curl precisa de ${flag}`);
  }
  if (!command.includes('"$PROD_TICK_URL"'))
    problems.push('despertador.yml: o curl deve chamar "$PROD_TICK_URL"');
  for (const leak of secretLeaks(text, ALL_SECRETS)) {
    problems.push(`despertador.yml: ${leak}`);
  }
  return problems;
}

/** Roda todas as checagens nos arquivos do repositório. Devolve os problemas (falham) e os avisos (só imprimem). */
export function checkAll(root = ROOT) {
  const read = (path) => readFileSync(join(root, path), 'utf8');
  const render = read('render.yaml');
  const domain = checkProductionDomain(render);
  return {
    problems: [
      ...checkRender(render),
      ...domain.problems,
      ...checkVercel(JSON.parse(read('apps/web/vercel.json')), productionHostOf(render)),
      ...checkBackupWorkflow(read('.github/workflows/backup.yml')),
      ...checkDespertadorWorkflow(read('.github/workflows/despertador.yml')),
    ],
    warnings: domain.warnings,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { problems, warnings } = checkAll();
  for (const warning of warnings) {
    console.warn(`\n!!! ATENÇÃO: ${warning} !!!\n`);
  }
  if (problems.length > 0) {
    console.error('Configuração de deploy com problema:');
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }
  console.log(
    'Configuração de deploy ok (render.yaml, vercel.json, backup.yml e despertador.yml).',
  );
}
