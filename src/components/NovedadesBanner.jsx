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
    <div role="status" className="backdrop-blur-md bg-blue-50/50 fixed top-0 left-0 right-0 flex items-start gap-3 rounded-xl border border-blue-100 px-4 py-3 text-sm text-blue-900 shadow-sm">
      <Sparkles size={18} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
      <p className="flex-1">
        <span className="font-bold">¡Gastos MAF se actualizó!</span>{' '}
        Ahora, al adjuntar una factura, el sistema detecta el monto automáticamente y llena el formulario por ti. Además, puedes obtener una vista previa de tus solicitudes y reportes sin necesidad de descargarlos.
      </p>
      <button
        type="button"
        onClick={cerrarBanner}
        className="shrink-0 rounded p-1 text-blue-500 transition-colors hover:bg-blue-100 hover:text-blue-800"
        aria-label="Cerrar aviso de actualización"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default NovedadesBanner;
