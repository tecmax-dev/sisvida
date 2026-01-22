import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

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
7️⃣ 2ª via Boleto Empresa

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
  const isMobile = useIsMobile();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendToBooking = async (userMessage: string) => {
    try {
      console.log('[booking] Calling booking-web-chat with:', { userMessage, clinicId });
      
      const { data, error } = await supabase.functions.invoke('booking-web-chat', {
        body: {
          message: userMessage,
          clinic_id: clinicId,
          phone: user?.phone || '5500000000000',
        },
      });

      console.log('[booking] Response:', { data, error });

      if (error) {
        console.error('Error calling booking-web-chat:', error);
        toast.error('Erro no fluxo de agendamento');
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Desculpe, ocorreu um erro. Por favor, digite seu CPF novamente.', isBookingFlow: true },
        ]);
        return;
      }

      if (data?.response) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response, isBookingFlow: true }]);
      }

      if (data?.booking_complete) {
        setIsBookingMode(false);
        toast.success('Agendamento realizado com sucesso!');
      }
    } catch (err) {
      console.error('Error in sendToBooking:', err);
      toast.error('Erro inesperado no agendamento');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Ocorreu um erro. Tente novamente digitando seu CPF.', isBookingFlow: true },
      ]);
    }
  };

  const handleSend = useCallback(async () => {
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
      // Only auto-focus on desktop
      if (!isMobile) {
        inputRef.current?.focus();
      }
    }
  }, [inputValue, isLoading, isBookingMode, messages, clinicId, user, isMobile]);

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

  // Handle touch events for mobile
  const handleTouchSend = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSend();
  }, [handleSend]);

  return (
    <Card className="h-[calc(100dvh-180px)] md:h-[600px] flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Bot className="h-5 w-5" />
            <span className="truncate">LIA - Assistente SECMI</span>
            {isBookingMode && (
              <Badge variant="secondary" className="ml-1 md:ml-2 shrink-0">
                <Calendar className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Agendamento</span>
              </Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={clearChat} className="shrink-0">
            Reiniciar
          </Button>
        </div>
        <p className="text-sm text-muted-foreground hidden md:block">
          Teste o assistente de IA integrado com OpenAI
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden p-0 min-h-0">
        {/* Use native scroll on mobile for better performance */}
        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto px-4 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="space-y-4 py-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-2 md:gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className={`h-7 w-7 md:h-8 md:w-8 rounded-full flex items-center justify-center shrink-0 ${
                    message.isBookingFlow ? 'bg-green-500/10' : 'bg-primary/10'
                  }`}>
                    {message.isBookingFlow ? (
                      <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-600" />
                    ) : (
                      <Bot className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                    )}
                  </div>
                )}
                <div
                  className={`rounded-lg px-3 py-2 md:px-4 max-w-[85%] md:max-w-[80%] ${
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
                  <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 md:gap-3 justify-start">
                <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                </div>
                <div className="rounded-lg px-3 py-2 md:px-4 bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 md:p-4 border-t shrink-0">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isBookingMode ? "Digite seu CPF ou resposta..." : "Digite o número da opção..."}
              disabled={isLoading}
              className="flex-1 text-base"
              inputMode="text"
              enterKeyHint="send"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
            />
            <Button
              type="button"
              onClick={handleSend}
              onTouchEnd={handleTouchSend}
              disabled={!inputValue.trim() || isLoading}
              size="icon"
              className="shrink-0 h-10 w-10 touch-manipulation"
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
