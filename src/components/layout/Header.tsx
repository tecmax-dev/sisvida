import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserMenu } from "./UserMenu";

const navLinks = [
   { href: "/clinica", label: "Clínica" },
   { href: "/sindicato-saas", label: "Sindicato" },
   { href: "/#pricing", label: "Planos" },
   { href: "/#faq", label: "FAQ" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, isSuperAdmin, isUnionEntityAdmin, userRoles, loading, rolesLoaded } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !rolesLoaded) return;
    if (location.pathname !== "/") return;
    if (user) {
      if (isSuperAdmin) {
        navigate("/admin", { replace: true });
      } else if (userRoles.length > 0) {
        navigate("/dashboard", { replace: true });
      } else if (isUnionEntityAdmin) {
        navigate("/union", { replace: true });
      } else {
        navigate("/clinic-setup", { replace: true });
      }
    }
  }, [user, isSuperAdmin, isUnionEntityAdmin, userRoles, loading, rolesLoaded, navigate, location.pathname]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-card/95 backdrop-blur-lg shadow-sm border-b border-border/80"
          : "bg-transparent"
      }`}
    >
      <div className="container flex h-16 lg:h-20 items-center justify-between px-4 sm:px-6">
        <Logo />

        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-foreground/70 hover:text-primary px-4 py-2 rounded-lg hover:bg-primary/5 transition-all"
            >
              {link.label}
            </a>
          ))}
          {user && isSuperAdmin && (
            <Link
              to="/admin"
              className="text-sm font-medium text-primary px-4 py-2 rounded-lg hover:bg-primary/5 transition-all"
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <UserMenu onAfterAction={() => setIsMenuOpen(false)} />
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </>
          ) : (
            <>
              <div className="hidden lg:flex items-center gap-3">
                <Button variant="ghost" className="text-sm font-medium" asChild>
                  <Link to="/auth">Entrar</Link>
                </Button>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6 text-sm font-semibold shadow-md" asChild>
                  <a href="https://wa.me/551151943839?text=Ol%C3%A1!%20Quero%20recuperar%20arquivos%20enviados%20que%20não%20aparecem." target="_blank" rel="noopener noreferrer">Recuperar Arquivos</a>
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </>
          )}
        </div>
      </div>

      {isMenuOpen && (
        <div className="lg:hidden bg-card border-b border-border shadow-lg animate-fade-in">
          <div className="container py-6 space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block text-sm font-medium text-foreground/80 hover:text-primary py-3 px-4 rounded-xl hover:bg-primary/5 transition-all"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            {!user && (
              <div className="flex flex-col gap-3 pt-4 mt-2 border-t border-border">
                <Button className="w-full bg-primary text-primary-foreground rounded-full font-semibold" asChild>
                  <a href="https://wa.me/551151943839?text=Ol%C3%A1!%20Quero%20testar%20o%20Prosinge%20gratuitamente." target="_blank" rel="noopener noreferrer" onClick={() => setIsMenuOpen(false)}>
                    Solicitar Demo
                  </a>
                </Button>
                <Button variant="outline" className="w-full rounded-full" asChild>
                  <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                    Entrar
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
