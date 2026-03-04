import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from "@tremor/react";

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registrado:', r);
    },
    onRegisterError(error) {
      console.log('Error en registro de SW:', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div className="fixed right-0 bottom-0 m-4 p-4 border rounded-md shadow-lg bg-white z-50 text-left">
      <div className="mb-2">
        {offlineReady ? (
          <span>Aplicación lista para funcionar sin conexión.</span>
        ) : (
          <span>Nueva versión disponible, ¡recarga para actualizar!</span>
        )}
      </div>
      {needRefresh && (
        <Button onClick={() => updateServiceWorker(true)} size="xs" className="mr-2">
          Recargar
        </Button>
      )}
      <Button onClick={() => close()} size="xs" variant="secondary">
        Cerrar
      </Button>
    </div>
  );
}

export default ReloadPrompt;