import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { Menu, X, LogIn, Play, ArrowRight } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/#features", label: "Recursos" },
  { href: "/#pricing", label: "Preço" },
  { href: "/#contact", label: "Contato" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Top Bar - LGPD Info */}
      <div className="bg-foreground text-background text-xs py-2">
        <div className="container flex items-center justify-center gap-2">
          <span className="opacity-80">
            🔒 Sistema em conformidade com a LGPD - Lei Geral de Proteção de Dados
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-50 w-full bg-card border-b border-border/40 shadow-sm">
        <div className="container flex h-16 items-center justify-between">
          <Logo />

          {/* Desktop Navigation - Center */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location.pathname === link.href 
                    ? "text-foreground" 
                    : "text-muted-foreground"
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Actions - Right */}
          <div className="hidden md:flex items-center gap-3">
            <Button 
              variant="outline" 
              className="border-primary text-primary hover:bg-primary/5 rounded-full px-5"
              asChild
            >
              <Link to="/auth" className="flex items-center gap-2">
                <Play className="h-4 w-4 fill-current" />
                Demonstração
              </Link>
            </Button>
            <Button 
              className="bg-cta hover:bg-cta-hover text-cta-foreground rounded-full px-5 shadow-md"
              asChild
            >
              <Link to="/auth?tab=signup" className="flex items-center gap-2">
                Testar agora
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
          <div className="md:hidden border-t border-border bg-card animate-slide-in-from-top">
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
                  className="border-primary text-primary w-full rounded-full"
                  asChild
                >
                  <Link to="/auth" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center gap-2">
                    <Play className="h-4 w-4 fill-current" />
                    Demonstração
                  </Link>
                </Button>
                <Button 
                  className="bg-cta hover:bg-cta-hover text-cta-foreground w-full rounded-full"
                  asChild
                >
                  <Link to="/auth?tab=signup" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center gap-2">
                    Testar agora
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
