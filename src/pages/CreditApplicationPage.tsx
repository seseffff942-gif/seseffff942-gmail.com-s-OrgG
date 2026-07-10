import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import html2pdf from 'html2pdf.js';
import { ChevronLeft, Download, FileText } from 'lucide-react';

const CreditApplicationPage: React.FC = () => {
  const formRef = useRef<HTMLDivElement>(null);
  const [logoBase64, setLogoBase64] = useState<string>('');

  const [isDownloading, setIsDownloading] = useState(false);

  const handleBack = () => {
    window.location.hash = 'home';
  };

  // Load logo for PDF
  React.useEffect(() => {
    const loadLogo = async () => {
      try {
        const res = await fetch('/logo_final.jpg');
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      } catch (e) {
        // Fallback logo path if needed
      }
    };
    loadLogo();
  }, []);

  const handleDownloadPDF = async () => {
    if (!formRef.current || isDownloading) return;

    try {
      setIsDownloading(true);
      
      // Give a small delay to allow UI to update and show loading state
      await new Promise(resolve => setTimeout(resolve, 300));

      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: 'solicitud_credito_agricovet.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          letterRendering: true,
          logging: false,
          backgroundColor: '#ffffff' // Force solid background
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      // Create a clone or ensure styles are compatible
      const element = formRef.current;
      await html2pdf().from(element).set(opt).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Hubo un error al generar el PDF. Por favor intenta de nuevo.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-30 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 cursor-pointer">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="text-emerald-600" />
            SOLICITUD DE CRÉDITO
          </h1>
        </div>
        <button
          onClick={handleDownloadPDF}
          disabled={isDownloading}
          className={`flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100 ${isDownloading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isDownloading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              GENERANDO...
            </>
          ) : (
            <>
              <Download size={18} />
              DESCARGAR DOCUMENTO
            </>
          )}
        </button>
      </div>

      <div className="max-w-4xl mx-auto mt-8 px-4">
        {/* Printable Area Wrapper */}
        <div 
          ref={formRef}
          className="bg-white p-[50px] mx-auto shadow-2xl rounded-sm"
          style={{ 
            width: '100%', 
            maxWidth: '800px', 
            minHeight: '1100px', 
            fontFamily: 'serif',
            color: '#000000',
            backgroundColor: '#ffffff'
          }}
        >
          {/* Form Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
               {logoBase64 ? (
                 <img src={logoBase64} alt="Agricovet Logo" className="h-32 object-contain" />
               ) : (
                 <div className="w-32 h-32 flex items-center justify-center font-bold border-2 border-dashed rounded-full" style={{ backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', color: '#cbd5e1' }}>LOGO</div>
               )}
            </div>
            <h2 className="text-2xl font-bold pb-2 inline-block uppercase" style={{ borderBottom: '2px solid #000000' }}>
              SOLICITUD DE CRÉDITO COMERCIAL: AGRICOVET DE GUATEMALA
            </h2>
          </div>

          {/* Section 1: Información de la Empresa */}
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-4 pb-1" style={{ borderBottom: '1px solid #000000' }}>Información de la Empresa</h3>
            <div className="space-y-4 text-sm">
              <div className="flex gap-8">
                <div className="flex items-center gap-2">
                  <span>Tipo Negocio: Individual</span>
                  <div className="w-8 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                </div>
                <div className="flex items-center gap-2">
                  <span>S.A</span>
                  <div className="w-8 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="whitespace-nowrap">Nombre de la Empresa:</span>
                <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
              </div>
              <div className="flex gap-2">
                <span className="whitespace-nowrap">Dirección:</span>
                <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex gap-2">
                  <span className="whitespace-nowrap">Tel. de la Empresa:</span>
                  <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                </div>
                <div className="flex gap-2">
                  <span className="whitespace-nowrap">Cel.:</span>
                  <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="whitespace-nowrap">Nombre del Representante Legal:</span>
                <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex gap-2">
                  <span className="whitespace-nowrap">DPI:</span>
                  <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                </div>
                <div className="flex gap-2">
                  <span className="whitespace-nowrap">Tel.:</span>
                  <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="whitespace-nowrap">Nombre de la Persona Responsable para realizar transacciones:</span>
                <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex gap-2">
                  <span className="whitespace-nowrap">Tel.:</span>
                  <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                </div>
                <div className="flex gap-2">
                  <span className="whitespace-nowrap">Correo:</span>
                  <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Referencias Comerciales */}
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-4 pb-1" style={{ borderBottom: '1px solid #000000' }}>Referencias Comerciales</h3>
            <div className="space-y-6 text-sm">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex gap-2">
                      <span className="whitespace-nowrap">{i}) Empresa:</span>
                      <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                    </div>
                    <div className="flex gap-2">
                      <span className="whitespace-nowrap">Contacto:</span>
                      <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                    </div>
                    <div className="flex gap-2">
                      <span className="whitespace-nowrap">Cel.:</span>
                      <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <span>Maneja crédito: si</span>
                      <div className="w-8 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                      <span>no</span>
                      <div className="w-8 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                    </div>
                    <div className="flex flex-1 gap-2">
                      <span className="whitespace-nowrap">¿Cuál es monto?</span>
                      <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                    </div>
                    <div className="flex flex-1 gap-2">
                      <span className="whitespace-nowrap">Saldo actual:</span>
                      <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <span>Maneja crédito en Otras empresas si</span>
                  <div className="w-8 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                  <span>no</span>
                  <div className="w-8 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                </div>
                <div className="flex flex-1 gap-2">
                  <span className="whitespace-nowrap">¿Cuál es monto?</span>
                  <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                </div>
                <div className="flex flex-1 gap-2">
                  <span className="whitespace-nowrap">Saldo actual:</span>
                  <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* PAGE BREAK HERE */}
          <div style={{ pageBreakBefore: 'always', paddingTop: '40px' }}>
            {/* Section 3: Referencias Personales */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-4 pb-1" style={{ borderBottom: '1px solid #000000' }}>Referencias Personales</h3>
              <div className="space-y-4 text-sm">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="grid grid-cols-4 gap-4">
                    <div className="flex gap-2 col-span-1">
                      <span className="whitespace-nowrap">{i}) Nombre:</span>
                      <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                    </div>
                    <div className="flex gap-2">
                      <span className="whitespace-nowrap">Relación:</span>
                      <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                    </div>
                    <div className="flex gap-2">
                      <span className="whitespace-nowrap">Cel.:</span>
                      <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                    </div>
                    <div className="flex gap-2">
                      <span className="whitespace-nowrap">Dir.:</span>
                      <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 mb-8 text-sm italic font-bold" style={{ border: '2px solid #000000' }}>
              Autorizo a AgricoVet de Guatemala a validar la información.
            </div>

            {/* Section 4: Información Financiera */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-4 pb-1" style={{ borderBottom: '1px solid #000000' }}>Información Financiera</h3>
              <div className="space-y-6 text-sm">
                <div className="flex gap-2">
                  <span className="whitespace-nowrap">Ingresos Mensuales Aproximados:</span>
                  <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                </div>
                <div className="space-y-4 uppercase font-bold pt-2">
                  <p>SE SOLICITA:</p>
                  <div className="flex gap-2 pl-4">
                    <span className="whitespace-nowrap">Un Crédito de: Q.</span>
                    <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                  </div>
                  <div className="flex gap-2 pl-4">
                    <span className="whitespace-nowrap">Contado:</span>
                    <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                  </div>
                  <div className="flex gap-2 pl-4">
                    <span className="whitespace-nowrap">Tiempo de crédito solicitado:</span>
                    <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                  </div>
                </div>
                <div className="flex gap-2 pt-6">
                  <span className="whitespace-nowrap">Autoriza (f)</span>
                  <div className="flex-1 h-5" style={{ borderBottom: '1px solid #000000' }}></div>
                </div>
              </div>
            </div>

            <p className="text-[10px] mb-12">
              Declaro que la información es verdadera... Autorizamos a AGRICOVET DE GUATEMALA a realizar investigaciones...
            </p>

            <div className="flex flex-col items-center w-1/3 mb-12">
              <div className="w-full h-5 mb-2" style={{ borderBottom: '1px solid #000000' }}></div>
              <p className="text-sm font-bold">(f) Nombre / DPI</p>
            </div>

            {/* Section 5: DOCUMENTOS QUE SE DEBEN ADJUNTAR */}
            <div className="pt-8" style={{ borderTop: '2px solid #000000' }}>
              <h3 className="text-md font-bold mb-4 uppercase tracking-wider">DOCUMENTOS QUE SE DEBEN ADJUNTAR</h3>
              <ul className="list-disc pl-8 space-y-2 text-sm font-bold">
                <li>Copia de Escritura de Constitución y ampliaciones</li>
                <li>Copia de Nombramiento Representante Legal y DPI</li>
                <li>Copia de Patente de Comercio de Empresa y de Sociedad (separados)</li>
                <li>Constancia de Inscripción ante la SAT (RTU) actualizado</li>
                <li>Estados Financieros y Solvencia Fiscal</li>
                <li>Copia de DPI</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditApplicationPage;
