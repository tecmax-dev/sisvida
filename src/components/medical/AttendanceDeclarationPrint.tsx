import { forwardRef } from "react";
import { DocumentSettings } from "@/hooks/useDocumentSettings";

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
  settings?: DocumentSettings | null;
}

const parseTemplate = (template: string, variables: Record<string, string>) => {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
};

export const AttendanceDeclarationPrint = forwardRef<HTMLDivElement, AttendanceDeclarationPrintProps>(
  ({ clinic, patient, professional, date, startTime, endTime, settings }, ref) => {
    const showLogo = settings?.show_logo ?? true;
    const showAddress = settings?.show_address ?? true;
    const showPhone = settings?.show_phone ?? true;
    const showCnpj = settings?.show_cnpj ?? true;
    const showFooter = settings?.show_footer ?? true;
    const footerText = settings?.footer_text || 'Este documento foi gerado eletronicamente pelo sistema Eclini';
    const title = settings?.attendance_title || 'DECLARAÇÃO DE COMPARECIMENTO';
    const customHeaderText = settings?.custom_header_text;
    const paperSize = settings?.paper_size || 'A4';
    
    const paperDimensions = paperSize === 'A5' 
      ? { width: '148mm', height: '210mm', padding: 'p-6', minHeight: 'min-h-[210mm]', logoHeight: 'h-12' }
      : { width: '210mm', height: '297mm', padding: 'p-8', minHeight: 'min-h-[297mm]', logoHeight: 'h-16' };

    const appointmentDate = new Date(date);
    
    const defaultTemplate = 'Declaro para os devidos fins que o(a) Sr(a). {patient_name} compareceu a este estabelecimento de saúde na data de {date}, no período das {start_time} às {end_time}, para atendimento médico/consulta.';
    
    const template = settings?.attendance_template || defaultTemplate;
    const variables = {
      patient_name: patient.name,
      date: appointmentDate.toLocaleDateString('pt-BR'),
      start_time: startTime,
      end_time: endTime,
    };

    const declarationText = parseTemplate(template, variables);

    return (
      <div ref={ref} className={`${paperDimensions.padding} bg-white text-black ${paperDimensions.minHeight}`} style={{ width: paperDimensions.width }}>
        {/* Header */}
        <div className="border-b-2 border-gray-300 pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              {showLogo && clinic.logo_url && (
                <img src={clinic.logo_url} alt={clinic.name} className={`${paperDimensions.logoHeight} mb-2 object-contain`} />
              )}
              <h1 className="text-xl font-bold">{clinic.name}</h1>
              {customHeaderText && <p className="text-sm text-gray-600">{customHeaderText}</p>}
              {showAddress && clinic.address && <p className="text-sm text-gray-600">{clinic.address}</p>}
              {showPhone && clinic.phone && <p className="text-sm text-gray-600">Tel: {clinic.phone}</p>}
              {showCnpj && clinic.cnpj && <p className="text-sm text-gray-600">CNPJ: {clinic.cnpj}</p>}
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-primary">{title}</h2>
              <p className="text-sm text-gray-600">{appointmentDate.toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* Declaration Content */}
        <div className="my-12 text-lg leading-loose">
          <p className="mb-8 text-justify">{declarationText}</p>
          
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
        {showFooter && (
          <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
            <p>{footerText}</p>
          </div>
        )}
      </div>
    );
  }
);

AttendanceDeclarationPrint.displayName = "AttendanceDeclarationPrint";
