import('./firebase-sync.js?v=0.5.2')
  .then(() => import('./firebase-ai-fly.js?v=0.7.2'))
  .catch(error => {
    console.error('Mesraah Firebase module:', error);
  });
