import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { Menu, X, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";

const navLinks = [
  { href: "/#features", label: "Recursos" },
  { href: "/#specialties", label: "Especialidades" },
  { href: "/#pricing", label: "Planos" },
  { href: "/#faq", label: "Dúvidas" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

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
        </nav>

        {/* Desktop Actions */}
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
            className="bg-primary hover:bg-primary-dark text-primary-foreground rounded-full px-6 font-semibold shadow-md transition-all duration-300 hover:shadow-lg"
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
            </nav>
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
                className="bg-primary hover:bg-primary-dark text-primary-foreground w-full rounded-full font-semibold"
                asChild
              >
                <Link to="/cadastro" onClick={() => setIsMenuOpen(false)}>
                  Começar agora
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
