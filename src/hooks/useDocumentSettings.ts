import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DocumentSettings {
  id?: string;
  clinic_id: string;
  show_logo: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_cnpj: boolean;
  custom_header_text: string | null;
  footer_text: string;
  show_footer: boolean;
  prescription_title: string;
  prescription_template: string | null;
  certificate_title: string;
  certificate_template: string;
  attendance_title: string;
  attendance_template: string;
}

const defaultSettings: Omit<DocumentSettings, 'clinic_id'> = {
  show_logo: true,
  show_address: true,
  show_phone: true,
  show_cnpj: true,
  custom_header_text: null,
  footer_text: 'Este documento foi gerado eletronicamente pelo sistema Eclini',
  show_footer: true,
  prescription_title: 'RECEITUÁRIO',
  prescription_template: null,
  certificate_title: 'ATESTADO MÉDICO',
  certificate_template: 'Atesto para os devidos fins que o(a) paciente {patient_name} esteve sob meus cuidados profissionais na data de {date}, necessitando de afastamento de suas atividades por um período de {days} dia(s).',
  attendance_title: 'DECLARAÇÃO DE COMPARECIMENTO',
  attendance_template: 'Declaro para os devidos fins que o(a) Sr(a). {patient_name} compareceu a este estabelecimento de saúde na data de {date}, no período das {start_time} às {end_time}, para atendimento médico/consulta.',
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
      setSettings(data as DocumentSettings);
    } else {
      // Return default settings if none exist
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
      setSettings(data as DocumentSettings);
    }

    return { data, error };
  };

  return { settings, loading, saveSettings, refetch: fetchSettings };
}
