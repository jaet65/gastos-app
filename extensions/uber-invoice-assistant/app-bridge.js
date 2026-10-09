window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  if (event.data?.source !== 'gastos-app' || event.data?.type !== 'UBER_ASSISTANT_PING') return;

  window.postMessage({
    source: 'uber-assistant-extension',
    type: 'UBER_ASSISTANT_READY',
    nonce: event.data.nonce,
  }, window.location.origin);
});