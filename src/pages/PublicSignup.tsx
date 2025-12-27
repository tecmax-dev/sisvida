import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/layout/Logo";
import { ArrowRight, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(14, "Telefone inválido"),
  businessType: z.string().min(1, "Selecione o tipo de negócio"),
});

// Generate a secure temporary password
function generateTempPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const businessTypes = [
  { value: "consultorio", label: "Consultório individual (1 profissional)" },
  { value: "clinica", label: "Clínica (2+ profissionais)" },
  { value: "diagnostico", label: "Centro de diagnóstico/laboratório" },
  { value: "estetica", label: "Clínica de estética" },
  { value: "odontologia", label: "Consultório/Clínica odontológica" },
  { value: "outro", label: "Outro" },
];

const carouselImages = [
  {
    url: "https://eahhszmbyxapxzilfdlo.supabase.co/storage/v1/object/public/carousel-images/scheduling-mockup-1766334441034.png",
    title: "Agenda inteligente",
    description: "Gerencie seus agendamentos de forma simples e eficiente"
  },
  {
    url: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
    title: "Prontuário digital",
    description: "Histórico completo dos seus pacientes em um só lugar"
  },
  {
    url: "https://images.unsplash.com/photo-1666214280557-f1b5022eb634?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
    title: "Lembretes automáticos",
    description: "Reduza faltas com confirmações via WhatsApp"
  },
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentSlide, setCurrentSlide] = useState(0);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    businessType: "",
  });

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setFormData(prev => ({ ...prev, phone: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

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
      // Generate temporary password for the user
      const tempPassword = generateTempPassword();
      
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: tempPassword,
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
        // Send credentials email with temporary password
        try {
          await supabase.functions.invoke("send-user-credentials", {
            body: {
              userEmail: formData.email,
              userName: formData.name,
              tempPassword: tempPassword,
              clinicName: "",
            },
          });
        } catch (emailError) {
          console.error("Failed to send credentials email:", emailError);
        }

        // Notify admin about new signup
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
        }

        // Sign out user after signup (they need to login with their credentials)
        await supabase.auth.signOut();

        toast({
          title: "Conta criada com sucesso!",
          description: "Suas credenciais de acesso foram enviadas para seu email.",
        });

        navigate("/auth", { 
          state: { email: formData.email, message: "Suas credenciais foram enviadas por email. Verifique sua caixa de entrada." } 
        });
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

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left Column - Form */}
      <div className="lg:w-1/2 flex flex-col justify-center p-6 sm:p-8 lg:p-12 xl:p-16 order-2 lg:order-1">
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
          <Link to="/" className="inline-block mb-8">
            <Logo size="md" />
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Crie sua conta
            </h1>
            <p className="text-muted-foreground">
              Comece seu teste grátis de 14 dias
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                placeholder="Seu nome"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`h-12 ${errors.name ? "border-destructive" : ""}`}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className={`h-12 ${errors.email ? "border-destructive" : ""}`}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone celular</Label>
              <Input
                id="phone"
                placeholder="(00) 00000-0000"
                value={formData.phone}
                onChange={handlePhoneChange}
                maxLength={15}
                className={`h-12 ${errors.phone ? "border-destructive" : ""}`}
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>


            <div className="space-y-2">
              <Label htmlFor="businessType">Tipo de negócio</Label>
              <Select
                value={formData.businessType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, businessType: value }))}
              >
                <SelectTrigger className={`h-12 ${errors.businessType ? "border-destructive" : ""}`}>
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
              {errors.businessType && <p className="text-sm text-destructive">{errors.businessType}</p>}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Criando conta...
                </>
              ) : (
                <>
                  Criar conta grátis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Ao criar sua conta, você concorda com nossos{" "}
              <a href="#" className="text-primary hover:underline">Termos de Uso</a>
              {" "}e{" "}
              <a href="#" className="text-primary hover:underline">Política de Privacidade</a>
            </p>
          </form>

          {/* Login link */}
          <div className="mt-8 text-center">
            <p className="text-muted-foreground">
              Já tem uma conta?{" "}
              <Link to="/auth" className="text-primary font-medium hover:underline">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Column - Carousel */}
      <div className="lg:w-1/2 relative bg-primary min-h-[300px] lg:min-h-screen order-1 lg:order-2 overflow-hidden">
        {/* SVG Decorations */}
        <svg className="absolute top-0 right-0 w-64 h-64 text-white/10" viewBox="0 0 200 200" fill="currentColor">
          <circle cx="100" cy="100" r="80" />
        </svg>
        <svg className="absolute bottom-0 left-0 w-48 h-48 text-white/10" viewBox="0 0 200 200" fill="currentColor">
          <circle cx="100" cy="100" r="60" />
        </svg>
        <svg className="absolute top-1/2 right-10 w-32 h-32 text-white/5" viewBox="0 0 200 200" fill="currentColor">
          <rect x="20" y="20" width="160" height="160" rx="20" />
        </svg>

        {/* Carousel */}
        <div className="relative h-full flex items-center justify-center p-6 lg:p-12">
          <div className="relative w-full max-w-lg">
            {/* Image Container */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
              {carouselImages.map((image, index) => (
                <div
                  key={index}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    index === currentSlide ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <img
                    src={image.url}
                    alt={image.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {/* Text */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h3 className="text-xl font-bold mb-2">{image.title}</h3>
                    <p className="text-white/80 text-sm">{image.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={prevSlide}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-6">
              {carouselImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentSlide 
                      ? "w-8 bg-white" 
                      : "bg-white/40 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Trial Badge */}
        <div className="absolute top-6 right-6 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
          <span className="text-white text-sm font-medium">14 dias grátis</span>
        </div>
      </div>
    </div>
  );
}
