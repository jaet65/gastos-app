import { useState, useRef, useEffect } from 'react'; // Agregamos useEffect
import { db } from '../firebase';
import { collection, addDoc, Timestamp, updateDoc, doc } from 'firebase/firestore'; // Agregamos updateDoc y doc
import { Calendar, AlignLeft, DollarSign, Layers, UploadCloud, X, FileCheck, CheckSquare } from 'lucide-react'; // Agregamos CheckSquare

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
  const [agregarPropina, setAgregarPropina] = useState(false); // Estado para el checkbox
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const CLOUD_NAME = "didj7kuah"; 
  const UPLOAD_PRESET = "gastos_app"; 

  // Resetear checkbox si cambia categoría
  useEffect(() => {
    if (formData.categoria !== 'Comida') {
      setAgregarPropina(false);
    }
  }, [formData.categoria]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    if (e.target.files[0]) setArchivo(e.target.files[0]);
  };

  const removeFile = () => {
    setArchivo(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const subirACloudinary = async (file) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", UPLOAD_PRESET);
    data.append("cloud_name", CLOUD_NAME);
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      { method: "POST", body: data }
    );
    const fileData = await response.json();
    return fileData.secure_url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let pdfUrl = '';
      if (archivo) pdfUrl = await subirACloudinary(archivo);

      const montoOriginal = parseFloat(formData.monto);
      const timestamp = Timestamp.now();

      // 1. Crear registro PRINCIPAL
      const docRef = await addDoc(collection(db, "gastos"), {
        ...formData,
        monto: montoOriginal,
        url_factura: pdfUrl,
        creado_en: timestamp
      });

      // 2. Lógica de PROPINA
      if (agregarPropina && formData.categoria === 'Comida') {
        const montoPropina = montoOriginal * 0.10; // 10%
        
        // Crear el registro de la propina
        const propinaRef = await addDoc(collection(db, "gastos"), {
          fecha: formData.fecha,
          concepto: `Propina => ${formData.concepto}`,
          monto: montoPropina,
          categoria: 'Comida',
          url_factura: '', // Sin factura
          creado_en: timestamp // Mismo tiempo para orden
        });

        // Actualizar el registro principal con el ID de la propina (para poder editar/borrar luego)
        await updateDoc(doc(db, "gastos", docRef.id), {
          idPropina: propinaRef.id
        });
      }

      alert("¡Guardado!");
      setFormData(INITIAL_STATE);
      setAgregarPropina(false);
      removeFile();

    } catch (error) {
      console.error("Error:", error);
      alert("Error al guardar.");
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

          {/* CHECKBOX DE PROPINA (Solo visible si es Comida) */}
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

          <div>
            {!archivo ? (
              <div onClick={() => fileInputRef.current.click()}
                className="bg-white/50 hover:bg-white/80 p-10 flex flex-col items-center justify-center cursor-pointer transition-all gap-4 group">
                <div className="bg-white p-5 transition-transform group-hover:scale-110 text-blue-500">
                  <UploadCloud size={32} />
                </div>
                <span className="text-sm font-bold text-slate-500 uppercase tracking-widest group-hover:text-blue-600">Adjuntar PDF</span>
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
              </div>
            ) : (
              <div className="flex items-center gap-6 bg-slate-100 p-6">
                <div className="bg-slate-800 text-white p-4">
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

          {/* BOTÓN GIGANTE (FORZADO) */}
          <button 
            type="submit" 
            disabled={loading}
            style={{ height: '100px', fontSize: '28px' }}
            className="w-full mt-8 rounded-3xl bg-slate-900 text-white font-black shadow-2xl hover:bg-blue-900 active:scale-95 transition-all duration-200 disabled:opacity-50 touch-manipulation flex items-center justify-center uppercase tracking-widest"
          >
            {loading ? 'GUARDANDO...' : 'GUARDAR GASTO'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FormularioGasto;