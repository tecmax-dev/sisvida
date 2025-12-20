import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Share, Plus, MoreVertical, Home, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function InstallPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Instale o Eclini
          </h1>
          <p className="text-muted-foreground">
            Tenha acesso rápido ao sistema diretamente da sua tela inicial
          </p>
        </div>

        <div className="space-y-6">
          {/* Android Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <span className="text-green-600 font-bold text-sm">A</span>
                </div>
                Android (Chrome)
              </CardTitle>
              <CardDescription>
                Siga os passos abaixo para instalar no seu dispositivo Android
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">1</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Abra o menu do navegador</p>
                  <p className="text-sm text-muted-foreground">
                    Toque nos três pontos <MoreVertical className="inline h-4 w-4" /> no canto superior direito
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Selecione "Adicionar à tela inicial"</p>
                  <p className="text-sm text-muted-foreground">
                    Ou "Instalar aplicativo" se disponível
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Confirme a instalação</p>
                  <p className="text-sm text-muted-foreground">
                    O ícone do Eclini aparecerá na sua tela inicial
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* iOS Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center">
                  <span className="text-gray-600 font-bold text-sm">🍎</span>
                </div>
                iPhone / iPad (Safari)
              </CardTitle>
              <CardDescription>
                Siga os passos abaixo para instalar no seu dispositivo iOS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">1</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Abra no Safari</p>
                  <p className="text-sm text-muted-foreground">
                    A instalação funciona apenas no navegador Safari
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Toque no botão Compartilhar</p>
                  <p className="text-sm text-muted-foreground">
                    O ícone <Share className="inline h-4 w-4" /> na barra inferior do Safari
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Selecione "Adicionar à Tela de Início"</p>
                  <p className="text-sm text-muted-foreground">
                    Role para baixo se necessário para encontrar a opção <Plus className="inline h-4 w-4" />
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">4</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Confirme tocando em "Adicionar"</p>
                  <p className="text-sm text-muted-foreground">
                    O ícone do Eclini aparecerá na sua tela inicial
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Benefits */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Home className="h-5 w-5" />
                Benefícios do App
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Acesso rápido pela tela inicial
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Experiência em tela cheia, sem barra do navegador
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Carregamento mais rápido com cache offline
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Funciona como um aplicativo nativo
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="text-center">
            <Button asChild size="lg">
              <Link to="/auth">
                Acessar o Sistema
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
