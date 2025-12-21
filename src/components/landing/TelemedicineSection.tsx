import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Video, 
  Monitor, 
  Smartphone, 
  Link2, 
  Shield, 
  FileText,
  ArrowRight,
  Check
} from "lucide-react";

const benefits = [
  {
    icon: Link2,
    title: "Sem instalação",
    description: "Paciente acessa por link único no navegador"
  },
  {
    icon: Video,
    title: "Vídeo HD",
    description: "Chamadas com áudio e vídeo de alta qualidade"
  },
  {
    icon: Monitor,
    title: "Compartilhe tela",
    description: "Mostre exames e resultados durante a consulta"
  },
  {
    icon: Smartphone,
    title: "Qualquer dispositivo",
    description: "Funciona em desktop, tablet ou celular"
  },
  {
    icon: FileText,
    title: "Prontuário integrado",
    description: "Registre tudo automaticamente no sistema"
  },
  {
    icon: Shield,
    title: "Seguro e privado",
    description: "Criptografia ponta a ponta"
  },
];

export function TelemedicineSection() {
  return (
    <section id="telemedicine" className="py-20 lg:py-28 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-background to-teal-500/5" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-teal-500/10 rounded-full blur-3xl" />

      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full mb-6">
              <Video className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-600">Teleconsulta integrada</span>
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Atenda seus pacientes
              <br />
              <span className="text-emerald-600">de qualquer lugar</span>
            </h2>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mb-8">
              Consultas online com a mesma qualidade do atendimento presencial. 
              Expanda seu alcance e ofereça mais comodidade aos seus pacientes.
            </p>

            {/* Benefits Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {benefits.map((benefit, i) => (
                <div 
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl bg-card/50 border border-border/50"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <benefit.icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">{benefit.title}</h4>
                    <p className="text-xs text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button 
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-8 h-14 text-base shadow-lg transition-all duration-300 hover:scale-105"
              asChild
            >
              <Link to="/cadastro" className="flex items-center gap-2">
                Comece a atender online
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>

          {/* Right Column - Visual */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              {/* Main visual container */}
              <div className="w-full max-w-md bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-3xl p-8 border border-emerald-500/20">
                {/* Video call mockup */}
                <div className="bg-card rounded-2xl shadow-2xl overflow-hidden border border-border">
                  {/* Header */}
                  <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-white" />
                      <span className="text-white text-sm font-medium">Teleconsulta em andamento</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-white/80 text-xs">12:34</span>
                    </div>
                  </div>
                  
                  {/* Video area */}
                  <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Video className="w-10 h-10 text-emerald-600" />
                    </div>
                    
                    {/* Small self-view */}
                    <div className="absolute bottom-3 right-3 w-20 h-14 bg-muted-foreground/20 rounded-lg border-2 border-card flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-primary text-xs font-bold">Dr.</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Controls */}
                  <div className="px-4 py-3 bg-card flex items-center justify-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Video className="w-5 h-5 text-foreground" />
                    </div>
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-foreground" />
                    </div>
                    <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">Fim</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <FileText className="w-5 h-5 text-foreground" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -left-4 top-1/4 bg-card border border-border rounded-xl p-3 shadow-lg animate-float hidden lg:block">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Paciente conectado</p>
                    <p className="text-xs text-muted-foreground">Pronto para consulta</p>
                  </div>
                </div>
              </div>

              <div className="absolute -right-4 bottom-1/4 bg-card border border-border rounded-xl p-3 shadow-lg animate-float hidden lg:block" style={{ animationDelay: '1s' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Smartphone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Acesso mobile</p>
                    <p className="text-xs text-muted-foreground">100% compatível</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
