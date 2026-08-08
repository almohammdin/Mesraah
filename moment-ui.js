import('./firebase-sync.js?v=0.5.2')
  .then(() => import('./google-calendar.js?v=0.8.0'))
  .then(() => import('./firebase-ai-assistant.js?v=0.8.0'))
  .then(() => import('./firebase-live-voice.js?v=0.8.0'))
  .then(() => import('./ui-v080.js?v=0.8.0'))
  .catch(error => {
    console.error('Mesraah v0.8 module:', error);
  });
