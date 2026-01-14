import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Globe, Phone, Mail, MapPin } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const APP_VERSION = "1.0.0";

export default function MobileAboutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4 sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold">Sobre</h1>
      </header>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Logo and App Info */}
        <div className="text-center py-6">
          <div className="w-24 h-24 bg-emerald-100 rounded-2xl mx-auto flex items-center justify-center mb-4">
            <img 
              src="/logo-sindicato.png" 
              alt="SECMI" 
              className="w-16 h-16 object-contain"
              onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
            />
          </div>
          <h2 className="text-xl font-bold text-foreground">SECMI</h2>
          <p className="text-sm text-muted-foreground">Sindicato dos Empregados no Comércio</p>
          <p className="text-xs text-muted-foreground mt-2">Versão {APP_VERSION}</p>
        </div>

        <Separator />

        {/* About */}
        <div>
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            Sobre o Sindicato
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O SECMI - Sindicato dos Empregados no Comércio é uma entidade sindical que representa 
            e defende os interesses dos trabalhadores do comércio. Há décadas trabalhando em prol 
            da categoria, oferecemos diversos benefícios e serviços aos nossos associados.
          </p>
        </div>

        <Separator />

        {/* Contact Info */}
        <div>
          <h3 className="font-semibold text-foreground mb-3">Contato</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Endereço</p>
                <p className="text-sm text-muted-foreground">
                  Rua Exemplo, 123 - Centro<br />
                  Cidade - BA, 12345-678
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-foreground">Telefone</p>
                <p className="text-sm text-muted-foreground">(73) 9999-9999</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-foreground">E-mail</p>
                <p className="text-sm text-muted-foreground">contato@secmi.org.br</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-foreground">Website</p>
                <p className="text-sm text-muted-foreground">www.secmi.org.br</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Developer */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Desenvolvido por
          </p>
          <p className="text-sm font-medium text-foreground">
            I & B Tecnologia
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            © 2026 Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
