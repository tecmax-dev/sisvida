import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Star, CheckCircle2 } from "lucide-react";

export default function PublicNPS() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [survey, setSurvey] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    loadSurvey();
  }, [token]);

  const loadSurvey = async () => {
    if (!token) return;

    try {
      const { data, error } = await supabase
        .from("nps_surveys")
        .select(`
          *,
          clinics:clinic_id (name, logo_url)
        `)
        .eq("response_token", token)
        .single();

      if (error) throw error;

      if (data.responded_at) {
        setSubmitted(true);
      }

      setSurvey(data);
      setClinic(data.clinics);
    } catch (error) {
      console.error("Error loading survey:", error);
      toast.error("Pesquisa não encontrada");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (score === null) {
      toast.error("Por favor, selecione uma nota");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("nps_surveys")
        .update({
          score,
          feedback: feedback || null,
          responded_at: new Date().toISOString(),
        })
        .eq("response_token", token);

      if (error) throw error;

      setSubmitted(true);
      toast.success("Obrigado pela sua avaliação!");
    } catch (error) {
      console.error("Error submitting survey:", error);
      toast.error("Erro ao enviar avaliação");
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColor = (s: number) => {
    if (s <= 6) return "bg-red-500 hover:bg-red-600 text-white";
    if (s <= 8) return "bg-yellow-500 hover:bg-yellow-600 text-white";
    return "bg-green-500 hover:bg-green-600 text-white";
  };

  const getScoreLabel = () => {
    if (score === null) return "";
    if (score <= 6) return "😔 Detrator";
    if (score <= 8) return "😐 Neutro";
    return "😊 Promotor";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Pesquisa não encontrada ou expirada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-green-700">Obrigado!</h2>
            <p className="text-muted-foreground">
              Sua avaliação foi registrada com sucesso. Sua opinião é muito importante para nós!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          {clinic?.logo_url && (
            <img 
              src={clinic.logo_url} 
              alt={clinic.name} 
              className="h-16 mx-auto mb-4 object-contain"
            />
          )}
          <CardTitle className="text-2xl">{clinic?.name || "Avaliação"}</CardTitle>
          <CardDescription>
            Como foi seu atendimento? Avalie de 0 a 10
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Selection */}
          <div className="space-y-4">
            <div className="grid grid-cols-11 gap-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => setScore(s)}
                  className={`
                    aspect-square rounded-lg font-bold text-sm transition-all
                    ${score === s 
                      ? getScoreColor(s) + " ring-2 ring-offset-2 ring-primary scale-110" 
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }
                  `}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Não recomendaria</span>
              <span>Recomendaria muito</span>
            </div>
            {score !== null && (
              <p className="text-center text-lg font-medium">{getScoreLabel()}</p>
            )}
          </div>

          {/* Feedback */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Deixe um comentário (opcional)
            </label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Conte-nos mais sobre sua experiência..."
              rows={4}
            />
          </div>

          {/* Submit */}
          <Button 
            onClick={handleSubmit} 
            disabled={score === null || submitting}
            className="w-full"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar Avaliação"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
