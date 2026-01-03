import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWhatsAppModuleAccess } from '@/hooks/useWhatsAppMultiattendance';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, MessageSquare, Users, Settings, Zap, LayoutGrid } from 'lucide-react';
import { ChatLayout } from '@/components/whatsapp-multiattendance/ChatLayout';
import { OperatorsPanel } from '@/components/whatsapp-multiattendance/OperatorsPanel';
import { SectorsPanel } from '@/components/whatsapp-multiattendance/SectorsPanel';
import { QuickRepliesPanel } from '@/components/whatsapp-multiattendance/QuickRepliesPanel';
import { ModuleSettingsPanel } from '@/components/whatsapp-multiattendance/ModuleSettingsPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

export default function WhatsAppMultiattendancePage() {
  const { currentClinic } = useAuth();
  const clinicId = currentClinic?.id;
  const { hasAccess, isLoading } = useWhatsAppModuleAccess(clinicId);
  const [activeTab, setActiveTab] = useState('chat');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container max-w-2xl py-12">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Multiatendimento WhatsApp</CardTitle>
            <CardDescription>
              Este módulo permite múltiplos operadores atenderem simultaneamente via WhatsApp,
              com gestão de filas, setores e Kanban de tickets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-left text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Múltiplos operadores</span>
              </div>
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span>Kanban de tickets</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span>Respostas rápidas</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span>Histórico completo</span>
              </div>
            </div>
            <Button className="mt-4">
              Solicitar Ativação
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Multiatendimento WhatsApp</h1>
        <p className="text-muted-foreground">
          Gerencie atendimentos, operadores e filas
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversas
          </TabsTrigger>
          <TabsTrigger value="operators" className="gap-2">
            <Users className="h-4 w-4" />
            Operadores
          </TabsTrigger>
          <TabsTrigger value="sectors" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Setores
          </TabsTrigger>
          <TabsTrigger value="quick-replies" className="gap-2">
            <Zap className="h-4 w-4" />
            Respostas Rápidas
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
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
