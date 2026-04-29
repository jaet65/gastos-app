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

    if (!buildTime) {
        return null;
    }

    try {
        const buildDate = new Date(buildTime);
        const formattedDate = format(buildDate, "dd MMM yyyy, HH:mm 'hrs.'", { locale: es }) + " UTC";

        return (
            <div className="text-left mb-2">
                <Text className="text-[10px] text-slate-400">Versión: {formattedDate}</Text>
            </div>
        );
    } catch (error) {
        return null; // No renderizar si la fecha es inválida
    }
};

export default Footer;