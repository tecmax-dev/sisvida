import { forwardRef } from "react";
import { DocumentSettings } from "@/hooks/useDocumentSettings";

interface PrescriptionPrintProps {
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
  prescription: string;
  date: string;
  settings?: DocumentSettings | null;
}

export const PrescriptionPrint = forwardRef<HTMLDivElement, PrescriptionPrintProps>(
  ({ clinic, patient, professional, prescription, date, settings }, ref) => {
    const showLogo = settings?.show_logo ?? true;
    const showAddress = settings?.show_address ?? true;
    const showPhone = settings?.show_phone ?? true;
    const showCnpj = settings?.show_cnpj ?? true;
    const showFooter = settings?.show_footer ?? true;
    const footerText = settings?.footer_text || 'Este documento foi gerado eletronicamente pelo sistema Eclini';
    const title = settings?.prescription_title || 'RECEITUÁRIO';
    const customHeaderText = settings?.custom_header_text;

    return (
      <div ref={ref} className="p-8 bg-white text-black min-h-[297mm] w-[210mm] mx-auto">
        {/* Header */}
        <div className="border-b-2 border-gray-300 pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              {showLogo && clinic.logo_url && (
                <img src={clinic.logo_url} alt={clinic.name} className="h-16 mb-2 object-contain" />
              )}
              <h1 className="text-xl font-bold">{clinic.name}</h1>
              {customHeaderText && <p className="text-sm text-gray-600">{customHeaderText}</p>}
              {showAddress && clinic.address && <p className="text-sm text-gray-600">{clinic.address}</p>}
              {showPhone && clinic.phone && <p className="text-sm text-gray-600">Tel: {clinic.phone}</p>}
              {showCnpj && clinic.cnpj && <p className="text-sm text-gray-600">CNPJ: {clinic.cnpj}</p>}
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-primary">{title}</h2>
              <p className="text-sm text-gray-600">{new Date(date).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* Patient Info */}
        <div className="mb-8">
          <p className="text-lg">
            <span className="font-semibold">Paciente:</span> {patient.name}
          </p>
        </div>

        {/* Prescription Content */}
        <div className="mb-16 min-h-[400px]">
          <div className="whitespace-pre-wrap text-base leading-relaxed">
            {prescription}
          </div>
        </div>

        {/* Signature */}
        <div className="mt-auto pt-8">
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
        {showFooter && (
          <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
            <p>{footerText}</p>
          </div>
        )}
      </div>
    );
  }
);

PrescriptionPrint.displayName = "PrescriptionPrint";
