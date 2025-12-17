import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Logo size="md" />
            <p className="mt-4 text-sm text-muted-foreground max-w-md">
              Sistema de agendamento e gestão para clínicas. Simplifique sua recepção, 
              reduza faltas e melhore a experiência dos seus pacientes.
            </p>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>CNPJ: 03.025.212/0001-11</p>
              <p>Contato: (71) 98238-6864</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-sm mb-4">Produto</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Funcionalidades
                </a>
              </li>
              <li>
                <a href="/#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Planos
                </a>
              </li>
              <li>
                <a href="/#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Contato
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Termos de Uso
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Política de Privacidade
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-10 pt-6 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Eclini. Todos os direitos reservados.
          </p>
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
