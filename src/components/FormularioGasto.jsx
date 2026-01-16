import { useState, useRef, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { Calendar, AlignLeft, DollarSign, Layers, UploadCloud, X, FileCheck, ArrowDownCircle } from 'lucide-react';

// InputGroup: Bloque plano sin bordes
const InputGroup = ({ icon: Icon, children }) => (
  <div className="flex items-center bg-white/50 transition-all overflow-hidden h-18 hover:bg-white/80 focus-within:bg-white backdrop-blur-md">
    <div className="pl-8 text-slate-400">
      <Icon size={24} strokeWidth={2.5} />
    </div>
    <div className="flex-1 h-full flex items-center pr-8">
      {children}
    </div>
  </div>
);

const FormularioGasto = () => {
  const INITIAL_STATE = {
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    monto: '',
    categoria: 'Transporte',
  };

  const [formData, setFormData] = useState(INITIAL_STATE);
  const [archivo, setArchivo] = useState(null);
  const [agregarPropina, setAgregarPropina] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estado para el Drag & Drop Global
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  
  const fileInputRef = useRef(null);

  const CLOUD_NAME = "didj7kuah"; 
  const UPLOAD_PRESET = "gastos_app"; 

  useEffect(() => {
    if (formData.categoria !== 'Comida') {
      setAgregarPropina(false);
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

    return fileData.secure_url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let pdfUrl = '';
      
      if (archivo) {
        try {
          pdfUrl = await subirACloudinary(archivo);
        } catch (uploadError) {
          console.error(uploadError);
          // 2. Alert con el mensaje real del error
          alert(`No se pudo subir el archivo: ${uploadError.message}`);
          setLoading(false);
          return; // Detenemos todo si falla la subida
        }
      }

      const montoOriginal = parseFloat(formData.monto);
      const timestamp = Timestamp.now();

      const docRef = await addDoc(collection(db, "gastos"), {
        ...formData,
        monto: montoOriginal,
        url_factura: pdfUrl || '',
        creado_en: timestamp
      });

      if (agregarPropina && formData.categoria === 'Comida') {
        const montoPropina = montoOriginal * 0.10;
        
        const propinaRef = await addDoc(collection(db, "gastos"), {
          fecha: formData.fecha,
          concepto: `Propina => ${formData.concepto} @ ${formData.fecha}`,
          monto: montoPropina,
          categoria: 'Comida',
          url_factura: '',
          creado_en: timestamp
        });

        await updateDoc(doc(db, "gastos", docRef.id), {
          idPropina: propinaRef.id
        });
      }

      alert("¡Guardado correctamente!");
      setFormData(INITIAL_STATE);
      setAgregarPropina(false);
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
      {/* TARJETA PRINCIPAL */}
      <div className="bg-white/40 backdrop-blur-xl p-12">
        
        <div className="mb-12">
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Nuevo Gasto</h2>
          <p className="text-slate-500 font-medium text-base mt-2">Ingresa los detalles del movimiento</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputGroup icon={Calendar}>
              <input type="date" name="fecha" required value={formData.fecha} onChange={handleChange}
                className="w-full h-full pl-6 bg-transparent border-none outline-none text-slate-700 font-bold text-base" />
            </InputGroup>

            <InputGroup icon={Layers}>
              <select name="categoria" value={formData.categoria} onChange={handleChange}
                className="w-full h-full pl-6 bg-transparent border-none outline-none text-slate-700 font-bold text-base cursor-pointer appearance-none">
                <option value="Transporte">Transporte</option>
                <option value="Comida">Comida</option>
                <option value="Otros">Otros</option>
              </select>
            </InputGroup>
          </div>

          <InputGroup icon={AlignLeft}>
            <input type="text" name="concepto" placeholder="Descripción" required value={formData.concepto} onChange={handleChange}
              className="w-full h-full pl-6 bg-transparent border-none outline-none text-slate-900 font-bold text-lg placeholder-slate-400" />
          </InputGroup>

          <InputGroup icon={DollarSign}>
            <input type="number" name="monto" placeholder="0.00" step="0.01" required value={formData.monto} onChange={handleChange}
              className="w-full h-full pl-6 bg-transparent border-none outline-none text-slate-900 text-3xl font-black placeholder-slate-300" />
          </InputGroup>

          {/* CHECKBOX DE PROPINA */}
          {formData.categoria === 'Comida' && (
            <div className="flex items-center gap-3 bg-blue-50/50 p-4 border-l-4 border-blue-500">
              <input 
                type="checkbox" 
                id="checkPropina"
                checked={agregarPropina}
                onChange={(e) => setAgregarPropina(e.target.checked)}
                className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
              />
              <label htmlFor="checkPropina" className="text-slate-700 font-bold text-sm cursor-pointer select-none">
                ¿Agregar Propina (10%)?
              </label>
              {agregarPropina && formData.monto && (
                <span className="ml-auto text-blue-600 font-black text-sm">
                  +${(parseFloat(formData.monto || 0) * 0.10).toFixed(2)}
                </span>
              )}
            </div>
          )}

          <br/><br/>

          {/* ZONA DE ARCHIVO */}
          <div>
            {!archivo ? (
              <div 
                onClick={() => fileInputRef.current.click()}
                className={`
                  p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 gap-4 group border-2 border-dashed rounded-xl
                  ${isDragging 
                    ? 'border-blue-500 bg-blue-50 scale-105 shadow-xl ring-4 ring-blue-100' 
                    : 'border-transparent bg-white/50 hover:bg-white/80'
                  }
                `}
              >
                <div className={`
                  p-5 transition-transform duration-300 rounded-full shadow-sm
                  ${isDragging ? 'bg-blue-200 text-blue-700 scale-110' : 'bg-white text-blue-500 group-hover:scale-110'}
                `}>
                  {isDragging ? (
                    <ArrowDownCircle size={40} className="animate-bounce" strokeWidth={2.5} />
                  ) : (
                    <UploadCloud size={32} />
                  )}
                </div>
                
                <span className={`text-sm font-bold uppercase tracking-widest transition-colors ${isDragging ? 'text-blue-700' : 'text-slate-500 group-hover:text-blue-600'}`}>
                  {isDragging ? '¡SUELTA EL PDF AQUÍ!' : 'ARRASTRA O CLICK PARA ADJUNTAR PDF'}
                </span>
                
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
              </div>
            ) : (
              <div className="flex items-center gap-6 bg-slate-100 p-6 rounded-xl border border-slate-200">
                <div className="bg-slate-800 text-white p-4 rounded-lg">
                  <FileCheck size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-slate-800 truncate">{archivo.name}</p>
                </div>
                <button type="button" onClick={removeFile} className="p-4 text-slate-400 hover:text-red-500 transition-colors">
                  <X size={24} />
                </button>
              </div>
            )}
          </div>

          <br/><br/>

          <button 
            type="submit" 
            disabled={loading}
            style={{ height: '100px', fontSize: '28px' }}
            className="w-full mt-8 rounded-full bg-transparent text-white font-black shadow-2xl hover:bg-blue-900 active:scale-95 transition-all duration-200 disabled:opacity-50 touch-manipulation flex items-center justify-center uppercase tracking-widest"
          >
            {loading ? 'GUARDANDO...' : 'GUARDAR GASTO'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FormularioGasto;