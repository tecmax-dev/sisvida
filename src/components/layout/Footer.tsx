import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { MessageCircle, Mail, Shield, Instagram, Linkedin, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Logo size="md" />
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              Sistema completo de agendamento e gestão para clínicas de todas as especialidades.
            </p>
            
            {/* Social Links */}
            <div className="mt-6 flex gap-3">
              <a 
                href="#" 
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a 
                href="#" 
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a 
                href="#" 
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          {/* Product Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Produto</h4>
            <ul className="space-y-3">
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
                <a href="/#specialties" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Especialidades
                </a>
              </li>
              <li>
                <Link to="/ajuda" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Central de Ajuda
                </Link>
              </li>
              <li>
                <Link to="/cadastro" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Criar conta
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Legal Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/lgpd" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link to="/lgpd" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link to="/lgpd" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  LGPD
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Contato</h4>
            <ul className="space-y-3">
              <li>
                <a 
                  href="https://wa.me/5571982786864" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  (71) 98278-6864
                </a>
              </li>
              <li>
                <a 
                  href="mailto:contato@eclini.com.br"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  contato@eclini.com.br
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} Eclini. Todos os direitos reservados.
              </p>
            </div>
            
            {/* Developer credit */}
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
                  className="h-5"
                />
              </a>
            </div>
          </div>
          
          {/* LGPD Compliance */}
          <div className="mt-6 pt-6 border-t border-border/50">
            <div className="flex flex-col md:flex-row justify-center items-center gap-3 text-center">
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-full">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-primary">Em conformidade com a LGPD</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tecmax Tecnologia • CNPJ: 03.025.212/0001-11
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
