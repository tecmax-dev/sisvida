import { useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { toast } from "sonner";
import type { HomologacaoAppointment } from "@/hooks/useHomologacaoAppointments";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: HomologacaoAppointment | null;
}

const LOCAL = {
  address: "Rua Coronel Paiva, 99, Centro",
  complement: "Ao lado da Sorveteria Chiquinho",
  city: "Ilhéus - BA",
  phone: "(73) 3231-1784",
};

export function HomologacaoPrintProtocolDialog({ open, onOpenChange, appointment }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!appointment) return null;

  const protocolNumber =
    appointment.protocol_number || `HOM-${appointment.id.slice(0, 8).toUpperCase()}`;
  const validationUrl = `${window.location.origin}/protocolo/${appointment.id}`;
  const dateLabel = appointment.appointment_date
    ? format(new Date(appointment.appointment_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
    : "-";

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) {
      toast.error("Não foi possível abrir a janela de impressão");
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Protocolo ${protocolNumber}</title>
      <style>
        @page { size: A4; margin: 16mm; }
        body { font-family: Arial, Helvetica, sans-serif; color:#111; font-size: 13px; }
        h1 { font-size: 18px; text-align:center; margin: 0 0 4px; }
        .sub { text-align:center; color:#555; font-size:12px; margin-bottom:16px; }
        .protocol { text-align:center; font-size:22px; font-weight:bold; letter-spacing:1px; margin:8px 0 16px; font-family: 'Courier New', monospace; }
        .divider { border-top:1px dashed #999; margin:12px 0; }
        .row { display:flex; gap:8px; margin:6px 0; }
        .label { font-weight:bold; min-width:120px; }
        .qr { text-align:center; margin-top:16px; }
        .footer { text-align:center; font-size:11px; color:#666; margin-top:20px; }
        svg { display:inline-block; }
      </style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Imprimir Protocolo</DialogTitle>
          <DialogDescription>Pré-visualização do protocolo de atendimento.</DialogDescription>
        </DialogHeader>

        <div ref={printRef} className="rounded-md border p-4 text-sm">
          <h1>PROTOCOLO DE ATENDIMENTO</h1>
          <div className="sub">Sindicato — Homologação / Assessoria</div>
          <div className="protocol">{protocolNumber}</div>
          <div className="divider" />
          <div className="row"><span className="label">Data:</span><span>{dateLabel}</span></div>
          <div className="row"><span className="label">Horário:</span><span>{appointment.start_time?.slice(0, 5)} - {appointment.end_time?.slice(0, 5)}</span></div>
          {appointment.professional?.name && (
            <div className="row"><span className="label">Profissional:</span><span>{appointment.professional.name}</span></div>
          )}
          {appointment.service_type?.name && (
            <div className="row"><span className="label">Serviço:</span><span>{appointment.service_type.name}</span></div>
          )}
          <div className="divider" />
          <div className="row"><span className="label">Funcionário:</span><span>{appointment.employee_name}</span></div>
          {appointment.employee_cpf && (
            <div className="row"><span className="label">CPF:</span><span>{appointment.employee_cpf}</span></div>
          )}
          <div className="row"><span className="label">Empresa:</span><span>{appointment.company_name}</span></div>
          {appointment.company_cnpj && (
            <div className="row"><span className="label">CNPJ:</span><span>{appointment.company_cnpj}</span></div>
          )}
          <div className="divider" />
          <div className="row"><span className="label">Local:</span><span>{LOCAL.address} — {LOCAL.city}<br />{LOCAL.complement}<br />Tel: {LOCAL.phone}</span></div>
          <div className="qr">
            <p style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>Escaneie para validar:</p>
            <QRCodeSVG value={validationUrl} size={110} level="M" includeMargin />
          </div>
          <div className="footer">
            Emitido em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" /> Fechar
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
