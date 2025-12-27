import { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useChatConversation } from '@/hooks/useChatConversation';
import { useChatAvailability } from '@/hooks/useChatAvailability';
import { ChatWindow } from './ChatWindow';
import { cn } from '@/lib/utils';

export const ChatWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const { unreadCount, markAsRead } = useChatConversation();
  const { status } = useChatAvailability();

  // Only render for authenticated users
  if (!user) return null;

  useEffect(() => {
    if (unreadCount > 0 && !isOpen) {
      setHasNewMessage(true);
    }
  }, [unreadCount, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasNewMessage(false);
    markAsRead();
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Chat Window */}
      {isOpen && <ChatWindow onClose={handleClose} />}

      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={handleOpen}
          className={cn(
            'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg',
            'bg-primary hover:bg-primary/90 text-primary-foreground',
            'transition-all duration-300 hover:scale-110',
            hasNewMessage && 'animate-bounce'
          )}
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
          
          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}

          {/* Online Indicator */}
          <span
            className={cn(
              'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background',
              status === 'online' ? 'bg-green-500' : 'bg-muted-foreground'
            )}
          />
        </Button>
      )}
    </>
  );
};
