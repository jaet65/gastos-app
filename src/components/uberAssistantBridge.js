export const createUberAssistantBridge = (onReady, windowRef = window) => {
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  let pendingResolver = null;
  let timeoutId = null;
  const handleMessage = (event) => {
    if (event.source !== windowRef || event.origin !== windowRef.location.origin) return;
    if (event.data?.source !== 'uber-assistant-extension'
      || event.data?.type !== 'UBER_ASSISTANT_READY'
      || event.data?.nonce !== nonce) return;
    onReady();
    if (pendingResolver) {
      windowRef.clearTimeout(timeoutId);
      timeoutId = null;
      pendingResolver(true);
      pendingResolver = null;
    }
  };

  const probe = () => windowRef.postMessage({
    source: 'gastos-app',
    type: 'UBER_ASSISTANT_PING',
    nonce,
  }, windowRef.location.origin);

  windowRef.addEventListener('message', handleMessage);
  probe();

  return {
    probe,
    checkInstalled: (timeoutMs = 400) => new Promise((resolve) => {
      if (pendingResolver) pendingResolver(false);
      pendingResolver = resolve;
      timeoutId = windowRef.setTimeout(() => {
        pendingResolver = null;
        timeoutId = null;
        resolve(false);
      }, timeoutMs);
      probe();
    }),
    disconnect: () => {
      windowRef.removeEventListener('message', handleMessage);
      if (timeoutId) windowRef.clearTimeout(timeoutId);
      if (pendingResolver) pendingResolver(false);
      pendingResolver = null;
    },
  };
};