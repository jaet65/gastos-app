import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore'; // Se mantiene addDoc y collection
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { differenceInCalendarDays } from 'date-fns';
import { format } from 'date-fns-tz';
import { X, FileCog, Send } from 'lucide-react';

const CLOUD_NAME = "didj7kuah";
const UPLOAD_PRESET = "gastos_app";

const formatoMoneda = (cantidad) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cantidad);
};

const SolicitudRecursosModal = ({ onClose, fechaInicioInicial = '', fechaFinInicial = '', onSolicitudCreada }) => {
    const [fechaInicio, setFechaInicio] = useState(fechaInicioInicial);
    const [fechaFin, setFechaFin] = useState(fechaFinInicial);
    const [loading, setLoading] = useState(false);

    const { dias, montoTransporte, montoComida, totalSolicitado } = useMemo(() => {
        if (!fechaInicio || !fechaFin) return { dias: 0, montoTransporte: 0, montoComida: 0, totalSolicitado: 0 };
        
        const inicio = new Date(`${fechaInicio}T00:00:00`); // Asegurar que se interprete como local al día
        const fin = new Date(`${fechaFin}T00:00:00`);
        if (inicio > fin) return { dias: 0, montoTransporte: 0, montoComida: 0, totalSolicitado: 0 };

        const dias = differenceInCalendarDays(fin, inicio) + 1;
        const montoTransporte = dias * 700;
        const montoComida = dias * 600;
        const totalSolicitado = montoTransporte + montoComida;

        return { dias, montoTransporte, montoComida, totalSolicitado };
    }, [fechaInicio, fechaFin]);

    const generarPdfSolicitud = async () => {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const margin = 50;

        // --- Encabezado ---
        try {
            const logoUrl = '/CECAI.png'; // Asegúrate que este archivo exista en tu carpeta /public
            const logoImageBytes = await fetch(logoUrl).then((res) => res.arrayBuffer());
            const logoImage = await pdfDoc.embedPng(logoImageBytes);
            const logoDims = logoImage.scale(0.05); // Ajusta el tamaño del logo
            page.drawImage(logoImage, {
                x: margin,
                y: height - margin - logoDims.height,
                width: logoDims.width,
                height: logoDims.height,
            });
        } catch (error) {
            console.warn("No se pudo cargar el logo. Asegúrate que 'CECAI.png' esté en la carpeta /public.");
        }
        
        page.drawText('Solicitud de Recursos', { x: margin, y: height - margin - 100, font: boldFont, size: 24 });
        
        // --- Cuerpo del documento ---
        let y = height - margin - 140;
        page.drawText('Consultor:', { x: margin, y, font: boldFont, size: 12 });
        page.drawText('Mario Alberto Agraz Martínez', { x: margin + 100, y, font, size: 12 });
        y -= 20;
        page.drawText('Proyecto:', { x: margin, y, font: boldFont, size: 12 });
        page.drawText('Rally TrackSIM', { x: margin + 100, y, font, size: 12 });
        y -= 20;
        page.drawText('Periodo:', { x: margin, y, font: boldFont, size: 12 });
        page.drawText(`${format(new Date(`${fechaInicio}T00:00:00`), 'dd/MM/yyyy')} al ${format(new Date(`${fechaFin}T00:00:00`), 'dd/MM/yyyy')} (${dias} días)`, { x: margin + 100, y, font, size: 12 });
        y -= 40;
        page.drawText('Desglose de Gastos:', { x: margin, y, font: boldFont, size: 14 });
        y -= 30;
        page.drawText('Transporte:', { x: margin + 20, y, font, size: 12 });
        page.drawText(formatoMoneda(montoTransporte), { x: margin + 150, y, font, size: 12 });
        y -= 20;
        page.drawText('Comida:', { x: margin + 20, y, font, size: 12 });
        page.drawText(formatoMoneda(montoComida), { x: margin + 150, y, font, size: 12 });
        y -= 10;
        page.drawLine({ start: { x: margin, y }, end: { x: margin + 250, y }, thickness: 1 });
        y -= 20;
        page.drawText('Total Solicitado:', { x: margin, y, font: boldFont, size: 14 });
        page.drawText(formatoMoneda(totalSolicitado), { x: margin + 150, y, font: boldFont, size: 14 });

        // --- Pie de página ---
        const footerText = `Solicitud de recursos por comisión a para el proyecto de TrackSIM comprendido de las fechas de: ${fechaInicio} hasta ${fechaFin}`;
        const footerTextWidth = font.widthOfTextAtSize(footerText, 8);
        page.drawText(footerText, {
            x: (width - footerTextWidth) / 2,
            y: 30,
            size: 8,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
        });

        return await pdfDoc.save();
    };

    const subirACloudinary = async (pdfBytes) => {
        const data = new FormData();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        data.append("file", blob, "solicitud_recursos.pdf");
        data.append("upload_preset", UPLOAD_PRESET);
        data.append("cloud_name", CLOUD_NAME);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: "POST", body: data });
        const fileData = await response.json();

        if (!response.ok || !fileData.secure_url) {
            throw new Error(fileData.error?.message || "Error al subir el PDF a Cloudinary");
        }
        return fileData.secure_url;
    };

    const handleSolicitar = async () => {
        if (dias <= 0) {
            alert("Por favor, selecciona un rango de fechas válido.");
            return;
        }
        setLoading(true);
        try {
            // 1. Generar PDF
            const pdfBytes = await generarPdfSolicitud();

            // 2. Subir a Cloudinary
            const pdfUrl = await subirACloudinary(pdfBytes);

            // 3. Guardar en la nueva colección "solicitudes"
            const nuevaSolicitudData = {
                consultor: 'Mario Alberto Agraz Martínez',
                proyecto: 'Rally TrackSIM',
                fechaInicio: fechaInicio,
                fechaFin: fechaFin,
                dias: dias,
                montoTransporte: montoTransporte,
                montoComida: montoComida,
                totalSolicitado: totalSolicitado,
                url_pdf_solicitud: pdfUrl,
                creado_en: Timestamp.now()
            };
            const docRef = await addDoc(collection(db, "solicitudes"), nuevaSolicitudData);

            if (onSolicitudCreada) {
                onSolicitudCreada({ id: docRef.id, ...nuevaSolicitudData });
            } else {
                alert("Solicitud de recursos generada y guardada correctamente.");
            }
            onClose(); // Cierra el modal en cualquier caso

        } catch (error) {
            console.error("Error al solicitar recursos:", error);
            alert("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative border border-slate-200">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><FileCog size={24} /> Solicitud de Recursos</h3>
                    <button onClick={onClose} disabled={loading} className="bg-transparent text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={22} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div><p className="text-sm"><span className="font-bold">Consultor:</span> Mario Alberto Agraz Martínez</p></div>
                    <div><p className="text-sm"><span className="font-bold">Proyecto:</span> Rally TrackSIM</p></div>

                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fecha de Inicio</label>
                            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-full font-bold text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fecha de Finalización</label>
                            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-full font-bold text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                        </div>
                    </div>

                    {dias > 0 && (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 mt-4">
                            <h4 className="font-bold text-center text-slate-700">Resumen de Solicitud ({dias} días)</h4>
                            <div className="flex justify-between text-sm"><p>Transporte ($700/día):</p><p className="font-bold">{formatoMoneda(montoTransporte)}</p></div>
                            <div className="flex justify-between text-sm"><p>Comida ($600/día):</p><p className="font-bold">{formatoMoneda(montoComida)}</p></div>
                            <hr className="my-1"/>
                            <div className="flex justify-between text-base"><p className="font-bold">Total Solicitado:</p><p className="font-black text-blue-600">{formatoMoneda(totalSolicitado)}</p></div>
                        </div>
                    )}

                    <button onClick={handleSolicitar} disabled={loading || dias <= 0} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-full flex justify-center items-center gap-2 mt-6 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? 'Procesando...' : <><Send size={18} /> Generar y Guardar Solicitud</>}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SolicitudRecursosModal;