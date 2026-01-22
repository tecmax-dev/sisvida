import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  CalendarX, 
  Plus,
  Search,
  Calendar as CalendarIcon,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Block {
  id: string;
  block_date: string;
  reason: string | null;
  block_type: string;
  professional_id: string | null;
  clinic_id: string;
}

interface Professional {
  id: string;
  name: string;
}

export default function HomologacaoBloqueiosPage() {
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    block_date: new Date(),
    reason: "",
    block_type: "full_day",
    professional_id: "",
  });

  // Fetch blocks
  const { data: blocks, isLoading } = useQuery({
    queryKey: ["homologacao-blocks", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("homologacao_blocks")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("block_date", { ascending: false });
      
      if (error) throw error;
      return data as Block[];
    },
    enabled: !!currentClinic?.id,
  });

  // Fetch professionals
  const { data: professionals } = useQuery({
    queryKey: ["homologacao-professionals", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("homologacao_professionals")
        .select("id, name")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data as Professional[];
    },
    enabled: !!currentClinic?.id,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("homologacao_blocks")
        .insert({
          block_date: format(data.block_date, "yyyy-MM-dd"),
          reason: data.reason || null,
          block_type: data.block_type,
          professional_id: data.professional_id || null,
          clinic_id: currentClinic?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homologacao-blocks"] });
      toast.success("Bloqueio criado com sucesso!");
      closeDialog();
    },
    onError: (error) => {
      toast.error("Erro ao criar bloqueio: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("homologacao_blocks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homologacao-blocks"] });
      toast.success("Bloqueio excluído com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir bloqueio: " + error.message);
    },
  });

  const openNewDialog = () => {
    setFormData({
      block_date: new Date(),
      reason: "",
      block_type: "full_day",
      professional_id: "",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    createMutation.mutate(formData);
  };

  const handleDelete = (id: string) => {
    if (confirm("Deseja realmente excluir este bloqueio?")) {
      deleteMutation.mutate(id);
    }
  };

  const getBlockTypeBadge = (type: string) => {
    switch (type) {
      case "full_day":
        return <Badge variant="destructive">Dia Inteiro</Badge>;
      case "partial":
        return <Badge variant="secondary">Parcial</Badge>;
      case "holiday":
        return <Badge className="bg-purple-500">Feriado</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const filteredBlocks = blocks?.filter(block =>
    block.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    format(new Date(block.block_date + "T12:00:00"), "dd/MM/yyyy").includes(searchTerm)
  );

  const getProfessionalName = (id: string | null) => {
    if (!id) return "Todos os profissionais";
    return professionals?.find(p => p.id === id)?.name || "Profissional não encontrado";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bloqueios e Feriados</h1>
          <p className="text-muted-foreground">Gestão de bloqueios de agenda e feriados</p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Bloqueio
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar bloqueio..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : filteredBlocks?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarX className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum bloqueio cadastrado</p>
            <Button onClick={openNewDialog} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Criar Bloqueio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBlocks?.map((block) => (
            <Card key={block.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">
                        {format(new Date(block.block_date + "T12:00:00"), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                      {getBlockTypeBadge(block.block_type)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{getProfessionalName(block.professional_id)}</span>
                    </div>
                    {block.reason && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {block.reason}
                      </p>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive"
                    onClick={() => handleDelete(block.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <PopupBase open={isDialogOpen} onClose={closeDialog}>
        <PopupHeader>
          <PopupTitle>Novo Bloqueio</PopupTitle>
          <PopupDescription>
            Crie um bloqueio de agenda para um dia específico
          </PopupDescription>
        </PopupHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Data do Bloqueio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.block_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.block_date ? (
                    format(formData.block_date, "dd/MM/yyyy", { locale: ptBR })
                  ) : (
                    <span>Selecione uma data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.block_date}
                  onSelect={(date) => date && setFormData({ ...formData, block_date: date })}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label>Tipo de Bloqueio</Label>
            <Select
              value={formData.block_type}
              onValueChange={(value) => setFormData({ ...formData, block_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_day">Dia Inteiro</SelectItem>
                <SelectItem value="partial">Parcial</SelectItem>
                <SelectItem value="holiday">Feriado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Profissional (opcional)</Label>
            <Select
              value={formData.professional_id}
              onValueChange={(value) => setFormData({ ...formData, professional_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os profissionais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os profissionais</SelectItem>
                {professionals?.map((prof) => (
                  <SelectItem key={prof.id} value={prof.id}>
                    {prof.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Motivo</Label>
            <Input
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Ex: Feriado Nacional, Férias, Reunião..."
            />
          </div>
        </div>
        <PopupFooter>
          <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
          <Button 
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </PopupFooter>
      </PopupBase>
    </div>
  );
}
