import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error:', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (needRefresh) {
    return (
      <div className="fixed bottom-4 right-4 z-100000 p-4 rounded-lg shadow-2xl bg-slate-800 text-white w-80">
        <button onClick={() => close()} className="absolute top-2 right-2 text-slate-400 hover:text-white">
          <X size={18} />
        </button>
        <div className="mb-3">
          <h3 className="font-bold">¡Nueva versión disponible!</h3>
          <p className="text-sm text-slate-300 mt-1">Hay una actualización lista para ser instalada.</p>
        </div>
        <button
          onClick={() => updateServiceWorker(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} /> Recargar
        </button>
      </div>
    );
  }

  return null;
}

export default ReloadPrompt;