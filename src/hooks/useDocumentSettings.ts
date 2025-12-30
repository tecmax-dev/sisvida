import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DocumentSettings {
  clinic_id: string;
  show_logo: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_cnpj: boolean;
  show_footer: boolean;
  custom_header_text: string | null;
  footer_text: string;
  prescription_title: string;
  prescription_template: string | null;
  certificate_title: string;
  certificate_template: string | null;
  attendance_title: string;
  attendance_template: string | null;
  exam_request_title: string;
  exam_request_template: string | null;
  paper_size: 'A4' | 'A5';
}

const defaultSettings: Omit<DocumentSettings, 'clinic_id'> = {
  show_logo: true,
  show_address: true,
  show_phone: true,
  show_cnpj: true,
  show_footer: true,
  custom_header_text: null,
  footer_text: 'Este documento foi gerado eletronicamente pelo sistema Eclini',
  prescription_title: 'RECEITUÁRIO',
  prescription_template: null,
  certificate_title: 'ATESTADO MÉDICO',
  certificate_template: null,
  attendance_title: 'DECLARAÇÃO DE COMPARECIMENTO',
  attendance_template: null,
  exam_request_title: 'SOLICITAÇÃO DE EXAMES',
  exam_request_template: null,
  paper_size: 'A4',
};

export function useDocumentSettings(clinicId: string | undefined) {
  const [settings, setSettings] = useState<DocumentSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clinicId) {
      fetchSettings();
    }
  }, [clinicId]);

  const fetchSettings = async () => {
    if (!clinicId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('document_settings')
      .select('*')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (data) {
      setSettings({
        ...defaultSettings,
        ...data,
        clinic_id: clinicId,
      } as DocumentSettings);
    } else {
      setSettings({ ...defaultSettings, clinic_id: clinicId });
    }
    setLoading(false);
  };

  const saveSettings = async (newSettings: Partial<DocumentSettings>) => {
    if (!clinicId) return { error: new Error('No clinic ID') };

    const settingsToSave = {
      ...defaultSettings,
      ...settings,
      ...newSettings,
      clinic_id: clinicId,
    };

    const { data, error } = await supabase
      .from('document_settings')
      .upsert(settingsToSave, { onConflict: 'clinic_id' })
      .select()
      .single();

    if (data) {
      setSettings({
        ...defaultSettings,
        ...data,
        clinic_id: clinicId,
      } as DocumentSettings);
    }

    return { data, error };
  };

  return { settings, loading, saveSettings, refetch: fetchSettings };
}
