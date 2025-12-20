import { useState, useEffect, useRef } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  User,
  Loader2,
  FileText,
  Clock,
  ShieldCheck,
  PenTool,
  Printer,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AnamneseResponseForm,
  Answer,
  Question,
  validateAnswers,
} from "@/components/anamnesis/AnamneseResponseForm";
import { AnamnesisPrint } from "@/components/anamnesis/AnamnesisPrint";
import { exportAnamnesisToPDF } from "@/lib/anamnesisExportUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Patient {
  id: string;
  name: string;
  phone: string;
}

interface Template {
  id: string;
  title: string;
  description: string | null;
}

interface Response {
  id: string;
  template_id: string;
  template_title: string;
  created_at: string;
  filled_by_patient: boolean;
  signature_data: string | null;
  signed_at: string | null;
  responsibility_accepted: boolean;
}

// Helper function to display answer based on question type
const getAnswerDisplay = (question: Question, answer: Answer | undefined): string => {
  // Para booleanos, tratar ausência de resposta como "Não"
  if (question.question_type === "boolean") {
    if (!answer || answer.answer_text === null || answer.answer_text === undefined || answer.answer_text === "false") {
      return "Não";
    }
    if (answer.answer_text === "true") {
      return "Sim";
    }
    return answer.answer_text;
  }
  
  if (!answer) return "";
  
  if (question.question_type === "text" || question.question_type === "textarea" || question.question_type === "date" || question.question_type === "number") {
    return answer.answer_text || "";
  }
  
  if (question.question_type === "radio" || question.question_type === "select" || question.question_type === "checkbox") {
    if (!answer.answer_option_ids || answer.answer_option_ids.length === 0) return "";
    
    const selectedOptions = question.options
      ?.filter(opt => answer.answer_option_ids?.includes(opt.id))
      .map(opt => opt.option_text);
    
    return selectedOptions?.join(", ") || "";
  }
  
  return answer.answer_text || "";
};

export default function DynamicAnamnesisPage() {
  const { currentClinic, user } = useAuth();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientResponses, setPatientResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [newResponseDialogOpen, setNewResponseDialogOpen] = useState(false);
  const [viewResponseDialogOpen, setViewResponseDialogOpen] = useState(false);

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // View state
  const [viewingResponse, setViewingResponse] = useState<Response | null>(null);
  const [viewQuestions, setViewQuestions] = useState<Question[]>([]);
  const [viewAnswers, setViewAnswers] = useState<Answer[]>([]);
  
  // Print ref
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentClinic) {
      fetchPatients();
      fetchTemplates();
    }
  }, [currentClinic]);

  useEffect(() => {
    if (selectedPatient) {
      fetchPatientResponses();
    }
  }, [selectedPatient]);

  useEffect(() => {
    if (selectedTemplateId) {
      fetchTemplateQuestions(selectedTemplateId);
    }
  }, [selectedTemplateId]);

  const fetchPatients = async () => {
    if (!currentClinic) return;

    const { data } = await supabase
      .from("patients")
      .select("id, name, phone")
      .eq("clinic_id", currentClinic.id)
      .order("name");

    setPatients(data || []);
    setLoading(false);
  };

  const fetchTemplates = async () => {
    if (!currentClinic) return;

    const { data } = await supabase
      .from("anamnese_templates")
      .select("id, title, description")
      .eq("clinic_id", currentClinic.id)
      .eq("is_active", true)
      .order("title");

    setTemplates(data || []);
  };

  const fetchPatientResponses = async () => {
    if (!currentClinic || !selectedPatient) return;

    const { data } = await supabase
      .from("anamnese_responses")
      .select(`
        id,
        template_id,
        created_at,
        filled_by_patient,
        signature_data,
        signed_at,
        responsibility_accepted,
        anamnese_templates (
          title
        )
      `)
      .eq("clinic_id", currentClinic.id)
      .eq("patient_id", selectedPatient.id)
      .order("created_at", { ascending: false });

    const responses: Response[] = (data || []).map((r: any) => ({
      id: r.id,
      template_id: r.template_id,
      template_title: r.anamnese_templates?.title || "Template removido",
      created_at: r.created_at,
      filled_by_patient: r.filled_by_patient || false,
      signature_data: r.signature_data,
      signed_at: r.signed_at,
      responsibility_accepted: r.responsibility_accepted || false,
    }));

    setPatientResponses(responses);
  };

  const getSignatureUrl = (signatureData: string | null): string | null => {
    if (!signatureData) return null;
    
    // Se começa com "data:", é base64
    if (signatureData.startsWith('data:')) {
      return signatureData;
    }
    
    // Caso contrário, é um path no Storage
    const { data } = supabase.storage
      .from('anamnesis-signatures')
      .getPublicUrl(signatureData);
    
    return data.publicUrl;
  };

  const fetchTemplateQuestions = async (templateId: string) => {
    setLoadingQuestions(true);
    try {
      const { data: questionsData } = await supabase
        .from("anamnese_questions")
        .select("*")
        .eq("template_id", templateId)
        .order("order_index");

      const questionsWithOptions = await Promise.all(
        (questionsData || []).map(async (q) => {
          const { data: optionsData } = await supabase
            .from("anamnese_question_options")
            .select("*")
            .eq("question_id", q.id)
            .order("order_index");

          return {
            id: q.id,
            question_text: q.question_text,
            question_type: q.question_type as Question["question_type"],
            is_required: q.is_required,
            order_index: q.order_index,
            options: (optionsData || []).map((o) => ({
              id: o.id,
              option_text: o.option_text,
              order_index: o.order_index,
            })),
          };
        })
      );

      // Inicializar respostas booleanas com "false" por padrão
      const initialAnswers: Answer[] = questionsWithOptions
        .filter(q => q.question_type === "boolean")
        .map(q => ({
          question_id: q.id,
          answer_text: "false",
          answer_option_ids: null,
        }));

      setQuestions(questionsWithOptions);
      setAnswers(initialAnswers);
      setErrors({});
    } finally {
      setLoadingQuestions(false);
    }
  };

  const fetchResponseAnswers = async (responseId: string, templateId: string) => {
    setLoadingQuestions(true);
    try {
      // Fetch questions
      const { data: questionsData } = await supabase
        .from("anamnese_questions")
        .select("*")
        .eq("template_id", templateId)
        .order("order_index");

      const questionsWithOptions = await Promise.all(
        (questionsData || []).map(async (q) => {
          const { data: optionsData } = await supabase
            .from("anamnese_question_options")
            .select("*")
            .eq("question_id", q.id)
            .order("order_index");

          return {
            id: q.id,
            question_text: q.question_text,
            question_type: q.question_type as Question["question_type"],
            is_required: q.is_required,
            order_index: q.order_index,
            options: (optionsData || []).map((o) => ({
              id: o.id,
              option_text: o.option_text,
              order_index: o.order_index,
            })),
          };
        })
      );

      // Fetch answers
      const { data: answersData } = await supabase
        .from("anamnese_answers")
        .select("*")
        .eq("response_id", responseId);

      const answers: Answer[] = (answersData || []).map((a) => ({
        question_id: a.question_id,
        answer_text: a.answer_text,
        answer_option_ids: a.answer_option_ids,
      }));

      setViewQuestions(questionsWithOptions);
      setViewAnswers(answers);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleOpenNewResponse = () => {
    setSelectedTemplateId("");
    setQuestions([]);
    setAnswers([]);
    setErrors({});
    setNewResponseDialogOpen(true);
  };

  const handleOpenViewResponse = async (response: Response) => {
    setViewingResponse(response);
    await fetchResponseAnswers(response.id, response.template_id);
    setViewResponseDialogOpen(true);
  };

  const handleSaveResponse = async () => {
    if (!currentClinic || !selectedPatient || !selectedTemplateId) return;

    // Validate
    const validationErrors = validateAnswers(questions, answers);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todas as perguntas obrigatórias",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Create response
      const { data: response, error: responseError } = await supabase
        .from("anamnese_responses")
        .insert({
          clinic_id: currentClinic.id,
          patient_id: selectedPatient.id,
          template_id: selectedTemplateId,
          professional_id: null, // Could be set if needed
        })
        .select()
        .single();

      if (responseError) throw responseError;

      // Create answers
      const answersToInsert = answers
        .filter((a) => a.answer_text || (a.answer_option_ids && a.answer_option_ids.length > 0))
        .map((a) => ({
          response_id: response.id,
          question_id: a.question_id,
          answer_text: a.answer_text,
          answer_option_ids: a.answer_option_ids,
        }));

      if (answersToInsert.length > 0) {
        const { error: answersError } = await supabase
          .from("anamnese_answers")
          .insert(answersToInsert);

        if (answersError) throw answersError;
      }

      toast({ title: "Anamnese salva com sucesso!" });
      setNewResponseDialogOpen(false);
      fetchPatientResponses();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrintAnamnesis = () => {
    if (!printRef.current) return;
    
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({
        title: "Erro",
        description: "Não foi possível abrir a janela de impressão. Verifique se pop-ups estão bloqueados.",
        variant: "destructive",
      });
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Anamnese - ${selectedPatient?.name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportAnamnesis = async (responseToExport: Response) => {
    if (!selectedPatient || !currentClinic) return;
    
    try {
      const signatureUrl = getSignatureUrl(responseToExport.signature_data);
      
      await exportAnamnesisToPDF({
        clinic: {
          name: currentClinic.name,
          address: currentClinic.address,
          phone: currentClinic.phone,
          cnpj: currentClinic.cnpj,
        },
        patient: {
          name: selectedPatient.name,
          phone: selectedPatient.phone,
        },
        template: {
          title: responseToExport.template_title,
        },
        questions: viewQuestions,
        answers: viewAnswers,
        response: {
          created_at: responseToExport.created_at,
          filled_by_patient: responseToExport.filled_by_patient,
          signature_data: responseToExport.signature_data,
          signed_at: responseToExport.signed_at,
          responsibility_accepted: responseToExport.responsibility_accepted,
        },
        signatureUrl,
      });
      
      toast({ title: "PDF exportado com sucesso!" });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anamnese Dinâmica</h1>
          <p className="text-muted-foreground">
            Aplique formulários personalizados aos pacientes
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Patient List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Pacientes
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[500px] overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : filteredPatients.length > 0 ? (
              filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPatient?.id === patient.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium text-foreground">{patient.name}</p>
                  <p className="text-sm text-muted-foreground">{patient.phone}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Nenhum paciente encontrado
              </p>
            )}
          </CardContent>
        </Card>

        {/* Responses Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {selectedPatient
                  ? `Anamneses - ${selectedPatient.name}`
                  : "Selecione um paciente"}
              </CardTitle>
              {selectedPatient && (
                <CardDescription>
                  {patientResponses.length} anamnese(s) registrada(s)
                </CardDescription>
              )}
            </div>
            {selectedPatient && templates.length > 0 && (
              <Button onClick={handleOpenNewResponse}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Anamnese
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedPatient ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione um paciente para ver as anamneses</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">Nenhum template de anamnese ativo</p>
                <p className="text-sm">
                  Crie templates na página de gerenciamento
                </p>
              </div>
            ) : patientResponses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">Nenhuma anamnese registrada</p>
                <Button onClick={handleOpenNewResponse}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Anamnese
                </Button>
              </div>
            ) : (
              <Accordion type="single" collapsible className="space-y-2">
                {patientResponses.map((response) => (
                  <AccordionItem 
                    key={response.id} 
                    value={response.id}
                    className="border border-border rounded-lg px-4"
                  >
                    <AccordionTrigger 
                      className="hover:no-underline py-4"
                      onClick={(e) => {
                        // Prevent default trigger behavior to load data first
                        const isOpen = e.currentTarget.getAttribute('data-state') === 'open';
                        if (!isOpen) {
                          fetchResponseAnswers(response.id, response.template_id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 text-left">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {response.template_title}
                          </p>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(response.created_at), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                            {response.filled_by_patient && response.signature_data && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                ✍️ Assinado
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      {loadingQuestions ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : viewQuestions.length > 0 ? (
                        <div className="space-y-4 pl-12">
                          {viewQuestions.map((question) => {
                            const answer = viewAnswers.find(a => a.question_id === question.id);
                            const answerDisplay = getAnswerDisplay(question, answer);
                            
                            return (
                              <div key={question.id} className="border-l-2 border-primary/20 pl-4">
                                <p className="text-sm font-medium text-foreground mb-1">
                                  {question.question_text}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {answerDisplay || <em>Não respondido</em>}
                                </p>
                              </div>
                            );
                          })}

                          {/* Seção de Assinatura Digital */}
                          {response.filled_by_patient && response.signature_data && (
                            <div className="mt-6 pt-4 border-t space-y-4">
                              {/* Badge indicando preenchimento pelo paciente */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                  <ShieldCheck className="h-3 w-3 mr-1" />
                                  Preenchido pelo paciente
                                </Badge>
                                {response.signed_at && (
                                  <span className="text-xs text-muted-foreground">
                                    Assinado em {format(new Date(response.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </span>
                                )}
                              </div>
                              
                              {/* Termo de responsabilidade */}
                              {response.responsibility_accepted && (
                                <Card className="bg-muted/30">
                                  <CardContent className="py-3">
                                    <p className="text-sm text-muted-foreground">
                                      <ShieldCheck className="h-4 w-4 inline mr-2 text-primary" />
                                      O paciente aceitou o termo de responsabilidade sobre as informações fornecidas.
                                    </p>
                                  </CardContent>
                                </Card>
                              )}
                              
                              {/* Assinatura digital */}
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-base flex items-center gap-2">
                                    <PenTool className="h-4 w-4" />
                                    Assinatura do Paciente
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="border rounded-lg p-4 bg-white">
                                    <img 
                                      src={getSignatureUrl(response.signature_data) || ''} 
                                      alt="Assinatura do paciente"
                                      className="max-w-full h-auto max-h-32 mx-auto"
                                    />
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}

                          {/* Botões de Ação */}
                          <div className="flex gap-2 justify-end mt-6 pt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setViewingResponse(response);
                                setTimeout(() => handlePrintAnamnesis(), 100);
                              }}
                            >
                              <Printer className="h-4 w-4 mr-2" />
                              Imprimir
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleExportAnamnesis(response)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Exportar PDF
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Sem respostas disponíveis
                        </p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Response Dialog */}
      <Dialog open={newResponseDialogOpen} onOpenChange={setNewResponseDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Anamnese - {selectedPatient?.name}</DialogTitle>
            <DialogDescription>
              Selecione um template e preencha as informações
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <Label>Template *</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingQuestions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : selectedTemplateId && questions.length > 0 ? (
              <AnamneseResponseForm
                questions={questions}
                answers={answers}
                onAnswersChange={setAnswers}
                errors={errors}
              />
            ) : selectedTemplateId ? (
              <div className="text-center py-8 text-muted-foreground">
                Este template não possui perguntas
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setNewResponseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveResponse}
              disabled={saving || !selectedTemplateId}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Anamnese
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Response Dialog */}
      <Dialog open={viewResponseDialogOpen} onOpenChange={setViewResponseDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingResponse?.template_title}</DialogTitle>
            <DialogDescription>
              Preenchida em{" "}
              {viewingResponse &&
                format(new Date(viewingResponse.created_at), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
            </DialogDescription>
          </DialogHeader>

          {loadingQuestions ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <AnamneseResponseForm
              questions={viewQuestions}
              answers={viewAnswers}
              onAnswersChange={() => {}}
              readOnly
            />
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setViewResponseDialogOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden Print Component */}
      <div className="hidden">
        {viewingResponse && selectedPatient && currentClinic && (
          <AnamnesisPrint
            ref={printRef}
            clinic={{
              name: currentClinic.name,
              address: currentClinic.address,
              phone: currentClinic.phone,
              logo_url: currentClinic.logo_url,
              cnpj: currentClinic.cnpj,
            }}
            patient={{
              name: selectedPatient.name,
              phone: selectedPatient.phone,
            }}
            template={{
              title: viewingResponse.template_title,
            }}
            questions={viewQuestions}
            answers={viewAnswers}
            response={{
              created_at: viewingResponse.created_at,
              filled_by_patient: viewingResponse.filled_by_patient,
              signature_data: viewingResponse.signature_data,
              signed_at: viewingResponse.signed_at,
              responsibility_accepted: viewingResponse.responsibility_accepted,
            }}
            signatureUrl={getSignatureUrl(viewingResponse.signature_data)}
          />
        )}
      </div>
    </div>
  );
}
