import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnionLegalCases, useUnionLawyers } from "@/hooks/useUnionLegal";
import { useUnionLegalCaseDetail } from "@/hooks/useUnionLegal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Clock } from "lucide-react";
import {
  deadlineCriticalityLabels,
  DeadlineCriticality,
  DeadlineStatus,
} from "@/types/unionLegal";

export default function UnionLegalDeadlineFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const caseIdFromUrl = searchParams.get("caso");
  const isEditing = !!id;
  const { currentClinic } = useAuth();

  const { cases } = useUnionLegalCases(currentClinic?.id);
  const { lawyers } = useUnionLawyers(currentClinic?.id);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    deadline_date: "",
    deadline_time: "",
    criticality: "normal" as DeadlineCriticality,
    legal_case_id: caseIdFromUrl || "",
    responsible_lawyer_id: "",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get the createDeadline mutation from the case detail hook if a case is selected
  const selectedCaseId = formData.legal_case_id || undefined;
  const { createDeadline } = useUnionLegalCaseDetail(selectedCaseId, currentClinic?.id);

  useEffect(() => {
    if (caseIdFromUrl) {
      setFormData((prev) => ({ ...prev, legal_case_id: caseIdFromUrl }));
    }
  }, [caseIdFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClinic?.id || !formData.legal_case_id) return;

    setIsSubmitting(true);

    const payload = {
      title: formData.title,
      description: formData.description || null,
      deadline_date: formData.deadline_date,
      deadline_time: formData.deadline_time || null,
      criticality: formData.criticality,
      legal_case_id: formData.legal_case_id,
      responsible_lawyer_id: formData.responsible_lawyer_id || null,
      notes: formData.notes || null,
      clinic_id: currentClinic.id,
      status: "pendente" as DeadlineStatus,
    };

    try {
      await createDeadline.mutateAsync(payload);
      navigate("/union/juridico/prazos");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-7 w-7 text-orange-500" />
            {isEditing ? "Editar Prazo" : "Novo Prazo"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? "Atualize as informações do prazo"
              : "Cadastre um novo prazo processual"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Identificação */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Prazo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">Título do Prazo *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Ex: Prazo para contestação"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Descrição detalhada do prazo..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Data e Criticidade */}
          <Card>
            <CardHeader>
              <CardTitle>Data e Prioridade</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="deadline_date">Data Limite *</Label>
                <Input
                  id="deadline_date"
                  type="date"
                  value={formData.deadline_date}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline_date: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline_time">Horário</Label>
                <Input
                  id="deadline_time"
                  type="time"
                  value={formData.deadline_time}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline_time: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="criticality">Criticidade *</Label>
                <Select
                  value={formData.criticality}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      criticality: value as DeadlineCriticality,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(deadlineCriticalityLabels).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Vinculação */}
          <Card>
            <CardHeader>
              <CardTitle>Vinculação</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="legal_case_id">Processo *</Label>
                <Select
                  value={formData.legal_case_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, legal_case_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o processo" />
                  </SelectTrigger>
                  <SelectContent>
                    {cases.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.case_number} - {c.subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="responsible_lawyer_id">
                  Advogado Responsável
                </Label>
                <Select
                  value={formData.responsible_lawyer_id || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      responsible_lawyer_id: value === "none" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um advogado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {lawyers.map((lawyer) => (
                      <SelectItem key={lawyer.id} value={lawyer.id}>
                        {lawyer.name} - OAB {lawyer.oab_number}/{lawyer.oab_state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader>
              <CardTitle>Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Observações adicionais sobre o prazo..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Ações */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.legal_case_id}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? "Atualizar Prazo" : "Cadastrar Prazo"}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
