import { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../firebase';
import SolicitudRecursosModal from './SolicitudRecursosModal';
import EditGastoModal from './EditGastoModal';
import ReporteOpcionesModal from './ReporteOpcionesModal';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
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
} from "@tremor/react";
import { FileText, Trash2, Calendar, FileCheck, AlertTriangle, Car, Utensils, Layers, Pencil, RotateCcw, Coins, Search, FileDown, Archive, ArchiveRestore, Loader2 } from 'lucide-react';

const ListaGastos = () => {
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
  
  const formatoMoneda = (cantidad) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(cantidad);
  };

  useEffect(() => {
    const q = query(collection(db, "gastos"), orderBy("creado_en", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGastos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const eliminarGasto = async (id, idPropina) => {
    if (confirm("¿Borrar este registro?")) {
      await deleteDoc(doc(db, "gastos", id));
      if (idPropina) {
        try {
           await deleteDoc(doc(db, "gastos", idPropina));
        } catch (e) {
           console.log("La propina ya no existía o error al borrar", e);
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
                    creado_en: Timestamp.now()
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
    const gastoPadre = gastos.find(g => g.idPropina === gasto.id);
    // Si se hace clic en una propina, abre la edición del gasto padre
    setGastoAEditar(gastoPadre || gasto);
  };

  const subirReporteACloudinary = async (fileBlob, solicitudId, formato) => {
    const CLOUD_NAME = "didj7kuah"; 
    const UPLOAD_PRESET = "gastos_app"; 
  
    const fileExtension = formato === 'excel' ? 'xlsx' : 'pdf';
    const mimeType = formato === 'excel' 
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      : 'application/pdf';

    // La función ahora recibe un Blob directamente, no los bytes.
    // Si por alguna razón se pasan bytes, lo convertimos a Blob.
    let blob;
    if (formato === 'zip') {
      blob = fileBlob instanceof Blob ? fileBlob : new Blob([fileBlob], { type: 'application/zip' });
    } else {
      blob = fileBlob instanceof Blob ? fileBlob : new Blob([fileBlob], { type: mimeType });
    }

    const data = new FormData();
    // El nombre del archivo en Cloudinary se pasa ahora como parámetro
    // const finalExtension = formato === 'zip' ? 'zip' : fileExtension;
    // const fileName = `reporte_gastos_${solicitudId}.${finalExtension}`;
    data.append("file", blob, solicitudId); // solicitudId ahora contiene el nombre completo del archivo
    data.append("upload_preset", UPLOAD_PRESET);
    data.append("cloud_name", CLOUD_NAME);

    // Usamos el endpoint 'raw' para archivos que no son multimedia (como PDF, XLSX, ZIP).
    const uploadEndpoint = `raw/upload`;
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${uploadEndpoint}`, { method: "POST", body: data });
    const fileData = await response.json();

    if (!response.ok || !fileData.secure_url) {
        console.error("Error subiendo reporte a Cloudinary:", fileData);
        throw new Error(fileData.error?.message || "Error al subir el reporte a Cloudinary");
    }
    return fileData.secure_url;
  };

  const handleAbrirModalSolicitudParaReporte = () => {
    if (!fechaInicio || !fechaFin) {
      alert("Por favor, selecciona un rango de fechas en los filtros antes de continuar.");
      return;
    }
    setModalReporteAbierto(false);
    setModalSolicitudParaReporteAbierto(true);
  };


  const handleUnarchiveVisible = async () => {
    const archivedVisibleGastos = [];
    // Aplanar dataAgrupada para obtener todos los elementos archivados visibles
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

  const generarReporte = async (fechaInicioReporte, fechaFinReporte, solicitudVinculada = null) => {
    setReporteGenerandose(true);
    try {
      // 1. Filtrar todos los gastos según los filtros actuales (no solo los que tienen factura)
      // Usaremos dataAgrupada que ya tiene los filtros y la agrupación aplicados.
      const gastosFiltrados = gastos.filter(g => {
        if (fechaInicioReporte && g.fecha < fechaInicioReporte) return false;
        if (fechaFinReporte && g.fecha > fechaFinReporte) return false;
        if (terminoBusqueda && !g.concepto.toLowerCase().includes(terminoBusqueda.toLowerCase())) {
          const gastoPadre = gastos.find(padre => padre.idPropina === g.id);
          return gastoPadre && gastoPadre.concepto.toLowerCase().includes(terminoBusqueda.toLowerCase());
        }
        return true;
      });
      
      if (gastosFiltrados.length === 0) {
        alert("No hay gastos en el periodo seleccionado para generar un reporte.");
        return; // No es necesario cambiar el estado aquí, se hace en el finally
      }

      const ultimaFechaGasto = gastosFiltrados.reduce((max, g) => g.fecha > max ? g.fecha : max, gastosFiltrados[0].fecha);
      const baseFileName = `Comprobacion gastos ${ultimaFechaGasto}`;

      // 2. Generar ambos reportes y obtener sus blobs
      const [excelBlob, pdfBlob] = await Promise.all([
        generarReporteExcel(gastosFiltrados, fechaInicioReporte, fechaFinReporte, solicitudVinculada),
        generarReportePdf(gastosFiltrados, fechaInicioReporte, fechaFinReporte, solicitudVinculada)
      ]);

      // 3. Crear el archivo ZIP
      const zip = new JSZip();
      zip.file(`${baseFileName}.xlsx`, excelBlob);
      zip.file(`${baseFileName}.pdf`, pdfBlob);

      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

      // 4. Descargar el ZIP
      saveAs(zipBlob, `${baseFileName}.zip`);

      // 5. Subir a Cloudinary si hay solicitud
      if (solicitudVinculada) {
        const cloudinaryFileName = `${baseFileName} (Solicitud ${solicitudVinculada.id}).zip`;
        const reporteUrl = await subirReporteACloudinary(zipBlob, cloudinaryFileName, 'zip');
        const solicitudRef = doc(db, "solicitudes", solicitudVinculada.id);
        await updateDoc(solicitudRef, { estado: 'Finalizada', url_reporte_gastos: reporteUrl });
      }

      // Marcar gastos como archivados
      const updates = gastosFiltrados.map(gasto => updateDoc(doc(db, "gastos", gasto.id), { archivado: true }));
      await Promise.all(updates);      alert("Reporte generado y gastos marcados como archivados.");
    } catch (error) {
      console.error(`Error generando el reporte compilado:`, error);
      alert("Ocurrió un error al generar el reporte: " + error.message);
    } finally {
      setReporteGenerandose(false);
    }
  };

  const generarReporteExcel = async (gastosFiltrados, fechaInicioReporte, fechaFinReporte, solicitudVinculada = null) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Gastos');

    // --- 1. Añadir Imagen ---
    try {
      const logoUrl = '/CECAI.png'; // Asegúrate que este archivo exista en tu carpeta /public
      const logoImageBytes = await fetch(logoUrl).then((res) => res.arrayBuffer());
      const logoImageId = workbook.addImage({
        buffer: logoImageBytes,
        extension: 'png',
      });
      // Colocar la imagen en la celda A1, ajustando su tamaño
      worksheet.addImage(logoImageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 100, height: 40 } // Ajusta el tamaño como necesites
      });
    } catch (error) {
      console.warn("No se pudo cargar el logo 'CECAI.png'. El reporte se generará sin él.");
    }
    worksheet.getRow(1).height = 35; // Aumentar altura de la primera fila

    // --- 2. Sección de Resumen ---
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
      worksheet.getCell(`A${currentRow}`).value = "Solicitud:";
      worksheet.getCell(`B${currentRow}`).value = solicitudVinculada.proyecto;
      currentRow++;
    }
    worksheet.getCell(`A${currentRow}`).value = "Periodo:";
    worksheet.getCell(`B${currentRow}`).value = `${fechaInicioReporte || 'N/A'} al ${fechaFinReporte || 'N/A'}`;
    currentRow += 2;

    // Detalle Financiero
    const detalleTitleCell = worksheet.getCell(`A${currentRow}`);
    detalleTitleCell.value = "Detalle Financiero";
    detalleTitleCell.style = titleStyle;
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    currentRow++;

    const sumaFacturado = gastosFiltrados.filter(g => g.url_factura).reduce((sum, g) => sum + parseFloat(g.monto), 0);
    const sumaSinFactura = gastosFiltrados.filter(g => !g.url_factura).reduce((sum, g) => sum + parseFloat(g.monto), 0);
    const totalGeneral = sumaFacturado + sumaSinFactura;
    const importeRecibido = solicitudVinculada ? solicitudVinculada.totalSolicitado : 0;
    let porReembolsar = 0;
    let porReintegrar = 0;
    if (importeRecibido > 0) {
      if (sumaFacturado > importeRecibido) porReembolsar = sumaFacturado - importeRecibido;
      else if (importeRecibido > sumaFacturado) porReintegrar = importeRecibido - sumaFacturado;
    }

    const addFinancialRow = (label, value) => {
      const labelCell = worksheet.getCell(`A${currentRow}`);
      labelCell.value = label;
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      const valueCell = worksheet.getCell(`C${currentRow}`);
      valueCell.value = value;
      valueCell.numFmt = '$#,##0.00';
      currentRow++;
    };

    addFinancialRow("Importe Recibido", importeRecibido > 0 ? importeRecibido : "N/A");
    addFinancialRow("Suma Facturado", sumaFacturado);
    addFinancialRow("Suma Sin Factura", sumaSinFactura);
    addFinancialRow("Total General", totalGeneral);
    currentRow++;
    addFinancialRow(porReembolsar > 0 ? ">> Por reembolsar a colaborador" : (porReintegrar > 0 ? ">> Por reintegrar a CECAI" : "Balance"), porReembolsar > 0 ? porReembolsar : (porReintegrar > 0 ? porReintegrar : 0));
    currentRow += 2;

    // --- 3. Sección de Detalle de Gastos ---
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
        row.getCell(1).value = gasto.fecha;
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

      // Añadir fila de subtotal
      const subtotalRow = worksheet.getRow(currentRow);
      subtotalRow.getCell(3).value = "Subtotal:";
      subtotalRow.getCell(3).font = { bold: true };
      subtotalRow.getCell(3).alignment = { horizontal: 'right' };
      
      const subtotalCell = subtotalRow.getCell(4);
      subtotalCell.value = { formula: `SUM(D${startRowForSubtotal}:D${currentRow - 1})` };
      subtotalCell.numFmt = '$#,##0.00';
      subtotalCell.font = { bold: true };
      currentRow++; // Espacio después de la sección
    };

    addGastosSection('Gastos con Factura', gastosConFactura, 'E9F5EC');
    addGastosSection('Gastos sin Factura', gastosSinFactura, 'FEF3E7');

    // --- 4. Ajustar anchos de columna ---
    worksheet.columns = [
      { key: 'A', width: 15 },
      { key: 'B', width: 15 },
      { key: 'C', width: 40 },
      { key: 'D', width: 15 },
      { key: 'E', width: 50 },
    ];

    // --- 5. Generar el buffer del archivo ---
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  const generarReportePdf = async (gastosFiltrados, fechaInicioReporte, fechaFinReporte, solicitudVinculada = null) => {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const margin = 50;

      // Variables para controlar la página actual y la posición Y
      let page;
      let y;
      let width;
      let height;

      // Si hay una solicitud vinculada, adjuntar su PDF primero
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

      // Calcular valores para la portada de resumen
      const sumaFacturado = gastosFiltrados
          .filter(g => g.url_factura)
          .reduce((sum, g) => sum + parseFloat(g.monto), 0);

      const sumaSinFactura = gastosFiltrados
          .filter(g => !g.url_factura)
          .reduce((sum, g) => sum + parseFloat(g.monto), 0);

      const importeRecibido = solicitudVinculada ? solicitudVinculada.totalSolicitado : 0;

      let porReembolsar = 0;
      let porReintegrar = 0;

      if (importeRecibido > 0) {
          if (sumaFacturado > importeRecibido) {
              porReembolsar = sumaFacturado - importeRecibido;
          } else if (importeRecibido > sumaFacturado) {
              porReintegrar = importeRecibido - sumaFacturado;
          }
      }

      // --- Portada de Resumen Financiero (se genera siempre) ---
      page = pdfDoc.addPage();
      ({ width, height } = page.getSize());
      let currentY = height - margin;

      // Encabezado con logo
      try {
          const logoUrl = '/CECAI.png';
          const logoImageBytes = await fetch(logoUrl).then((res) => res.arrayBuffer());
          const logoImage = await pdfDoc.embedPng(logoImageBytes);
          const logoDims = logoImage.scale(0.05);
          page.drawImage(logoImage, {
              x: margin,
              y: currentY - logoDims.height,
              width: logoDims.width,
              height: logoDims.height,
          });
      } catch (error) {
          console.warn("No se pudo cargar el logo 'CECAI.png' desde la carpeta /public.");
      }
      currentY -= 100;

      // Título y detalles de la portada
      page.drawText('Resumen de Gastos', { x: margin, y: currentY, font: boldFont, size: 24, color: rgb(0, 0, 0) });
      currentY -= 40;

      if (solicitudVinculada) {
          page.drawText(`Consultor: ${solicitudVinculada.consultor}`, { x: margin, y: currentY, font: font, size: 14 });
          currentY -= 20;
          page.drawText(`Solicitud: ${solicitudVinculada.proyecto}`, { x: margin, y: currentY, font: font, size: 14 });
          currentY -= 20;
      }
      page.drawText(`Periodo: ${fechaInicioReporte || 'N/A'} al ${fechaFinReporte || 'N/A'}`, { x: margin, y: currentY, font: font, size: 12 });
      currentY -= 40;

      page.drawText('Detalle Financiero:', { x: margin, y: currentY, font: boldFont, size: 16 });
      currentY -= 30;

      // --- Campos del detalle financiero ---
      if (solicitudVinculada) {
          // Importe recibido
          const importeRecibidoTexto = formatoMoneda(importeRecibido);
          const importeRecibidoAncho = boldFont.widthOfTextAtSize(importeRecibidoTexto, 12);
          page.drawText('Importe recibido:', { x: margin, y: currentY, font: font, size: 12 });
          page.drawText(importeRecibidoTexto, { x: width - margin - importeRecibidoAncho, y: currentY, font: boldFont, size: 12 });
          currentY -= 20;
      }
      
          // Suma Facturado
          const sumaFacturadoTexto = formatoMoneda(sumaFacturado);
          const sumaFacturadoAncho = boldFont.widthOfTextAtSize(sumaFacturadoTexto, 12);
          page.drawText('Suma Facturado:', { x: margin, y: currentY, font: font, size: 12 });
          page.drawText(sumaFacturadoTexto, { x: width - margin - sumaFacturadoAncho, y: currentY, font: boldFont, size: 12 });
          currentY -= 20;

          // Suma Sin Factura
          const sumaSinFacturaTexto = formatoMoneda(sumaSinFactura);
          const sumaSinFacturaAncho = boldFont.widthOfTextAtSize(sumaSinFacturaTexto, 12);
          page.drawText('>> Suma sin factura:', { x: margin, y: currentY, font: font, size: 12 });
          page.drawText(sumaSinFacturaTexto, { x: width - margin - sumaSinFacturaAncho, y: currentY, font: boldFont, size: 12 });
          currentY -= 30;

      if (solicitudVinculada) {
          // Por reembolsar / Por reintegrar
          if (porReembolsar > 0) {
              const porReembolsarTexto = formatoMoneda(porReembolsar);
              const porReembolsarAncho = boldFont.widthOfTextAtSize(porReembolsarTexto, 12);
              page.drawText('>> Por reembolsar a colaborador:', { x: margin, y: currentY, font: boldFont, size: 12, color: rgb(0, 0.5, 0) });
              page.drawText(porReembolsarTexto, { x: width - margin - porReembolsarAncho, y: currentY, font: boldFont, size: 12, color: rgb(0, 0.5, 0) });
          } else if (porReintegrar > 0) {
              const porReintegrarTexto = formatoMoneda(porReintegrar);
              const porReintegrarAncho = boldFont.widthOfTextAtSize(porReintegrarTexto, 12);
              page.drawText('>> Por reintegrar a CECAI:', { x: margin, y: currentY, font: boldFont, size: 12, color: rgb(0.8, 0.2, 0) });
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

      // --- 2. Crear la página de listado de gastos ---
      page = pdfDoc.addPage();
      ({ width, height } = page.getSize());
      y = height - margin;

      // Título
      page.drawText('Reporte de Gastos', { x: margin, y, font: boldFont, size: 24, color: rgb(0, 0, 0) });
      y -= 30;

      // Rango de fechas
      const rangoFechas = (fechaInicioReporte || fechaFinReporte) 
        ? `Periodo: ${fechaInicioReporte || 'N/A'} a ${fechaFinReporte || 'N/A'}`
        : 'Periodo: Todos los gastos';
      page.drawText(rangoFechas, { x: margin, y, font, size: 12, color: rgb(0.3, 0.3, 0.3) });
      y -= 40;

      // Agrupar los datos filtrados para el reporte
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


      // --- Iterar sobre la estructura agrupada y ordenada ---
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
        // Dibuja el título del estado a la izquierda y su subtotal a la derecha, en la misma línea.
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
            page.drawText(fecha, { x: margin + 30, y, font, size: 10, color: rgb(0.2, 0.5, 0.2) });
            y -= 18;

            const items = datosCategoria.fechas[fecha];
            for (const gasto of items) {
              checkPageBreak();
              const montoTexto = formatoMoneda(gasto.monto);
              const montoAncho = boldFont.widthOfTextAtSize(montoTexto, 10);
              page.drawText(gasto.concepto.substring(0, 50), { x: margin + 45, y, font, size: 10 });
              page.drawText(montoTexto, { x: width - margin - montoAncho, y, font, size: 10, font: boldFont });
              y -= 15;
            }
          }
          y -= 10; // Espacio entre categorías
        }
        y -= 15; // Espacio entre estados (Con/Sin Factura)
      }

      // --- Total General ---
      checkPageBreak();
      y -= 10;

      // Total
      const totalGeneral = Object.values(dataAgrupadaReporte).reduce((sum, e) => sum + e.totalEstado, 0);
      const totalTexto = formatoMoneda(totalGeneral);
      const totalAncho = boldFont.widthOfTextAtSize(totalTexto, 14);
      page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 1 });
      page.drawText('TOTAL GENERAL:', { x: margin, y: y - 5, font: boldFont, size: 14 });
      page.drawText(totalTexto, { x: width - margin - totalAncho, y: y - 5, font: boldFont, size: 14 });

      // --- 3. Adjuntar los PDFs de las facturas ---
      const gastosConFactura = gastosFiltrados
        .filter(g => g.url_factura) // Solo los que tienen factura
        .sort((a, b) => {
          // Ordenar por categoría primero
          const order = { 'Comida': 1, 'Transporte': 2, 'Otros': 3 };
          const categoriaA = order[a.categoria] || 99;
          const categoriaB = order[b.categoria] || 99;
          if (categoriaA !== categoriaB) {
            return categoriaA - categoriaB;
          }
          // Si la categoría es la misma, ordenar por fecha
          return a.fecha.localeCompare(b.fecha);
        });


      if (gastosConFactura.length > 0) {
        // Añadir una página de índice para las facturas
        page = pdfDoc.addPage();
        y = height - margin; // Resetear 'y' para la nueva página

        page.drawText('Índice de Facturas Adjuntas', {
          x: margin, y, font: boldFont, size: 24, color: rgb(0, 0, 0)
        });
        y -= 40;

        // Cabeceras del índice
        page.drawText('Concepto del Gasto', { x: margin, y, font: boldFont, size: 10 });
        page.drawText('Fecha', { x: width - margin - 100, y, font: boldFont, size: 10 });
        y -= 15;
        page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
        y -= 20;

        // Listar cada factura en el índice
        for (const gasto of gastosConFactura) {
          checkPageBreak(); // Comprobar si se necesita una nueva página para el índice
          page.drawText(gasto.concepto.substring(0, 70), { x: margin, y, font, size: 10 });
          page.drawText(gasto.fecha, { x: width - margin - 100, y, font, size: 10 });
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

      // 4. Guardar y descargar el archivo final
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
    switch(cat) {
      case 'Transporte': return { color: 'slate', icon: Car };
      case 'Comida': return { color: 'slate', icon: Utensils };
      default: return { color: 'slate', icon: Layers };
    }
  };

  const dataAgrupada = useMemo(() => {
    const filtrados = gastos.filter(g => {
      // Ocultar archivados si el toggle no está activo
      if (!mostrarArchivados && g.archivado) {
        return false;
      }
      if (fechaInicio && g.fecha < fechaInicio) return false;
      if (fechaFin && g.fecha > fechaFin) return false;
      if (terminoBusqueda && !g.concepto.toLowerCase().includes(terminoBusqueda.toLowerCase())) {
        // Si hay un término de búsqueda y el concepto no lo incluye, no lo muestres.
        // Pero si este gasto es una propina, debemos verificar si el concepto del gasto padre lo incluye.
        const gastoPadre = gastos.find(padre => padre.idPropina === g.id);
        return gastoPadre && gastoPadre.concepto.toLowerCase().includes(terminoBusqueda.toLowerCase());
      }
      return true;
    });

    const resultado = filtrados.reduce((acc, gasto) => {
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

    return resultado;
  }, [gastos, fechaInicio, fechaFin, terminoBusqueda, mostrarArchivados]);

  const totalGeneral = Object.values(dataAgrupada).reduce((sum, e) => sum + e.totalEstado, 0);

  return (
    <div className="space-y-4 relative">
      {/* CONTENEDOR DE FILTROS FIJO */}
      <div className="sticky top-0 z-10 bg-slate-100 pt-1 pb-4 -mt-4 -mx-4 px-4 border-b border-slate-200">
        <div className="space-y-3">
          {/* 2. FILTROS */}
          <div className="flex gap-2 items-center">
            <div className="bg-white p-2 rounded-full border border-gray-200 flex items-center gap-2 flex-1 shadow-sm">
                <Calendar size={14} className="text-gray-400 ml-1"/>
                <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="rounded-full border-none bg-transparent w-full text-xs outline-none text-gray-600"/>
            </div>
            <div className="bg-white p-2 rounded-full border border-gray-200 flex items-center gap-2 flex-1 shadow-sm">
                <Calendar size={14} className="text-gray-400 ml-1"/>
                <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="rounded-full border-none bg-transparent w-full text-xs outline-none text-gray-600"/>
            </div>
            <button onClick={() => setMostrarArchivados(!mostrarArchivados)} className={`p-2 rounded-full border transition-all shadow-sm flex-shrink-0 ${mostrarArchivados ? 'bg-blue-100 border-blue-200 text-blue-600' : 'bg-transparent border-gray-200 text-slate-400 hover:bg-slate-50'}`} title={mostrarArchivados ? "Ocultar archivados" : "Mostrar archivados"}>
              {mostrarArchivados 
                ? <ArchiveRestore size={16} /> 
                : <Archive size={16} />
              }
            </button>
            {mostrarArchivados && gastos.some(g => g.archivado) && ( // Solo mostrar si se están viendo archivados y hay al menos un gasto archivado en la lista general
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
          {/* Campo de búsqueda */}
          <div className="bg-white p-2 rounded-full border border-gray-200 flex items-center gap-2 flex-1 shadow-sm">
            <Search size={14} className="text-gray-400 ml-1"/>
            <input 
              type="text" 
              placeholder="Buscar por concepto..."
              value={terminoBusqueda}
              onChange={e => setTerminoBusqueda(e.target.value)}
              className="border-none bg-transparent w-full text-xs outline-none text-gray-600"
            />
          </div>
          {/* Botón para generar reporte */}
          <button onClick={() => setModalReporteAbierto(true)} disabled={reporteGenerandose} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-full flex justify-center items-center gap-2 shadow-lg shadow-emerald-200 transition-all disabled:opacity-60 disabled:cursor-wait">
            <FileDown size={16} />
            <span className="text-xs uppercase font-bold tracking-wider">{reporteGenerandose ? 'Generando...' : 'Generar Reporte'}</span>
          </button>
        </div>
      </div>
      
      {/* 1. TOTAL GENERAL */}
      <Card decoration="top" decorationColor="blue" className="italic font-black text-xl py-1 px-0 mt-4">
        <Flex justifyContent="between" alignItems="center">
            <Text>Total Periodo</Text>
            <Metric className="italic text-xl font-black text-slate-800">
                {formatoMoneda(totalGeneral)}
            </Metric>
        </Flex>
      </Card>

      {/* RENDERIZADO DEL MODAL */}
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

      {/* 3. LISTADO */}
      {Object.entries(dataAgrupada)
        .sort(([estadoA], [estadoB]) => {
          // Ordena para que "Con Factura" siempre aparezca primero
          if (estadoA === 'Con Factura') return -1;
          if (estadoB === 'Con Factura') return 1;
          return 0;
        })
        .map(([estado, datosEstado]) => {
        const isFactura = estado === 'Con Factura';
        const colorEstado = isFactura ? 'transparent' : 'transparent';
        const IconoEstado = isFactura ? FileCheck : AlertTriangle;

        return (
          <Card key={estado} className="p-0 overflow-hidden shadow-sm">
            <div className={`py-0 px-0 border-l-4 ${isFactura ? 'border-emerald-100 bg-emerald-100' : 'border-amber-100 bg-amber-100'}`}>
                <Flex justifyContent="between" alignItems="center">
                    <div className="flex items-center gap-2">
                        <Icon icon={IconoEstado} color={colorEstado} variant="light" size="sm" />
                        <Title className={`text-sm uppercase font-bold ${isFactura ? 'text-emerald-900' : 'text-amber-900'}`}>{estado}</Title>
                    </div>
                    <Text className={`font-bold ${isFactura ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {formatoMoneda(datosEstado.totalEstado)}
                    </Text>
                </Flex>
            </div>

            <div className="p-4 space-y-4">
                {Object.entries(datosEstado.categorias)
                    .sort(([catA], [catB]) => {
                      // Ordena las categorías según el orden especificado
                      const order = { 'Comida': 1, 'Transporte': 2, 'Otros': 3 };
                      return (order[catA] || 99) - (order[catB] || 99);
                    })
                    .map(([nombreCategoria, datosCategoria], indexCat) => {

                    const { color, icon: CatIcon } = getCategoryDetails(nombreCategoria);
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
                                                    <Text className="text-xs font-bold text-green-700 uppercase">{fecha}</Text>
                                                </div>
                                                <List className="mt-0 space-y-0">
                                                    {items.map((gasto) => (
                                                        <ListItem key={gasto.id} className="p-0 border-none">
                                                            <div className="grid grid-cols-12 w-full items-center py-2 px-2 bg-slate-50/50 rounded hover:bg-slate-100 transition-colors">
                                                                
                                                                <div className="col-span-6 pr-2 flex items-center gap-1.5 overflow-hidden">
                                                                    {gasto.archivado && (
                                                                        <div className="text-slate-400 flex-shrink-0" title="Gasto archivado">
                                                                            <Archive size={12} strokeWidth={2.5} />
                                                                        </div>
                                                                    )}
                                                                    <Text className="font-bold text-slate-700 truncate text-xs sm:text-sm" title={gasto.concepto}>{gasto.concepto}</Text>
                                                                    {gasto.idPropina && (
                                                                        <div className="bg-transparent text-yellow-600 p-0.5 rounded flex-shrink-0" title="Tiene propina asignada">
                                                                            <Coins size={10} strokeWidth={2.5} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                
                                                                <div className="col-span-3 text-right">
                                                                    <Text className="font-mono font-bold text-slate-900 text-sm">{formatoMoneda(parseFloat(gasto.monto))}</Text>
                                                                </div>
                                                                
                                                                <div className="col-span-3 flex justify-end items-center gap-0 pl-1 -mr-6">
                                                                    {gasto.url_factura && (
                                                                        <a href={gasto.url_factura} target="_blank" rel="noreferrer" className="p-1 text-slate-400 hover:text-slate-600">
                                                                            <FileText size={20} />
                                                                        </a>
                                                                    )}
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
                                                                </div>
                                                            </div>
                                                        </ListItem>
                                                    ))}
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