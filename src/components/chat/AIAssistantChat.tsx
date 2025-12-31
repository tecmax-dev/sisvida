import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isBookingFlow?: boolean;
}

interface AIAssistantChatProps {
  clinicId: string;
}

const WELCOME_MESSAGE = `Olá, tudo bem? 👋 Sou LIA, assistente virtual SECMI. Estou aqui para auxiliar você!

1️⃣ Atendimento Associado
2️⃣ Atendimento Empresa
3️⃣ Atendimento Contabilidade
4️⃣ Dia do Comerciário
5️⃣ Outros Assuntos
6️⃣ Agendar Consultas

Digite o número da opção desejada:`;

export const AIAssistantChat = ({ clinicId }: AIAssistantChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME_MESSAGE }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBookingMode, setIsBookingMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendToBooking = async (userMessage: string) => {
    const { data, error } = await supabase.functions.invoke('booking-web-chat', {
      body: {
        message: userMessage,
        clinic_id: clinicId,
        phone: user?.phone || '5500000000000',
      },
    });

    if (error) {
      console.error('Error calling booking-web-chat:', error);
      toast.error('Erro no fluxo de agendamento');
      return;
    }

    if (data?.response) {
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response, isBookingFlow: true }]);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // Add user message to chat
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      if (isBookingMode) {
        await sendToBooking(userMessage);
        return;
      }

      // Build conversation history for context (exclude initial welcome message for API)
      const conversationHistory = newMessages
        .slice(1)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      const { data, error } = await supabase.functions.invoke('whatsapp-ai-assistant', {
        body: {
          message: userMessage,
          clinic_id: clinicId,
          phone: user?.phone || '5500000000000',
          conversation_history: conversationHistory.slice(0, -1),
        },
      });

      if (error) {
        console.error('Error calling AI assistant:', error);
        toast.error('Erro ao comunicar com o assistente');
        return;
      }

      // Check if we should handoff to booking flow
      if (data?.handoff_to_booking) {
        setIsBookingMode(true);
        await sendToBooking('');
        return;
      }

      // Add assistant response
      if (data?.response) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao processar mensagem');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }]);
    setIsBookingMode(false);
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            LIA - Assistente SECMI
            {isBookingMode && (
              <Badge variant="secondary" className="ml-2">
                <Calendar className="h-3 w-3 mr-1" />
                Agendamento
              </Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={clearChat}>
            Reiniciar
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Teste o assistente de IA integrado com OpenAI
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
        <ScrollArea ref={scrollRef} className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    message.isBookingFlow ? 'bg-green-500/10' : 'bg-primary/10'
                  }`}>
                    {message.isBookingFlow ? (
                      <Calendar className="h-4 w-4 text-green-600" />
                    ) : (
                      <Bot className="h-4 w-4 text-primary" />
                    )}
                  </div>
                )}
                <div
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.isBookingFlow
                        ? 'bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800'
                        : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-lg px-4 py-2 bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isBookingMode ? "Digite seu CPF ou resposta..." : "Digite o número da opção ou sua mensagem..."}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
