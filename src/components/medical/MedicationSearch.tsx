import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Pill, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Medication {
  id: string;
  name: string;
  active_ingredient: string | null;
  dosage: string | null;
  form: string | null;
  instructions: string | null;
  is_controlled: boolean;
}

interface MedicationSearchProps {
  onSelectMedication: (text: string) => void;
  disabled?: boolean;
}

export function MedicationSearch({ onSelectMedication, disabled }: MedicationSearchProps) {
  const { currentClinic } = useAuth();
  const [search, setSearch] = useState("");
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [newMedication, setNewMedication] = useState({
    name: "",
    active_ingredient: "",
    dosage: "",
    form: "",
    instructions: "",
    is_controlled: false,
  });

  const fetchMedications = useCallback(async (searchTerm: string) => {
    setLoading(true);
    try {
      // Build query to fetch both global and clinic-specific medications
      let query = supabase
        .from("medications")
        .select("id, name, active_ingredient, dosage, form, instructions, is_controlled")
        .eq("is_active", true)
        .order("name")
        .limit(30);
      
      // Filter by clinic_id (NULL for global, or matching clinic)
      if (currentClinic?.id) {
        query = query.or(`clinic_id.is.null,clinic_id.eq.${currentClinic.id}`);
      } else {
        query = query.is("clinic_id", null);
      }
      
      if (searchTerm.trim()) {
        query = query.or(`name.ilike.%${searchTerm}%,active_ingredient.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setMedications(data || []);
    } catch (error) {
      console.error("Error fetching medications:", error);
      toast.error("Erro ao buscar medicamentos");
    } finally {
      setLoading(false);
    }
  }, [currentClinic?.id]);

  // Fetch on mount and when search changes
  useEffect(() => {
    if (!currentClinic?.id) return;
    
    const debounce = setTimeout(() => {
      fetchMedications(search);
    }, 300);
    return () => clearTimeout(debounce);
  }, [search, fetchMedications, currentClinic?.id]);

  const handleSelectMedication = (med: Medication) => {
    let text = med.name;
    if (med.dosage) text += ` ${med.dosage}`;
    if (med.form) text += ` (${med.form})`;
    if (med.instructions) text += `\n   ${med.instructions}`;
    
    onSelectMedication(text);
    toast.success(`${med.name} adicionado à prescrição`);
  };

  const handleSaveNewMedication = async () => {
    if (!currentClinic?.id || !newMedication.name.trim()) {
      toast.error("Nome do medicamento é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("medications")
        .insert({
          clinic_id: currentClinic.id,
          name: newMedication.name.trim(),
          active_ingredient: newMedication.active_ingredient.trim() || null,
          dosage: newMedication.dosage.trim() || null,
          form: newMedication.form.trim() || null,
          instructions: newMedication.instructions.trim() || null,
          is_controlled: newMedication.is_controlled,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Medicamento cadastrado com sucesso!");
      setShowAddDialog(false);
      setNewMedication({
        name: "",
        active_ingredient: "",
        dosage: "",
        form: "",
        instructions: "",
        is_controlled: false,
      });
      fetchMedications(search);
      
      // Auto-add to prescription
      if (data) {
        handleSelectMedication(data as Medication);
      }
    } catch (error: any) {
      console.error("Error saving medication:", error);
      toast.error("Erro ao salvar medicamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar medicamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            disabled={disabled}
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowAddDialog(true)}
          disabled={disabled}
          title="Cadastrar novo medicamento"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : medications.length > 0 ? (
        <ScrollArea className="h-[180px]">
          <div className="space-y-1">
            {medications.map((med) => (
              <Card
                key={med.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => !disabled && handleSelectMedication(med)}
              >
                <CardContent className="p-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Pill className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {med.name}
                        {med.dosage && <span className="text-muted-foreground ml-1">{med.dosage}</span>}
                      </p>
                      {med.form && (
                        <p className="text-xs text-muted-foreground truncate">{med.form}</p>
                      )}
                    </div>
                  </div>
                  {med.is_controlled && (
                    <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-900/30 flex-shrink-0">
                      Controlado
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      ) : medications.length === 0 && !search ? (
        <div className="text-center py-4 text-muted-foreground">
          <Pill className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum medicamento cadastrado</p>
          <Button
            variant="link"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            disabled={disabled}
          >
            <Plus className="h-3 w-3 mr-1" />
            Cadastrar primeiro medicamento
          </Button>
        </div>
      ) : search && medications.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">Nenhum medicamento encontrado</p>
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setNewMedication({ ...newMedication, name: search });
              setShowAddDialog(true);
            }}
            disabled={disabled}
          >
            <Plus className="h-3 w-3 mr-1" />
            Cadastrar "{search}"
          </Button>
        </div>
      ) : null}

      {/* Add Medication Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Medicamento</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={newMedication.name}
                onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                placeholder="Ex: Dipirona"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dosagem</Label>
                <Input
                  value={newMedication.dosage}
                  onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
                  placeholder="Ex: 500mg"
                />
              </div>
              <div>
                <Label>Forma</Label>
                <Input
                  value={newMedication.form}
                  onChange={(e) => setNewMedication({ ...newMedication, form: e.target.value })}
                  placeholder="Ex: Comprimido"
                />
              </div>
            </div>
            
            <div>
              <Label>Princípio Ativo</Label>
              <Input
                value={newMedication.active_ingredient}
                onChange={(e) => setNewMedication({ ...newMedication, active_ingredient: e.target.value })}
                placeholder="Ex: Dipirona Sódica"
              />
            </div>
            
            <div>
              <Label>Posologia Padrão</Label>
              <Textarea
                value={newMedication.instructions}
                onChange={(e) => setNewMedication({ ...newMedication, instructions: e.target.value })}
                placeholder="Ex: Tomar 1 comprimido de 6 em 6 horas"
                rows={2}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Medicamento Controlado</Label>
              <Switch
                checked={newMedication.is_controlled}
                onCheckedChange={(checked) => setNewMedication({ ...newMedication, is_controlled: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveNewMedication} disabled={saving || !newMedication.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
