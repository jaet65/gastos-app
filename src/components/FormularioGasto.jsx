import { useState, useRef, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { collection, addDoc, Timestamp, updateDoc, doc } from 'firebase/firestore';
import SolicitudRecursosModal from './SolicitudRecursosModal';
import Footer from './Footer';
import { formatInTimeZone } from 'date-fns-tz';
import { Calendar, AlignLeft, DollarSign, Layers, UploadCloud, X, FileCheck, ArrowDownCircle, FileCog, QrCode } from 'lucide-react';
import { getCloudinaryFilename } from './cloudinary';
import Swal from 'sweetalert2';
import { confirmInvoiceAmount } from './invoiceAmountConfirmation';
import { analyzeInvoice, appendInvoiceRfcStatus } from './invoiceAnalysis';
import { hasMafRfcMismatch, isMafRfc } from './invoiceRfcRules';
import { takeSharedInvoice } from '../shareTarget';

// InputGroup: Bloque plano sin bordes
const InputGroup = ({ icon: Icon, children }) => ( // eslint-disable-line no-unused-vars
  <div className="flex items-center bg-white/50 transition-all overflow-hidden h-14 hover:bg-white/80 focus-within:bg-white backdrop-blur-md">
    <div className="pl-4 text-slate-400">
      <Icon size={16} strokeWidth={2.5} />
    </div>
    <div className="flex-1 h-full flex items-center pr-4">
      {children}
    </div>
  </div>
);

const FormularioGasto = () => {
  const { user } = useAuth();
  const INITIAL_STATE = {
    fecha: formatInTimeZone(new Date(), 'America/Mexico_City', 'yyyy-MM-dd'),
    concepto: '',
    monto: '',
    categoria: 'Transporte',
  };

  const [formData, setFormData] = useState(INITIAL_STATE);
  const [archivo, setArchivo] = useState(null);
  const [agregarPropina, setAgregarPropina] = useState(false);
  const [casetas, setCasetas] = useState([]); // Nuevo estado para casetas
  const [loading, setLoading] = useState(false);
  const [analizandoFactura, setAnalizandoFactura] = useState(false);
  const [mensajeAnalisis, setMensajeAnalisis] = useState('');
  const [modalRecursosAbierto, setModalRecursosAbierto] = useState(false);

  // Estado para el Drag & Drop Global
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const fileInputRef = useRef(null);
  const invoiceScanId = useRef(0);
  const casetaScanIds = useRef(new Map());
  const casetaIdCounter = useRef(0);
  const casetaMontos = useRef(new Map());
  const montoActualRef = useRef('');
  const invoiceReceiverRfc = useRef(null);
  const processedShareRef = useRef(null);

  const CLOUD_NAME = "didj7kuah";
  const UPLOAD_PRESET = "Gastos_Facturas";

  useEffect(() => {
    if (formData.categoria !== 'Comida') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAgregarPropina(false);
    }
    if (formData.categoria !== 'Transporte') {
      setCasetas([]);
    }
  }, [formData.categoria]);

  const handleInvoiceFile = useCallback(async (file) => {
    const scanId = invoiceScanId.current + 1;
    invoiceScanId.current = scanId;
    setArchivo(file);
    setAnalizandoFactura(true);
    setMensajeAnalisis('');

    try {
      const analysis = await analyzeInvoice(file);
      const amount = analysis.amount;
      if (invoiceScanId.current !== scanId) return;
      invoiceReceiverRfc.current = analysis.receiverRfc || null;
      if (isMafRfc(analysis.receiverRfc)) {
        setFormData((current) => ({ ...current, categoria: 'MAF' }));
      }

      if (amount !== null) {
        const montoDetectado = amount.toFixed(2);
        const resultado = await confirmInvoiceAmount(amount, montoActualRef.current);
        if (invoiceScanId.current !== scanId) return;

        montoActualRef.current = resultado.amount;
        setFormData((current) => ({ ...current, monto: resultado.amount }));
        setMensajeAnalisis(appendInvoiceRfcStatus(resultado.source === 'detected'
          ? `Total detectado: $${montoDetectado}`
          : `Se conservará el monto ingresado: $${Number(resultado.amount).toFixed(2)}`, analysis));
      } else {
        setMensajeAnalisis(appendInvoiceRfcStatus('No se detectó el total; puedes ingresarlo manualmente.', analysis));
      }
    } catch (error) {
      console.error('Error analizando la factura:', error);
      if (invoiceScanId.current === scanId) {
        setMensajeAnalisis('No se pudo leer el total automáticamente; ingrésalo manualmente.');
      }
    } finally {
      if (invoiceScanId.current === scanId) setAnalizandoFactura(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedInvoiceId = params.get('sharedInvoice');
    const shareError = params.get('shareError');
    if (!sharedInvoiceId && !shareError) return;

    const processedId = sharedInvoiceId || `error-${shareError}`;
    if (processedShareRef.current === processedId) return;
    processedShareRef.current = processedId;

    params.delete('sharedInvoice');
    params.delete('shareError');
    const remainingParams = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${remainingParams ? `?${remainingParams}` : ''}${window.location.hash}`
    );

    if (shareError) {
      const message = shareError === 'invalid'
        ? 'Comparte un archivo PDF para adjuntarlo al gasto.'
        : 'No se pudo recibir la factura compartida. Intenta compartirla nuevamente o selecciónala desde el formulario.';
      Swal.fire({
        title: 'No se recibió la factura',
        text: message,
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    takeSharedInvoice(sharedInvoiceId).then((file) => {
      if (!file) {
        Swal.fire({
          title: 'No se encontró la factura',
          text: 'Vuelve a compartir el PDF o selecciónalo desde el formulario.',
          icon: 'warning',
          confirmButtonText: 'Entendido'
        });
        return;
      }
      handleInvoiceFile(file);
    }).catch((error) => {
      console.error('Error recuperando la factura compartida:', error);
      Swal.fire({
        title: 'No se pudo abrir la factura',
        text: 'Intenta compartir el PDF nuevamente o selecciónalo desde el formulario.',
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
    });
  }, [handleInvoiceFile]);

  // --- LOGICA DE DRAG & DROP GLOBAL ---
  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current += 1;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current -= 1;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type === "application/pdf") {
          handleInvoiceFile(file);
        } else {
          Swal.fire({
              title: 'Formato no permitido',
              text: 'Por favor, arrastra solo archivos PDF.',
              icon: 'warning',
              confirmButtonText: 'Entendido',
              confirmButtonColor: '#3b82f6', // Azul
              customClass: {
                  popup: 'rounded-2xl',
                  confirmButton: 'px-4 py-2 text-sm font-medium rounded-lg'
              }
          });
          console.log("LOG: Formato no permitido, solo PDF")
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleInvoiceFile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'monto') montoActualRef.current = value;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) handleInvoiceFile(e.target.files[0]);
  };

  const removeFile = () => {
    invoiceScanId.current += 1;
    invoiceReceiverRfc.current = null;
    setArchivo(null);
    setAnalizandoFactura(false);
    setMensajeAnalisis('');
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addCaseta = () => {
    casetaIdCounter.current += 1;
    const scanKey = `caseta-${casetaIdCounter.current}`;
    casetaMontos.current.set(scanKey, '');
    setCasetas((current) => [...current, { scanKey, monto: '', archivo: null }]);
  };

  const removeCaseta = (index) => {
    const caseta = casetas[index];
    if (caseta) {
      casetaScanIds.current.delete(caseta.scanKey);
      casetaMontos.current.delete(caseta.scanKey);
    }
    setCasetas((current) => current.filter((_, casetaIndex) => casetaIndex !== index));
  };

  const handleCasetaChange = (index, field, value) => {
    const caseta = casetas[index];
    if (!caseta) return;

    if (field === 'monto') {
      casetaMontos.current.set(caseta.scanKey, value);
      setCasetas((current) => current.map((item) => (
        item.scanKey === caseta.scanKey ? { ...item, monto: value } : item
      )));
      return;
    }

    if (field === 'archivo' && value) {
      const scanId = (casetaScanIds.current.get(caseta.scanKey) || 0) + 1;
      casetaScanIds.current.set(caseta.scanKey, scanId);
      setCasetas((current) => current.map((item) => (
        item.scanKey === caseta.scanKey
          ? { ...item, archivo: value, analizandoFactura: true, mensajeAnalisis: '' }
          : item
      )));

      analyzeInvoice(value).then(async (analysis) => {
        if (casetaScanIds.current.get(caseta.scanKey) !== scanId) return;
        const amount = analysis.amount;

        if (amount === null) {
          setCasetas((current) => current.map((item) => (
            item.scanKey === caseta.scanKey
              ? { ...item, analizandoFactura: false, mensajeAnalisis: appendInvoiceRfcStatus('No se detectó el total; puedes ingresarlo manualmente.', analysis) }
              : item
          )));
          return;
        }

        const resultado = await confirmInvoiceAmount(amount, casetaMontos.current.get(caseta.scanKey));
        if (casetaScanIds.current.get(caseta.scanKey) !== scanId) return;
        casetaMontos.current.set(caseta.scanKey, resultado.amount);
        setCasetas((current) => current.map((item) => (
          item.scanKey === caseta.scanKey
            ? {
                ...item,
                monto: resultado.amount,
                analizandoFactura: false,
                mensajeAnalisis: appendInvoiceRfcStatus(resultado.source === 'detected'
                  ? `Total detectado: $${amount.toFixed(2)}`
                  : `Se conservará el monto ingresado: $${Number(resultado.amount).toFixed(2)}`, analysis)
              }
            : item
        )));
      }).catch((error) => {
        console.error('Error analizando la factura de la caseta:', error);
        if (casetaScanIds.current.get(caseta.scanKey) !== scanId) return;
        setCasetas((current) => current.map((item) => (
          item.scanKey === caseta.scanKey
            ? { ...item, analizandoFactura: false, mensajeAnalisis: 'No se pudo leer el total automáticamente; ingrésalo manualmente.' }
            : item
        )));
      });
    }
  };

  const subirACloudinary = async (file) => {
    // 1. Validación previa del archivo
    if (!file) throw new Error("El archivo no es válido.");
    if (file.size === 0) throw new Error("El archivo está vacío (0 bytes). Verifica que se haya descargado bien de Drive.");

    // FUNCIÓN HELPER: Convertir File a Base64
    // Esto obliga al navegador a descargar/leer el archivo real del sistema
    const toBase64 = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });

    // 1. Intentamos leer el archivo primero
    let fileDataUrl;
    try {
      fileDataUrl = await toBase64(file);
    } catch (readError) {
      console.error("Error de lectura:", readError);
      throw new Error("No se pudo leer el archivo del dispositivo. Intenta descargarlo primero.");
    }

    const data = new FormData();
    const nombreArchivo = getCloudinaryFilename(user?.email, file.name);
    data.append("file", fileDataUrl); // Cloudinary acepta Base64
    data.append("upload_preset", UPLOAD_PRESET);
    data.append("cloud_name", CLOUD_NAME);
    data.append("filename_override", nombreArchivo);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      { method: "POST", body: data }
    );

    const fileData = await response.json();

    if (!response.ok || !fileData.secure_url) {
      console.error("Error subiendo a Cloudinary:", fileData);
      // Usamos el mensaje de error de Cloudinary si existe
      throw new Error(fileData.error?.message || "Error desconocido al subir a Cloudinary");
    }

    return fileData;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasMafRfcMismatch(formData.categoria, invoiceReceiverRfc.current, Boolean(archivo))) {
      await Swal.fire({
        title: 'RFC incompatible con MAF',
        text: 'Los gastos de categoría MAF solo pueden llevar una factura con RFC receptora MCE170119JC0.',
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    if (analizandoFactura || casetas.some((caseta) => caseta.analizandoFactura)) {
      await Swal.fire({
        title: 'Análisis en curso',
        text: 'Espera a que termine el análisis de las facturas antes de guardar.',
        icon: 'info',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    setLoading(true);

    try {
      let fileData = null;

      if (archivo) {
        try {
          fileData = await subirACloudinary(archivo);
        } catch (uploadError) {
          console.error(uploadError);
          
          await Swal.fire({
              title: 'Error al subir el archivo',
              text: uploadError.message,
              icon: 'error',
              confirmButtonText: 'Entendido',
              confirmButtonColor: '#ef4444', // Rojo
              customClass: {
                  popup: 'rounded-2xl',
                  confirmButton: 'px-4 py-2 text-sm font-medium rounded-lg'
              }
          });
          console.log("LOG: Error al subir el archivo:", uploadError.message)
          setLoading(false);
          return;
        }
      }

      const montoOriginal = parseFloat(formData.monto);
      const timestamp = Timestamp.now();

      let conceptoFinal = formData.concepto;
      if (formData.categoria === 'MAF' && !conceptoFinal.startsWith('MAF - ')) {
        conceptoFinal = `MAF - ${conceptoFinal}`;
      }

      const docRef = await addDoc(collection(db, "gastos"), {
        ...formData,
        concepto: conceptoFinal,
        monto: montoOriginal,
        url_factura: fileData?.secure_url || '',
        deleteToken: fileData?.delete_token || '',
        creado_en: timestamp,
        userId: user.uid
      });

      // LÓGICA DE PROPINA (Comida)
      if (agregarPropina && formData.categoria === 'Comida') {
        const montoPropina = montoOriginal * 0.10;

        const propinaRef = await addDoc(collection(db, "gastos"), {
          fecha: formData.fecha,
          concepto: `Propina => ${formData.concepto} @ ${formData.fecha}`,
          monto: montoPropina,
          categoria: 'Comida',
          url_factura: '',
          creado_en: timestamp,
          userId: user.uid
        });

        await updateDoc(doc(db, "gastos", docRef.id), {
          idPropina: propinaRef.id
        });
      }

      // LÓGICA DE CASETAS (Transporte)
      if (formData.categoria === 'Transporte' && casetas.length > 0) {
        for (const caseta of casetas) {
          if (!caseta.monto) continue;

          let fileDataCaseta = { secure_url: '', delete_token: '' };
          if (caseta.archivo) {
            try {
              fileDataCaseta = await subirACloudinary(caseta.archivo);
            } catch (uploadError) {
              console.error("Error subiendo caseta:", uploadError);
              await Swal.fire({
                  title: 'Error al subir caseta',
                  text: uploadError.message,
                  icon: 'error',
                  confirmButtonText: 'Entendido',
                  confirmButtonColor: '#ef4444', // Rojo
                  customClass: {
                      popup: 'rounded-2xl',
                      confirmButton: 'px-4 py-2 text-sm font-medium rounded-lg'
                  }
              });
              console.log("LOG: Error al subir caseta:", uploadError.message)
              // Continuamos guardando el monto aunque falle la subida? 
              // Por ahora seguiremos con la caseta sin factura si falla
            }
          }

          await addDoc(collection(db, "gastos"), {
            fecha: formData.fecha,
            concepto: `Caseta`,
            monto: parseFloat(caseta.monto),
            categoria: 'Transporte',
            url_factura: fileDataCaseta.secure_url,
            deleteToken: fileDataCaseta.delete_token,
            creado_en: timestamp,
            userId: user.uid,
            idPadre: docRef.id // Vinculamos al gasto principal
          });
        }
      }

      Swal.fire({
          title: '¡Guardado correctamente!',
          text: 'Los cambios se han almacenado con éxito.',
          icon: 'success',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#10b981', // Verde
          timer: 5000, // Opcional: Se cierra automáticamente tras 2 segundos
          timerProgressBar: true,
          customClass: {
              popup: 'rounded-2xl',
              confirmButton: 'px-4 py-2 text-sm font-medium rounded-lg'
          }
      });
      console.log("LOG: Almecenado con exito")

      setFormData(INITIAL_STATE);
      invoiceReceiverRfc.current = null;
      montoActualRef.current = '';
      setAgregarPropina(false);
      setCasetas([]);
      casetaScanIds.current.clear();
      casetaMontos.current.clear();
      removeFile();

    } catch (error) {
      console.error("Error general:", error);
      await Swal.fire({
          title: 'Error en la base de datos',
          text: `No se pudo guardar la información: ${error.message}`,
          icon: 'error',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#ef4444', // Rojo
          customClass: {
              popup: 'rounded-2xl',
              confirmButton: 'px-4 py-2 text-sm font-medium rounded-lg'
          }
      });
      console.log("LOG: Error en la base de datos")
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* RENDERIZADO DEL MODAL DE RECURSOS */}
      {modalRecursosAbierto && (
        <SolicitudRecursosModal onClose={() => setModalRecursosAbierto(false)} />
      )}

      {/* TARJETA PRINCIPAL */}
      <div className="bg-white/40 backdrop-blur-xl p-0">

        <Footer />

        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Nuevo Gasto</h2>
          <button type="button" onClick={() => setModalRecursosAbierto(true)} className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-100 hover:bg-blue-200 px-2.5 py-1.5 rounded-full transition-colors" title="Generar solicitud de recursos">
            <FileCog size={16} />
            <span>Solicitar Recursos</span>
          </button>
        </div>
        <div className="mb-1">
          <p className="text-slate-500 font-medium text-sm">Ingresa los detalles del movimiento</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            <InputGroup icon={Calendar}>
              <input type="date" name="fecha" required value={formData.fecha} onChange={handleChange}
                className="w-full h-full pl-2 bg-transparent border-none outline-none text-slate-700 font-bold text-base" />
            </InputGroup>

            <InputGroup icon={Layers}>
              <select name="categoria" value={formData.categoria} onChange={handleChange}
                className="w-full h-full pl-2 bg-transparent border-none outline-none text-slate-700 font-bold text-base cursor-pointer appearance-none">
                <option value="Transporte">Transporte</option>
                <option value="Comida">Comida</option>
                <option value="Otros">Otros</option>
                <option value="MAF">MAF</option>
                <option value="ANTP">ANTP</option>
              </select>
            </InputGroup>
          </div>

          <div className="grid grid-cols-1 gap-1">
            <InputGroup icon={AlignLeft}>
              <input type="text" name="concepto" placeholder="Descripción" required value={formData.concepto} onChange={handleChange}
                className="w-full h-full pl-2 bg-transparent border-none outline-none text-slate-900 font-bold text-2xl placeholder-slate-400" />
            </InputGroup>
            <InputGroup icon={DollarSign}>
              <input type="number" name="monto" placeholder="0.00" step="0.01" required value={formData.monto} onChange={handleChange}
                className="w-full h-full pl-2 bg-transparent border-none outline-none text-slate-900 text-2xl font-black placeholder-slate-300" />
            </InputGroup>
          </div>

          {/* CHECKBOX DE PROPINA */}
          {formData.categoria === 'Comida' && (
            <div className="flex items-center gap-2 bg-blue-50/50 px-2 py-1 border-l-4 border-blue-500">
              <input
                type="checkbox"
                id="checkPropina"
                checked={agregarPropina}
                onChange={(e) => setAgregarPropina(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
              />
              <label htmlFor="checkPropina" className="text-slate-500 font-bold text-sm cursor-pointer select-none">
                ¿Agregar Propina (10%)?
              </label>
              {agregarPropina && formData.monto && (
                <span className="ml-auto text-blue-600 font-black text-sm">
                  +${(parseFloat(formData.monto || 0) * 0.10).toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* ZONA DE ARCHIVO (Compacta) */}
          <div className="mt-0 mb-0">
            {!archivo ? (
              <div
                onClick={() => fileInputRef.current.click()}
                className={`
                  p-1 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 gap-1 group border border-none
                  ${isDragging
                    ? 'border-none bg-white/50 scale-105 shadow-xl ring-4 ring-blue-100 rounded-full'
                    : 'border-none bg-white/50 hover:bg-white/80'
                  }
                `}
              >
                <div className={`
                  p-1 transition-transform duration-300 rounded-full shadow-sm
                  ${isDragging ? 'bg-transparent text-blue-700 scale-110' : 'bg-white text-blue-500 group-hover:scale-110'}
                `}>
                  {isDragging ? (
                    <ArrowDownCircle size={22} className="animate-bounce" strokeWidth={2.5} />
                  ) : (
                    <UploadCloud size={22} />
                  )}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-tight transition-colors ${isDragging ? 'text-blue-700' : 'text-slate-500 group-hover:text-blue-600'}`}>
                  {isDragging ? '¡SUELTA EL PDF AQUÍ!' : 'ADJUNTAR FACTURA (PDF)'}
                </span>
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
              </div>
            ) : (
              <div className="flex items-center gap-4 bg-slate-100 p-3 rounded-xl border border-slate-200">
                <div className="bg-slate-800 text-white p-2 rounded-lg">
                  <FileCheck size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{archivo.name}</p>
                  {analizandoFactura ? (
                    <p className="text-xs text-slate-500">Analizando factura...</p>
                  ) : mensajeAnalisis ? (
                    <p className="text-xs text-slate-500">{mensajeAnalisis}</p>
                  ) : null}
                </div>
                <button type="button" onClick={removeFile} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
            )}
            <div className="mt-0.5 flex justify-center">
              <span
                aria-label="Autocompletado por QR disponible"
                title="Autocompletado por QR disponible"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700"
              >
                <QrCode size={13} strokeWidth={2.2} aria-hidden="true" />
                <span>Autocompletado por QR disponible</span>
              </span>
            </div>
          </div>

          {/* SECCIÓN DE CASETAS */}
          {formData.categoria === 'Transporte' && (
            <div className="bg-slate-50/80 p-3 space-y-2 border-y border-slate-200 mb-2 rounded-xl">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Casetas (Tolls)</h3>
                <button
                  type="button"
                  onClick={addCaseta}
                  className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-bold hover:bg-blue-700 transition-colors"
                >
                  + Agregar
                </button>
              </div>

              {casetas.map((caseta, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-1.5 items-start md:items-center bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                  <div className="md:w-32 w-full shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-bold font-mono text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={caseta.monto}
                        onChange={(e) => handleCasetaChange(index, 'monto', e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-slate-800 font-bold text-sm"
                      />
                      {caseta.analizandoFactura ? (
                        <p className="text-[10px] text-slate-500">Analizando factura...</p>
                      ) : caseta.mensajeAnalisis ? (
                        <p className="text-[10px] text-slate-500">{caseta.mensajeAnalisis}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex-1 w-full min-w-0">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <input
                        type="file"
                        accept=".pdf"
                        aria-label={`Factura de caseta ${index + 1}`}
                        onChange={(e) => handleCasetaChange(index, 'archivo', e.target.files[0])}
                        className="text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[9px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 w-full truncate"
                      />
                      {caseta.archivo && (
                        <span className="text-green-500 shrink-0 ml-1"><FileCheck size={14} /></span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeCaseta(index)}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {casetas.length === 0 && (
                <p className="text-center text-slate-400 text-[10px] italic">Sin casetas</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || analizandoFactura || casetas.some((caseta) => caseta.analizandoFactura)}
            style={{ height: '42px', fontSize: '15px' }}
            className="w-full mb-2 rounded-full bg-green-700 text-white font-black shadow-lg hover:bg-blue-900 active:scale-95 transition-all duration-200 disabled:opacity-50 flex items-center justify-center uppercase tracking-widest"
          >
            {loading ? 'GUARDANDO...' : (analizandoFactura || casetas.some((caseta) => caseta.analizandoFactura) ? 'ANALIZANDO FACTURA...' : 'GUARDAR GASTO')}
          </button>
        </form>
      </div>
    </div>
  );
};


export default FormularioGasto;