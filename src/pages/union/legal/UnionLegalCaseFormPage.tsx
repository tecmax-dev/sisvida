import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnionLegalCases, useUnionLawyers, useUnionLawFirms } from "@/hooks/useUnionLegal";
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
import { ArrowLeft, Save, Loader2, FileText } from "lucide-react";
import {
  caseTypeLabels,
  caseStatusLabels,
  riskLevelLabels,
  LegalCaseType,
  LegalCaseStatus,
  LegalRiskLevel,
} from "@/types/unionLegal";

export default function UnionLegalCaseFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const { currentClinic } = useAuth();

  const { cases, createCase, updateCase } = useUnionLegalCases(currentClinic?.id);
  const { lawyers } = useUnionLawyers(currentClinic?.id);
  const { lawFirms } = useUnionLawFirms(currentClinic?.id);

  const [formData, setFormData] = useState({
    case_number: "",
    case_type: "trabalhista" as LegalCaseType,
    subject: "",
    plaintiff: "",
    defendant: "",
    court: "",
    jurisdiction: "",
    tribunal: "",
    filing_date: "",
    status: "ativo" as LegalCaseStatus,
    risk_level: "medio" as LegalRiskLevel,
    cause_value: "",
    estimated_liability: "",
    notes: "",
    lawyer_id: "",
    law_firm_id: "",
    union_role: "autor" as string,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEditing && cases.length > 0) {
      const existingCase = cases.find((c) => c.id === id);
      if (existingCase) {
        setFormData({
          case_number: existingCase.case_number || "",
          case_type: existingCase.case_type as LegalCaseType,
          subject: existingCase.subject || "",
          plaintiff: existingCase.plaintiff || "",
          defendant: existingCase.defendant || "",
          court: existingCase.court || "",
          jurisdiction: existingCase.jurisdiction || "",
          tribunal: existingCase.tribunal || "",
          filing_date: existingCase.filing_date?.split("T")[0] || "",
          status: existingCase.status as LegalCaseStatus,
          risk_level: existingCase.risk_level as LegalRiskLevel,
          cause_value: existingCase.cause_value?.toString() || "",
          estimated_liability: existingCase.estimated_liability?.toString() || "",
          notes: existingCase.notes || "",
          lawyer_id: existingCase.lawyer_id || "",
          law_firm_id: existingCase.law_firm_id || "",
          union_role: existingCase.union_role || "autor",
        });
      }
    }
  }, [isEditing, id, cases]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClinic?.id) return;

    setIsSubmitting(true);

    const payload = {
      ...formData,
      clinic_id: currentClinic.id,
      cause_value: formData.cause_value ? parseFloat(formData.cause_value) : null,
      estimated_liability: formData.estimated_liability
        ? parseFloat(formData.estimated_liability)
        : null,
      lawyer_id: formData.lawyer_id || null,
      law_firm_id: formData.law_firm_id || null,
      filing_date: formData.filing_date || null,
    };

    try {
      if (isEditing) {
        await updateCase.mutateAsync({ id, ...payload });
      } else {
        await createCase.mutateAsync(payload);
      }
      navigate("/union/juridico/casos");
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
            <FileText className="h-7 w-7 text-blue-500" />
            {isEditing ? "Editar Processo" : "Novo Processo"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? "Atualize as informações do processo"
              : "Cadastre um novo processo judicial"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Identificação */}
          <Card>
            <CardHeader>
              <CardTitle>Identificação do Processo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="case_number">Número do Processo *</Label>
                <Input
                  id="case_number"
                  value={formData.case_number}
                  onChange={(e) =>
                    setFormData({ ...formData, case_number: e.target.value })
                  }
                  placeholder="0000000-00.0000.0.00.0000"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="case_type">Tipo de Processo *</Label>
                <Select
                  value={formData.case_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, case_type: value as LegalCaseType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(caseTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filing_date">Data de Distribuição</Label>
                <Input
                  id="filing_date"
                  type="date"
                  value={formData.filing_date}
                  onChange={(e) =>
                    setFormData({ ...formData, filing_date: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <Label htmlFor="subject">Assunto *</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  placeholder="Descrição resumida do processo"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Partes */}
          <Card>
            <CardHeader>
              <CardTitle>Partes Envolvidas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plaintiff">Autor/Reclamante *</Label>
                <Input
                  id="plaintiff"
                  value={formData.plaintiff}
                  onChange={(e) =>
                    setFormData({ ...formData, plaintiff: e.target.value })
                  }
                  placeholder="Nome do autor"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defendant">Réu/Reclamado *</Label>
                <Input
                  id="defendant"
                  value={formData.defendant}
                  onChange={(e) =>
                    setFormData({ ...formData, defendant: e.target.value })
                  }
                  placeholder="Nome do réu"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Tribunal e Jurisdição */}
          <Card>
            <CardHeader>
              <CardTitle>Tribunal e Jurisdição</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="court">Tribunal/Vara</Label>
                <Input
                  id="court"
                  value={formData.court}
                  onChange={(e) =>
                    setFormData({ ...formData, court: e.target.value })
                  }
                  placeholder="Ex: 1ª Vara do Trabalho"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jurisdiction">Comarca</Label>
                <Input
                  id="jurisdiction"
                  value={formData.jurisdiction}
                  onChange={(e) =>
                    setFormData({ ...formData, jurisdiction: e.target.value })
                  }
                  placeholder="Ex: São Paulo/SP"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tribunal">Tribunal</Label>
                <Input
                  id="tribunal"
                  value={formData.tribunal}
                  onChange={(e) =>
                    setFormData({ ...formData, tribunal: e.target.value })
                  }
                  placeholder="Ex: TRT-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Status e Risco */}
          <Card>
            <CardHeader>
              <CardTitle>Status e Avaliação de Risco</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value as LegalCaseStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(caseStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="risk_level">Nível de Risco *</Label>
                <Select
                  value={formData.risk_level}
                  onValueChange={(value) =>
                    setFormData({ ...formData, risk_level: value as LegalRiskLevel })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(riskLevelLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cause_value">Valor da Causa (R$)</Label>
                <Input
                  id="cause_value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cause_value}
                  onChange={(e) =>
                    setFormData({ ...formData, cause_value: e.target.value })
                  }
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated_liability">
                  Passivo Estimado (R$)
                </Label>
                <Input
                  id="estimated_liability"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.estimated_liability}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      estimated_liability: e.target.value,
                    })
                  }
                  placeholder="0,00"
                />
              </div>
            </CardContent>
          </Card>

          {/* Representação Legal */}
          <Card>
            <CardHeader>
              <CardTitle>Representação Legal</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="law_firm_id">Escritório</Label>
                <Select
                  value={formData.law_firm_id || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      law_firm_id: value === "none" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um escritório" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {lawFirms.map((firm) => (
                      <SelectItem key={firm.id} value={firm.id}>
                        {firm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lawyer_id">Advogado Responsável</Label>
                <Select
                  value={formData.lawyer_id || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      lawyer_id: value === "none" ? "" : value,
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
                placeholder="Observações adicionais sobre o processo..."
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? "Atualizar Processo" : "Cadastrar Processo"}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
