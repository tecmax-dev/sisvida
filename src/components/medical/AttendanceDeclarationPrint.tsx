import { forwardRef } from "react";

interface AttendanceDeclarationPrintProps {
  clinic: {
    name: string;
    address?: string;
    phone?: string;
    cnpj?: string;
    logo_url?: string;
  };
  patient: {
    name: string;
  };
  professional?: {
    name: string;
    specialty?: string;
    registration_number?: string;
  };
  date: string;
  startTime: string;
  endTime: string;
}

export const AttendanceDeclarationPrint = forwardRef<HTMLDivElement, AttendanceDeclarationPrintProps>(
  ({ clinic, patient, professional, date, startTime, endTime }, ref) => {
    const appointmentDate = new Date(date);

    return (
      <div ref={ref} className="p-8 bg-white text-black min-h-[297mm] w-[210mm] mx-auto">
        {/* Header */}
        <div className="border-b-2 border-gray-300 pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              {clinic.logo_url && (
                <img src={clinic.logo_url} alt={clinic.name} className="h-16 mb-2" />
              )}
              <h1 className="text-xl font-bold">{clinic.name}</h1>
              {clinic.address && <p className="text-sm text-gray-600">{clinic.address}</p>}
              {clinic.phone && <p className="text-sm text-gray-600">Tel: {clinic.phone}</p>}
              {clinic.cnpj && <p className="text-sm text-gray-600">CNPJ: {clinic.cnpj}</p>}
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-primary">DECLARAÇÃO DE COMPARECIMENTO</h2>
              <p className="text-sm text-gray-600">{appointmentDate.toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* Declaration Content */}
        <div className="my-12 text-lg leading-loose">
          <p className="mb-8 text-justify">
            Declaro para os devidos fins que o(a) Sr(a). <strong>{patient.name}</strong> compareceu 
            a este estabelecimento de saúde na data de <strong>{appointmentDate.toLocaleDateString('pt-BR')}</strong>, 
            no período das <strong>{startTime}</strong> às <strong>{endTime}</strong>, 
            para atendimento médico/consulta.
          </p>
          
          <p className="mb-8 text-justify">
            O presente documento é emitido a pedido do interessado para fins de comprovação de comparecimento.
          </p>
        </div>

        {/* Signature */}
        <div className="mt-32 pt-8">
          <div className="w-64 mx-auto text-center">
            <div className="border-t border-black pt-2">
              <p className="font-semibold">{professional?.name || "Profissional"}</p>
              {professional?.specialty && (
                <p className="text-sm text-gray-600">{professional.specialty}</p>
              )}
              {professional?.registration_number && (
                <p className="text-sm text-gray-600">Registro: {professional.registration_number}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>Este documento foi gerado eletronicamente pelo sistema Eclini</p>
        </div>
      </div>
    );
  }
);

AttendanceDeclarationPrint.displayName = "AttendanceDeclarationPrint";
