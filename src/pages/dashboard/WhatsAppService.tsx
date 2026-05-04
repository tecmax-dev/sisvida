 import { useState, useEffect, useRef } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { useToast } from "@/hooks/use-toast";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Badge } from "@/components/ui/badge";
 import { Card } from "@/components/ui/card";
import { 
  MessageSquare, 
  Send, 
  User, 
  Clock, 
  CheckCircle2, 
  Bot, 
  Search,
  Loader2,
  MoreVertical,
  Phone,
  Check,
  CheckCheck,
  FileText
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import { cn } from "@/lib/utils";
 
 interface Contact {
   id: string;
   name: string | null;
   phone: string;
 }
 
 interface Ticket {
   id: string;
   status: string;
   subject: string | null;
   last_message: string | null;
   last_message_at: string | null;
   is_bot_active: boolean;
   contact: Contact;
   unread_count: number;
 }
 
interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_type: string;
  sender_name: string | null;
  message_type: string;
  content: string | null;
  created_at: string;
  is_read: boolean;
}
 
 export default function WhatsAppService() {
   const { currentClinic, user } = useAuth();
   const { toast } = useToast();
   const [tickets, setTickets] = useState<Ticket[]>([]);
   const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
   const [messages, setMessages] = useState<Message[]>([]);
   const [newMessage, setNewMessage] = useState("");
   const [loading, setLoading] = useState(true);
   const [loadingMessages, setLoadingMessages] = useState(false);
   const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
    const [showTemplateDialog, setShowTemplateDialog] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    // Load templates
    useEffect(() => {
      if (showTemplateDialog) {
        loadTemplates();
      }
    }, [showTemplateDialog]);

    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const { data, error } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('status', 'approved')
          .order('name');
        
        if (error) throw error;
        setTemplates(data || []);
      } catch (err) {
        console.error("Error loading templates:", err);
      } finally {
        setLoadingTemplates(false);
      }
    };

    const handleSendTemplate = async (template: WhatsAppTemplate) => {
      if (!selectedTicket || sending) return;
      
      setSending(true);
      try {
        const { error } = await supabase.functions.invoke('meta-send-template', {
          body: {
            to: selectedTicket.contact.phone,
            template_name: template.name,
            language_code: 'pt_BR',
            ticket_id: selectedTicket.id
          }
        });

        if (error) throw error;
        
        setShowTemplateDialog(false);
        toast({
          title: "Template enviado",
          description: "O modelo de reativação foi enviado com sucesso."
        });
      } catch (err: any) {
        console.error("Error sending template:", err);
        toast({
          title: "Erro ao enviar template",
          description: err.message || "Tente novamente mais tarde.",
          variant: "destructive"
        });
      } finally {
        setSending(false);
      }
    };

   const scrollRef = useRef<HTMLDivElement>(null);
 
   const selectedTicket = tickets.find(t => t.id === selectedTicketId);
 
   // Load tickets
   useEffect(() => {
     if (!currentClinic?.id) return;
     loadTickets();
 
     // Real-time subscription for tickets
     const channel = supabase
       .channel('whatsapp_tickets_changes')
       .on('postgres_changes', { 
         event: '*', 
         schema: 'public', 
         table: 'whatsapp_tickets',
         filter: `clinic_id=eq.${currentClinic.id}`
       }, () => {
         loadTickets();
       })
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [currentClinic?.id]);
 
   // Load messages when ticket is selected
   useEffect(() => {
     if (!selectedTicketId) return;
     loadMessages(selectedTicketId);
 
     // Real-time subscription for messages
     const channel = supabase
       .channel(`ticket_messages_${selectedTicketId}`)
       .on('postgres_changes', { 
         event: 'INSERT', 
         schema: 'public', 
         table: 'whatsapp_ticket_messages',
         filter: `ticket_id=eq.${selectedTicketId}`
       }, (payload) => {
         setMessages(prev => [...prev, payload.new as Message]);
         scrollToBottom();
       })
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [selectedTicketId]);
 
   useEffect(() => {
     scrollToBottom();
   }, [messages]);
 
   const scrollToBottom = () => {
     if (scrollRef.current) {
       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
     }
   };
 
   const loadTickets = async () => {
     try {
       const { data, error } = await supabase
         .from('whatsapp_tickets')
         .select(`
           *,
           contact:whatsapp_contacts(*)
         `)
         .eq('clinic_id', currentClinic?.id)
         .order('last_message_at', { ascending: false });
 
       if (error) throw error;
       setTickets(data || []);
     } catch (err) {
       console.error("Error loading tickets:", err);
     } finally {
       setLoading(false);
     }
   };
 
   const loadMessages = async (ticketId: string) => {
     setLoadingMessages(true);
     try {
       const { data, error } = await supabase
         .from('whatsapp_ticket_messages')
         .select('*')
         .eq('ticket_id', ticketId)
         .order('created_at', { ascending: true });
 
       if (error) throw error;
       setMessages(data || []);
       
       // Mark as read
       await supabase
         .from('whatsapp_tickets')
         .update({ unread_count: 0 })
         .eq('id', ticketId);
         
     } catch (err) {
       console.error("Error loading messages:", err);
     } finally {
       setLoadingMessages(false);
     }
   };
 
   const handleSendMessage = async (e?: React.FormEvent) => {
     if (e) e.preventDefault();
     if (!newMessage.trim() || !selectedTicket || sending) return;
 
     setSending(true);
     try {
       const { data, error } = await supabase.functions.invoke('meta-send-text', {
         body: {
           to: selectedTicket.contact.phone,
           text: newMessage,
           ticket_id: selectedTicket.id
         }
       });
 
       if (error) throw error;
       
       setNewMessage("");
     } catch (err: any) {
       console.error("Error sending message:", err);
       toast({
         title: "Erro ao enviar mensagem",
         description: err.message === "WINDOW_CLOSED" 
           ? "A janela de 24h está fechada. Envie um template para reabrir."
           : "Tente novamente mais tarde.",
         variant: "destructive"
       });
     } finally {
       setSending(false);
     }
   };
 
   const toggleBot = async (ticketId: string, currentStatus: boolean) => {
     try {
       const { error } = await supabase
         .from('whatsapp_tickets')
         .update({ is_bot_active: !currentStatus })
         .eq('id', ticketId);
       
       if (error) throw error;
       
       toast({
         title: !currentStatus ? "Robô ativado" : "Atendimento humano ativado",
         description: !currentStatus ? "A Lia assumiu o atendimento." : "O robô foi pausado para intervenção humana."
       });
     } catch (err) {
       console.error("Error toggling bot:", err);
     }
   };
 
   const closeTicket = async (ticketId: string) => {
     try {
       const { error } = await supabase
         .from('whatsapp_tickets')
         .update({ status: 'closed', closed_at: new Date().toISOString() })
         .eq('id', ticketId);
       
       if (error) throw error;
       
       toast({
         title: "Ticket finalizado",
         description: "A conversa foi marcada como concluída."
       });
       setSelectedTicketId(null);
     } catch (err) {
       console.error("Error closing ticket:", err);
     }
   };
 
   const filteredTickets = tickets.filter(t => 
     t.contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     t.contact.phone.includes(searchTerm) ||
     t.last_message?.toLowerCase().includes(searchTerm.toLowerCase())
   );
 
   if (loading) {
     return (
       <div className="flex h-[calc(100vh-64px)] items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   return (
     <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-background">
       {/* Ticket List Sidebar */}
       <div className="w-80 border-r flex flex-col bg-card">
         <div className="p-4 border-b">
           <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
             <MessageSquare className="h-5 w-5 text-primary" />
             Atendimento WhatsApp
           </h1>
           <div className="relative">
             <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input 
               placeholder="Buscar conversas..." 
               className="pl-8"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
         </div>
 
         <ScrollArea className="flex-1">
           <div className="divide-y">
             {filteredTickets.map((ticket) => (
               <button
                 key={ticket.id}
                 onClick={() => setSelectedTicketId(ticket.id)}
                 className={cn(
                   "w-full p-4 text-left hover:bg-accent/50 transition-colors flex flex-col gap-1",
                   selectedTicketId === ticket.id && "bg-accent"
                 )}
               >
                 <div className="flex justify-between items-start">
                   <span className="font-semibold truncate">
                     {ticket.contact.name || "Sem nome"}
                   </span>
                   <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                     {ticket.last_message_at ? format(new Date(ticket.last_message_at), 'HH:mm', { locale: ptBR }) : ''}
                   </span>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                     {ticket.last_message}
                   </span>
                   <div className="flex gap-1">
                     {ticket.unread_count > 0 && (
                       <Badge className="h-4 min-w-4 px-1 flex items-center justify-center">
                         {ticket.unread_count}
                       </Badge>
                     )}
                     {!ticket.is_bot_active && (
                       <Badge variant="secondary" className="h-4 text-[10px]">Humano</Badge>
                     )}
                   </div>
                 </div>
                 <div className="text-[10px] text-muted-foreground">
                   {ticket.contact.phone}
                 </div>
               </button>
             ))}
             {filteredTickets.length === 0 && (
               <div className="p-8 text-center text-muted-foreground text-sm">
                 Nenhuma conversa encontrada
               </div>
             )}
           </div>
         </ScrollArea>
       </div>
 
       {/* Chat Area */}
       <div className="flex-1 flex flex-col relative overflow-hidden">
         {selectedTicket ? (
           <>
             {/* Chat Header */}
             <div className="p-4 border-b flex justify-between items-center bg-card">
               <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                   <User className="h-5 w-5 text-primary" />
                 </div>
                 <div>
                   <div className="font-semibold">{selectedTicket.contact.name || "Sem nome"}</div>
                   <div className="text-xs text-muted-foreground flex items-center gap-1">
                     <Phone className="h-3 w-3" />
                     {selectedTicket.contact.phone}
                   </div>
                 </div>
               </div>
               <div className="flex gap-2">
                 <Button 
                   variant={selectedTicket.is_bot_active ? "outline" : "secondary"}
                   size="sm"
                   onClick={() => toggleBot(selectedTicket.id, selectedTicket.is_bot_active)}
                   className="gap-2"
                 >
                   <Bot className={cn("h-4 w-4", selectedTicket.is_bot_active && "text-primary")} />
                   {selectedTicket.is_bot_active ? "Pausar Robô" : "Retomar Robô"}
                 </Button>
                 <Button 
                   variant="outline" 
                   size="sm"
                   onClick={() => closeTicket(selectedTicket.id)}
                   className="gap-2"
                 >
                   <CheckCircle2 className="h-4 w-4" />
                   Finalizar
                 </Button>
               </div>
             </div>
 
             {/* Chat Messages */}
             <ScrollArea className="flex-1 p-4" ref={scrollRef}>
               <div className="space-y-4 max-w-4xl mx-auto">
                 {messages.map((msg) => (
                   <div
                     key={msg.id}
                     className={cn(
                       "flex flex-col max-w-[80%]",
                       msg.sender_type === 'contact' ? "self-start" : "self-end items-end"
                     )}
                   >
                     <div
                       className={cn(
                         "px-4 py-2 rounded-2xl text-sm shadow-sm",
                         msg.sender_type === 'contact' 
                           ? "bg-muted text-foreground rounded-tl-none" 
                           : msg.sender_type === 'bot'
                             ? "bg-secondary/50 text-foreground border border-secondary rounded-tr-none italic"
                             : "bg-primary text-primary-foreground rounded-tr-none"
                       )}
                     >
                       {msg.content}
                     </div>
                     <div className="flex items-center gap-1 mt-1 px-1">
                       <span className="text-[10px] text-muted-foreground">
                         {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                       </span>
                       {msg.sender_type !== 'contact' && (
                         <span className="text-[10px] text-muted-foreground">
                           • {msg.sender_type === 'bot' ? 'Lia' : 'Você'}
                         </span>
                       )}
                     </div>
                   </div>
                 ))}
                 {loadingMessages && (
                   <div className="flex justify-center p-4">
                     <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                   </div>
                 )}
               </div>
             </ScrollArea>
 
              {/* Template Selection Dialog */}
              <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Reativar Conversa (Templates)</DialogTitle>
                    <DialogDescription>
                      A janela de 24h está fechada. Selecione um modelo aprovado para reativar o atendimento.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <ScrollArea className="max-h-[400px] mt-4">
                    {loadingTemplates ? (
                      <div className="flex justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : templates.length > 0 ? (
                      <div className="space-y-3">
                        {templates.map((template) => (
                          <Card 
                            key={template.id} 
                            className="p-3 cursor-pointer hover:bg-accent transition-colors"
                            onClick={() => handleSendTemplate(template)}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-xs uppercase text-primary">{template.name.replace(/_/g, ' ')}</span>
                              <Badge variant="outline" className="text-[9px]">{template.category}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{template.content}</p>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">Nenhum template aprovado encontrado.</p>
                    )}
                  </ScrollArea>
                </DialogContent>
              </Dialog>

              {/* Message Input */}
              <div className="p-4 border-t bg-card">
                <div className="flex gap-2 max-w-4xl mx-auto items-center mb-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 text-xs h-8"
                    onClick={() => setShowTemplateDialog(true)}
                  >
                    <FileText className="h-3 w-3" />
                    Reativar (Template)
                  </Button>
                  <div className="h-4 w-[1px] bg-border mx-1" />
                  <span className="text-[10px] text-muted-foreground italic">
                    Use templates se a janela de 24h estiver fechada.
                  </span>
                </div>
                <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
                  <Input 
                    placeholder="Digite uma mensagem..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={sending || !newMessage.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
               {selectedTicket.is_bot_active && (
                 <p className="text-[10px] text-center text-muted-foreground mt-2">
                   O robô está ativo. Suas mensagens serão enviadas, mas a Lia pode responder em seguida.
                 </p>
               )}
             </div>
           </>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-accent/10">
             <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center mb-4">
               <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
             </div>
             <p className="text-lg font-medium">Selecione uma conversa para começar</p>
             <p className="text-sm">Clique em um contato na barra lateral para ver o histórico</p>
           </div>
         )}
       </div>
     </div>
   );
 }