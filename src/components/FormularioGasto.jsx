import { useState } from 'react';
import { db } from '../firebase'; // Ya NO importamos storage de firebase
import { collection, addDoc, Timestamp } from 'firebase/firestore';

const FormularioGasto = () => {
  const [formData, setFormData] = useState({
    fecha: '',
    concepto: '',
    monto: '',
    categoria: 'Transporte',
  });
  const [archivo, setArchivo] = useState(null);
  const [loading, setLoading] = useState(false);

  // CONFIGURACIÓN DE CLOUDINARY
  const CLOUD_NAME = "didj7kuah"; // <-- Pon tu Cloud Name aquí
  const UPLOAD_PRESET = "gastos_app"; // <-- Pon el nombre del preset aquí

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setArchivo(e.target.files[0]);
    }
  };

  const subirACloudinary = async (file) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", UPLOAD_PRESET);
    data.append("cloud_name", CLOUD_NAME);
    data.append("folder", "gastos_pdf"); // Carpeta opcional en Cloudinary

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, // Para PDFs a veces se usa /raw/upload o /image/upload depende de la config, image suele funcionar para visualización
        {
          method: "POST",
          body: data,
        }
      );
      const fileData = await response.json();
      return fileData.secure_url; // Retorna la URL del PDF
    } catch (error) {
      console.error("Error subiendo a Cloudinary:", error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let pdfUrl = '';

      // 1. Subir a Cloudinary si hay archivo
      if (archivo) {
        pdfUrl = await subirACloudinary(archivo);
        console.log("Archivo subido a:", pdfUrl);
      }

      // 2. Guardar en Firestore
      await addDoc(collection(db, "gastos"), {
        ...formData,
        monto: parseFloat(formData.monto),
        url_factura: pdfUrl,
        creado_en: Timestamp.now()
      });

      alert("¡Gasto guardado con éxito!");
      setFormData({ fecha: '', concepto: '', monto: '', categoria: 'Transporte' });
      setArchivo(null);

    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar. Revisa la consola.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md mt-10">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Registrar Gasto</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Fecha */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha</label>
          <input
            type="date"
            name="fecha"
            required
            value={formData.fecha}
            onChange={handleChange}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* Concepto */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Concepto</label>
          <input
            type="text"
            name="concepto"
            placeholder="Ej: Taxi al aeropuerto"
            required
            value={formData.concepto}
            onChange={handleChange}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Categoría</label>
          <select
            name="categoria"
            value={formData.categoria}
            onChange={handleChange}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="Transporte">Transporte</option>
            <option value="Comida">Comida</option>
            <option value="Otros">Otros</option>
          </select>
        </div>

        {/* Monto */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Monto ($)</label>
          <input
            type="number"
            name="monto"
            placeholder="0.00"
            step="0.01"
            required
            value={formData.monto}
            onChange={handleChange}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* Archivo PDF */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Factura (PDF)</label>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white font-medium 
            ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'Subiendo y Guardando...' : 'Guardar Gasto'}
        </button>
      </form>
    </div>
  );
};

export default FormularioGasto;