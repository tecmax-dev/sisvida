import { forwardRef, useState } from "react";

interface MedicalCertificatePrintProps {
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
  days: number;
  reason?: string;
}

export const MedicalCertificatePrint = forwardRef<HTMLDivElement, MedicalCertificatePrintProps>(
  ({ clinic, patient, professional, date, days, reason }, ref) => {
    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days - 1);

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
              <h2 className="text-2xl font-bold text-primary">ATESTADO MÉDICO</h2>
              <p className="text-sm text-gray-600">{startDate.toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* Certificate Content */}
        <div className="my-12 text-lg leading-loose">
          <p className="mb-8">
            Atesto para os devidos fins que o(a) paciente <strong>{patient.name}</strong> esteve 
            sob meus cuidados profissionais na data de <strong>{startDate.toLocaleDateString('pt-BR')}</strong>
            {days > 1 ? (
              <>, necessitando de afastamento de suas atividades por um período de <strong>{days} dias</strong>, 
              de <strong>{startDate.toLocaleDateString('pt-BR')}</strong> a <strong>{endDate.toLocaleDateString('pt-BR')}</strong>.</>
            ) : (
              <>, necessitando de afastamento de suas atividades nesta data.</>
            )}
          </p>
          
          {reason && (
            <p className="mb-8">
              <strong>CID:</strong> {reason}
            </p>
          )}
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

MedicalCertificatePrint.displayName = "MedicalCertificatePrint";
