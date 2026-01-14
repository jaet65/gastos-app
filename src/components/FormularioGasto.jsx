import { useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { Calendar, AlignLeft, DollarSign, Layers, UploadCloud, X, FileCheck } from 'lucide-react';

// InputGroup Fuera para evitar re-render
const InputGroup = ({ icon: Icon, children }) => (
  // Borde más oscuro (gray-300) para mayor contraste en fondo blanco
  <div className="flex items-center bg-white border-2 border-gray-200 rounded-xl focus-within:border-black focus-within:ring-0 transition-all overflow-hidden h-14">
    <div className="pl-4 text-gray-900">
      <Icon size={20} strokeWidth={2.5} />
    </div>
    <div className="flex-1 h-full flex items-center">
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

  // TUS CREDENCIALES
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
      if (archivo) {
        pdfUrl = await subirACloudinary(archivo);
      }

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
      {/* Tarjeta con borde sólido para resaltar en fondo blanco */}
      <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-xl p-6">
        
        <div className="mb-6">
          <h2 className="text-2xl font-black text-black">Nuevo Gasto</h2>
          <p className="text-gray-500 font-medium text-sm">Ingresa los detalles</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-2 gap-3">
            <InputGroup icon={Calendar}>
              <input
                type="date"
                name="fecha"
                required
                value={formData.fecha}
                onChange={handleChange}
                className="w-full h-full pl-3 bg-transparent border-none outline-none text-black font-semibold text-sm"
              />
            </InputGroup>

            <InputGroup icon={Layers}>
              <select
                name="categoria"
                value={formData.categoria}
                onChange={handleChange}
                className="w-full h-full pl-3 bg-transparent border-none outline-none text-black font-semibold text-sm cursor-pointer appearance-none"
              >
                <option value="Transporte">Transporte</option>
                <option value="Comida">Comida</option>
                <option value="Otros">Otros</option>
              </select>
            </InputGroup>
          </div>

          <InputGroup icon={AlignLeft}>
            <input
              type="text"
              name="concepto"
              placeholder="Descripción"
              required
              value={formData.concepto}
              onChange={handleChange}
              className="w-full h-full pl-3 bg-transparent border-none outline-none text-black font-medium placeholder-gray-400"
            />
          </InputGroup>

          <InputGroup icon={DollarSign}>
            <input
              type="number"
              name="monto"
              placeholder="0.00"
              step="0.01"
              required
              value={formData.monto}
              onChange={handleChange}
              className="w-full h-full pl-3 bg-transparent border-none outline-none text-black text-lg font-bold placeholder-gray-300"
            />
          </InputGroup>

          <div>
            {!archivo ? (
              <div 
                onClick={() => fileInputRef.current.click()}
                className="border-2 border-dashed border-gray-300 hover:border-black hover:bg-gray-50 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors gap-2"
              >
                <UploadCloud size={24} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-500 uppercase">Adjuntar PDF</span>
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 border-2 border-gray-200 p-3 rounded-xl">
                <div className="bg-black text-white p-2 rounded-lg">
                  <FileCheck size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-black truncate">{archivo.name}</p>
                </div>
                <button type="button" onClick={removeFile} className="p-2 text-gray-500 hover:text-red-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-black text-white font-bold text-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar Gasto'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FormularioGasto;