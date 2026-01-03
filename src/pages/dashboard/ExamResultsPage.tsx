import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, FileUp, Bell, Eye, Search, Download, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RoleGuard } from "@/components/auth/RoleGuard";

interface ExamResult {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_type: string | null;
  notification_sent: boolean;
  notification_sent_at: string | null;
  viewed_at: string | null;
  created_at: string;
  patient: { id: string; name: string; phone: string } | null;
  professional: { id: string; name: string } | null;
}

export default function ExamResultsPage() {
  const { currentClinic, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<ExamResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    patient_id: "",
    professional_id: "",
    title: "",
    description: "",
    file: null as File | null,
  });

  useEffect(() => {
    if (currentClinic?.id) {
      loadData();
    }
  }, [currentClinic?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load exam results
      const { data: examsData } = await supabase
        .from("exam_results")
        .select(`
          *,
          patient:patient_id (id, name, phone),
          professional:professional_id (id, name)
        `)
        .eq("clinic_id", currentClinic?.id)
        .order("created_at", { ascending: false });

      setExams((examsData as any[]) || []);

      // Load patients for selector
      const { data: patientsData } = await supabase
        .from("patients")
        .select("id, name")
        .eq("clinic_id", currentClinic?.id)
        .eq("is_active", true)
        .order("name");

      setPatients(patientsData || []);

      // Load professionals for selector
      const { data: professionalsData } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("clinic_id", currentClinic?.id)
        .eq("is_active", true)
        .order("name");

      setProfessionals(professionalsData || []);
    } catch (error) {
      console.error("Error loading exam results:", error);
      toast.error("Erro ao carregar resultados");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!formData.patient_id || !formData.title || !formData.file) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setUploading(true);
    try {
      // Upload file to storage
      const fileName = `${currentClinic?.id}/${formData.patient_id}/${Date.now()}_${formData.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("patient-attachments")
        .upload(fileName, formData.file);

      if (uploadError) throw uploadError;

      // Create exam result record
      const { error: insertError } = await supabase
        .from("exam_results")
        .insert({
          clinic_id: currentClinic?.id,
          patient_id: formData.patient_id,
          professional_id: formData.professional_id || null,
          title: formData.title,
          description: formData.description || null,
          file_path: fileName,
          file_name: formData.file.name,
          file_size: formData.file.size,
          file_type: formData.file.type,
          created_by: user?.id,
        });

      if (insertError) throw insertError;

      toast.success("Resultado de exame cadastrado");
      setDialogOpen(false);
      setFormData({
        patient_id: "",
        professional_id: "",
        title: "",
        description: "",
        file: null,
      });
      loadData();
    } catch (error) {
      console.error("Error uploading exam:", error);
      toast.error("Erro ao cadastrar resultado");
    } finally {
      setUploading(false);
    }
  };

  const handleNotify = async (exam: ExamResult) => {
    if (!exam.patient?.phone) {
      toast.error("Paciente não possui telefone cadastrado");
      return;
    }

    setNotifying(exam.id);
    try {
      const response = await supabase.functions.invoke("send-exam-notification", {
        body: {
          clinic_id: currentClinic?.id,
          patient_id: exam.patient.id,
          exam_result_id: exam.id,
          patient_name: exam.patient.name,
          patient_phone: exam.patient.phone,
          exam_title: exam.title,
        },
      });

      if (response.error) throw response.error;

      toast.success("Notificação enviada");
      loadData();
    } catch (error) {
      console.error("Error sending notification:", error);
      toast.error("Erro ao enviar notificação");
    } finally {
      setNotifying(null);
    }
  };

  const handleDownload = async (exam: ExamResult) => {
    try {
      const { data, error } = await supabase.storage
        .from("patient-attachments")
        .download(exam.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = exam.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handleDelete = async (examId: string) => {
    if (!confirm("Deseja realmente excluir este resultado?")) return;

    try {
      const { error } = await supabase
        .from("exam_results")
        .delete()
        .eq("id", examId);

      if (error) throw error;

      toast.success("Resultado excluído");
      loadData();
    } catch (error) {
      console.error("Error deleting exam:", error);
      toast.error("Erro ao excluir resultado");
    }
  };

  const filteredExams = exams.filter(
    (e) =>
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.patient?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <RoleGuard permission="view_patients">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Resultados de Exames</h1>
            <p className="text-muted-foreground">
              Gerencie e envie resultados de exames para os associados
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Resultado
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Resultado de Exame</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Associado *</Label>
                  <Select
                    value={formData.patient_id}
                    onValueChange={(v) => setFormData({ ...formData, patient_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o associado" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Profissional</Label>
                  <Select
                    value={formData.professional_id}
                    onValueChange={(v) => setFormData({ ...formData, professional_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o profissional (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Título do Exame *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Hemograma Completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Observações sobre o exame..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Arquivo *</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: PDF, JPG, PNG (máx. 10MB)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <FileUp className="h-4 w-4 mr-2" />
                      Cadastrar
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lista de Resultados</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por associado ou exame..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Associado</TableHead>
                  <TableHead>Exame</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.patient?.name || "-"}</TableCell>
                    <TableCell>{exam.title}</TableCell>
                    <TableCell>{exam.professional?.name || "-"}</TableCell>
                    <TableCell>
                      {format(parseISO(exam.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {exam.notification_sent ? (
                          <Badge variant="default" className="bg-green-500">
                            Notificado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                        {exam.viewed_at && (
                          <Badge variant="outline">
                            <Eye className="h-3 w-3 mr-1" />
                            Visualizado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {!exam.notification_sent && exam.patient?.phone && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleNotify(exam)}
                            disabled={notifying === exam.id}
                          >
                            {notifying === exam.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Bell className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDownload(exam)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDelete(exam.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredExams.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum resultado de exame cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
