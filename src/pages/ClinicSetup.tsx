import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/Logo";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2 } from "lucide-react";
import { z } from "zod";

const clinicSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100),
  phone: z.string().optional(),
  cnpj: z.string().optional(),
});

export default function ClinicSetup() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});
  
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const getUniqueSlug = async (baseSlug: string): Promise<string> => {
    // Check if base slug is available
    const { data: existing } = await supabase
      .from('clinics')
      .select('slug')
      .eq('slug', baseSlug)
      .maybeSingle();

    if (!existing) return baseSlug;

    // Find next available number
    const { data: similarSlugs } = await supabase
      .from('clinics')
      .select('slug')
      .like('slug', `${baseSlug}%`);

    if (!similarSlugs || similarSlugs.length === 0) return baseSlug;

    // Extract numbers from similar slugs and find next available
    let maxNum = 0;
    similarSlugs.forEach(s => {
      const match = s.slug.match(new RegExp(`^${baseSlug}-(\\d+)$`));
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1]));
      }
    });

    return `${baseSlug}-${maxNum + 1}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = clinicSchema.safeParse({ name, phone, cnpj });
    if (!validation.success) {
      const fieldErrors: typeof errors = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === "name") fieldErrors.name = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!user) return;

    setLoading(true);
    setErrors({});

    try {
      // Create clinic with unique slug
      const baseSlug = generateSlug(name);
      const slug = await getUniqueSlug(baseSlug);
      
      const { data: clinic, error: clinicError } = await supabase
        .from('clinics')
        .insert({
          name: name.trim(),
          slug,
          phone: phone.trim() || null,
          cnpj: cnpj.trim() || null,
        })
        .select()
        .single();

      if (clinicError) throw clinicError;

      // Assign user as owner
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          clinic_id: clinic.id,
          role: 'owner',
        });

      if (roleError) throw roleError;

      toast({
        title: "Clínica criada com sucesso!",
        description: "Você já pode começar a usar o sistema.",
      });

      await refreshProfile();
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error creating clinic:", error);
      toast({
        title: "Erro ao criar clínica",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Configure sua clínica
          </h1>
          <p className="text-muted-foreground mt-2">
            Vamos começar criando o perfil da sua clínica
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-primary/5 border border-primary/10">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Nova Clínica</p>
              <p className="text-sm text-muted-foreground">
                Preencha os dados básicos
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name">Nome da Clínica *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Clínica Saúde Total"
                className={`mt-1.5 ${errors.name ? "border-destructive" : ""}`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="mt-1.5"
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Clínica
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
