import { forwardRef } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DocumentSettings } from "@/hooks/useDocumentSettings";

interface ControlledPrescriptionPrintProps {
  clinic: {
    name: string;
    address?: string;
    phone?: string;
    cnpj?: string;
    logo_url?: string;
  };
  patient: {
    name: string;
    cpf?: string;
    address?: string;
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

export const ControlledPrescriptionPrint = forwardRef<HTMLDivElement, ControlledPrescriptionPrintProps>(
  ({ clinic, patient, professional, prescription, date, settings }, ref) => {
    const formattedDate = format(parseISO(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const cityDate = `${clinic.address?.split(',').pop()?.trim() || 'Local'}, ${formattedDate}`;

    const showLogo = settings?.show_logo !== false;
    const showAddress = settings?.show_address !== false;
    const showPhone = settings?.show_phone !== false;
    const showCnpj = settings?.show_cnpj !== false;
    const showFooter = settings?.show_footer !== false;
    const paperSize = settings?.paper_size || 'A4';
    
    // Receita controlada sempre em A4 (duas vias)
    const pageWidth = '210mm';

    // Common header for both vias
    const renderHeader = (viaNumber: number, viaType: string) => (
      <div className="border-b-2 border-gray-300 pb-4 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {showLogo && clinic.logo_url && (
              <img 
                src={clinic.logo_url} 
                alt="Logo" 
                className="h-12 w-auto object-contain"
              />
            )}
            <div>
              <h1 className="text-lg font-bold text-black">{clinic.name}</h1>
              {showAddress && clinic.address && (
                <p className="text-xs text-gray-600">{clinic.address}</p>
              )}
              {showPhone && clinic.phone && (
                <p className="text-xs text-gray-600">Tel: {clinic.phone}</p>
              )}
              {showCnpj && clinic.cnpj && (
                <p className="text-xs text-gray-600">CNPJ: {clinic.cnpj}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="bg-gray-100 border border-gray-300 px-3 py-1 rounded">
              <p className="text-xs font-bold text-gray-700">{viaNumber}ª VIA</p>
              <p className="text-xs text-gray-600">{viaType}</p>
            </div>
          </div>
        </div>
      </div>
    );

    // Document title
    const renderTitle = () => (
      <div className="text-center mb-4">
        <h2 className="text-base font-bold text-black uppercase tracking-wide border-b-2 border-black pb-1 inline-block">
          Receituário de Controle Especial
        </h2>
        <p className="text-xs text-gray-500 mt-1">Portaria SVS/MS nº 344/98</p>
      </div>
    );

    // Patient info section
    const renderPatientInfo = () => (
      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="font-semibold text-gray-700">Paciente:</span>
            <span className="ml-2 text-black">{patient.name}</span>
          </div>
          {patient.cpf && (
            <div>
              <span className="font-semibold text-gray-700">CPF:</span>
              <span className="ml-2 text-black">{patient.cpf}</span>
            </div>
          )}
          {patient.address && (
            <div className="col-span-2">
              <span className="font-semibold text-gray-700">Endereço:</span>
              <span className="ml-2 text-black">{patient.address}</span>
            </div>
          )}
        </div>
      </div>
    );

    // Prescription content
    const renderPrescription = () => (
      <div className="mb-4">
        <div className="border border-gray-300 rounded p-4 min-h-[120px] bg-white">
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-black">{prescription}</p>
        </div>
      </div>
    );

    // Signature section
    const renderSignature = () => (
      <div className="mt-6">
        <p className="text-xs text-gray-600 mb-4">{cityDate}</p>
        <div className="flex justify-center">
          <div className="text-center">
            <div className="border-t border-black w-56 pt-2">
              <p className="text-sm font-semibold text-black">{professional?.name || "Profissional"}</p>
              {professional?.specialty && (
                <p className="text-xs text-gray-600">{professional.specialty}</p>
              )}
              {professional?.registration_number && (
                <p className="text-xs text-gray-600">{professional.registration_number}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );

    // Pharmacy section (only for Via 1)
    const renderPharmacySection = () => (
      <div className="mt-4 pt-3 border-t border-dashed border-gray-300">
        <p className="text-xs font-semibold text-gray-700 mb-2">IDENTIFICAÇÃO DO COMPRADOR</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="border-b border-gray-300 pb-1">
            <span className="text-gray-500">Nome:</span>
            <span className="ml-1">_________________________</span>
          </div>
          <div className="border-b border-gray-300 pb-1">
            <span className="text-gray-500">RG:</span>
            <span className="ml-1">_________________________</span>
          </div>
          <div className="border-b border-gray-300 pb-1">
            <span className="text-gray-500">Endereço:</span>
            <span className="ml-1">_________________________</span>
          </div>
          <div className="border-b border-gray-300 pb-1">
            <span className="text-gray-500">Telefone:</span>
            <span className="ml-1">_________________________</span>
          </div>
        </div>
        <div className="mt-3 flex justify-between items-center">
          <div className="text-xs">
            <span className="text-gray-500">Data da dispensação:</span>
            <span className="ml-1">____/____/________</span>
          </div>
          <div className="text-center">
            <div className="border-t border-black w-32 pt-1 mt-3">
              <p className="text-xs text-gray-600">Carimbo da Farmácia</p>
            </div>
          </div>
        </div>
      </div>
    );

    // Footer
    const renderFooter = () => (
      showFooter && (
        <div className="mt-4 pt-2 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            {settings?.footer_text || `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`}
          </p>
        </div>
      )
    );

    return (
      <div ref={ref} className="bg-white text-black w-[210mm] mx-auto">
        {/* 1ª VIA - FARMÁCIA */}
        <div className="p-6 min-h-[148mm] border-b-2 border-dashed border-gray-400 relative">
          {renderHeader(1, "FARMÁCIA")}
          {renderTitle()}
          {renderPatientInfo()}
          {renderPrescription()}
          {renderSignature()}
          {renderPharmacySection()}
          {renderFooter()}
          
          {/* Cut line indicator */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center -mb-3">
            <div className="bg-white px-2">
              <span className="text-xs text-gray-400">✂ Corte aqui</span>
            </div>
          </div>
        </div>

        {/* 2ª VIA - PACIENTE */}
        <div className="p-6 min-h-[148mm]">
          {renderHeader(2, "PACIENTE")}
          {renderTitle()}
          {renderPatientInfo()}
          {renderPrescription()}
          {renderSignature()}
          {renderFooter()}
        </div>
      </div>
    );
  }
);

ControlledPrescriptionPrint.displayName = "ControlledPrescriptionPrint";
