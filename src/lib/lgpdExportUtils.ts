import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PatientFullData {
  patient: any;
  appointments: any[];
  medicalRecords: any[];
  prescriptions: any[];
  attachments: any[];
  anamnesis: any[];
  cards: any[];
}

export async function fetchPatientFullData(
  patientId: string,
  clinicId: string
): Promise<PatientFullData> {
  // Fetch patient basic data
  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();

  // Fetch appointments
  const { data: appointments } = await supabase
    .from("appointments")
    .select(`
      *,
      professionals:professional_id (name),
      procedures:procedure_id (name)
    `)
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .order("appointment_date", { ascending: false });

  // Fetch medical records
  const { data: medicalRecords } = await supabase
    .from("medical_records")
    .select(`
      *,
      professionals:professional_id (name)
    `)
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  // Fetch prescriptions
  const { data: prescriptions } = await supabase
    .from("prescriptions")
    .select(`
      *,
      professionals:professional_id (name)
    `)
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  // Fetch attachments
  const { data: attachments } = await supabase
    .from("patient_attachments")
    .select("*")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  // Fetch anamnesis
  const { data: anamnesis } = await supabase
    .from("anamnesis")
    .select("*")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  // Fetch cards
  const { data: cards } = await supabase
    .from("patient_cards")
    .select("*")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  return {
    patient,
    appointments: appointments || [],
    medicalRecords: medicalRecords || [],
    prescriptions: prescriptions || [],
    attachments: attachments || [],
    anamnesis: anamnesis || [],
    cards: cards || [],
  };
}

export function generateLGPDExportPDF(data: PatientFullData, clinicName: string): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Title
  doc.setFontSize(18);
  doc.text("Relatório de Dados Pessoais - LGPD", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  doc.setFontSize(10);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  doc.text(`Clínica: ${clinicName}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Patient Info Section
  doc.setFontSize(14);
  doc.text("1. Dados Cadastrais", 14, yPos);
  yPos += 10;

  const patientData = data.patient || {};
  const patientInfo = [
    ["Nome", patientData.name || "-"],
    ["CPF", patientData.cpf || "-"],
    ["RG", patientData.rg || "-"],
    ["Data de Nascimento", patientData.birth_date ? format(parseISO(patientData.birth_date), "dd/MM/yyyy") : "-"],
    ["Email", patientData.email || "-"],
    ["Telefone", patientData.phone || "-"],
    ["Endereço", patientData.address || "-"],
    ["Cidade", patientData.city || "-"],
    ["Estado", patientData.state || "-"],
    ["CEP", patientData.cep || "-"],
    ["Gênero", patientData.gender || "-"],
    ["Estado Civil", patientData.marital_status || "-"],
    ["Profissão", patientData.profession || "-"],
    ["Cadastrado em", patientData.created_at ? format(parseISO(patientData.created_at), "dd/MM/yyyy HH:mm") : "-"],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [["Campo", "Valor"]],
    body: patientInfo,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Appointments Section
  if (data.appointments.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text("2. Histórico de Agendamentos", 14, yPos);
    yPos += 10;

    const appointmentRows = data.appointments.map((a) => [
      a.appointment_date ? format(parseISO(a.appointment_date), "dd/MM/yyyy") : "-",
      a.start_time || "-",
      (a.professionals as any)?.name || "-",
      (a.procedures as any)?.name || "-",
      a.status || "-",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Data", "Horário", "Profissional", "Procedimento", "Status"]],
      body: appointmentRows,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Medical Records Section
  if (data.medicalRecords.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text("3. Prontuário Médico", 14, yPos);
    yPos += 10;

    const recordRows = data.medicalRecords.map((r) => [
      r.created_at ? format(parseISO(r.created_at), "dd/MM/yyyy") : "-",
      (r.professionals as any)?.name || "-",
      r.notes?.substring(0, 100) + (r.notes?.length > 100 ? "..." : "") || "-",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Data", "Profissional", "Observações"]],
      body: recordRows,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Prescriptions Section
  if (data.prescriptions.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text("4. Prescrições", 14, yPos);
    yPos += 10;

    const prescriptionRows = data.prescriptions.map((p) => [
      p.created_at ? format(parseISO(p.created_at), "dd/MM/yyyy") : "-",
      (p.professionals as any)?.name || "-",
      p.medications || "-",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Data", "Profissional", "Medicamentos"]],
      body: prescriptionRows,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Este documento foi gerado conforme Lei Geral de Proteção de Dados (LGPD) - Lei nº 13.709/2018`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: "center" }
    );
  }

  // Save
  doc.save(`dados_pessoais_${patientData.name?.replace(/\s+/g, "_") || "paciente"}_${format(new Date(), "yyyyMMdd")}.pdf`);
}

export function generateLGPDExportJSON(data: PatientFullData): string {
  const exportData = {
    exportDate: new Date().toISOString(),
    lgpdCompliance: "Lei nº 13.709/2018",
    patient: {
      ...data.patient,
      // Remove sensitive internal fields
      id: undefined,
      clinic_id: undefined,
    },
    appointments: data.appointments.map((a) => ({
      date: a.appointment_date,
      time: a.start_time,
      professional: (a.professionals as any)?.name,
      procedure: (a.procedures as any)?.name,
      status: a.status,
      notes: a.notes,
    })),
    medicalRecords: data.medicalRecords.map((r) => ({
      date: r.created_at,
      professional: (r.professionals as any)?.name,
      notes: r.notes,
      diagnosis: r.diagnosis,
      vitalSigns: {
        weight: r.weight,
        height: r.height,
        bloodPressure: r.blood_pressure,
        heartRate: r.heart_rate,
        temperature: r.temperature,
      },
    })),
    prescriptions: data.prescriptions.map((p) => ({
      date: p.created_at,
      professional: (p.professionals as any)?.name,
      medications: p.medications,
      instructions: p.instructions,
    })),
    attachmentsCount: data.attachments.length,
    anamnesisCount: data.anamnesis.length,
    cardsCount: data.cards.length,
  };

  return JSON.stringify(exportData, null, 2);
}
