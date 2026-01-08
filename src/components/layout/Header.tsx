import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserMenu } from "./UserMenu";

const navLinks = [
  { href: "/#features", label: "Recursos" },
  { href: "/#specialties", label: "Especialidades" },
  { href: "/#pricing", label: "Planos" },
  { href: "/#faq", label: "Dúvidas" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, isSuperAdmin } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? "bg-card shadow-md border-b border-border/30" 
          : "bg-card/80 backdrop-blur-sm"
      }`}
    >
      <div className="container flex h-16 lg:h-18 items-center justify-between">
        <Logo />

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors"
            >
              {link.label}
            </a>
          ))}
          {user && isSuperAdmin && (
            <Link
              to="/admin"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Actions - Always visible */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <UserMenu onAfterAction={() => setIsMenuOpen(false)} />
              {/* Mobile Menu Button - only for navigation links */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </>
          ) : (
            <>
              {/* Desktop login buttons */}
              <div className="hidden lg:flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  className="text-sm font-medium text-foreground/80 hover:text-primary"
                  asChild
                >
                  <Link to="/auth">
                    Acessar plataforma
                  </Link>
                </Button>
                <Button 
                  className="btn-eclini px-6 font-semibold"
                  asChild
                >
                  <Link to="/cadastro">
                    Começar agora
                  </Link>
                </Button>
              </div>
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden bg-card border-b border-border shadow-lg animate-fade-in">
          <div className="container py-4 space-y-4">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-foreground/80 hover:text-primary hover:bg-primary/5 transition-colors py-3 px-4 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              {user && isSuperAdmin && (
                <Link
                  to="/admin"
                  className="text-sm font-medium text-primary hover:text-primary/80 hover:bg-primary/5 transition-colors py-3 px-4 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
            </nav>
            {!user && (
              <div className="flex flex-col gap-3 pt-4 border-t border-border">
                <Button 
                  variant="outline" 
                  className="w-full rounded-full border-primary/30 text-primary hover:bg-primary/5"
                  asChild
                >
                  <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                    Acessar plataforma
                  </Link>
                </Button>
                <Button 
                  className="btn-eclini w-full font-semibold"
                  asChild
                >
                  <Link to="/cadastro" onClick={() => setIsMenuOpen(false)}>
                    Começar agora
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
