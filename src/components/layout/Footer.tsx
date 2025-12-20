import { Logo } from "./Logo";
import { MessageCircle, Mail, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Logo size="md" />
            <p className="mt-4 text-sm text-muted-foreground max-w-md">
              Sistema de agendamento e gestão para clínicas. Simplifique sua recepção, 
              reduza faltas e melhore a experiência dos seus pacientes.
            </p>
            <div className="mt-4 space-y-2">
              <a 
                href="https://wa.me/5571982786864" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                (71) 98278-6864
              </a>
              <a 
                href="mailto:contato@eclini.com.br"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-4 w-4" />
                contato@eclini.com.br
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-foreground mb-4">Produto</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="/#features" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Recursos
                </a>
              </li>
              <li>
                <a href="/#pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Preços
                </a>
              </li>
              <li>
                <a href="/#contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Contato
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Termos de Uso
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Política de Privacidade
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  LGPD
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-10 pt-6 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Eclini. Todos os direitos reservados.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              CNPJ: 03.025.212/0001-11
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Desenvolvido por</span>
            <a
              href="https://danielasales.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <img
                src="https://danielasales.com/assets/logo-tecmax-DxAeqUGw.png"
                alt="Tecmax Tecnologia"
                className="h-6"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
