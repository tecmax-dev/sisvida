import React from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, MapPin, User, Building2, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function HomologacaoConsultPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t");

  const { data: appointment, isLoading, error } = useQuery({
    queryKey: ["homologacao-consult", token],
    queryFn: async () => {
      if (!token) throw new Error("Token ausente");

      // Use raw RPC or direct fetch with casting to bypass complex type issues in the view
      const { data: tokenData, error: tokenError } = await supabase
        .from("homologacao_access_tokens" as any)
        .select("appointment_id")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (tokenError || !tokenData) throw new Error("Link expirado ou inválido");

      const { data: apt, error: aptError } = await supabase
        .from("homologacao_appointments" as any)
        .select(`
          *,
          professional:homologacao_professionals(name),
          service:homologacao_service_types(name)
        `)
        .eq("id", (tokenData as any).appointment_id)
        .maybeSingle();

      if (aptError || !apt) throw new Error("Agendamento não encontrado");
      return apt;
    },
    enabled: !!token,
    retry: false
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <Skeleton className="h-[400px] w-full max-w-md rounded-xl" />
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Link Inválido</CardTitle>
            <CardDescription>O link de consulta expirou ou é inválido.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const apt = appointment as any;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="w-full max-w-md shadow-lg border-blue-100">
        <CardHeader className="bg-blue-600 text-white rounded-t-xl">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">Dados do Agendamento</CardTitle>
              <CardDescription className="text-blue-100">Confirmação de Homologação</CardDescription>
            </div>
            <ShieldCheck className="h-6 w-6 opacity-50" />
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Data</p>
                <p className="text-sm font-medium">
                  {apt.appointment_date ? format(new Date(apt.appointment_date + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR }) : '-'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Horário</p>
                <p className="text-sm font-medium">{apt.start_time?.slice(0, 5)}h</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <MapPin className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Local</p>
                <p className="text-sm font-medium">Rua Coronel Paiva, 99, Centro - Ilhéus/BA</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <User className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Trabalhador</p>
                <p className="text-sm font-medium">{apt.employee_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <Building2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Empresa</p>
                <p className="text-sm font-medium">{apt.company_name}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-mono">PROTOCOLO: {apt.protocol_number}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
