import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { MessageCircle, Mail, Shield, Instagram, Linkedin, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-14 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          <div>
            <Logo size="md" />
            <p className="mt-4 text-sm text-muted-foreground max-w-xs leading-relaxed">
              Sistema completo de gestão para sindicatos, associações e federações de todo o Brasil.
            </p>
            <div className="mt-6 flex gap-2">
              {[
                { icon: Instagram, label: "Instagram" },
                { icon: Linkedin, label: "LinkedIn" },
                { icon: Youtube, label: "YouTube" },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/50 hover:bg-primary/10 transition-colors"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4 text-sm">Produto</h4>
            <ul className="space-y-3">
              {[
                 { href: "/#features", label: "Funcionalidades" },
                 { href: "/apresentacao-clinica", label: "Módulo Clínica" },
                 { href: "/#pricing", label: "Planos" },
                 { href: "https://wa.me/5571982786864?text=Ol%C3%A1!%20Quero%20solicitar%20uma%20demo%20do%20Prosinge.", label: "Solicitar Demo", external: true },
                 { href: "/ajuda", label: "Central de Ajuda" },
              ].map((link) => (
                 <li key={link.href}>
                   <a
                     href={link.href}
                     {...((link as any).external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                     className="text-sm text-muted-foreground hover:text-primary transition-colors"
                   >
                     {link.label}
                   </a>
                 </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4 text-sm">Legal</h4>
            <ul className="space-y-3">
              {[
                { to: "/lgpd", label: "Termos de Uso" },
                { to: "/lgpd", label: "Política de Privacidade" },
                { to: "/lgpd", label: "LGPD" },
              ].map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4 text-sm">Contato</h4>
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
                  href="mailto:contato@prosinge.com.br"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  contato@prosinge.com.br
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground">
               © 2025 Prosinge — Todos os direitos reservados
            </p>
            <p className="text-xs text-muted-foreground">
              CNPJ: 03.025.212/0001-11
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              <span>Em conformidade com a LGPD</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
