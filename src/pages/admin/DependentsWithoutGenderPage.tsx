import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Dependent {
  id: string;
  name: string;
  gender: string | null;
}

export default function DependentsWithoutGenderPage() {
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDependents();
  }, []);

  const fetchDependents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_dependents')
        .select('id, name, gender')
        .is('gender', null);

      if (error) throw error;
      setDependents((data as Dependent[]) || []);

    } catch (error) {
      console.error('Error fetching dependents:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateGender = async (id: string, gender: string) => {
    try {
      const { error } = await supabase
        .from('dependents')
        .update({ gender })
        .eq('id', id);

      if (error) throw error;
      setDependents(prev => prev.map(dep => dep.id === id ? { ...dep, gender } : dep));
    } catch (error) {
      console.error('Error updating gender:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dependentes Sem Gênero Cadastrado</CardTitle>
        </CardHeader>
        <CardContent>
          {dependents.length === 0 ? (
            <p className="text-center">Todos os dependentes têm gênero cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Gênero</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dependents.map(dependent => (
                  <TableRow key={dependent.id}>
                    <TableCell>{dependent.name}</TableCell>
                    <TableCell>
                      <Select
                        value={dependent.gender || ""}
                        onValueChange={(value) => updateGender(dependent.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o gênero" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Masculino</SelectItem>
                          <SelectItem value="female">Feminino</SelectItem>
                          <SelectItem value="other">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button onClick={() => updateGender(dependent.id, dependent.gender || "")}>Salvar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
