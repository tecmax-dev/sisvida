import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAppointmentDisplayName } from "./calendarHelpers";

interface RescheduleAppointmentDialogProps {
  rescheduleDialogOpen: boolean;
  setRescheduleDialogOpen: (open: boolean) => void;
  reschedulingAppointment: any;
  setReschedulingAppointment: (apt: any) => void;
  newDate: string;
  setNewDate: (v: string) => void;
  newTime: string;
  setNewTime: (v: string) => void;
  timeSlots: string[];
  typeLabels: Record<string, string>;
  saving: boolean;
  handleReschedule: () => void;
}

export function RescheduleAppointmentDialog({
  rescheduleDialogOpen, setRescheduleDialogOpen, reschedulingAppointment, setReschedulingAppointment,
  newDate, setNewDate, newTime, setNewTime, timeSlots, typeLabels, saving, handleReschedule,
}: RescheduleAppointmentDialogProps) {
  return (
      <Dialog open={rescheduleDialogOpen} onOpenChange={(open) => {
        setRescheduleDialogOpen(open);
        if (!open) {
          setReschedulingAppointment(null);
          setNewDate("");
          setNewTime("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reagendar Consulta</DialogTitle>
            <DialogDescription>
              Selecione a nova data e horário para a consulta
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {reschedulingAppointment && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">{getAppointmentDisplayName(reschedulingAppointment)}</p>
                <p className="text-sm text-muted-foreground">
                  {typeLabels[reschedulingAppointment.type]} com {reschedulingAppointment.professional?.name}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nova Data</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => {
                  setNewDate(e.target.value);
                  // Reset time if date changes to today and current time is past
                  const today = new Date().toISOString().split('T')[0];
                  if (e.target.value === today && newTime) {
                    const now = new Date();
                    const [hours, minutes] = newTime.split(':').map(Number);
                    const slotTime = new Date();
                    slotTime.setHours(hours, minutes, 0, 0);
                    if (slotTime <= now) {
                      setNewTime("");
                    }
                  }
                }}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label>Novo Horário</Label>
              <Select value={newTime} onValueChange={setNewTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o horário" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots
                    .filter((time) => {
                      // If selected date is today, filter out past times
                      const today = new Date().toISOString().split('T')[0];
                      if (newDate === today) {
                        const now = new Date();
                        const [hours, minutes] = time.split(':').map(Number);
                        const slotTime = new Date();
                        slotTime.setHours(hours, minutes, 0, 0);
                        return slotTime > now;
                      }
                      return true;
                    })
                    .map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRescheduleDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleReschedule} disabled={saving || !newDate || !newTime}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reagendar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
  );
}
