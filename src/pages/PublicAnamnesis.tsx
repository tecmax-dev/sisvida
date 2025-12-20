import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, FileText, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AnamneseResponseForm, validateAnswers } from "@/components/anamnesis/AnamneseResponseForm";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  is_required: boolean;
  order_index: number;
  options: { id: string; option_text: string; order_index: number }[];
}

interface Answer {
  question_id: string;
  answer_text: string | null;
  answer_option_ids: string[] | null;
}

interface ResponseData {
  id: string;
  template_id: string;
  patient_id: string;
  clinic_id: string;
  filled_by_patient: boolean;
  patient: { name: string } | null;
  template: { title: string; description: string | null } | null;
  clinic: { name: string } | null;
}

export default function PublicAnamnesis() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseData, setResponseData] = useState<ResponseData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (token) {
      fetchAnamnesisData();
    }
  }, [token]);

  const fetchAnamnesisData = async () => {
    try {
      // Fetch the response by public token
      const { data: response, error: responseError } = await supabase
        .from('anamnese_responses')
        .select(`
          id,
          template_id,
          patient_id,
          clinic_id,
          filled_by_patient,
          patient:patients (name),
          template:anamnese_templates (title, description),
          clinic:clinics (name)
        `)
        .eq('public_token', token)
        .single();

      if (responseError || !response) {
        setError("Link inválido ou expirado.");
        setLoading(false);
        return;
      }

      if (response.filled_by_patient) {
        setSubmitted(true);
        setResponseData(response as ResponseData);
        setLoading(false);
        return;
      }

      setResponseData(response as ResponseData);

      // Fetch questions for this template
      const { data: questionsData } = await supabase
        .from('anamnese_questions')
        .select(`
          id,
          question_text,
          question_type,
          is_required,
          order_index,
          options:anamnese_question_options (id, option_text, order_index)
        `)
        .eq('template_id', response.template_id)
        .order('order_index');

      if (questionsData) {
        const mappedQuestions = questionsData.map(q => ({
          ...q,
          is_required: q.is_required ?? false,
          options: (q.options || []).sort((a, b) => a.order_index - b.order_index)
        }));
        setQuestions(mappedQuestions);
        
        // Inicializar respostas booleanas com "false" por padrão
        const booleanAnswers: Answer[] = mappedQuestions
          .filter(q => q.question_type === "boolean")
          .map(q => ({
            question_id: q.id,
            answer_text: "false",
            answer_option_ids: null,
          }));
        
        // Mesclar com respostas existentes
        setAnswers(prev => {
          const existingIds = prev.map(a => a.question_id);
          const newBooleanAnswers = booleanAnswers.filter(a => !existingIds.includes(a.question_id));
          return [...prev, ...newBooleanAnswers];
        });
      }

      // Fetch existing answers
      const { data: existingAnswers } = await supabase
        .from('anamnese_answers')
        .select('question_id, answer_text, answer_option_ids')
        .eq('response_id', response.id);

      if (existingAnswers) {
        setAnswers(existingAnswers);
      }
    } catch (err) {
      console.error("Error fetching anamnesis:", err);
      setError("Erro ao carregar formulário.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!responseData) return;

    // Validate required fields
    const errors = validateAnswers(questions as any, answers as any);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Delete existing answers
      await supabase
        .from('anamnese_answers')
        .delete()
        .eq('response_id', responseData.id);

      // Insert new answers
      if (answers.length > 0) {
        const { error: insertError } = await supabase
          .from('anamnese_answers')
          .insert(
            answers.map(a => ({
              response_id: responseData.id,
              question_id: a.question_id,
              answer_text: a.answer_text,
              answer_option_ids: a.answer_option_ids,
            }))
          );

        if (insertError) throw insertError;
      }

      // Mark as filled by patient
      const { error: updateError } = await supabase
        .from('anamnese_responses')
        .update({ 
          filled_by_patient: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', responseData.id);

      if (updateError) throw updateError;

      setSubmitted(true);
      toast({
        title: "Anamnese enviada!",
        description: "Suas respostas foram salvas com sucesso.",
      });
    } catch (err: any) {
      console.error("Error saving anamnesis:", err);
      toast({
        title: "Erro ao enviar",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">Link Inválido</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-semibold mb-2">Obrigado!</h2>
            <p className="text-muted-foreground mb-4">
              Sua anamnese foi enviada com sucesso para {responseData?.clinic?.name || "a clínica"}.
            </p>
            <p className="text-sm text-muted-foreground">
              Você pode fechar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center border-b">
            <div className="flex items-center justify-center gap-2 mb-2">
              <FileText className="h-6 w-6 text-primary" />
              <CardTitle>{responseData?.template?.title || "Anamnese"}</CardTitle>
            </div>
            <CardDescription>
              {responseData?.clinic?.name && (
                <span className="block font-medium text-foreground">
                  {responseData.clinic.name}
                </span>
              )}
              {responseData?.patient?.name && (
                <span className="block mt-1">
                  Paciente: {responseData.patient.name}
                </span>
              )}
              {responseData?.template?.description && (
                <span className="block mt-2">{responseData.template.description}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {questions.length > 0 ? (
              <>
                <AnamneseResponseForm
                  questions={questions as any}
                  answers={answers as any}
                  onAnswersChange={setAnswers as any}
                  errors={validationErrors}
                  readOnly={false}
                />
                <div className="flex justify-end mt-6 pt-6 border-t">
                  <Button onClick={handleSubmit} disabled={saving} size="lg">
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Enviar Anamnese
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma pergunta configurada para este formulário.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}