import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ReportData {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  newPatients: number;
  noShowRate: number;
  appointmentsByType: { name: string; value: number }[];
  appointmentsByStatus: { name: string; value: number }[];
  appointmentsByInsurance: { name: string; value: number; percentage: number }[];
  dailyAppointments: { date: string; total: number; completed: number; noShow: number }[];
}

interface ExportOptions {
  clinicName: string;
  period: string;
  data: ReportData;
}

const periodLabels: Record<string, string> = {
  week: 'Última semana',
  month: 'Último mês',
  quarter: 'Último trimestre',
  year: 'Último ano',
};

export function exportToPDF({ clinicName, period, data }: ExportOptions) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(0, 128, 128);
  doc.text('Relatório de Consultas', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(clinicName, pageWidth / 2, 28, { align: 'center' });
  doc.text(`Período: ${periodLabels[period] || period}`, pageWidth / 2, 35, { align: 'center' });
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 42, { align: 'center' });

  // Metrics
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Métricas Gerais', 14, 55);

  autoTable(doc, {
    startY: 60,
    head: [['Métrica', 'Valor']],
    body: [
      ['Total de Consultas', data.totalAppointments.toString()],
      ['Consultas Concluídas', data.completedAppointments.toString()],
      ['Consultas Canceladas', data.cancelledAppointments.toString()],
      ['No-shows', data.noShowAppointments.toString()],
      ['Taxa de No-show', `${data.noShowRate}%`],
      ['Novos Pacientes', data.newPatients.toString()],
    ],
    theme: 'striped',
    headStyles: { fillColor: [0, 128, 128] },
  });

  // Appointments by Type
  const yAfterMetrics = (doc as any).lastAutoTable.finalY + 15;
  doc.text('Consultas por Tipo', 14, yAfterMetrics);

  autoTable(doc, {
    startY: yAfterMetrics + 5,
    head: [['Tipo', 'Quantidade']],
    body: data.appointmentsByType.map(item => [item.name, item.value.toString()]),
    theme: 'striped',
    headStyles: { fillColor: [0, 128, 128] },
  });

  // Appointments by Status
  const yAfterTypes = (doc as any).lastAutoTable.finalY + 15;
  doc.text('Consultas por Status', 14, yAfterTypes);

  autoTable(doc, {
    startY: yAfterTypes + 5,
    head: [['Status', 'Quantidade']],
    body: data.appointmentsByStatus.map(item => [item.name, item.value.toString()]),
    theme: 'striped',
    headStyles: { fillColor: [0, 128, 128] },
  });

  // Check if we need a new page for insurance data
  const yAfterStatus = (doc as any).lastAutoTable.finalY + 15;
  if (yAfterStatus > 250) {
    doc.addPage();
    doc.text('Atendimentos por Convênio', 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [['Convênio', 'Quantidade', 'Percentual']],
      body: data.appointmentsByInsurance.map(item => [item.name, item.value.toString(), `${item.percentage}%`]),
      theme: 'striped',
      headStyles: { fillColor: [0, 128, 128] },
    });
  } else {
    doc.text('Atendimentos por Convênio', 14, yAfterStatus);
    autoTable(doc, {
      startY: yAfterStatus + 5,
      head: [['Convênio', 'Quantidade', 'Percentual']],
      body: data.appointmentsByInsurance.map(item => [item.name, item.value.toString(), `${item.percentage}%`]),
      theme: 'striped',
      headStyles: { fillColor: [0, 128, 128] },
    });
  }

  // Daily appointments on new page
  if (data.dailyAppointments.length > 0) {
    doc.addPage();
    doc.text('Consultas Diárias', 14, 20);

    autoTable(doc, {
      startY: 25,
      head: [['Data', 'Total', 'Concluídos', 'No-show']],
      body: data.dailyAppointments.map(item => [
        item.date,
        item.total.toString(),
        item.completed.toString(),
        item.noShow.toString(),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [0, 128, 128] },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} • Eclini by Tecmax Tecnologia`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`relatorio-${clinicName.toLowerCase().replace(/\s+/g, '-')}-${period}.pdf`);
}

export function exportToExcel({ clinicName, period, data }: ExportOptions) {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['Relatório de Consultas'],
    ['Clínica', clinicName],
    ['Período', periodLabels[period] || period],
    ['Gerado em', new Date().toLocaleDateString('pt-BR')],
    [],
    ['Métricas Gerais'],
    ['Total de Consultas', data.totalAppointments],
    ['Consultas Concluídas', data.completedAppointments],
    ['Consultas Canceladas', data.cancelledAppointments],
    ['No-shows', data.noShowAppointments],
    ['Taxa de No-show', `${data.noShowRate}%`],
    ['Novos Pacientes', data.newPatients],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

  // By Type sheet
  const typeData = [
    ['Tipo', 'Quantidade'],
    ...data.appointmentsByType.map(item => [item.name, item.value]),
  ];
  const typeSheet = XLSX.utils.aoa_to_sheet(typeData);
  XLSX.utils.book_append_sheet(workbook, typeSheet, 'Por Tipo');

  // By Status sheet
  const statusData = [
    ['Status', 'Quantidade'],
    ...data.appointmentsByStatus.map(item => [item.name, item.value]),
  ];
  const statusSheet = XLSX.utils.aoa_to_sheet(statusData);
  XLSX.utils.book_append_sheet(workbook, statusSheet, 'Por Status');

  // By Insurance sheet
  const insuranceData = [
    ['Convênio', 'Quantidade', 'Percentual'],
    ...data.appointmentsByInsurance.map(item => [item.name, item.value, `${item.percentage}%`]),
  ];
  const insuranceSheet = XLSX.utils.aoa_to_sheet(insuranceData);
  XLSX.utils.book_append_sheet(workbook, insuranceSheet, 'Por Convênio');

  // Daily sheet
  if (data.dailyAppointments.length > 0) {
    const dailyData = [
      ['Data', 'Total', 'Concluídos', 'No-show'],
      ...data.dailyAppointments.map(item => [item.date, item.total, item.completed, item.noShow]),
    ];
    const dailySheet = XLSX.utils.aoa_to_sheet(dailyData);
    XLSX.utils.book_append_sheet(workbook, dailySheet, 'Diário');
  }

  XLSX.writeFile(workbook, `relatorio-${clinicName.toLowerCase().replace(/\s+/g, '-')}-${period}.xlsx`);
}
