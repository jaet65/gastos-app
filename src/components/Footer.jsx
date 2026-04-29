import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Text } from '@tremor/react';

const buildTime = import.meta.env.VITE_APP_BUILD_TIME;
const commitSha = import.meta.env.VITE_APP_COMMIT_SHA;
const isDev = import.meta.env.DEV;

const Footer = () => {
    if (isDev) {
        return (
            <div className="text-left mb-2">
                <Text className="text-[10px] text-slate-400">Versión: LOCALHOST</Text>
            </div>
        );
    }

    try {
        let versionInfo = 'Producción'; // Fallback
        if (buildTime) {
            const buildDate = new Date(buildTime);
            const formattedDate = format(buildDate, "dd MMM yyyy, HH:mm 'hrs.'", { locale: es });
            versionInfo = `${formattedDate} UTC`;
        }
        
        if (commitSha) {
            // Si tenemos fecha y commit, los unimos. Si solo hay commit, lo mostramos solo.
            versionInfo = buildTime ? `${versionInfo} (#${commitSha})` : `Commit: #${commitSha}`;
        }

        return (
            <div className="text-left mb-2">
                <Text className="text-[10px] text-slate-400">Versión: {versionInfo}</Text>
            </div>
        );
    } catch (error) {
        return null; // No renderizar si la fecha es inválida
    }
};

export default Footer;