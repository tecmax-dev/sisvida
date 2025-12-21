import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/layout/Logo";
import { ArrowRight, Check, Eye, EyeOff, MessageCircle, Loader2 } from "lucide-react";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(14, "Telefone inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  businessType: z.string().min(1, "Selecione o tipo de negócio"),
});

const businessTypes = [
  { value: "consultorio", label: "Consultório individual (1 profissional)" },
  { value: "clinica", label: "Clínica (2+ profissionais)" },
  { value: "diagnostico", label: "Centro de diagnóstico/laboratório" },
  { value: "estetica", label: "Clínica de estética" },
  { value: "odontologia", label: "Consultório/Clínica odontológica" },
  { value: "outro", label: "Outro" },
];

const benefits = [
  "Agenda online 24 horas",
  "Confirmação automática via WhatsApp",
  "Prontuário eletrônico completo",
  "Gestão financeira integrada",
  "Relatórios e métricas em tempo real",
  "Suporte em português",
];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export default function PublicSignup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    businessType: "",
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setFormData(prev => ({ ...prev, phone: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form
    const result = signupSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Create user account
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/clinic-setup`,
          data: {
            name: formData.name,
            phone: formData.phone,
            business_type: formData.businessType,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Email já cadastrado",
            description: "Este email já está registrado. Tente fazer login ou use outro email.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      if (data.user) {
        // Notify super admin about new signup
        try {
          await supabase.functions.invoke("notify-new-signup", {
            body: {
              userName: formData.name,
              userEmail: formData.email,
              userPhone: formData.phone,
              businessType: businessTypes.find(b => b.value === formData.businessType)?.label || formData.businessType,
              userId: data.user.id,
            },
          });
        } catch (notifyError) {
          console.error("Failed to notify admin:", notifyError);
          // Don't block signup if notification fails
        }

        toast({
          title: "Conta criada com sucesso!",
          description: "Vamos configurar sua clínica agora.",
        });

        navigate("/clinic-setup");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Erro ao criar conta",
        description: error.message || "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Column - Branding & Benefits */}
      <div className="relative lg:w-1/2 bg-gradient-to-br from-primary via-primary to-primary-dark p-6 sm:p-8 lg:p-12 flex flex-col overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-white/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-64 sm:w-96 h-64 sm:h-96 bg-white/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
        
        <div className="relative z-10">
          <Link to="/">
            <Logo variant="light" size="md" />
          </Link>
          
          <div className="mt-6 sm:mt-8 lg:mt-12">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 backdrop-blur-sm rounded-full mb-4 sm:mb-6 animate-pulse">
              <span className="w-2 h-2 bg-success rounded-full" />
              <span className="text-xs sm:text-sm font-medium text-white">TESTE GRÁTIS POR 14 DIAS</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white leading-tight">
              Transforme a gestão
              <br />
              da sua clínica
            </h1>
            
            <p className="mt-4 sm:mt-6 text-sm sm:text-base lg:text-lg text-white/80 max-w-md">
              Sistema completo para profissionais de saúde. 
              Simplifique agendamentos, automatize lembretes e foque no que importa: seus pacientes.
            </p>
            
            {/* Benefits - Grid on mobile, list on larger screens */}
            <div className="mt-6 sm:mt-8 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-1">
              {benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 sm:gap-3 text-white/90">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                  </div>
                  <span className="text-xs sm:text-sm">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Doctor Image */}
        <div className="relative z-10 mt-6 lg:mt-auto lg:pt-8 flex justify-center lg:justify-start">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-white/20 rounded-2xl blur-2xl scale-95" />
            <img 
              src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
              alt="Profissional de saúde" 
              className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-64 lg:h-64 xl:w-72 xl:h-72 object-cover rounded-2xl shadow-2xl"
            />
            {/* Floating badge */}
            <div className="absolute -bottom-2 -right-2 sm:-bottom-3 sm:-right-3 bg-white rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 shadow-lg">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-xs sm:text-sm font-medium text-foreground">+2.000 clínicas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="text-center lg:text-left mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
              Crie sua conta grátis
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">
              Em menos de 2 minutos você estará usando o sistema
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="name" className="text-sm">Nome completo *</Label>
              <Input
                id="name"
                placeholder="Seu nome"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`h-10 sm:h-11 ${errors.name ? "border-destructive" : ""}`}
              />
              {errors.name && <p className="text-xs sm:text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="email" className="text-sm">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className={`h-10 sm:h-11 ${errors.email ? "border-destructive" : ""}`}
              />
              {errors.email && <p className="text-xs sm:text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="phone" className="text-sm">Telefone celular *</Label>
              <Input
                id="phone"
                placeholder="(00) 00000-0000"
                value={formData.phone}
                onChange={handlePhoneChange}
                maxLength={15}
                className={`h-10 sm:h-11 ${errors.phone ? "border-destructive" : ""}`}
              />
              {errors.phone && <p className="text-xs sm:text-sm text-destructive">{errors.phone}</p>}
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="password" className="text-sm">Senha *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className={`h-10 sm:h-11 ${errors.password ? "border-destructive pr-10" : "pr-10"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs sm:text-sm text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="businessType" className="text-sm">Tipo de negócio *</Label>
              <Select
                value={formData.businessType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, businessType: value }))}
              >
                <SelectTrigger className={`h-10 sm:h-11 ${errors.businessType ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {businessTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.businessType && <p className="text-xs sm:text-sm text-destructive">{errors.businessType}</p>}
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 sm:h-12 bg-cta hover:bg-cta-hover text-cta-foreground text-sm sm:text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                <>
                  Criar conta grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-center text-xs sm:text-sm text-muted-foreground">
              Ao criar sua conta, você concorda com nossos{" "}
              <a href="#" className="text-primary hover:underline">Termos de Uso</a>
              {" "}e{" "}
              <a href="#" className="text-primary hover:underline">Política de Privacidade</a>
            </p>

            <div className="text-center pt-3 sm:pt-4 border-t">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Já tem uma conta?{" "}
                <Link to="/auth" className="text-primary font-medium hover:underline">
                  Fazer login
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* WhatsApp floating button */}
      <a
        href="https://wa.me/5571982786864?text=Olá! Gostaria de saber mais sobre o Eclini."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-full shadow-lg transition-all duration-300 hover:scale-105"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline font-medium text-sm">Dúvidas? Fale conosco</span>
      </a>
    </div>
  );
}
