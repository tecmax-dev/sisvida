import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { Menu, X, LogIn } from "lucide-react";
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
  const isLanding = location.pathname === "/";

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-border/40">
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
                  ? "text-foreground border-b-2 border-primary pb-0.5" 
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
            variant="default" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6"
            asChild
          >
            <Link to="/auth" className="flex items-center gap-2">
              Sou Cliente (Entrar)
              <LogIn className="h-4 w-4" />
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
        <div className="md:hidden border-t border-border bg-white animate-slide-in-from-top">
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
                variant="default" 
                className="bg-primary hover:bg-primary/90 w-full rounded-full"
                asChild
              >
                <Link to="/auth" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center gap-2">
                  Sou Cliente (Entrar)
                  <LogIn className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
