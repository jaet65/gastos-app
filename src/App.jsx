import FormularioGasto from './components/FormularioGasto';
import ListaGastos from './components/ListaGastos';
import { LayoutDashboard, ChevronDown } from 'lucide-react';

function App() {
  return (
    // CONTENEDOR MAESTRO
    // - Móvil/Tablet: flex-col, h-auto (scroll global)
    // - Desktop (lg+): flex-row, h-screen (pantalla fija sin scroll global)
    <div className="w-full min-h-screen lg:h-screen bg-slate-50 flex flex-col lg:flex-row font-sans selection:bg-blue-200 selection:text-blue-900 overflow-x-hidden">
      
      {/* ------------------------------------------------------------
          COLUMNA IZQUIERDA (Formulario)
          ------------------------------------------------------------ 
          - Móvil: h-[100dvh] (Pantalla completa real)
          - Desktop (lg): Ancho fijo 450px, Altura 100%
      */}
      <div className="w-full lg:w-[450px] xl:w-[500px] shrink-0 h-[100dvh] lg:h-full bg-white relative z-0 flex flex-col border-r border-slate-100">
        
        {/* Navbar */}
        <nav className="w-full pt-4 px-4 pb-0">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-4">
              <LayoutDashboard size={16} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-800">
              Gastos <span className="text-blue-500">MAF</span>
            </h1>
          </div>
        </nav>

        {/* Formulario Centrado */}
        <div className="flex-1 flex flex-col justify-center p-6 lg:p-2">
          <FormularioGasto />

          {/* Indicador visual en móvil (desaparece en lg) */}
          <div className="lg:hidden mt-auto pb-12 flex flex-col items-center gap-2 text-slate-400 animate-pulse opacity-80">
            <span className="text-[10px] font-black uppercase tracking-widest">Desliza para ver lista</span>
            <ChevronDown size={24} />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------
          COLUMNA DERECHA (Listado / Ventana Emergente)
          ------------------------------------------------------------ 
          - Móvil: Se comporta como una "Hoja" que sube.
          - Desktop (lg): Ocupa el espacio restante (flex-1), tiene su propio scroll.
      */}
      <div className="w-full lg:flex-1 lg:h-full lg:overflow-y-auto bg-slate-100 relative z-10">
        
        {/* ENVOLTORIO ESTILO 'HOJA'
            - Móvil: Borde superior redondo, sombra, margen negativo para solaparse.
            - Desktop: Sin bordes redondos, sin sombra, sin márgenes extraños.
        */}
        <div className="min-h-screen lg:min-h-0 bg-slate-100 lg:bg-transparent rounded-t-[40px] lg:rounded-none shadow-[0_-10px_40px_rgba(0,0,0,0.1)] lg:shadow-none -mt-8 lg:mt-0 pt-8 lg:pt-0 px-4 lg:px-16 pb-32">
           
           {/* "Agarradera" visual (Solo móvil) */}
           <div className="lg:hidden w-16 h-1.5 bg-slate-300 rounded-full mx-auto mb-8" />
           
           <ListaGastos />
        </div>
      </div>

    </div>
  );
}

export default App;