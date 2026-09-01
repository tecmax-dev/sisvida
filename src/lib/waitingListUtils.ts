import { supabase } from "@/integrations/supabase/client";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

interface CancelledSlot {
  appointmentDate: string;
  startTime: string;
  endTime?: string;
  professionalId: string;
  professionalName: string;
  appointmentId?: string;
}

interface NotifyResult {
  notified: boolean;
  patientName?: string;
  waitingCount: number;
  error?: string;
  /** true quando a Fila de Espera Inteligente criou uma oferta de vaga */
  offerCreated?: boolean;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * When an appointment is cancelled or marked no_show, find the next
 * patient in the waiting list (respecting queue order) and send a WhatsApp notification.
 *
 * Quando a Fila de Espera Automática estiver ativada na clínica, o fluxo
 * inteligente (oferta com aceite/recusa no app) assume o lugar do aviso simples.
 */
export async function notifyNextInWaitingList(
  clinicId: string,
  clinicName: string,
  slot: CancelledSlot
): Promise<NotifyResult> {
  try {
    console.log('[waitingList] Checking waiting list for slot:', slot);

    // Smart waiting list (toggle in Configurações → Agendamentos → Fila de Espera)
    const { data: clinic } = await supabase
      .from('clinics')
      .select('waiting_list_enabled')
      .eq('id', clinicId)
      .maybeSingle();

    if ((clinic as any)?.waiting_list_enabled) {
      const startTime = slot.startTime.slice(0, 8);
      const endTime = (slot.endTime || addMinutes(slot.startTime.slice(0, 5), 30)).slice(0, 8);

      const { data, error } = await supabase.functions.invoke('waiting-list-offer', {
        body: {
          clinicId,
          professionalId: slot.professionalId,
          appointmentDate: slot.appointmentDate,
          startTime,
          endTime,
          cancelledAppointmentId: slot.appointmentId ?? null,
        },
      });

      if (error) {
        console.error('[waitingList] offer function error:', error);
        return { notified: false, waitingCount: 0, error: error.message };
      }

      const offered = (data as any)?.offered === true;
      const { count } = await supabase
        .from('waiting_list')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('queue_status', 'ATIVO');

      return {
        notified: offered,
        offerCreated: offered,
        waitingCount: count ?? 0,
      };
    }

    // Find active waiting list entries matching:
    // 1. Same professional OR no professional preference (null)
    // 2. Not already notified with a pending slot
    // 3. Ordered by creation date (FIFO queue)
    const { data: waitingPatients, error } = await supabase
      .from('waiting_list')
      .select('id, patient_id, professional_id, notes, created_at, notification_status, patient:patients!waiting_list_patient_id_fkey(id, name, phone)')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .in('notification_status', ['pending', 'declined'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[waitingList] Error fetching waiting list:', error);
      return { notified: false, waitingCount: 0, error: error.message };
    }

    if (!waitingPatients || waitingPatients.length === 0) {
      console.log('[waitingList] No patients in waiting list');
      return { notified: false, waitingCount: 0 };
    }

    // Filter: match professional preference
    const matchingPatients = waitingPatients.filter(entry => {
      // If patient has no professional preference, they match any professional
      if (!entry.professional_id) return true;
      // Otherwise must match the cancelled slot's professional
      return entry.professional_id === slot.professionalId;
    });

    if (matchingPatients.length === 0) {
      console.log('[waitingList] No matching patients for professional:', slot.professionalId);
      return { notified: false, waitingCount: waitingPatients.length };
    }

    const firstInLine = matchingPatients[0];
    const patient = firstInLine.patient as any;

    if (!patient?.phone) {
      console.log('[waitingList] First patient has no phone:', patient?.name);
      return { notified: false, waitingCount: matchingPatients.length, error: 'Paciente sem telefone' };
    }

    // Format date for message
    const dateObj = new Date(slot.appointmentDate + 'T12:00:00');
    const formattedDate = dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const formattedTime = slot.startTime.slice(0, 5);

    const message = `🔔 *Vaga Disponível!*

Olá ${patient.name.split(' ')[0]}! 

Uma vaga abriu na agenda de *${slot.professionalName}* e você está na lista de espera!

📅 *Data:* ${formattedDate}
⏰ *Horário:* ${formattedTime}

Para confirmar, entre em contato conosco o mais rápido possível.

Caso não confirme a tempo, a vaga será oferecida ao próximo da lista.

_${clinicName}_`;

    // Send WhatsApp
    const sendResult = await sendWhatsAppMessage({
      phone: patient.phone,
      message,
      clinicId,
      type: 'custom',
    });

    // Update waiting list entry with slot info regardless of send result
    const updateData: Record<string, any> = {
      notification_status: sendResult.success ? 'notified' : 'pending',
      notified_at: sendResult.success ? new Date().toISOString() : null,
      offered_appointment_date: slot.appointmentDate,
      offered_appointment_time: slot.startTime,
      offered_professional_id: slot.professionalId,
      offered_professional_name: slot.professionalName,
      slot_offered_at: sendResult.success ? new Date().toISOString() : null,
    };

    await supabase
      .from('waiting_list')
      .update(updateData as any)
      .eq('id', firstInLine.id);

    console.log(`[waitingList] Notified ${patient.name}: success=${sendResult.success}`);

    return {
      notified: sendResult.success,
      patientName: patient.name,
      waitingCount: matchingPatients.length,
      error: sendResult.error,
    };
  } catch (err: any) {
    console.error('[waitingList] Unexpected error:', err);
    return { notified: false, waitingCount: 0, error: err.message };
  }
}
