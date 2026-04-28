import { useState, useRef, useEffect } from 'react';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { collection, addDoc, Timestamp, updateDoc, doc } from 'firebase/firestore';
import SolicitudRecursosModal from './SolicitudRecursosModal';
import { formatInTimeZone } from 'date-fns-tz';
import { Calendar, AlignLeft, DollarSign, Layers, UploadCloud, X, FileCheck, ArrowDownCircle, FileCog } from 'lucide-react';

// InputGroup: Bloque plano sin bordes
const InputGroup = ({ icon: Icon, children }) => ( // eslint-disable-line no-unused-vars
  <div className="flex items-center bg-white/50 transition-all overflow-hidden h-18 hover:bg-white/80 focus-within:bg-white backdrop-blur-md">
    <div className="pl-8 text-slate-400">
      <Icon size={16} strokeWidth={2.5} />
    </div>
    <div className="flex-1 h-full flex items-center pr-8">
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
  const [modalRecursosAbierto, setModalRecursosAbierto] = useState(false);
  
  // Estado para el Drag & Drop Global
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  
  const fileInputRef = useRef(null);

  const CLOUD_NAME = "didj7kuah"; 
  const UPLOAD_PRESET = "Gastos_Facturas";

  useEffect(() => {
    if (formData.categoria !== 'Comida') {
      setAgregarPropina(false);
    }
    if (formData.categoria !== 'Transporte') {
      setCasetas([]);
    }
  }, [formData.categoria]);

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
          setArchivo(file);
        } else {
          alert("Por favor, arrastra solo archivos PDF.");
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
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    if (e.target.files[0]) setArchivo(e.target.files[0]);
  };

  const removeFile = () => {
    setArchivo(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const addCaseta = () => {
    setCasetas([...casetas, { monto: '', archivo: null }]);
  };

  const removeCaseta = (index) => {
    const newCasetas = [...casetas];
    newCasetas.splice(index, 1);
    setCasetas(newCasetas);
  };

  const handleCasetaChange = (index, field, value) => {
    const newCasetas = [...casetas];
    newCasetas[index][field] = value;
    setCasetas(newCasetas);
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
    data.append("file", fileDataUrl); // Cloudinary acepta Base64
    data.append("upload_preset", UPLOAD_PRESET);
    data.append("cloud_name", CLOUD_NAME);
    
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
    setLoading(true);

    try {
      let fileData = null; 

      if (archivo) {
        try {
          fileData = await subirACloudinary(archivo);
        } catch (uploadError) {
          console.error(uploadError);
          alert(`No se pudo subir el archivo: ${uploadError.message}`);
          setLoading(false);
          return; 
        }
      }

      const montoOriginal = parseFloat(formData.monto);
      const timestamp = Timestamp.now();

      const docRef = await addDoc(collection(db, "gastos"), {
        ...formData,
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
              alert(`Error al subir caseta: ${uploadError.message}`);
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

      alert("¡Guardado correctamente!");
      setFormData(INITIAL_STATE);
      setAgregarPropina(false);
      setCasetas([]);
      removeFile();

    } catch (error) {
      console.error("Error general:", error);
      alert("Error al guardar en la base de datos: " + error.message);
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
        
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Nuevo Gasto</h2>
          <button type="button" onClick={() => setModalRecursosAbierto(true)} className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-100 hover:bg-blue-200 p-2 rounded-full transition-colors" title="Generar solicitud de recursos">
            <FileCog size={16} />
            <span>Solicitar Recursos</span>
          </button>
        </div>
        <div className="mb-0">
          <p className="text-slate-500 font-medium text-base mt-2">Ingresa los detalles del movimiento</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
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
              </select>
            </InputGroup>
          </div>

          <InputGroup icon={AlignLeft}>
            <input type="text" name="concepto" placeholder="Descripción" required value={formData.concepto} onChange={handleChange}
              className="w-full h-full pl-2 bg-transparent border-none outline-none text-slate-900 font-bold text-lg placeholder-slate-400" />
          </InputGroup>

          <InputGroup icon={DollarSign}>
            <input type="number" name="monto" placeholder="0.00" step="0.01" required value={formData.monto} onChange={handleChange}
              className="w-full h-full pl-2 bg-transparent border-none outline-none text-slate-900 text-3xl font-black placeholder-slate-300" />
          </InputGroup>

          {/* CHECKBOX DE PROPINA */}
          {formData.categoria === 'Comida' && (
            <div className="flex items-center gap-3 bg-blue-50/50 p-1 border-l-4 border-blue-500">
              <input 
                type="checkbox" 
                id="checkPropina"
                checked={agregarPropina}
                onChange={(e) => setAgregarPropina(e.target.checked)}
                className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
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
          <div className="mt-2 mb-2">
            {!archivo ? (
              <div 
                onClick={() => fileInputRef.current.click()}
                className={`
                  p-1 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 gap-1 group border-1 border-none
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
                </div>
                <button type="button" onClick={removeFile} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
            )}
          </div>

          {/* SECCIÓN DE CASETAS */}
          {formData.categoria === 'Transporte' && (
            <div className="bg-slate-50/80 p-4 space-y-3 border-y border-slate-200 mb-4 rounded-xl">
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
                <div key={index} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                  <div className="md:w-32 w-full flex-shrink-0">
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
                    </div>
                  </div>
                  
                  <div className="flex-1 w-full min-w-0">
                    <div className="flex items-center gap-2 overflow-hidden">
                       <input 
                          type="file" 
                          accept=".pdf"
                          onChange={(e) => handleCasetaChange(index, 'archivo', e.target.files[0])}
                          className="text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[9px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 w-full truncate"
                       />
                       {caseta.archivo && (
                         <span className="text-green-500 flex-shrink-0 ml-1"><FileCheck size={14} /></span>
                       )}
                    </div>
                  </div>

                  <button 
                    type="button" 
                    onClick={() => removeCaseta(index)}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
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
            disabled={loading}
            style={{ height: '48px', fontSize: '18px' }}
            className="w-full mb-2 rounded-full bg-green-700 text-white font-black shadow-lg hover:bg-blue-900 active:scale-95 transition-all duration-200 disabled:opacity-50 flex items-center justify-center uppercase tracking-widest"
          >
            {loading ? 'GUARDANDO...' : 'GUARDAR GASTO'}
          </button>
        </form>
      </div>
    </div>
  );
};


export default FormularioGasto;