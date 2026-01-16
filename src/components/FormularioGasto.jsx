import { useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { Calendar, AlignLeft, DollarSign, Layers, UploadCloud, X, FileCheck } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const CLOUD_NAME = "didj7kuah"; 
  const UPLOAD_PRESET = "gastos_app"; 

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

      await addDoc(collection(db, "gastos"), {
        ...formData,
        monto: parseFloat(formData.monto),
        url_factura: pdfUrl,
        creado_en: Timestamp.now()
      });

      alert("¡Guardado!");
      setFormData(INITIAL_STATE);
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
      {/* TARJETA PRINCIPAL: Bloque de cristal plano sin bordes ni sombras */}
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
          <br /><br />
          <div>
            {!archivo ? (
              // Área de carga plana, sin borde punteado
              <div onClick={() => fileInputRef.current.click()}
                className="bg-white/50 hover:bg-white/80 p-10 flex flex-col items-center justify-center cursor-pointer transition-all gap-4 group">
                <div className="bg-white p-5 transition-transform group-hover:scale-110 text-blue-500">
                  <UploadCloud size={32} />
                </div>
                <span className="text-sm font-bold text-slate-500 uppercase tracking-widest group-hover:text-blue-600">Adjuntar PDF</span>
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                <br /><br />
              </div>
            ) : (
              // Archivo cargado: Bloque sólido
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

          {/* BOTON PLANO GRANDE */}
          <button 
            type="submit" 
            disabled={loading}
            style={{ height: '50px', fontSize: '20px' }} // Forzamos altura y fuente
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