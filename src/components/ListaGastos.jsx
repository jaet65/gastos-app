import { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase'; import { CLOUD_NAME } from './config';
import { useAuth } from './AuthContext';
import SolicitudRecursosModal from './SolicitudRecursosModal';
import EditGastoModal from './EditGastoModal';
import ReporteOpcionesModal from './ReporteOpcionesModal';
import { AnimatePresence } from 'framer-motion';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import ExcelJS from 'exceljs'; import { getDoc } from 'firebase/firestore';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, addDoc, Timestamp, where } from 'firebase/firestore';
import { differenceInCalendarDays } from 'date-fns';
import {
  Card,
  Title,
  Text,
  Metric,
  List,
  ListItem,
  Badge,
  Flex,
  Icon,
  Divider,
} from '@tremor/react';
import { FileText, Trash2, Calendar, FileCheck, AlertTriangle, Car, Utensils, Layers, Pencil, RotateCcw, Coins, Search, FileDown, Archive, ArchiveRestore, Loader2, ShieldCheck } from 'lucide-react';

const ListaGastos = ({ adminViewUid = null }) => {
  const { user } = useAuth();
  const esVistaAdmin = !!adminViewUid;
  const targetUid = adminViewUid || user?.uid;
  const [gastos, setGastos] = useState([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [gastoAEditar, setGastoAEditar] = useState(null);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [reporteGenerandose, setReporteGenerandose] = useState(false);
  const [modalReporteAbierto, setModalReporteAbierto] = useState(false);
  const [mostrarArchivados, setMostrarArchivados] = useState(false);
  const [modalSolicitudParaReporteAbierto, setModalSolicitudParaReporteAbierto] = useState(false);
  const [isUnarchiving, setIsUnarchiving] = useState(false); // Nuevo estado para el proceso de desarchivado

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatoMoneda = (cantidad) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(cantidad);
  };

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "gastos"),
      where("userId", "==", targetUid),
      orderBy("fecha", "asc"),
      orderBy("creado_en", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGastos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user, targetUid]);

  const eliminarGasto = async (id, idPropina) => {
    if (confirm("¿Borrar este registro?")) {
      const gastoRef = doc(db, "gastos", id);
      const gastoDoc = await getDoc(gastoRef);
      const gastoData = gastoDoc.data();

      // Borrar archivo de Cloudinary si existe
      if (gastoData.deleteToken) {
        try {
          const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/delete_by_token`;
          const response = await fetch(cloudinaryUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: gastoData.deleteToken })
          });
          if (!response.ok) console.error('Error deleting from Cloudinary:', response.statusText);
        } catch (error) { console.error('Error deleting from Cloudinary:', error); }
      }

      // Borrar el gasto principal
      await deleteDoc(doc(db, "gastos", id));

      // Borrar propina vinculada si existe
      if (idPropina) {
        try {
          await deleteDoc(doc(db, "gastos", idPropina));
        } catch (e) {
          console.log("La propina ya no existía o error al borrar", e);
        }
      }

      // NUEVO: Borrar subgastos (casetas) vinculados
      const subgastos = gastos.filter(g => g.idPadre === id);
      for (const sub of subgastos) {
        try {
          // Borrar factura de caseta si tiene
          if (sub.deleteToken) {
            const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/delete_by_token`;
            await fetch(cloudinaryUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: sub.deleteToken })
            });
          }
          await deleteDoc(doc(db, "gastos", sub.id));
        } catch (e) {
          console.error("Error borrando subgasto:", e);
        }
      }
    }
  };

  const guardarEdicion = async (gastoActualizado, conPropina) => {
    try {
      const montoPrincipal = parseFloat(gastoActualizado.monto);
      const refPrincipal = doc(db, "gastos", gastoActualizado.id);

      let updateData = {
        concepto: gastoActualizado.concepto,
        monto: montoPrincipal,
        fecha: gastoActualizado.fecha,
        categoria: gastoActualizado.categoria,
        url_factura: gastoActualizado.url_factura || ""
      };

      // Lógica para manejar la propina
      if (gastoActualizado.idPropina && !conPropina) {
        // Se desmarcó la propina, hay que borrarla
        await deleteDoc(doc(db, "gastos", gastoActualizado.idPropina));
        updateData.idPropina = null;
      }
      else if (conPropina && gastoActualizado.categoria === 'Comida') {
        // Se marcó la propina (o ya estaba marcada)
        const montoPropina = montoPrincipal * 0.10;
        const datosPropina = {
          fecha: gastoActualizado.fecha,
          concepto: `Propina => ${gastoActualizado.concepto}  @ ${gastoActualizado.fecha}`,
          monto: montoPropina,
          categoria: 'Comida',
          url_factura: ''
        };

        if (gastoActualizado.idPropina) {
          // La propina ya existía, solo se actualiza
          await updateDoc(doc(db, "gastos", gastoActualizado.idPropina), datosPropina);
        } else {
          // La propina no existía, se crea una nueva
          const nuevaPropinaRef = await addDoc(collection(db, "gastos"), {
            ...datosPropina,
            creado_en: Timestamp.now(),
            userId: user.uid
          });
          updateData.idPropina = nuevaPropinaRef.id;
        }
      }
      else if (gastoActualizado.idPropina && gastoActualizado.categoria !== 'Comida') {
        // Si se cambia la categoría a algo que no es comida, se borra la propina
        await deleteDoc(doc(db, "gastos", gastoActualizado.idPropina));
        updateData.idPropina = null;
      }

      await updateDoc(refPrincipal, updateData);


      alert("Gasto actualizado correctamente");
      // El modal se cerrará desde su propio componente
    } catch (error) {
      console.error("Error", error);
      alert("Error al guardar cambios: " + error.message);
      throw error; // Re-lanza el error para que el modal sepa que falló
    }
  };

  const abrirEdicion = (gasto) => {
    // Caso 1: Es una propina (buscamos al padre que la contiene)
    const gastoPadreDePropina = gastos.find(g => g.idPropina === gasto.id);
    // Caso 2: Es una caseta (buscamos al padre vinculado por idPadre)
    const gastoPadreDeCaseta = gasto.idPadre ? gastos.find(g => g.id === gasto.idPadre) : null;

    setGastoAEditar(gastoPadreDePropina || gastoPadreDeCaseta || gasto);
  };

  const subirReporteACloudinary = async (fileBlob, solicitudId, formato) => {
    const CLOUD_NAME = "didj7kuah";
    const UPLOAD_PRESET = "Gastos_Reportes";

    const mimeType = formato === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf';

    let blob;
    if (formato === 'zip') {
      blob = fileBlob instanceof Blob ? fileBlob : new Blob([fileBlob], { type: 'application/zip' });
    } else {
      blob = fileBlob instanceof Blob ? fileBlob : new Blob([fileBlob], { type: mimeType });
    }

    const nombreArchivo = solicitudId; // solicitudId ya contiene el nombre completo del archivo
    const data = new FormData();
    data.append("file", blob, nombreArchivo);
    data.append("upload_preset", UPLOAD_PRESET);
    data.append("cloud_name", CLOUD_NAME);
    data.append("filename_override", nombreArchivo);

    const uploadEndpoint = `raw/upload`;
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${uploadEndpoint}`, { method: "POST", body: data });
    const fileData = await response.json();

    if (!response.ok || !fileData.secure_url) {
      console.error("Error subiendo reporte a Cloudinary:", fileData);
      throw new Error(fileData.error?.message || "Error al subir el reporte a Cloudinary");
    }
    return { url: fileData.secure_url, nombreArchivo, deleteToken: fileData.delete_token };
  };

  // --- Automatización de Solicitud de Recursos ($0.00) ---
  const generarPdfSolicitudCero = async (fInicio, fFin) => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 50;
    const dias = differenceInCalendarDays(new Date(`${fFin}T00:00:00`), new Date(`${fInicio}T00:00:00`)) + 1;

    try {
      const logoUrl = '/CECAI.png';
      const logoImageBytes = await fetch(logoUrl).then((res) => res.arrayBuffer());
      const logoImage = await pdfDoc.embedPng(logoImageBytes);
      const logoDims = logoImage.scale(0.05);
      page.drawImage(logoImage, { x: margin, y: height - margin - logoDims.height, width: logoDims.width, height: logoDims.height });
    } catch { console.warn("Logo no cargado"); }

    page.drawText('Solicitud de Recursos', { x: margin, y: height - margin - 100, font: boldFont, size: 24 });
    let y = height - margin - 140;
    page.drawText('Consultor:', { x: margin, y, font: boldFont, size: 12 });
    page.drawText('Mario Alberto Agraz Martínez', { x: margin + 100, y, font, size: 12 });
    y -= 20;
    page.drawText('Proyecto:', { x: margin, y, font: boldFont, size: 12 });
    page.drawText('Rally TrackSIM - CECAI', { x: margin + 100, y, font, size: 12 });
    y -= 20;
    page.drawText('Periodo:', { x: margin, y, font: boldFont, size: 12 });
    page.drawText(`${formatearFecha(fInicio)} al ${formatearFecha(fFin)} (${dias} días)`, { x: margin + 100, y, font, size: 12 });
    y -= 40;
    page.drawText('Desglose de Gastos:', { x: margin, y, font: boldFont, size: 14 });
    y -= 30;
    page.drawText('Transporte:', { x: margin + 20, y, font, size: 12 });
    page.drawText('$0.00', { x: margin + 150, y, font, size: 12 });
    y -= 20;
    page.drawText('Comida:', { x: margin + 20, y, font, size: 12 });
    page.drawText('$0.00', { x: margin + 150, y, font, size: 12 });
    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: margin + 250, y }, thickness: 1 });
    y -= 20;
    page.drawText('Total Solicitado:', { x: margin, y, font: boldFont, size: 14 });
    page.drawText('$0.00', { x: margin + 150, y, font: boldFont, size: 14 });

    const footerText = `Solicitud generada automáticamente para comprobación de gastos: ${formatearFecha(fInicio)} al ${formatearFecha(fFin)}`;
    page.drawText(footerText, { x: margin, y: 30, size: 8, font: font, color: rgb(0.5, 0.5, 0.5) });

    return await pdfDoc.save();
  };

  const subirSolicitudCeroACloudinary = async (pdfBytes, fInicio) => {
    const nombreArchivo = `Solicitud ${fInicio}.pdf`;
    const data = new FormData();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    data.append("file", blob, nombreArchivo);
    data.append("upload_preset", "Gastos_Solicitudes");
    data.append("cloud_name", CLOUD_NAME);
    data.append("filename_override", nombreArchivo);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: "POST", body: data });
    const fileData = await response.json();
    if (!response.ok || !fileData.secure_url) throw new Error(fileData.error?.message || "Error al subir PDF");
    return { ...fileData, nombreArchivo };
  };

  const handleAbrirModalSolicitudParaReporte = async () => {
    // 1. Obtener gastos actualmente filtrados para determinar el rango de fechas real
    const gastosFiltrados = gastos.filter(g => {
      if (fechaInicio && g.fecha < fechaInicio) return false;
      if (fechaFin && g.fecha > fechaFin) return false;
      if (terminoBusqueda && !g.concepto.toLowerCase().includes(terminoBusqueda.toLowerCase())) return false;
      if (!mostrarArchivados && g.archivado) return false;
      return true;
    });

    if (gastosFiltrados.length === 0) {
      alert("No hay gastos filtrados para generar un reporte.");
      return;
    }

    // 2. Determinar rango de fechas para la solicitud (usar filtros o extremos de los gastos)
    const fInicio = fechaInicio || gastosFiltrados.reduce((min, g) => g.fecha < min ? g.fecha : min, gastosFiltrados[0].fecha);
    const fFin = fechaFin || gastosFiltrados.reduce((max, g) => g.fecha > max ? g.fecha : max, gastosFiltrados[0].fecha);

    setModalReporteAbierto(false);
    setReporteGenerandose(true);

    try {
      // 3. Crear Solicitud Automática con $0.00
      const pdfBytes = await generarPdfSolicitudCero(fInicio, fFin);
      const fileData = await subirSolicitudCeroACloudinary(pdfBytes, fInicio);

      const nuevaSolicitudData = {
        consultor: 'Mario Alberto Agraz Martínez',
        proyecto: 'Rally TrackSIM - CECAI',
        fechaInicio: fInicio,
        fechaFin: fFin,
        dias: differenceInCalendarDays(new Date(`${fFin}T00:00:00`), new Date(`${fInicio}T00:00:00`)) + 1,
        montoTransporte: 0,
        montoComida: 0,
        totalSolicitado: 0,
        url_pdf_solicitud: fileData.secure_url,
        nombre_archivo: fileData.nombreArchivo,
        deleteToken: fileData.delete_token,
        creado_en: Timestamp.now(),
        estado: 'Esperando...',
        userId: user.uid
      };
      const docRef = await addDoc(collection(db, "solicitudes"), nuevaSolicitudData);

      // 4. Proceder a generar el reporte con la solicitud creada
      await generarReporte(fInicio, fFin, { id: docRef.id, ...nuevaSolicitudData });
    } catch (error) {
      console.error("Error en solicitud automática:", error);
      alert("Error al automatizar la solicitud: " + error.message);
    } finally {
      setReporteGenerandose(false);
    }
  };


  const handleUnarchiveVisible = async () => {
    const archivedVisibleGastos = [];
    Object.values(dataAgrupada).forEach(estado => {
      Object.values(estado.categorias).forEach(cat => {
        Object.values(cat.fechas).forEach(items => {
          items.forEach(gasto => {
            if (gasto.archivado) {
              archivedVisibleGastos.push(gasto);
            }
          });
        });
      });
    });

    if (archivedVisibleGastos.length === 0) {
      alert("No hay gastos archivados visibles para desarchivar.");
      return;
    }

    if (!confirm(`¿Estás seguro de que quieres desarchivar ${archivedVisibleGastos.length} registros visibles?`)) {
      return;
    }

    setIsUnarchiving(true);
    try {
      const updates = archivedVisibleGastos.map(gasto => {
        const gastoRef = doc(db, "gastos", gasto.id);
        return updateDoc(gastoRef, { archivado: false });
      });
      await Promise.all(updates);
      alert("Registros desarchivados correctamente.");
    } catch (error) {
      console.error("Error al desarchivar registros:", error);
      alert("Ocurrió un error al desarchivar los registros.");
    } finally {
      setIsUnarchiving(false);
    }
  };

  const generarReporte = async (fechaInicioReporte, fechaFinReporte, solicitudVinculada = null, esMAF = false, montoMAF = 0) => {
    setReporteGenerandose(true);
    try {
      const gastosFiltrados = gastos.filter(g => {
        // Filtro especial para MAF
        if (esMAF) {
          if (g.categoria !== 'MAF') return false;
        } else {
          if (g.categoria === 'MAF') return false;
        }

        if (fechaInicioReporte && g.fecha < fechaInicioReporte) return false;
        if (fechaFinReporte && g.fecha > fechaFinReporte) return false;
        if (terminoBusqueda && !g.concepto.toLowerCase().includes(terminoBusqueda.toLowerCase())) {
          const gastoPadrePropina = gastos.find(padre => padre.idPropina === g.id);
          if (gastoPadrePropina && gastoPadrePropina.concepto.toLowerCase().includes(terminoBusqueda.toLowerCase())) return true;

          const gastoPadreCaseta = gastos.find(padre => padre.id === g.idPadre);
          if (gastoPadreCaseta && gastoPadreCaseta.concepto.toLowerCase().includes(terminoBusqueda.toLowerCase())) return true;

          return false;
        }
        return true;
      });

      if (gastosFiltrados.length === 0) {
        alert("No hay gastos en el periodo seleccionado para generar un reporte.");
        return;
      }

      const ultimaFechaGasto = gastosFiltrados.reduce((max, g) => g.fecha > max ? g.fecha : max, gastosFiltrados[0].fecha);
      const prefix = esMAF ? "MAF - " : "";
      const baseFileName = `${prefix}Comprobacion gastos ${formatearFecha(ultimaFechaGasto).replaceAll('/', '-')}`;

      const [excelBlob, pdfBlob] = await Promise.all([
        generarReporteExcel(gastosFiltrados, fechaInicioReporte, fechaFinReporte, solicitudVinculada, esMAF, montoMAF),
        generarReportePdf(gastosFiltrados, fechaInicioReporte, fechaFinReporte, solicitudVinculada, esMAF, montoMAF)
      ]);

      const zip = new JSZip();
      zip.file(`${baseFileName}.xlsx`, excelBlob);
      zip.file(`${baseFileName}.pdf`, pdfBlob);

      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

      saveAs(zipBlob, `${baseFileName}.zip`);

      if (solicitudVinculada) {
        const sumaFacturado = gastosFiltrados.filter(g => g.url_factura).reduce((sum, g) => sum + parseFloat(g.monto), 0);
        const sumaSinFactura = gastosFiltrados.filter(g => !g.url_factura).reduce((sum, g) => sum + parseFloat(g.monto), 0);
        const importeRecibido = solicitudVinculada.totalSolicitado || 0;
        const porReembolsar = sumaFacturado > importeRecibido ? sumaFacturado - importeRecibido : 0;
        const porReintegrar = importeRecibido > sumaFacturado ? importeRecibido - sumaFacturado : 0;

        const cloudinaryFileName = `${baseFileName} (Solicitud ${solicitudVinculada.fechaInicio}).zip`;
        const { url: reporteUrl, nombreArchivo: nombreReporte } = await subirReporteACloudinary(zipBlob, cloudinaryFileName, 'zip');
        const solicitudRef = doc(db, "solicitudes", solicitudVinculada.id);
        await updateDoc(solicitudRef, {
          estado: 'Esperando...',
          url_reporte_gastos: reporteUrl,
          nombre_archivo_reporte: nombreReporte,
          resumen_sumaFacturado: sumaFacturado,
          resumen_sumaSinFactura: sumaSinFactura,
          resumen_porReembolsar: porReembolsar,
          resumen_porReintegrar: porReintegrar,
        });
      } else if (esMAF) {
        const sumaFacturado = gastosFiltrados.filter(g => g.url_factura).reduce((sum, g) => sum + parseFloat(g.monto), 0);
        const sumaSinFactura = gastosFiltrados.filter(g => !g.url_factura).reduce((sum, g) => sum + parseFloat(g.monto), 0);
        const importeRecibido = montoMAF;
        const porReembolsar = sumaFacturado > importeRecibido ? sumaFacturado - importeRecibido : 0;
        const porReintegrar = importeRecibido > sumaFacturado ? importeRecibido - sumaFacturado : 0;

        const cloudinaryFileName = `${baseFileName}.zip`;
        const { url: reporteUrl, nombreArchivo: nombreReporte, deleteToken } = await subirReporteACloudinary(zipBlob, cloudinaryFileName, 'zip');
        
        await addDoc(collection(db, "solicitudes"), {
          consultor: 'Mario Alberto Agraz Martínez',
          proyecto: 'Rally TrackSIM - MAF',
          fechaInicio: fechaInicioReporte || '',
          fechaFin: fechaFinReporte || '',
          totalSolicitado: montoMAF,
          url_reporte_gastos: reporteUrl,
          nombre_archivo_reporte: nombreReporte,
          deleteToken: deleteToken || '',
          creado_en: Timestamp.now(),
          estado: 'Esperando...',
          userId: user.uid,
          esMAF: true,
          resumen_sumaFacturado: sumaFacturado,
          resumen_sumaSinFactura: sumaSinFactura,
          resumen_porReembolsar: porReembolsar,
          resumen_porReintegrar: porReintegrar,
        });
      }

      const updates = gastosFiltrados.map(gasto => updateDoc(doc(db, "gastos", gasto.id), { archivado: true }));
      await Promise.all(updates); alert("Reporte generado y gastos marcados como archivados.");
    } catch (error) {
      console.error(`Error generando el reporte compilado:`, error);
      alert("Ocurrió un error al generar el reporte: " + error.message);
    } finally {
      setReporteGenerandose(false);
    }
  };

  const handleGenerarReporteMAF = async (montoRecibido) => {
    setReporteGenerandose(true);
    try {
      const gastosMAF = gastos.filter(g => g.categoria === 'MAF');
      if (gastosMAF.length === 0) {
        alert("No hay gastos MAF para generar el reporte.");
        setReporteGenerandose(false);
        return;
      }
      const fInicio = fechaInicio || gastosMAF.reduce((min, g) => g.fecha < min ? g.fecha : min, gastosMAF[0].fecha);
      const fFin = fechaFin || gastosMAF.reduce((max, g) => g.fecha > max ? g.fecha : max, gastosMAF[0].fecha);

      await generarReporte(fInicio, fFin, null, true, montoRecibido);
    } catch (error) {
      console.error("Error reporte MAF:", error);
      alert("Error: " + error.message);
      setReporteGenerandose(false);
    }
  };

  const generarReporteExcel = async (gastosFiltrados, fechaInicioReporte, fechaFinReporte, solicitudVinculada = null, esMAF = false, montoMAF = 0) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Gastos');

    try {
      const logoUrl = esMAF ? '/MAFR.png' : '/CECAI.png';
      const logoImageBytes = await fetch(logoUrl).then((res) => res.arrayBuffer());
      const logoImageId = workbook.addImage({
        buffer: logoImageBytes,
        extension: 'png',
      });
      worksheet.addImage(logoImageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 100, height: 40 }
      });
    } catch {
      console.warn(`No se pudo cargar el logo '${esMAF ? 'MAFR.png' : 'CECAI.png'}'.`);
    }
    worksheet.getRow(1).height = 35;


    const titleStyle = { font: { bold: true, size: 16 } };
    const resumenTitleCell = worksheet.getCell('A3');
    resumenTitleCell.value = "Resumen de Gastos";
    resumenTitleCell.style = titleStyle;
    worksheet.mergeCells('A3:E3');

    let currentRow = 4;
    if (solicitudVinculada) {
      worksheet.getCell(`A${currentRow}`).value = "Consultor:";
      worksheet.getCell(`B${currentRow}`).value = solicitudVinculada.consultor;
      currentRow++;
      worksheet.getCell(`A${currentRow}`).value = "Proyecto:";
      worksheet.getCell(`B${currentRow}`).value = solicitudVinculada.proyecto;
      currentRow++;
    } else if (esMAF) {
      worksheet.getCell(`A${currentRow}`).value = "Consultor:";
      worksheet.getCell(`B${currentRow}`).value = 'Mario Alberto Agraz Martínez';
      currentRow++;
      worksheet.getCell(`A${currentRow}`).value = "Proyecto:";
      worksheet.getCell(`B${currentRow}`).value = 'Rally TrackSIM - MAF';
      currentRow++;
    }
    worksheet.getCell(`A${currentRow}`).value = "Periodo:";
    worksheet.getCell(`B${currentRow}`).value = `${fechaInicioReporte || 'N/A'} al ${fechaFinReporte || 'N/A'}`;
    currentRow += 2;

    const detalleTitleCell = worksheet.getCell(`A${currentRow}`);
    detalleTitleCell.value = "Detalle Financiero";
    detalleTitleCell.style = titleStyle;
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    currentRow++;

    const sumaFacturado = gastosFiltrados.filter(g => g.url_factura).reduce((sum, g) => sum + parseFloat(g.monto), 0);
    const sumaSinFactura = gastosFiltrados.filter(g => !g.url_factura).reduce((sum, g) => sum + parseFloat(g.monto), 0);
    const totalGeneral = sumaFacturado + sumaSinFactura;
    const importeRecibido = esMAF ? montoMAF : (solicitudVinculada ? solicitudVinculada.totalSolicitado : 0);
    let porReembolsar = 0;
    let porReintegrar = 0;
    if (sumaFacturado > importeRecibido) porReembolsar = sumaFacturado - importeRecibido;
    else porReintegrar = importeRecibido - sumaFacturado;

    const addFinancialRow = (label, value) => {
      const labelCell = worksheet.getCell(`A${currentRow}`);
      labelCell.value = label;
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      const valueCell = worksheet.getCell(`C${currentRow}`);
      valueCell.value = value;
      valueCell.numFmt = '$#,##0.00';
      currentRow++;
    };

    addFinancialRow("Importe Recibido", importeRecibido);
    addFinancialRow("Suma Facturado", sumaFacturado);
    addFinancialRow("<< Suma sin factura", sumaSinFactura);
    addFinancialRow("Total General", totalGeneral);
    currentRow++;
    const entityName = esMAF ? "MAF" : "CECAI";
    addFinancialRow(sumaFacturado > importeRecibido ? `<< Por reintegrar desde ${entityName}` : `>> Por reintegrar a ${entityName}`, sumaFacturado > importeRecibido ? porReembolsar : porReintegrar);
    currentRow += 2;

    const detalleGastosTitle = worksheet.getCell(`A${currentRow}`);
    detalleGastosTitle.value = "Detalle de Gastos";
    detalleGastosTitle.style = titleStyle;
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    currentRow += 2;

    const gastosOrdenados = [...gastosFiltrados].sort((a, b) => {
      const aTieneFactura = a.url_factura ? 1 : 0;
      const bTieneFactura = b.url_factura ? 1 : 0;
      if (aTieneFactura !== bTieneFactura) return bTieneFactura - aTieneFactura;
      const order = { 'Comida': 1, 'Transporte': 2, 'Otros': 3 };
      const catA = order[a.categoria] || 99;
      const catB = order[b.categoria] || 99;
      if (catA !== catB) return catA - catB;
      return new Date(a.fecha) - new Date(b.fecha);
    });

    const gastosConFactura = gastosOrdenados.filter(g => g.url_factura);
    const gastosSinFactura = gastosOrdenados.filter(g => !g.url_factura);

    const addGastosSection = (title, gastos, color) => {
      if (gastos.length === 0) return;

      const sectionTitleCell = worksheet.getCell(`A${currentRow}`);
      sectionTitleCell.value = title;
      sectionTitleCell.style = { font: { bold: true, size: 14 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: color } } };
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
      currentRow++;

      const headerRow = worksheet.getRow(currentRow);
      headerRow.values = ['Fecha', 'Categoría', 'Concepto', 'Monto', 'URL Factura'];
      headerRow.font = { bold: true };
      currentRow++;

      const startRowForSubtotal = currentRow;

      gastos.forEach(gasto => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = formatearFecha(gasto.fecha);
        row.getCell(2).value = gasto.categoria;
        row.getCell(3).value = gasto.concepto;
        row.getCell(4).value = parseFloat(gasto.monto);
        row.getCell(4).numFmt = '$#,##0.00';
        if (gasto.url_factura) {
          row.getCell(5).value = { text: 'Link', hyperlink: gasto.url_factura };
          row.getCell(5).font = { color: { argb: 'FF0000FF' }, underline: true };
        }
        currentRow++;
      });

      const subtotalRow = worksheet.getRow(currentRow);
      subtotalRow.getCell(3).value = "Subtotal:";
      subtotalRow.getCell(3).font = { bold: true };
      subtotalRow.getCell(3).alignment = { horizontal: 'right' };

      const subtotalCell = subtotalRow.getCell(4);
      subtotalCell.value = { formula: `SUM(D${startRowForSubtotal}:D${currentRow - 1})` };
      subtotalCell.numFmt = '$#,##0.00';
      subtotalCell.font = { bold: true };
      currentRow++;
    };

    addGastosSection('Gastos con Factura', gastosConFactura, 'E9F5EC');
    addGastosSection('Gastos sin Factura', gastosSinFactura, 'FEF3E7');

    worksheet.columns = [
      { key: 'A', width: 15 },
      { key: 'B', width: 15 },
      { key: 'C', width: 40 },
      { key: 'D', width: 15 },
      { key: 'E', width: 50 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  const generarReportePdf = async (gastosFiltrados, fechaInicioReporte, fechaFinReporte, solicitudVinculada = null, esMAF = false, montoMAF = 0) => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 50;

    let page;
    let y;
    let width;
    let height;

    if (solicitudVinculada) {
      try {
        const solicitudPdfBytes = await fetch(solicitudVinculada.url_pdf_solicitud).then(res => res.arrayBuffer());
        const solicitudPdf = await PDFDocument.load(solicitudPdfBytes);
        const copiedSolicitudPages = await pdfDoc.copyPages(solicitudPdf, solicitudPdf.getPageIndices());
        copiedSolicitudPages.forEach((p) => pdfDoc.addPage(p));
      } catch (error) {
        console.error(`No se pudo cargar el PDF de la solicitud ${solicitudVinculada.id}:`, error);
        alert(`Advertencia: No se pudo adjuntar el PDF de la solicitud ${solicitudVinculada.proyecto}. El reporte continuará sin él.`);
      }
    }

    const sumaFacturado = gastosFiltrados
      .filter(g => g.url_factura)
      .reduce((sum, g) => sum + parseFloat(g.monto), 0);

    const sumaSinFactura = gastosFiltrados
      .filter(g => !g.url_factura)
      .reduce((sum, g) => sum + parseFloat(g.monto), 0);

    const importeRecibido = esMAF ? montoMAF : (solicitudVinculada ? solicitudVinculada.totalSolicitado : 0);
    let porReembolsar = 0;
    let porReintegrar = 0;

    if (sumaFacturado > importeRecibido) {
      porReembolsar = sumaFacturado - importeRecibido;
    } else {
      porReintegrar = importeRecibido - sumaFacturado;
    }

    page = pdfDoc.addPage();
    ({ width, height } = page.getSize());
    let currentY = height - margin;

    try {
      const logoUrl = esMAF ? '/MAFR.png' : '/CECAI.png';
      const logoImageBytes = await fetch(logoUrl).then((res) => res.arrayBuffer());
      const logoImage = await pdfDoc.embedPng(logoImageBytes);
      const logoDims = logoImage.scale(0.05);
      page.drawImage(logoImage, {
        x: margin,
        y: currentY - logoDims.height,
        width: logoDims.width,
        height: logoDims.height,
      });
    } catch {
      console.warn(`No se pudo cargar el logo '${esMAF ? 'MAFR.png' : 'CECAI.png'}'.`);
    }
    currentY -= 100;

    page.drawText('Resumen de Gastos', { x: margin, y: currentY, font: boldFont, size: 24, color: rgb(0, 0, 0) });
    currentY -= 40;

    if (solicitudVinculada) {
      page.drawText(`Consultor: ${solicitudVinculada.consultor}`, { x: margin, y: currentY, font: font, size: 14 });
      currentY -= 20;
      page.drawText(`Proyecto: ${solicitudVinculada.proyecto}`, { x: margin, y: currentY, font: font, size: 14 });
      currentY -= 20;
    } else if (esMAF) {
      page.drawText('Consultor: Mario Alberto Agraz Martínez', { x: margin, y: currentY, font: font, size: 14 });
      currentY -= 20;
      page.drawText('Proyecto: Rally TrackSIM - MAF', { x: margin, y: currentY, font: font, size: 14 });
      currentY -= 20;
    }
    page.drawText(`Periodo: ${formatearFecha(fechaInicioReporte) || 'N/A'} al ${formatearFecha(fechaFinReporte) || 'N/A'}`, { x: margin, y: currentY, font: font, size: 14 });
    currentY -= 40;

    page.drawText('Detalle Financiero:', { x: margin, y: currentY, font: boldFont, size: 16 });
    currentY -= 30;

    if (solicitudVinculada || esMAF) {
      const importeRecibidoTexto = formatoMoneda(importeRecibido);
      const importeRecibidoAncho = boldFont.widthOfTextAtSize(importeRecibidoTexto, 12);
      page.drawText('Importe recibido:', { x: margin, y: currentY, font: font, size: 12 });
      page.drawText(importeRecibidoTexto, { x: width - margin - importeRecibidoAncho, y: currentY, font: boldFont, size: 12 });
      currentY -= 20;
    }

    const sumaFacturadoTexto = formatoMoneda(sumaFacturado);
    const sumaFacturadoAncho = boldFont.widthOfTextAtSize(sumaFacturadoTexto, 12);
    page.drawText('Suma Facturado:', { x: margin, y: currentY, font: font, size: 12 });
    page.drawText(sumaFacturadoTexto, { x: width - margin - sumaFacturadoAncho, y: currentY, font: boldFont, size: 12 });
    currentY -= 20;

    const sumaSinFacturaTexto = formatoMoneda(sumaSinFactura);
    const sumaSinFacturaAncho = boldFont.widthOfTextAtSize(sumaSinFacturaTexto, 12);
    page.drawText('<< Suma sin factura:', { x: margin, y: currentY, font: font, size: 12 });
    page.drawText(sumaSinFacturaTexto, { x: width - margin - sumaSinFacturaAncho, y: currentY, font: boldFont, size: 12 });
    currentY -= 30;

    if (solicitudVinculada || esMAF) {
      const entityName = esMAF ? "MAF" : "CECAI";
      if (sumaFacturado > importeRecibido) {
        const porReembolsarTexto = formatoMoneda(porReembolsar);
        const porReembolsarAncho = boldFont.widthOfTextAtSize(porReembolsarTexto, 12);
        page.drawText(`<< Por reintegrar desde ${entityName}:`, { x: margin, y: currentY, font: boldFont, size: 12, color: rgb(0, 0.5, 0) });
        page.drawText(porReembolsarTexto, { x: width - margin - porReembolsarAncho, y: currentY, font: boldFont, size: 12, color: rgb(0, 0.5, 0) });
      } else {
        const porReintegrarTexto = formatoMoneda(porReintegrar);
        const porReintegrarAncho = boldFont.widthOfTextAtSize(porReintegrarTexto, 12);
        page.drawText(`>> Por reintegrar a ${entityName}:`, { x: margin, y: currentY, font: boldFont, size: 12, color: rgb(0.8, 0.2, 0) });
        page.drawText(porReintegrarTexto, { x: width - margin - porReintegrarAncho, y: currentY, font: boldFont, size: 12, color: rgb(0.8, 0.2, 0) });
      }
    }
    currentY -= 20;

    const checkPageBreak = () => {
      if (y < margin) {
        page = pdfDoc.addPage();
        y = height - margin;
        return true;
      }
      return false;
    };

    page = pdfDoc.addPage();
    ({ width, height } = page.getSize());
    y = height - margin;

    page.drawText('Reporte de Gastos', { x: margin, y, font: boldFont, size: 24, color: rgb(0, 0, 0) });
    y -= 30;

    const rangoFechas = (fechaInicioReporte || fechaFinReporte)
      ? `Periodo: ${formatearFecha(fechaInicioReporte) || 'N/A'} a ${formatearFecha(fechaFinReporte) || 'N/A'}`
      : 'Periodo: Todos los gastos';
    page.drawText(rangoFechas, { x: margin, y, font, size: 12, color: rgb(0.3, 0.3, 0.3) });
    y -= 40;

    const dataAgrupadaReporte = gastosFiltrados.reduce((acc, gasto) => {
      const estado = gasto.url_factura ? 'Con Factura' : 'Sin Factura';
      const categoria = gasto.categoria || 'Otros';
      const fecha = gasto.fecha;

      if (!acc[estado]) acc[estado] = { totalEstado: 0, categorias: {} };
      if (!acc[estado].categorias[categoria]) acc[estado].categorias[categoria] = { totalCategoria: 0, fechas: {} };
      if (!acc[estado].categorias[categoria].fechas[fecha]) acc[estado].categorias[categoria].fechas[fecha] = [];

      acc[estado].categorias[categoria].fechas[fecha].push(gasto);
      acc[estado].categorias[categoria].totalCategoria += parseFloat(gasto.monto);
      acc[estado].totalEstado += parseFloat(gasto.monto);

      return acc;
    }, {});


    const sortedEstados = Object.entries(dataAgrupadaReporte).sort(([estadoA], [estadoB]) => {
      if (estadoA === 'Con Factura') return -1;
      if (estadoB === 'Con Factura') return 1;
      return 0;
    });

    for (const [estado, datosEstado] of sortedEstados) {
      checkPageBreak();
      const isFactura = estado === 'Con Factura';
      const subtotalTexto = formatoMoneda(datosEstado.totalEstado);
      const subtotalAncho = boldFont.widthOfTextAtSize(subtotalTexto, 16);
      page.drawText(estado, { x: margin, y, font: boldFont, size: 16, color: isFactura ? rgb(0.05, 0.4, 0.11) : rgb(0.72, 0.38, 0.02) });
      page.drawText(subtotalTexto, { x: width - margin - subtotalAncho, y, font: boldFont, size: 16, color: isFactura ? rgb(0.05, 0.4, 0.11) : rgb(0.72, 0.38, 0.02) });

      y -= 25;

      const sortedCategorias = Object.entries(datosEstado.categorias).sort(([catA], [catB]) => {
        const order = { 'Comida': 1, 'Transporte': 2, 'Otros': 3 };
        return (order[catA] || 99) - (order[catB] || 99);
      });

      for (const [nombreCategoria, datosCategoria] of sortedCategorias) {
        checkPageBreak();
        page.drawText(nombreCategoria, { x: margin + 15, y, font: boldFont, size: 12, color: rgb(0.1, 0.1, 0.1) });
        y -= 20;

        const fechasOrdenadas = Object.keys(datosCategoria.fechas).sort((a, b) => new Date(a) - new Date(b));

        for (const fecha of fechasOrdenadas) {
          checkPageBreak();
          page.drawText(formatearFecha(fecha), { x: margin + 30, y, font, size: 10, color: rgb(0.2, 0.5, 0.2) });
          y -= 18;

          const items = datosCategoria.fechas[fecha];
          for (const gasto of items) {
            checkPageBreak();
            const montoTexto = formatoMoneda(gasto.monto);
            const montoAncho = boldFont.widthOfTextAtSize(montoTexto, 10);
            page.drawText(gasto.concepto.substring(0, 50), { x: margin + 45, y, font, size: 10 });
            page.drawText(montoTexto, { x: width - margin - montoAncho, y, font: boldFont, size: 10 });
            y -= 15;
          }
        }
        y -= 10;
      }
      y -= 15;
    }

    checkPageBreak();
    y -= 10;

    const totalGeneral = Object.values(dataAgrupadaReporte).reduce((sum, e) => sum + e.totalEstado, 0);
    const totalTexto = formatoMoneda(totalGeneral);
    const totalAncho = boldFont.widthOfTextAtSize(totalTexto, 14);
    page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 1 });
    page.drawText('TOTAL GENERAL:', { x: margin, y: y - 5, font: boldFont, size: 14 });
    page.drawText(totalTexto, { x: width - margin - totalAncho, y: y - 5, font: boldFont, size: 14 });

    const gastosConFactura = gastosFiltrados
      .filter(g => g.url_factura)
      .sort((a, b) => {
        const order = { 'Comida': 1, 'Transporte': 2, 'Otros': 3 };
        const categoriaA = order[a.categoria] || 99;
        const categoriaB = order[b.categoria] || 99;
        if (categoriaA !== categoriaB) {
          return categoriaA - categoriaB;
        }
        return a.fecha.localeCompare(b.fecha);
      });


    if (gastosConFactura.length > 0) {
      page = pdfDoc.addPage();
      y = height - margin;

      page.drawText('Índice de Facturas Adjuntas', {
        x: margin, y, font: boldFont, size: 24, color: rgb(0, 0, 0)
      });
      y -= 40;

      page.drawText('Concepto del Gasto', { x: margin, y, font: boldFont, size: 10 });
      page.drawText('Fecha', { x: width - margin - 100, y, font: boldFont, size: 10 });
      y -= 15;
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
      y -= 20;

      for (const gasto of gastosConFactura) {
        checkPageBreak();
        page.drawText(gasto.concepto.substring(0, 70), { x: margin, y, font, size: 10 });
        page.drawText(formatearFecha(gasto.fecha), { x: width - margin - 100, y, font, size: 10 });
        y -= 20;
      }
    }

    for (const gasto of gastosConFactura) {
      try {
        const url = gasto.url_factura;
        const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());
        const donorPdfDoc = await PDFDocument.load(existingPdfBytes);
        const copiedPages = await pdfDoc.copyPages(donorPdfDoc, donorPdfDoc.getPageIndices());
        copiedPages.forEach((page) => pdfDoc.addPage(page));
      } catch (error) {
        console.error(`No se pudo cargar o procesar el PDF para el gasto '${gasto.concepto}':`, error);
      }
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return blob;
  };

  const limpiarFiltros = () => {
    setFechaInicio('');
    setFechaFin('');
    setTerminoBusqueda('');
  };

  const getCategoryDetails = (cat) => {
    switch (cat) {
      case 'Transporte': return { color: 'slate', icon: Car };
      case 'Comida': return { color: 'slate', icon: Utensils };
      case 'MAF': return { color: 'orange', icon: ShieldCheck };
      default: return { color: 'slate', icon: Layers };
    }
  };

  const dataAgrupada = useMemo(() => {
    const filtrados = gastos.filter(g => {
      if (!mostrarArchivados && g.archivado) {
        return false;
      }
      if (fechaInicio && g.fecha < fechaInicio) return false;
      if (fechaFin && g.fecha > fechaFin) return false;
      if (terminoBusqueda && !g.concepto.toLowerCase().includes(terminoBusqueda.toLowerCase())) {
        const gastoPadrePropina = gastos.find(padre => padre.idPropina === g.id);
        if (gastoPadrePropina && gastoPadrePropina.concepto.toLowerCase().includes(terminoBusqueda.toLowerCase())) return true;

        const gastoPadreCaseta = gastos.find(padre => padre.id === g.idPadre);
        if (gastoPadreCaseta && gastoPadreCaseta.concepto.toLowerCase().includes(terminoBusqueda.toLowerCase())) return true;

        return false;
      }
      return true;
    });

    const resultado = filtrados.reduce((acc, gasto) => {
      const estado = gasto.categoria === 'MAF' ? 'MAF' : (gasto.url_factura ? 'Con Factura' : 'Sin Factura');
      const categoria = gasto.categoria || 'Otros';
      const fecha = gasto.fecha;

      if (!acc[estado]) acc[estado] = { totalEstado: 0, categorias: {} };
      if (!acc[estado].categorias[categoria]) acc[estado].categorias[categoria] = { totalCategoria: 0, fechas: {} };
      if (!acc[estado].categorias[categoria].fechas[fecha]) acc[estado].categorias[categoria].fechas[fecha] = [];

      acc[estado].categorias[categoria].fechas[fecha].push(gasto);
      acc[estado].categorias[categoria].totalCategoria += parseFloat(gasto.monto);
      acc[estado].totalEstado += parseFloat(gasto.monto);

      return acc;
    }, {});

    return resultado;
  }, [gastos, fechaInicio, fechaFin, terminoBusqueda, mostrarArchivados]);

  const totalNormal = useMemo(() => {
    let total = 0;
    Object.values(dataAgrupada).forEach(estado => {
      Object.entries(estado.categorias).forEach(([cat, datos]) => {
        if (cat !== 'MAF') total += datos.totalCategoria;
      });
    });
    return total;
  }, [dataAgrupada]);

  const totalMAF = useMemo(() => {
    let total = 0;
    Object.values(dataAgrupada).forEach(estado => {
      Object.entries(estado.categorias).forEach(([cat, datos]) => {
        if (cat === 'MAF') total += datos.totalCategoria;
      });
    });
    return total;
  }, [dataAgrupada]);

  const statsCategorias = useMemo(() => {
    const totales = {};
    const diasConGastos = new Set();

    Object.values(dataAgrupada).forEach(estado => {
      Object.entries(estado.categorias).forEach(([cat, datos]) => {
        totales[cat] = (totales[cat] || 0) + datos.totalCategoria;
        Object.keys(datos.fechas).forEach(fecha => {
          diasConGastos.add(fecha);
        });
      });
    });

    const numDias = diasConGastos.size;
    if (numDias === 0) return [];

    return Object.entries(totales).map(([categoria, total]) => ({
      categoria,
      total,
      promedio: total / numDias,
      details: getCategoryDetails(categoria)
    }));
  }, [dataAgrupada]);

  return (
    <div className="space-y-4 relative">
      <div className="sticky top-0 z-10 bg-slate-100 pt-1 pb-4 -mt-4 -mx-4 px-4 border-b border-slate-200">
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <div className="bg-white p-2 rounded-full border border-gray-200 flex items-center gap-2 flex-1 shadow-sm">
              <Calendar size={14} className="text-gray-400 ml-1" />
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="rounded-full border-none bg-transparent w-full text-xs outline-none text-gray-600" />
            </div>
            <div className="bg-white p-2 rounded-full border border-gray-200 flex items-center gap-2 flex-1 shadow-sm">
              <Calendar size={14} className="text-gray-400 ml-1" />
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="rounded-full border-none bg-transparent w-full text-xs outline-none text-gray-600" />
            </div>
            <button onClick={() => setMostrarArchivados(!mostrarArchivados)} className={`p-2 rounded-full border transition-all shadow-sm flex-shrink-0 ${mostrarArchivados ? 'bg-blue-100 border-blue-200 text-blue-600' : 'bg-transparent border-gray-200 text-slate-400 hover:bg-slate-50'}`} title={mostrarArchivados ? "Ocultar archivados" : "Mostrar archivados"}>
              {mostrarArchivados
                ? <ArchiveRestore size={16} />
                : <Archive size={16} />
              }
            </button>
            {mostrarArchivados && gastos.some(g => g.archivado) && !esVistaAdmin && (
              <button onClick={handleUnarchiveVisible} disabled={isUnarchiving} className="flex items-center gap-1 p-2 rounded-full border transition-all shadow-sm flex-shrink-0 bg-yellow-100 border-yellow-200 text-yellow-700 hover:bg-yellow-200" title="Desarchivar todos los visibles">
                {isUnarchiving ? <Loader2 size={16} className="animate-spin" /> : <ArchiveRestore size={16} />}
                <span className="text-xs font-bold">Desarchivar</span>
              </button>
            )}
            {(fechaInicio || fechaFin || terminoBusqueda) && (
              <button onClick={limpiarFiltros} className="bg-transparent p-2 rounded-full border border-gray-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm flex-shrink-0" title="Limpiar filtros">
                <RotateCcw size={16} />
              </button>
            )}
          </div>
          <div className="bg-white p-2 rounded-full border border-gray-200 flex items-center gap-2 flex-1 shadow-sm">
            <Search size={14} className="text-gray-400 ml-1" />
            <input
              type="text"
              placeholder="Buscar por concepto..."
              value={terminoBusqueda}
              onChange={e => setTerminoBusqueda(e.target.value)}
              className="border-none bg-transparent w-full text-xs outline-none text-gray-600"
            />
          </div>
          <button onClick={() => setModalReporteAbierto(true)} disabled={reporteGenerandose} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-full flex justify-center items-center gap-2 shadow-lg shadow-emerald-200 transition-all disabled:opacity-60 disabled:cursor-wait">
            <FileDown size={16} />
            <span className="text-xs uppercase font-bold tracking-wider">{reporteGenerandose ? 'Generando...' : 'Generar Reporte'}</span>
          </button>
        </div>
      </div>

      {/* 0. RESUMEN ESTADÍSTICO POR CATEGORÍA */}
      {statsCategorias.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 mt-2">
          {statsCategorias.map((stat) => (
            <div key={stat.categoria} className="flex-shrink-0 bg-white/60 backdrop-blur-sm p-3 rounded-2xl border border-white/50 shadow-sm min-w-[100px] flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-1">
                <stat.details.icon size={14} className="text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{stat.categoria}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-slate-800">{formatoMoneda(stat.promedio)}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Promedio / día</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 1. TOTALES SEPARADOS */}
      <div className={`grid gap-3 ${totalMAF > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        <Card decoration="top" decorationColor="blue" className="italic font-black py-1 px-0 mt-0 shadow-sm border-blue-100">
          <Flex justifyContent="between" alignItems="center" className="px-4">
            <Text className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Total Periodo</Text>
            <Metric className="italic text-xl font-black text-slate-800">
              {formatoMoneda(totalNormal)}
            </Metric>
          </Flex>
        </Card>

        {totalMAF > 0 && (
          <Card decoration="top" decorationColor="orange" className="italic font-black py-1 px-0 mt-0 shadow-sm border-orange-100 bg-orange-50/30">
            <Flex justifyContent="between" alignItems="center" className="px-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-orange-500" />
                <Text className="text-orange-600 uppercase text-[10px] font-bold tracking-widest">Total MAF</Text>
              </div>
              <Metric className="italic text-xl font-black text-orange-700">
                {formatoMoneda(totalMAF)}
              </Metric>
            </Flex>
          </Card>
        )}
      </div>

      {gastoAEditar && (
        <EditGastoModal
          gasto={gastoAEditar}
          onClose={() => setGastoAEditar(null)}
          onSave={guardarEdicion}
        />
      )}

      {modalReporteAbierto && (
        <ReporteOpcionesModal
          onClose={() => setModalReporteAbierto(false)}
          onGenerarConFechasPersonalizadas={handleAbrirModalSolicitudParaReporte}
          onGenerarConSolicitud={(solicitud) => generarReporte(solicitud.fechaInicio, solicitud.fechaFin, solicitud)}
          onGenerarReporteMAF={(monto) => handleGenerarReporteMAF(monto)}
        />
      )}

      {modalSolicitudParaReporteAbierto && (
        <SolicitudRecursosModal
          onClose={() => setModalSolicitudParaReporteAbierto(false)}
          fechaInicioInicial={fechaInicio}
          fechaFinInicial={fechaFin}
          onSolicitudCreada={(nuevaSolicitud) => generarReporte(nuevaSolicitud.fechaInicio, nuevaSolicitud.fechaFin, nuevaSolicitud)}
        />
      )}

      {Object.entries(dataAgrupada)
        .sort(([estadoA], [estadoB]) => {
          const order = { 'Con Factura': 1, 'Sin Factura': 2, 'MAF': 3 };
          return (order[estadoA] || 99) - (order[estadoB] || 99);
        })
        .map(([estado, datosEstado]) => {
          const isFactura = estado === 'Con Factura';
          const isMAFState = estado === 'MAF';
          const colorEstado = 'transparent';
          const IconoEstado = isMAFState ? ShieldCheck : (isFactura ? FileCheck : AlertTriangle);

          return (
            <Card key={estado} className="p-0 overflow-hidden shadow-sm">
              <div className={`py-0 px-0 border-l-4 ${isMAFState ? 'border-orange-100 bg-orange-100' : (isFactura ? 'border-emerald-100 bg-emerald-100' : 'border-amber-100 bg-amber-100')}`}>
                <Flex justifyContent="between" alignItems="center">
                  <div className="flex items-center gap-2">
                    <Icon icon={IconoEstado} color={colorEstado} variant="light" size="sm" />
                    <Title className={`text-sm uppercase font-bold ${isMAFState ? 'text-orange-900' : (isFactura ? 'text-emerald-900' : 'text-amber-900')}`}>
                      {isMAFState ? 'Gastos MAF' : estado}
                    </Title>
                  </div>
                  <Text className={`font-bold ${isMAFState ? 'text-orange-700' : (isFactura ? 'text-emerald-700' : 'text-amber-700')}`}>
                    {formatoMoneda(datosEstado.totalEstado)}
                  </Text>
                </Flex>
              </div>

              <div className="p-4 space-y-4">
                {Object.entries(datosEstado.categorias)
                  .sort(([catA], [catB]) => {
                    const order = { 'Comida': 1, 'Transporte': 2, 'MAF': 3, 'Otros': 4 };
                    return (order[catA] || 99) - (order[catB] || 99);
                  })
                  .map(([nombreCategoria, datosCategoria], indexCat) => {

                    const { icon: CatIcon } = getCategoryDetails(nombreCategoria);
                    const fechasOrdenadas = Object.keys(datosCategoria.fechas).sort((a, b) => new Date(a) - new Date(b));

                    return (
                      <div key={nombreCategoria}>
                        {indexCat > 0 && <Divider className="my-0 opacity-50" />}
                        <div className="pt-2 pb-0">
                          <div className="-mr-4 -ml-4 px-0 mb-2">
                            <Flex justifyContent="between" alignItems="center">
                              <div className="flex items-center gap-1.5 pl-1">
                                <CatIcon size={20} className="text-slate-900" strokeWidth={2.5} />
                                <span className="text-xs font-black uppercase text-slate-900 tracking-wide">
                                  {nombreCategoria}
                                </span>
                              </div>

                              <Text className="text-sm font-bold text-blue-700">
                                {formatoMoneda(datosCategoria.totalCategoria)}
                              </Text>
                            </Flex>
                          </div>
                          <div className="space-y-0">
                            {fechasOrdenadas.map((fecha) => {
                              const items = datosCategoria.fechas[fecha];
                              return (
                                <div key={fecha} className="px-0">
                                  <div className="flex items-center gap-4 mb-0 ml-0">
                                    <Text className="text-xs font-bold text-green-700 uppercase">{formatearFecha(fecha)}</Text>
                                  </div>
                                  <List className="mt-0 space-y-0">
                                    {items.map((gasto) => {
                                      const padreGasto = gasto.idPadre ? gastos.find(p => p.id === gasto.idPadre) : null;
                                      if (gasto.idPadre) {
                                        const mismoEstadoQuePadre = (!!gasto.url_factura === !!padreGasto?.url_factura);
                                        if (mismoEstadoQuePadre) return null;
                                      }

                                      const misCasetas = gastos.filter(g => g.idPadre === gasto.id);
                                      const casetasVisibles = misCasetas.filter(c => !!c.url_factura === !!gasto.url_factura);

                                      return (
                                        <div key={gasto.id} className="border-b border-slate-100 last:border-0">
                                          <ListItem className="p-0 border-none">
                                            <div className="grid grid-cols-12 w-full items-center py-2 px-2 bg-slate-50/50 rounded hover:bg-slate-100 transition-colors">

                                              <div className="col-span-6 pr-2 flex items-center gap-1.5 overflow-hidden">
                                                {gasto.archivado && (
                                                  <div className="text-slate-400 flex-shrink-0" title="Gasto archivado">
                                                    <Archive size={12} strokeWidth={2.5} />
                                                  </div>
                                                )}
                                                <Text className="font-bold text-slate-700 truncate text-xs sm:text-sm" title={gasto.concepto}>
                                                  {gasto.idPadre ? `Caseta de: ${padreGasto?.concepto || 'Gasto Eliminado'}` : gasto.concepto}
                                                </Text>
                                                {gasto.idPropina && (
                                                  <div className="bg-transparent text-yellow-600 p-0.5 rounded flex-shrink-0" title="Tiene propina asignada">
                                                    <Coins size={10} strokeWidth={2.5} />
                                                  </div>
                                                )}
                                                {misCasetas.length > 0 && (
                                                  <Badge size="xs" color="slate-400" className="px-1 py-0 text-[9px] uppercase font-bold">+{misCasetas.length} Casetas</Badge>
                                                )}
                                              </div>

                                              <div className="col-span-3 text-right">
                                                <Text className="font-mono font-bold text-slate-900 text-sm">
                                                  {formatoMoneda(parseFloat(gasto.monto))}
                                                </Text>
                                              </div>

                                              <div className="col-span-3 flex justify-end items-center gap-0 pl-1 -mr-6">
                                                {/* Factura Gasto Principal */}
                                                {gasto.url_factura && (
                                                  <a href={gasto.url_factura} target="_blank" rel="noreferrer" className="p-1 text-slate-400 hover:text-slate-600" title="Factura principal">
                                                    <FileText size={20} />
                                                  </a>
                                                )}

                                                {!esVistaAdmin && (
                                                  <>
                                                    <button
                                                      type="button"
                                                      onClick={() => abrirEdicion(gasto)}
                                                      className="bg-transparent border-none p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    >
                                                      <Pencil size={20} />
                                                    </button>

                                                    <button onClick={() => eliminarGasto(gasto.id, gasto.idPropina)} className="bg-transparent border-none p-0 cursor-pointer group-hover:scale-110 transition-transform" title="Eliminar">
                                                      <Trash2 size={20} color="#ef4444" strokeWidth={2.5} />
                                                    </button>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          </ListItem>

                                          {/* Desglose de Casetas (Solo las que coinciden con el estado actual de factura) */}
                                          {casetasVisibles.length > 0 && (
                                            <div className="ml-10 mb-2 mt-0.5 space-y-1">
                                              {casetasVisibles.map((caseta, idx) => (
                                                <div key={caseta.id} className="flex items-center justify-between pr-4 bg-slate-50/30 py-0.5 px-2 rounded border border-slate-100/50">
                                                  <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Caseta {idx + 1}</span>
                                                    {caseta.url_factura && (
                                                      <a href={caseta.url_factura} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 flex items-center gap-1.5 no-underline">
                                                        <FileText size={12} />
                                                        <span className="text-[9px] font-black uppercase">Ver Factura</span>
                                                      </a>
                                                    )}
                                                  </div>
                                                  <span className="text-[10px] font-mono font-bold text-slate-600">{formatoMoneda(caseta.monto)}</span>
                                                </div>
                                              ))}
                                              {/* Fila de Total de este Gasto + sus Casetas del mismo estado */}
                                              <div className="flex items-center justify-between pr-4 bg-blue-50/50 py-1 px-2 rounded border border-blue-100/50 mt-1">
                                                <span className="text-[10px] font-black text-yellow-700 uppercase">Total con Casetas</span>
                                                <span className="text-[14px] font-mono font-black text-yellow-700">
                                                  {formatoMoneda(parseFloat(gasto.monto) + casetasVisibles.reduce((acc, c) => acc + parseFloat(c.monto), 0))}
                                                </span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </List>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          );
        })}

    </div>
  );
};

export default ListaGastos;