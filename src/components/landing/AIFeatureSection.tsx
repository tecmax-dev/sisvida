import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function AIFeatureSection() {
  return (
    <section className="py-16 lg:py-20 bg-muted/30">
      <div className="container">
        <div className="max-w-4xl mx-auto text-center">
          {/* Title */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            <span className="gradient-text">IA no Prontuário</span>
          </h2>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            <strong className="text-foreground">Menos tempo para telas, mais tempo para o paciente.</strong>
          </p>

          {/* Audio wave visualization */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="h-8 w-8 text-primary" />
            </div>
            <div className="flex items-center gap-1 h-12">
              {[...Array(40)].map((_, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-muted-foreground/30 rounded-full"
                  style={{
                    height: `${Math.random() * 100}%`,
                    minHeight: '4px'
                  }}
                />
              ))}
            </div>
          </div>

          {/* CTA */}
          <Button 
            size="lg"
            className="btn-eclini px-8 h-14 text-base"
            asChild
          >
            <Link to="/cadastro">
              Conheça essa novidade
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
