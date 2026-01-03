import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWhatsAppModuleAccess } from '@/hooks/useWhatsAppMultiattendance';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  MessageCircle, 
  Users2, 
  Settings2, 
  Zap, 
  Grid3X3,
  Lock,
  MessageSquareDashed,
  LayoutDashboard,
  Bot,
  Sparkles
} from 'lucide-react';
import { ChatLayout } from '@/components/whatsapp-multiattendance/ChatLayout';
import { OperatorsPanel } from '@/components/whatsapp-multiattendance/OperatorsPanel';
import { SectorsPanel } from '@/components/whatsapp-multiattendance/SectorsPanel';
import { QuickRepliesPanel } from '@/components/whatsapp-multiattendance/QuickRepliesPanel';
import { ModuleSettingsPanel } from '@/components/whatsapp-multiattendance/ModuleSettingsPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function WhatsAppMultiattendancePage() {
  const { currentClinic } = useAuth();
  const clinicId = currentClinic?.id;
  const { hasAccess, isLoading } = useWhatsAppModuleAccess(clinicId);
  const [activeTab, setActiveTab] = useState('chat');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-2xl shadow-lg">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground font-medium">Carregando módulo...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container max-w-3xl py-8 md:py-12">
        <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-background via-background to-green-50/30 dark:to-green-950/10">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-green-500/10 to-emerald-500/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
          
          <CardHeader className="text-center relative pb-2">
            <div className="mx-auto mb-6 relative">
              <div className="absolute inset-0 bg-green-500/20 rounded-3xl blur-xl animate-pulse" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <Lock className="h-9 w-9 text-white" />
              </div>
            </div>
            <Badge variant="secondary" className="mb-3 bg-green-100 text-green-700 hover:bg-green-100 w-fit mx-auto">
              <Sparkles className="h-3 w-3 mr-1" />
              Módulo Premium
            </Badge>
            <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Multiatendimento WhatsApp
            </CardTitle>
            <CardDescription className="text-base md:text-lg mt-2 max-w-lg mx-auto">
              Atenda múltiplos clientes simultaneamente com gestão inteligente de filas, setores e Kanban de tickets
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Users2, title: 'Múltiplos operadores', desc: 'Equipe atendendo em paralelo', color: 'from-blue-500 to-indigo-600' },
                { icon: LayoutDashboard, title: 'Kanban de tickets', desc: 'Visão geral organizada', color: 'from-purple-500 to-pink-600' },
                { icon: MessageSquareDashed, title: 'Respostas rápidas', desc: 'Templates personalizáveis', color: 'from-orange-500 to-amber-600' },
                { icon: Bot, title: 'Chatbot integrado', desc: 'Automação inteligente', color: 'from-cyan-500 to-teal-600' },
              ].map((feature, i) => (
                <div 
                  key={i} 
                  className="group flex items-start gap-4 p-4 rounded-xl bg-card/60 backdrop-blur-sm border border-border/50 hover:border-green-500/30 hover:shadow-md transition-all duration-300"
                >
                  <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-foreground">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/25 text-white font-semibold">
                <Sparkles className="h-4 w-4 mr-2" />
                Solicitar Ativação
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com gradiente */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-6 md:p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width='30' height='30' viewBox='0 0 30 30' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10h10v10H0V10zM10 0h10v10H10V0z' fill='%23ffffff' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E')]" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <MessageCircle className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Multiatendimento WhatsApp</h1>
              <p className="text-white/80 text-sm md:text-base mt-1">
                Gerencie atendimentos, operadores e filas de forma inteligente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border-0">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
              Online
            </Badge>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full md:w-auto flex flex-wrap gap-1 h-auto p-1.5 bg-muted/60 rounded-xl">
          <TabsTrigger 
            value="chat" 
            className="flex-1 md:flex-none gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg px-4 py-2.5 font-medium transition-all"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Conversas</span>
          </TabsTrigger>
          <TabsTrigger 
            value="operators" 
            className="flex-1 md:flex-none gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg px-4 py-2.5 font-medium transition-all"
          >
            <Users2 className="h-4 w-4" />
            <span className="hidden sm:inline">Operadores</span>
          </TabsTrigger>
          <TabsTrigger 
            value="sectors" 
            className="flex-1 md:flex-none gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg px-4 py-2.5 font-medium transition-all"
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="hidden sm:inline">Setores</span>
          </TabsTrigger>
          <TabsTrigger 
            value="quick-replies" 
            className="flex-1 md:flex-none gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg px-4 py-2.5 font-medium transition-all"
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Respostas Rápidas</span>
          </TabsTrigger>
          <TabsTrigger 
            value="settings" 
            className="flex-1 md:flex-none gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-600 data-[state=active]:to-slate-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg px-4 py-2.5 font-medium transition-all"
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Configurações</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-0">
          <ChatLayout clinicId={clinicId} />
        </TabsContent>

        <TabsContent value="operators" className="space-y-4">
          <OperatorsPanel clinicId={clinicId} />
        </TabsContent>

        <TabsContent value="sectors" className="space-y-4">
          <SectorsPanel clinicId={clinicId} />
        </TabsContent>

        <TabsContent value="quick-replies" className="space-y-4">
          <QuickRepliesPanel clinicId={clinicId} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <ModuleSettingsPanel clinicId={clinicId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
