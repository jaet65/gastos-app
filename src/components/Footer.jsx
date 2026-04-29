import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Text } from '@tremor/react';

const buildTime = import.meta.env.VITE_APP_BUILD_TIME;
const isDev = import.meta.env.DEV;

const Footer = () => {
    if (isDev) {
        return (
            <div className="text-left mb-2">
                <Text className="text-[10px] text-slate-400">Versión: LOCALHOST</Text>
            </div>
        );
    }

    let versionInfo = null;
    try {
        versionInfo = 'Producción'; // Fallback
        if (buildTime) {
            const buildDate = new Date(buildTime);
            versionInfo = format(buildDate, "dd/MM/yy - HH:mm", { locale: es });
        }
    } catch {
        return null; // No renderizar si la fecha es inválida
    }

    return (
        <div className="text-left mb-2">
            <Text className="text-[10px] text-slate-400">Versión: {versionInfo}</Text>
        </div>
    );
};

export default Footer;