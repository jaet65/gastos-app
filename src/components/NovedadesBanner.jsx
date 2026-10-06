import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const LAST_NOTIFIED_VERSION_KEY = 'ultimaVersionNovedades';

const NovedadesBanner = () => {
  const appVersion = import.meta.env.VITE_APP_COMMIT_SHA;
  const [visible, setVisible] = useState(() => {
    if (!appVersion || appVersion === 'N/A') return false;
    return localStorage.getItem(LAST_NOTIFIED_VERSION_KEY) !== appVersion;
  });

  const cerrarBanner = () => {
    if (appVersion && appVersion !== 'N/A') {
      localStorage.setItem(LAST_NOTIFIED_VERSION_KEY, appVersion);
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div 
      role="status" 
      className="relative mb-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs md:text-sm text-blue-900 shadow-xs backdrop-blur-xs transition-all"
    >
      <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600 shrink-0 mt-0.5">
        <Sparkles size={16} aria-hidden="true" />
      </div>
      
      <div className="flex-1 space-y-1">
        <p className="font-semibold leading-snug">
          ¡Gastos MAF se actualizó!
        </p>
        <p className="text-blue-700 leading-relaxed">
          Ahora el sistema detecta el monto de tus facturas automáticamente y puedes previsualizar reportes sin descargarlos.
        </p>
      </div>

      <button
        type="button"
        onClick={cerrarBanner}
        className="shrink-0 rounded-lg p-1 text-blue-400 transition-colors hover:bg-blue-100 hover:text-blue-700"
        aria-label="Cerrar aviso de actualización"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default NovedadesBanner;