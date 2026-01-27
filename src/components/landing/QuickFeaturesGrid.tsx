import { 
  FileText, 
  BarChart3, 
  Users, 
  Megaphone,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";

const quickFeatures = [
  {
    icon: FileText,
    title: "Faturamento TISS e TUSS",
    description: "Com nosso sistema, os padrões TISS e TUSS não serão mais um problema, você fatura as guias com mais praticidade."
  },
  {
    icon: BarChart3,
    title: "Gestão da Clínica",
    description: "É um completo sistema para clínica de estética, médica, odontológica, entre outras especialidades."
  },
  {
    icon: Users,
    title: "Atendimento de pacientes",
    description: "Com o software, a desmarcação de consultas deixa de ser um problema."
  },
  {
    icon: Megaphone,
    title: "Marketing Médico",
    description: "Ferramentas para ampliar sua presença de marca, atrair mais pacientes e fortalecer a relação com seu público."
  }
];

export function QuickFeaturesGrid() {
  return (
    <section className="py-16 lg:py-20 bg-card">
      <div className="container">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickFeatures.map((feature, index) => (
            <div 
              key={index}
              className="bg-background border border-border rounded-2xl p-6 hover:shadow-lg hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 group"
            >
              <div className="w-14 h-14 rounded-xl feature-card-icon mb-4">
                <feature.icon className="h-7 w-7" />
              </div>
              
              <h3 className="text-lg font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {feature.description}
              </p>
              
              <Link 
                to="/cadastro"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:gap-3 transition-all"
              >
                Conheça
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
