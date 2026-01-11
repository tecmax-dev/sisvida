import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Loader2, LogIn, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function UnionEntityLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      // Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Check if user is a union entity admin
      const { data: entityData, error: entityError } = await supabase
        .from('union_entities')
        .select('id, status, razao_social')
        .eq('user_id', authData.user.id)
        .single();

      if (entityError || !entityData) {
        await supabase.auth.signOut();
        throw new Error('Acesso não autorizado. Esta conta não está vinculada a uma entidade sindical.');
      }

      if (entityData.status !== 'ativa') {
        await supabase.auth.signOut();
        const statusMessages = {
          suspensa: 'Sua conta está suspensa. Entre em contato com o suporte.',
          em_analise: 'Sua conta ainda está em análise. Aguarde a aprovação.',
          inativa: 'Sua conta está inativa. Entre em contato com o suporte.'
        };
        throw new Error(statusMessages[entityData.status as keyof typeof statusMessages] || 'Conta não ativa');
      }

      // Update last access
      await supabase
        .from('union_entities')
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq('id', entityData.id);

      toast.success(`Bem-vindo, ${entityData.razao_social}!`);
      
      // Redirect to union module
      navigate('/union');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
          <CardHeader className="space-y-4 text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">
                Acesso Entidade Sindical
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Portal exclusivo para sindicatos, federações e confederações
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="pt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail Institucional</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contato@sindicato.org.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Entrar
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Não possui uma conta?{" "}
                <Link to="/sindical" className="text-emerald-600 hover:underline font-medium">
                  Conheça nosso sistema
                </Link>
              </p>
              
              <Link 
                to="/" 
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar ao início
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-white/60 text-sm mt-6">
          Sistema de Gestão Sindical
        </p>
      </div>
    </div>
  );
}
