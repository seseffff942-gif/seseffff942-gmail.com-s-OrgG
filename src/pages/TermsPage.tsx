import React from 'react';
import { User } from '../types';
import { ArrowLeft } from 'lucide-react';

interface TermsPageProps {
  user: User;
  isMobile?: boolean;
}

export function TermsPage({ user, isMobile }: TermsPageProps) {
  return (
    <div className={`max-w-4xl mx-auto flex flex-col ${isMobile ? 'p-4 h-full space-y-4' : 'p-8'}`}>
      <div className={`flex flex-col gap-2 ${isMobile ? 'mb-4' : 'mb-8'}`}>
        <h1 className="text-4xl font-black text-[#0b3b2c] tracking-tight font-hanken">Términos y Condiciones</h1>
        <p className="text-[#44474c] font-manrope">Última actualización: Junio de 2026</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-10 text-[#44474c] space-y-6 font-manrope leading-relaxed overflow-y-auto flex-1">
        
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#191c1d] font-hanken">1. Aceptación de los Términos</h2>
          <p>
            Al acceder y utilizar el sistema Agricovet, usted acepta estar sujeto a estos términos y condiciones. Si no está de acuerdo con alguna parte de estos términos, no podrá acceder al sistema.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#191c1d] font-hanken">2. Uso de la Aplicación</h2>
          <p>
            El sistema está destinado para el uso exclusivo de empleados y colaboradores autorizados de Agricovet. El uso de la plataforma para fines ajenos a los comerciales de la empresa, o la manipulación de la información sin la debida autorización, está estrictamente prohibido.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#191c1d] font-hanken">3. Privacidad y Datos de Usuarios</h2>
          <p>
            Toda la información registrada, tanto de clientes como de productos, es propiedad de Agricovet. Nos comprometemos a proteger la privacidad de los datos personales ingresados en el sistema y a no compartirlos con terceros sin el consentimiento correspondiente.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#191c1d] font-hanken">4. Responsabilidad</h2>
          <p>
            Cada usuario es responsable de mantener la confidencialidad de sus credenciales de acceso. Agricovet no se hace responsable de las pérdidas de datos o daños derivados del mal uso de las cuentas o de la compartición de contraseñas.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#191c1d] font-hanken">5. Modificación de los Términos</h2>
          <p>
            Agricovet se reserva el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán en vigor inmediatamente después de su publicación en el sistema. Es su responsabilidad revisar periódicamente estos términos.
          </p>
        </section>

      </div>
    </div>
  );
}
