import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { Menu, X, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

const navLinks = [
  { href: "/#features", label: "Recursos" },
  { href: "/#specialties", label: "Especialidades" },
  { href: "/#pricing", label: "Planos" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? "bg-card/95 backdrop-blur-lg border-b border-border/40 shadow-sm" 
          : "bg-transparent"
      }`}
    >
      <div className="container flex h-16 lg:h-20 items-center justify-between">
        <Logo />

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isScrolled ? "text-muted-foreground" : "text-foreground/80"
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Button 
            variant="ghost" 
            className="text-sm font-medium"
            asChild
          >
            <Link to="/auth">
              Entrar
            </Link>
          </Button>
          <Button 
            className="bg-cta hover:bg-cta-hover text-cta-foreground rounded-full px-6 shadow-md transition-all duration-300 hover:scale-105"
            asChild
          >
            <Link to="/auth?tab=signup" className="flex items-center gap-2">
              Começar grátis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-card/95 backdrop-blur-lg border-b border-border animate-fade-in">
          <div className="container py-4 space-y-4">
            <nav className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="flex flex-col gap-2 pt-2">
              <Button 
                variant="outline" 
                className="w-full rounded-full"
                asChild
              >
                <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                  Entrar
                </Link>
              </Button>
              <Button 
                className="bg-cta hover:bg-cta-hover text-cta-foreground w-full rounded-full"
                asChild
              >
                <Link to="/auth?tab=signup" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center gap-2">
                  Começar grátis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
