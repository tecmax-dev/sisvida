// Lista de conselhos profissionais de saúde do Brasil
export interface ProfessionalCouncil {
  id: string;
  name: string;
  fullName: string;
  category: 'medical' | 'dental' | 'therapy' | 'nursing' | 'pharmacy' | 'other';
}

export const PROFESSIONAL_COUNCILS: ProfessionalCouncil[] = [
  // Médico
  { id: 'CRM', name: 'CRM', fullName: 'Conselho Regional de Medicina', category: 'medical' },
  
  // Odontológico
  { id: 'CRO', name: 'CRO', fullName: 'Conselho Regional de Odontologia', category: 'dental' },
  
  // Enfermagem
  { id: 'COREN', name: 'COREN', fullName: 'Conselho Regional de Enfermagem', category: 'nursing' },
  
  // Farmácia
  { id: 'CRF', name: 'CRF', fullName: 'Conselho Regional de Farmácia', category: 'pharmacy' },
  
  // Fisioterapia e Terapia Ocupacional
  { id: 'CREFITO', name: 'CREFITO', fullName: 'Conselho Regional de Fisioterapia e Terapia Ocupacional', category: 'therapy' },
  
  // Psicologia
  { id: 'CRP', name: 'CRP', fullName: 'Conselho Regional de Psicologia', category: 'therapy' },
  
  // Fonoaudiologia
  { id: 'CRFa', name: 'CRFa', fullName: 'Conselho Regional de Fonoaudiologia', category: 'therapy' },
  
  // Nutrição
  { id: 'CRN', name: 'CRN', fullName: 'Conselho Regional de Nutricionistas', category: 'therapy' },
  
  // Biomedicina
  { id: 'CRBM', name: 'CRBM', fullName: 'Conselho Regional de Biomedicina', category: 'other' },
  
  // Educação Física
  { id: 'CREF', name: 'CREF', fullName: 'Conselho Regional de Educação Física', category: 'other' },
  
  // Técnicos em Radiologia
  { id: 'CRTR', name: 'CRTR', fullName: 'Conselho Regional de Técnicos em Radiologia', category: 'other' },
  
  // Serviço Social
  { id: 'CRESS', name: 'CRESS', fullName: 'Conselho Regional de Serviço Social', category: 'other' },
  
  // Biologia
  { id: 'CRBio', name: 'CRBio', fullName: 'Conselho Regional de Biologia', category: 'other' },
  
  // Medicina Veterinária
  { id: 'CRMV', name: 'CRMV', fullName: 'Conselho Regional de Medicina Veterinária', category: 'other' },
  
  // Quiropraxia (não tem conselho, usa associação)
  { id: 'ABQ', name: 'ABQ', fullName: 'Associação Brasileira de Quiropraxia', category: 'other' },
  
  // Acupuntura (pode ser via CRM, CRO, CREFITO dependendo da formação)
  { id: 'CMBA', name: 'CMBA', fullName: 'Colégio Médico Brasileiro de Acupuntura', category: 'other' },
  
  // Optometria
  { id: 'CBOO', name: 'CBOO', fullName: 'Conselho Brasileiro de Óptica e Optometria', category: 'other' },
  
  // Musicoterapia
  { id: 'UBAM', name: 'UBAM', fullName: 'União Brasileira das Associações de Musicoterapia', category: 'therapy' },
  
  // Massoterapia (não regulamentado, usa associações)
  { id: 'ABRAMC', name: 'ABRAMC', fullName: 'Associação Brasileira de Massoterapia Clínica', category: 'other' },
  
  // Podologia
  { id: 'ABRAP', name: 'ABRAP', fullName: 'Associação Brasileira de Podologia', category: 'other' },
  
  // Sem conselho específico / Outro
  { id: 'OUTRO', name: 'Outro', fullName: 'Outro registro profissional', category: 'other' },
];

export const getCouncilById = (id: string): ProfessionalCouncil | undefined => {
  return PROFESSIONAL_COUNCILS.find(c => c.id === id);
};

export const getCouncilsByCategory = (category: ProfessionalCouncil['category']): ProfessionalCouncil[] => {
  return PROFESSIONAL_COUNCILS.filter(c => c.category === category);
};
