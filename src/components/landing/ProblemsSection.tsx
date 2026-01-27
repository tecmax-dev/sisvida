import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const problems = [
  "A clínica fica desorganizada, faltam processos padronizados",
  "Alto índice de atrasos e cancelamentos das consultas e procedimentos",
  "Controlar o estoque é complicado",
  "Dificuldade na tomada de decisão e excesso de planilhas e papelada",
  "Prejuízos financeiros por falta de controle nos repasses e nas cobranças"
];

export function ProblemsSection() {
  return (
    <section className="py-20 lg:py-28 bg-card">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Visual */}
          <div className="relative flex justify-center">
            <div className="relative w-full max-w-md">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-warning/10 rounded-3xl" />
              
              {/* Main card */}
              <div className="relative bg-card border border-border rounded-2xl p-8 shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-7 w-7 text-destructive" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">Software inadequado</h4>
                    <p className="text-sm text-muted-foreground">Pode causar prejuízos</p>
                  </div>
                </div>
                
                {/* Fake error messages */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                    <X className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">Agenda duplicada</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-warning/5 rounded-lg border border-warning/20">
                    <X className="h-4 w-4 text-warning" />
                    <span className="text-sm text-warning">Dados perdidos</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                    <X className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">Falta de suporte</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Content */}
          <div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              O que pode acontecer se você utilizar o{" "}
              <span className="gradient-text">software para clínica errado?</span>
            </h2>
            
            <ul className="space-y-4 mb-8">
              {problems.map((problem, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <X className="h-3 w-3 text-destructive" />
                  </div>
                  <span className="text-muted-foreground">{problem}</span>
                </li>
              ))}
            </ul>

            <Button 
              size="lg"
              variant="outline"
              className="btn-eclini-outline px-8 h-14 text-base"
              asChild
            >
              <Link to="/cadastro">
                Solicite uma demonstração
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
