import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  Settings,
  Type,
  List,
  CheckSquare,
  Calendar,
  Hash,
  ToggleLeft,
  AlignLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

interface SortableQuestionProps {
  question: Question;
  onUpdate: (id: string, updates: Partial<Question>) => void;
  onDelete: (id: string) => void;
  onAddOption: (questionId: string) => void;
  onUpdateOption: (questionId: string, optionId: string, text: string) => void;
  onDeleteOption: (questionId: string, optionId: string) => void;
}

const questionTypeIcons: Record<QuestionType, React.ReactNode> = {
  text: <Type className="h-4 w-4" />,
  textarea: <AlignLeft className="h-4 w-4" />,
  radio: <List className="h-4 w-4" />,
  checkbox: <CheckSquare className="h-4 w-4" />,
  select: <List className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
  number: <Hash className="h-4 w-4" />,
  boolean: <ToggleLeft className="h-4 w-4" />,
};

const questionTypeLabels: Record<QuestionType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  radio: "Escolha única",
  checkbox: "Múltipla escolha",
  select: "Lista suspensa",
  date: "Data",
  number: "Número",
  boolean: "Sim/Não",
};

function SortableQuestion({
  question,
  onUpdate,
  onDelete,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
}: SortableQuestionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const needsOptions = ["radio", "checkbox", "select"].includes(question.question_type);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? "shadow-lg" : ""}`}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab hover:bg-muted p-1 rounded"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          
          <div className="flex-1 min-w-0">
            <Input
              value={question.question_text}
              onChange={(e) => onUpdate(question.id, { question_text: e.target.value })}
              placeholder="Digite a pergunta..."
              className="border-0 p-0 h-auto text-base font-medium focus-visible:ring-0"
            />
          </div>

          <Badge variant="outline" className="flex items-center gap-1 shrink-0">
            {questionTypeIcons[question.question_type]}
            <span className="hidden sm:inline">{questionTypeLabels[question.question_type]}</span>
          </Badge>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Settings className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(question.id)}
            className="shrink-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <CollapsibleContent>
          <CardContent className="p-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Tipo de pergunta</Label>
                <Select
                  value={question.question_type}
                  onValueChange={(value: QuestionType) =>
                    onUpdate(question.id, { question_type: value, options: [] })
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(questionTypeLabels) as QuestionType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          {questionTypeIcons[type]}
                          {questionTypeLabels[type]}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 sm:justify-end">
                <Label htmlFor={`required-${question.id}`}>Obrigatória</Label>
                <Switch
                  id={`required-${question.id}`}
                  checked={question.is_required}
                  onCheckedChange={(checked) =>
                    onUpdate(question.id, { is_required: checked })
                  }
                />
              </div>
            </div>

            {needsOptions && (
              <div className="space-y-2">
                <Label>Opções</Label>
                {question.options.map((option, idx) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-6">
                      {idx + 1}.
                    </span>
                    <Input
                      value={option.option_text}
                      onChange={(e) =>
                        onUpdateOption(question.id, option.id, e.target.value)
                      }
                      placeholder="Texto da opção"
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteOption(question.id, option.id)}
                      className="text-destructive hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddOption(question.id)}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar opção
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface AnamneseTemplateBuilderProps {
  questions: Question[];
  onQuestionsChange: (questions: Question[]) => void;
}

export function AnamneseTemplateBuilder({
  questions,
  onQuestionsChange,
}: AnamneseTemplateBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex((q) => q.id === active.id);
      const newIndex = questions.findIndex((q) => q.id === over.id);
      const newQuestions = arrayMove(questions, oldIndex, newIndex).map(
        (q, idx) => ({ ...q, order_index: idx })
      );
      onQuestionsChange(newQuestions);
    }
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      question_text: "",
      question_type: "text",
      is_required: false,
      order_index: questions.length,
      options: [],
    };
    onQuestionsChange([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    onQuestionsChange(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  const deleteQuestion = (id: string) => {
    onQuestionsChange(
      questions
        .filter((q) => q.id !== id)
        .map((q, idx) => ({ ...q, order_index: idx }))
    );
  };

  const addOption = (questionId: string) => {
    onQuestionsChange(
      questions.map((q) => {
        if (q.id === questionId) {
          return {
            ...q,
            options: [
              ...q.options,
              {
                id: crypto.randomUUID(),
                option_text: "",
                order_index: q.options.length,
              },
            ],
          };
        }
        return q;
      })
    );
  };

  const updateOption = (questionId: string, optionId: string, text: string) => {
    onQuestionsChange(
      questions.map((q) => {
        if (q.id === questionId) {
          return {
            ...q,
            options: q.options.map((o) =>
              o.id === optionId ? { ...o, option_text: text } : o
            ),
          };
        }
        return q;
      })
    );
  };

  const deleteOption = (questionId: string, optionId: string) => {
    onQuestionsChange(
      questions.map((q) => {
        if (q.id === questionId) {
          return {
            ...q,
            options: q.options
              .filter((o) => o.id !== optionId)
              .map((o, idx) => ({ ...o, order_index: idx })),
          };
        }
        return q;
      })
    );
  };

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={questions.map((q) => q.id)}
          strategy={verticalListSortingStrategy}
        >
          {questions.map((question) => (
            <SortableQuestion
              key={question.id}
              question={question}
              onUpdate={updateQuestion}
              onDelete={deleteQuestion}
              onAddOption={addOption}
              onUpdateOption={updateOption}
              onDeleteOption={deleteOption}
            />
          ))}
        </SortableContext>
      </DndContext>

      {questions.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            Nenhuma pergunta adicionada ainda
          </p>
        </div>
      )}

      <Button onClick={addQuestion} variant="outline" className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Pergunta
      </Button>
    </div>
  );
}
