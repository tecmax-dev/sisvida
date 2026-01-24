import { useNavigate } from "react-router-dom";
import { ArrowLeft, Target, Eye, Award, Phone, Mail, MapPin, Globe, Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

const APP_VERSION = "1.0.0";

export default function MobileAboutPage() {
  const navigate = useNavigate();

  const principles = [
    {
      icon: Target,
      title: "Missão",
      description: "Representar, defender e promover os interesses dos trabalhadores do comércio, lutando por melhores condições de trabalho, salários dignos e justiça social.",
      color: "text-rose-500",
      bgColor: "bg-rose-100"
    },
    {
      icon: Eye,
      title: "Visão",
      description: "Ser reconhecido como o sindicato mais atuante e eficaz na defesa dos comerciários, promovendo o desenvolvimento sustentável da categoria.",
      color: "text-blue-500",
      bgColor: "bg-blue-100"
    },
    {
      icon: Award,
      title: "Valores",
      description: "Transparência, ética, solidariedade, democracia participativa e compromisso inabalável com a justiça social e os direitos trabalhistas.",
      color: "text-amber-500",
      bgColor: "bg-amber-100"
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4 sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold">Sobre Nós</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Nossa História */}
        <section className="p-4 space-y-4">
          <h2 className="text-xl font-bold text-foreground">Nossa História</h2>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Fundado em 1937, o Sindicato dos Comerciários de Ilhéus e Região (SECMI) representa os 
              interesses dos trabalhadores do comércio há mais de 88 anos.
            </p>
            
            <div className="w-full h-40 bg-emerald-100 rounded-xl flex items-center justify-center overflow-hidden">
              <Users className="h-16 w-16 text-emerald-600" />
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nossa missão é defender os direitos trabalhistas, promover melhorias nas condições de 
              trabalho e oferecer benefícios que melhorem a qualidade de vida dos associados.
            </p>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              Atuamos em diversas frentes, desde negociações coletivas até a oferta de serviços de 
              saúde, educação e assistência jurídica.
            </p>
          </div>
        </section>

        <Separator className="mx-4" />

        {/* Nossos Princípios */}
        <section className="p-4 space-y-4">
          <h2 className="text-xl font-bold text-foreground text-center">Nossos Princípios</h2>
          
          <div className="grid gap-4">
            {principles.map((principle, index) => (
              <Card key={index} className="border-0 shadow-sm">
                <CardContent className="p-4 text-center space-y-3">
                  <div className={`w-12 h-12 ${principle.bgColor} rounded-full flex items-center justify-center mx-auto`}>
                    <principle.icon className={`h-6 w-6 ${principle.color}`} />
                  </div>
                  <h3 className="font-semibold text-foreground">{principle.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {principle.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="mx-4" />

        {/* Contato */}
        <section className="p-4 space-y-4">
          <h2 className="text-xl font-bold text-foreground">Contato</h2>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Endereço</p>
                <p className="text-sm text-muted-foreground">
                  Rua Exemplo, 123 - Centro<br />
                  Ilhéus - BA, 45650-000
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Telefone</p>
                <p className="text-sm text-muted-foreground">(73) 3231-0000</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">E-mail</p>
                <p className="text-sm text-muted-foreground">contato@secmi.org.br</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Website</p>
                <p className="text-sm text-muted-foreground">www.secmi.org.br</p>
              </div>
            </div>
          </div>
        </section>

        <Separator className="mx-4" />

        {/* App Info & Developer */}
        <section className="p-4 pb-8 text-center space-y-4">
          <div>
            <div className="w-16 h-16 bg-emerald-100 rounded-xl mx-auto flex items-center justify-center mb-2">
              <img 
                src="/logo-sindicato.png" 
                alt="SECMI" 
                className="w-10 h-10 object-contain"
                onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Versão {APP_VERSION}</p>
          </div>
          
          <div>
            <p className="text-xs text-muted-foreground">Desenvolvido por</p>
            <p className="text-sm font-medium text-foreground">Tecmax Tecnologia</p>
            <p className="text-xs text-muted-foreground mt-1">
              © 2026 Todos os direitos reservados
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
