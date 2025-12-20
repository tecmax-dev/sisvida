import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

export type QuestionType = "text" | "textarea" | "radio" | "checkbox" | "select" | "date" | "number" | "boolean";

export interface QuestionOption {
  id: string;
  option_text: string;
  order_index: number;
}

export interface Question {
  id: string;
  question_text: string;
  question_type: QuestionType;
  is_required: boolean;
  order_index: number;
  options: QuestionOption[];
}

export interface Answer {
  question_id: string;
  answer_text: string | null;
  answer_option_ids: string[] | null;
}

interface AnamneseResponseFormProps {
  questions: Question[];
  answers: Answer[];
  onAnswersChange: (answers: Answer[]) => void;
  errors?: Record<string, string>;
  readOnly?: boolean;
}

export function AnamneseResponseForm({
  questions,
  answers,
  onAnswersChange,
  errors = {},
  readOnly = false,
}: AnamneseResponseFormProps) {
  const getAnswer = (questionId: string): Answer => {
    const existingAnswer = answers.find((a) => a.question_id === questionId);
    if (existingAnswer) return existingAnswer;
    
    // Verificar se é uma pergunta booleana para inicializar com "false"
    const question = questions.find(q => q.id === questionId);
    if (question?.question_type === "boolean") {
      return {
        question_id: questionId,
        answer_text: "false",
        answer_option_ids: null,
      };
    }
    
    return {
      question_id: questionId,
      answer_text: null,
      answer_option_ids: null,
    };
  };

  const updateAnswer = (questionId: string, updates: Partial<Answer>) => {
    const existingIndex = answers.findIndex((a) => a.question_id === questionId);
    const newAnswers = [...answers];

    if (existingIndex >= 0) {
      newAnswers[existingIndex] = { ...newAnswers[existingIndex], ...updates };
    } else {
      newAnswers.push({
        question_id: questionId,
        answer_text: null,
        answer_option_ids: null,
        ...updates,
      });
    }

    onAnswersChange(newAnswers);
  };

  const renderQuestion = (question: Question) => {
    const answer = getAnswer(question.id);
    const error = errors[question.id];

    return (
      <div
        key={question.id}
        className={`p-4 rounded-lg border ${
          error ? "border-destructive bg-destructive/5" : "border-border"
        }`}
      >
        <div className="flex items-start gap-2 mb-3">
          <Label className="text-base font-medium flex-1">
            {question.question_text}
            {question.is_required && (
              <span className="text-destructive ml-1">*</span>
            )}
          </Label>
          {question.is_required && (
            <Badge variant="outline" className="text-xs shrink-0">
              Obrigatória
            </Badge>
          )}
        </div>

        {renderInput(question, answer)}

        {error && (
          <div className="flex items-center gap-1 mt-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>
    );
  };

  const renderInput = (question: Question, answer: Answer) => {
    switch (question.question_type) {
      case "text":
        return (
          <Input
            value={answer.answer_text || ""}
            onChange={(e) =>
              updateAnswer(question.id, { answer_text: e.target.value })
            }
            disabled={readOnly}
            placeholder="Digite sua resposta..."
          />
        );

      case "textarea":
        return (
          <Textarea
            value={answer.answer_text || ""}
            onChange={(e) =>
              updateAnswer(question.id, { answer_text: e.target.value })
            }
            disabled={readOnly}
            placeholder="Digite sua resposta..."
            rows={3}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={answer.answer_text || ""}
            onChange={(e) =>
              updateAnswer(question.id, { answer_text: e.target.value })
            }
            disabled={readOnly}
            placeholder="0"
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={answer.answer_text || ""}
            onChange={(e) =>
              updateAnswer(question.id, { answer_text: e.target.value })
            }
            disabled={readOnly}
          />
        );

      case "boolean":
        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={answer.answer_text === "true"}
              onCheckedChange={(checked) =>
                updateAnswer(question.id, { answer_text: checked.toString() })
              }
              disabled={readOnly}
            />
            <span className="text-sm text-muted-foreground">
              {answer.answer_text === "true" ? "Sim" : "Não"}
            </span>
          </div>
        );

      case "radio":
        return (
          <RadioGroup
            value={answer.answer_option_ids?.[0] || ""}
            onValueChange={(value) =>
              updateAnswer(question.id, { answer_option_ids: [value] })
            }
            disabled={readOnly}
            className="space-y-2"
          >
            {question.options
              .sort((a, b) => a.order_index - b.order_index)
              .map((option) => (
                <div key={option.id} className="flex items-center gap-2">
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label htmlFor={option.id} className="font-normal cursor-pointer">
                    {option.option_text}
                  </Label>
                </div>
              ))}
          </RadioGroup>
        );

      case "checkbox":
        return (
          <div className="space-y-2">
            {question.options
              .sort((a, b) => a.order_index - b.order_index)
              .map((option) => {
                const isChecked = answer.answer_option_ids?.includes(option.id) || false;
                return (
                  <div key={option.id} className="flex items-center gap-2">
                    <Checkbox
                      id={option.id}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const currentIds = answer.answer_option_ids || [];
                        const newIds = checked
                          ? [...currentIds, option.id]
                          : currentIds.filter((id) => id !== option.id);
                        updateAnswer(question.id, { answer_option_ids: newIds });
                      }}
                      disabled={readOnly}
                    />
                    <Label htmlFor={option.id} className="font-normal cursor-pointer">
                      {option.option_text}
                    </Label>
                  </div>
                );
              })}
          </div>
        );

      case "select":
        return (
          <Select
            value={answer.answer_option_ids?.[0] || ""}
            onValueChange={(value) =>
              updateAnswer(question.id, { answer_option_ids: [value] })
            }
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent>
              {question.options
                .sort((a, b) => a.order_index - b.order_index)
                .map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.option_text}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        );

      default:
        return null;
    }
  };

  const sortedQuestions = [...questions].sort(
    (a, b) => a.order_index - b.order_index
  );

  return (
    <div className="space-y-4">
      {sortedQuestions.map(renderQuestion)}

      {questions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Este formulário não possui perguntas
        </div>
      )}
    </div>
  );
}

// Validation helper
export function validateAnswers(
  questions: Question[],
  answers: Answer[]
): Record<string, string> {
  const errors: Record<string, string> = {};

  questions.forEach((question) => {
    if (question.is_required) {
      const answer = answers.find((a) => a.question_id === question.id);

      if (!answer) {
        errors[question.id] = "Esta pergunta é obrigatória";
        return;
      }

      const hasTextAnswer = answer.answer_text && answer.answer_text.trim() !== "";
      const hasOptionAnswer = answer.answer_option_ids && answer.answer_option_ids.length > 0;

      if (["text", "textarea", "number", "date", "boolean"].includes(question.question_type)) {
        if (!hasTextAnswer) {
          errors[question.id] = "Esta pergunta é obrigatória";
        }
      } else {
        if (!hasOptionAnswer) {
          errors[question.id] = "Selecione pelo menos uma opção";
        }
      }
    }
  });

  return errors;
}
