/**
 * sw.js — Service Worker для Vuntgram PWA
 *
 * Отвечает за:
 *  1. Приём push-уведомлений от сервера (через Web Push API).
 *  2. Показ системных уведомлений, когда приложение закрыто / в фоне.
 *  3. Обработку клика по уведомлению — открытие/фокус чата.
 *
 * Файл должен лежать в корне сайта (рядом с chats.html),
 * чтобы scope SW охватывал все страницы.
 */

const APP_ORIGIN = 'https://vuntgram.vercel.app';  // замените при необходимости
const CHATS_URL  = `${APP_ORIGIN}/chats.html`;

// ─── Установка / активация ────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    // Немедленно активируемся (не ждём закрытия всех вкладок)
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Захватываем контроль над всеми клиентами сразу
    event.waitUntil(clients.claim());
});

// ─── Обработка входящего Push ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    let payload = { title: 'Новое сообщение', body: '', data: {} };

    if (event.data) {
        try {
            payload = event.data.json();
        } catch {
            payload.body = event.data.text();
        }
    }

    const title   = payload.title || 'Vuntgram';
    const body    = payload.body  || '';
    const data    = payload.data  || {};
    const chatId  = data.chat_id;

    const options = {
        body,
        icon:  '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [150, 50, 150],
        tag:   chatId ? `chat-${chatId}` : 'vuntgram-msg',  // группировка по чату
        renotify: true,                                      // вибрировать при замене
        data: { chatId, url: chatId ? `${CHATS_URL}?openChat=${chatId}` : CHATS_URL }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Клик по уведомлению ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || CHATS_URL;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Ищем уже открытую вкладку с приложением
            for (const client of clientList) {
                if (client.url.startsWith(APP_ORIGIN) && 'focus' in client) {
                    client.focus();
                    // Посылаем сообщение странице, чтобы она открыла нужный чат
                    if (event.notification.data?.chatId) {
                        client.postMessage({
                            type: 'OPEN_CHAT',
                            chatId: event.notification.data.chatId
                        });
                    }
                    return;
                }
            }
            // Если вкладка не найдена — открываем новую
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
