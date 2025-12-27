import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender_type: 'user' | 'support' | 'system';
  sender_name: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface ChatMessagesProps {
  messages: Message[];
}

export const ChatMessages = ({ messages }: ChatMessagesProps) => {
  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), 'HH:mm', { locale: ptBR });
  };

  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  return (
    <div className="flex flex-col gap-3">
      {messages.map((msg) => {
        const isUser = msg.sender_type === 'user';
        const isSystem = msg.sender_type === 'system';

        if (isSystem) {
          return (
            <div
              key={msg.id}
              className="flex justify-center"
            >
              <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                {escapeHtml(msg.message)}
              </span>
            </div>
          );
        }

        return (
          <div
            key={msg.id}
            className={cn(
              'flex flex-col max-w-[80%]',
              isUser ? 'self-end items-end' : 'self-start items-start'
            )}
          >
            {!isUser && msg.sender_name && (
              <span className="text-xs text-muted-foreground mb-1 ml-2">
                {msg.sender_name}
              </span>
            )}
            <div
              className={cn(
                'px-3 py-2 rounded-2xl',
                isUser
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted text-foreground rounded-bl-md'
              )}
            >
              <p className="text-sm whitespace-pre-wrap break-words">
                {escapeHtml(msg.message)}
              </p>
            </div>
            <div className="flex items-center gap-1 mt-1 px-2">
              <span className="text-[10px] text-muted-foreground">
                {formatTime(msg.created_at)}
              </span>
              {isUser && (
                msg.is_read ? (
                  <CheckCheck className="h-3 w-3 text-primary" />
                ) : (
                  <Check className="h-3 w-3 text-muted-foreground" />
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
