import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { envFilePaths } from './env-files';

describe('envFilePaths', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'env-files-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    // O ConfigModule grava o que lê em process.env; sem limpar, um caso vaza para o próximo.
    for (const key of ['TESTE_EQUIPE', 'TESTE_RAIZ', 'TESTE_AMBOS']) delete process.env[key];
  });

  async function load() {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ envFilePath: envFilePaths(root) })],
    }).compile();
    return module.get(ConfigService);
  }

  it('o arquivo da equipe vence o da raiz; o resto vem da raiz', async () => {
    writeFileSync(join(root, '.env.equipe'), 'TESTE_EQUIPE=da-equipe\nTESTE_AMBOS=equipe\n');
    writeFileSync(join(root, '.env'), 'TESTE_RAIZ=da-raiz\nTESTE_AMBOS=raiz\n');

    const config = await load();

    expect(config.get('TESTE_AMBOS')).toBe('equipe');
    expect(config.get('TESTE_EQUIPE')).toBe('da-equipe');
    expect(config.get('TESTE_RAIZ')).toBe('da-raiz');
  });

  it('sem o arquivo da equipe, vale só o da raiz', async () => {
    writeFileSync(join(root, '.env'), 'TESTE_RAIZ=da-raiz\n');

    const config = await load();

    expect(config.get('TESTE_RAIZ')).toBe('da-raiz');
  });

  it('sem nenhum dos dois, não quebra (CI e produção usam o ambiente)', async () => {
    const config = await load();

    expect(config.get('TESTE_RAIZ')).toBeUndefined();
  });
});
