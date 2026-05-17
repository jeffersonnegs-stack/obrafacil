// Service Worker — ObraFácil com Push Notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCOrQGAq7ACuX2eR6ZVqgbXUoLI_yHBzuY",
  authDomain: "obrafacil-f642d.firebaseapp.com",
  projectId: "obrafacil-f642d",
  storageBucket: "obrafacil-f642d.firebasestorage.app",
  messagingSenderId: "975589992691",
  appId: "1:975589992691:web:57957f4e8c2be971316f86"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/obrafacil/assets/icons/icon-192.png',
    badge: '/obrafacil/assets/icons/icon-192.png',
    vibrate: [200, 100, 200],
  });
});
