import { describe, expect, it } from 'vitest';
import { pushState, showEnablePushLine, type PushStateInput } from './push-state';

const base: PushStateInput = {
  serverEnabled: true,
  ios: false,
  standalone: false,
  supported: true,
  permission: 'default',
  subscribed: false,
};
const state = (patch: Partial<PushStateInput>) => pushState({ ...base, ...patch });

describe('pushState: o que o card Avisos mostra (C26 a C32)', () => {
  it('desligado: com suporte, permissão ainda não pedida e sem assinatura (C26)', () => {
    expect(state({})).toBe('off');
  });

  it('ligado: com assinatura e permissão dada (C27)', () => {
    expect(state({ permission: 'granted', subscribed: true })).toBe('on');
  });

  it('permissão dada mas sem assinatura (desligou antes): continua desligado', () => {
    expect(state({ permission: 'granted', subscribed: false })).toBe('off');
  });

  it('assinatura que sobrou sem a permissão não conta como ligado', () => {
    expect(state({ permission: 'default', subscribed: true })).toBe('off');
  });

  it('bloqueado: permissão negada, com ou sem assinatura velha (C30)', () => {
    expect(state({ permission: 'denied' })).toBe('blocked');
    expect(state({ permission: 'denied', subscribed: true })).toBe('blocked');
  });

  it('verificando: o navegador ainda não disse se há assinatura (C39)', () => {
    expect(state({ permission: 'granted', subscribed: undefined })).toBe('checking');
  });

  it('sem suporte (C32)', () => {
    expect(state({ supported: false })).toBe('unsupported');
  });

  it('iPhone sem instalar: pede para instalar, mesmo sem `PushManager` (C31)', () => {
    expect(state({ ios: true, supported: false })).toBe('ios-install');
    expect(state({ ios: true, supported: true })).toBe('ios-install');
  });

  it('iPhone com o app instalado: como qualquer navegador com suporte', () => {
    expect(state({ ios: true, standalone: true })).toBe('off');
    expect(state({ ios: true, standalone: true, supported: false })).toBe('unsupported');
  });

  it('servidor com push desligado, sem resposta ou com erro: o card não aparece (C32)', () => {
    expect(state({ serverEnabled: false })).toBe('hidden');
    expect(state({ serverEnabled: undefined })).toBe('hidden');
    expect(state({ serverEnabled: false, ios: true })).toBe('hidden');
    expect(state({ serverEnabled: false, supported: false })).toBe('hidden');
  });
});

describe('showEnablePushLine: a linha "Ative os avisos" do Feed (C33)', () => {
  it('só para quem pode ligar agora e ainda não foi perguntado', () => {
    expect(showEnablePushLine(base)).toBe(true);
  });

  it.each([
    ['já ligou', { permission: 'granted', subscribed: true }],
    ['desligou de propósito', { permission: 'granted', subscribed: false }],
    ['bloqueou', { permission: 'denied' }],
    ['sem suporte', { supported: false }],
    ['iPhone sem instalar', { ios: true }],
    ['servidor sem push', { serverEnabled: false }],
    ['ainda verificando', { subscribed: undefined }],
  ] satisfies [string, Partial<PushStateInput>][])('não aparece: %s', (_, patch) => {
    expect(showEnablePushLine({ ...base, ...patch })).toBe(false);
  });
});
