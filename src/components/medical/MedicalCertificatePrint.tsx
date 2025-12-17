import { forwardRef } from "react";
import { DocumentSettings } from "@/hooks/useDocumentSettings";

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
  settings?: DocumentSettings | null;
}

const parseTemplate = (template: string, variables: Record<string, string>) => {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
};

export const MedicalCertificatePrint = forwardRef<HTMLDivElement, MedicalCertificatePrintProps>(
  ({ clinic, patient, professional, date, days, reason, settings }, ref) => {
    const showLogo = settings?.show_logo ?? true;
    const showAddress = settings?.show_address ?? true;
    const showPhone = settings?.show_phone ?? true;
    const showCnpj = settings?.show_cnpj ?? true;
    const showFooter = settings?.show_footer ?? true;
    const footerText = settings?.footer_text || 'Este documento foi gerado eletronicamente pelo sistema Eclini';
    const title = settings?.certificate_title || 'ATESTADO MÉDICO';
    const customHeaderText = settings?.custom_header_text;
    
    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days - 1);

    const defaultTemplate = days > 1 
      ? 'Atesto para os devidos fins que o(a) paciente {patient_name} esteve sob meus cuidados profissionais na data de {date}, necessitando de afastamento de suas atividades por um período de {days} dia(s), de {date} a {end_date}.'
      : 'Atesto para os devidos fins que o(a) paciente {patient_name} esteve sob meus cuidados profissionais na data de {date}, necessitando de afastamento de suas atividades nesta data.';

    const template = settings?.certificate_template || defaultTemplate;
    const variables = {
      patient_name: patient.name,
      date: startDate.toLocaleDateString('pt-BR'),
      days: days.toString(),
      end_date: endDate.toLocaleDateString('pt-BR'),
      cid: reason || '',
    };

    const certificateText = parseTemplate(template, variables);

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
              <p className="text-sm text-gray-600">{startDate.toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* Certificate Content */}
        <div className="my-12 text-lg leading-loose">
          <p className="mb-8">{certificateText}</p>
          
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
        {showFooter && (
          <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
            <p>{footerText}</p>
          </div>
        )}
      </div>
    );
  }
);

MedicalCertificatePrint.displayName = "MedicalCertificatePrint";
