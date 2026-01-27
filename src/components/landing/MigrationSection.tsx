import { ArrowRight, CheckCircle2, Shield, Clock, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const benefits = [
  { icon: Shield, text: "Migração com total segurança" },
  { icon: Clock, text: "Processo ágil e sem interrupções" },
  { icon: Database, text: "Seus dados preservados 100%" }
];

export function MigrationSection() {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Content */}
          <div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Migrar para o Eclini é{" "}
              <span className="gradient-text">fácil e seguro!</span>
            </h2>
            
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Muitas clínicas já trouxeram seus dados para o Eclini. O processo de{" "}
              <strong className="text-foreground">migração de sistema</strong> é feito 
              com total segurança, agilidade e sem interferir na rotina da equipe!
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {benefits.map((benefit, index) => (
                <div 
                  key={index}
                  className="flex flex-col items-center text-center p-4 bg-primary/5 rounded-xl border border-primary/10"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{benefit.text}</span>
                </div>
              ))}
            </div>

            <Button 
              size="lg"
              className="btn-eclini px-8 h-14 text-base"
              asChild
            >
              <Link to="/cadastro" className="flex items-center gap-2">
                Solicitar migração
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>

          {/* Right - Visual */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-cta/10 rounded-3xl blur-xl" />
              
              {/* Main card */}
              <div className="relative bg-card border border-border rounded-2xl p-8 shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-xl feature-card-icon">
                    <Database className="h-7 w-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">Migração completa</h4>
                    <p className="text-sm text-muted-foreground">Transferência segura</p>
                  </div>
                </div>
                
                {/* Progress steps */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div className="flex-1 h-2 bg-success/20 rounded-full">
                      <div className="h-full w-full bg-success rounded-full" />
                    </div>
                    <span className="text-xs text-muted-foreground">Pacientes</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div className="flex-1 h-2 bg-success/20 rounded-full">
                      <div className="h-full w-full bg-success rounded-full" />
                    </div>
                    <span className="text-xs text-muted-foreground">Prontuários</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div className="flex-1 h-2 bg-success/20 rounded-full">
                      <div className="h-full w-full bg-success rounded-full" />
                    </div>
                    <span className="text-xs text-muted-foreground">Financeiro</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div className="flex-1 h-2 bg-success/20 rounded-full">
                      <div className="h-full w-full bg-success rounded-full" />
                    </div>
                    <span className="text-xs text-muted-foreground">Agendamentos</span>
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
