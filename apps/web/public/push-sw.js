/*
 * Avisos push do Fut Stats (pwa-e-push). O service worker que o vite-plugin-pwa gera (`generateSW`) importa este
 * arquivo com `importScripts('push-sw.js')` (vite.config.ts) e continua cuidando do cache e da atualização.
 *
 * Script clássico (sem `import`/`export`) e sem dependência. A lógica fica em funções puras no topo, que o
 * Vitest roda numa sandbox (src/features/pwa/push-sw.test.ts); só o fim do arquivo liga os eventos, e só dentro
 * de um service worker de verdade.
 */

var PUSH_ICON = 'pwa-192x192.png';
var FALLBACK_TITLE = 'Fut Stats';
var FALLBACK_BODY = 'Você tem um aviso novo.';
var FALLBACK_URL = '/';

/** Caminho do app ("/rodadas/1?grupo=g"). Outro endereço (ou "//outro.site") nunca é aberto: cai no início. */
function safePushUrl(url) {
  if (typeof url !== 'string' || url.charAt(0) !== '/' || url.charAt(1) === '/')
    return FALLBACK_URL;
  return url;
}

/**
 * Valida o que veio no push (PushPayload do `@fut-stats/shared`). Conteúdo ilegível não derruba o aviso:
 * o navegador exige uma notificação por push, então cai num aviso genérico que abre o app.
 */
function parsePushPayload(raw) {
  var ok =
    raw !== null &&
    typeof raw === 'object' &&
    typeof raw.title === 'string' &&
    typeof raw.body === 'string' &&
    typeof raw.tag === 'string' &&
    raw.title !== '' &&
    raw.body !== '';
  if (!ok) return { title: FALLBACK_TITLE, body: FALLBACK_BODY, tag: 'geral', url: FALLBACK_URL };
  return { title: raw.title, body: raw.body, tag: raw.tag, url: safePushUrl(raw.url) };
}

/** Argumentos do `showNotification`: título, texto, ícone do app, `tag` (o aviso novo troca o antigo) e a `url` nos dados. */
function notificationArgs(payload) {
  return {
    title: payload.title,
    options: {
      body: payload.body,
      icon: PUSH_ICON,
      badge: PUSH_ICON,
      tag: payload.tag,
      lang: 'pt-BR',
      data: { url: payload.url },
    },
  };
}

/**
 * O que fazer ao tocar no aviso: com uma janela do app aberta, foca ela e navega para a `url` (`index` é a
 * posição na lista); sem janela, abre a `url`.
 */
function pickClickAction(windowClients, origin) {
  for (var i = 0; i < windowClients.length; i += 1) {
    var client = windowClients[i];
    if (typeof client.url === 'string' && client.url.indexOf(origin) === 0) {
      return { kind: 'focus', index: i };
    }
  }
  return { kind: 'open' };
}

function readPushData(event) {
  try {
    return event.data ? event.data.json() : null;
  } catch {
    return null;
  }
}

function onPush(scope, event) {
  var args = notificationArgs(parsePushPayload(readPushData(event)));
  event.waitUntil(scope.registration.showNotification(args.title, args.options));
}

function onNotificationClick(scope, event) {
  var data = event.notification.data;
  var url = new URL(safePushUrl(data && data.url), scope.location.origin).href;
  event.notification.close();
  event.waitUntil(
    scope.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      var action = pickClickAction(list, scope.location.origin);
      if (action.kind === 'open') return scope.clients.openWindow(url);
      var client = list[action.index];
      return client.focus().then(function (focused) {
        var target = focused || client;
        // Navegador sem `navigate` na janela: abre a `url` numa janela nova em vez de ficar parado
        return typeof target.navigate === 'function'
          ? target.navigate(url)
          : scope.clients.openWindow(url);
      });
    }),
  );
}

// Só dentro de um service worker de verdade (o Vitest roda o arquivo numa sandbox sem este escopo global)
/* global ServiceWorkerGlobalScope */
if (typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope) {
  self.addEventListener('push', function (event) {
    onPush(self, event);
  });
  self.addEventListener('notificationclick', function (event) {
    onNotificationClick(self, event);
  });
}
