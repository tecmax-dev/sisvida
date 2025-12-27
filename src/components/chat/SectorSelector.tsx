import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, HelpCircle, Stethoscope, Calendar, CreditCard, Settings, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Sector {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
}

interface SectorSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (sector: Sector) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  HelpCircle,
  Stethoscope,
  Calendar,
  CreditCard,
  Settings,
  MessageCircle,
};

export const SectorSelector = ({ open, onClose, onSelect }: SectorSelectorProps) => {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSectors = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('chat_sectors')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

      if (error) {
        console.error('Error fetching sectors:', error);
      } else {
        setSectors(data || []);
      }
      setIsLoading(false);
    };

    if (open) {
      fetchSectors();
    }
  }, [open]);

  const getIcon = (iconName: string | null) => {
    const Icon = iconMap[iconName || 'HelpCircle'] || HelpCircle;
    return Icon;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Como podemos ajudar?</DialogTitle>
          <DialogDescription>
            Selecione o setor para direcionar sua conversa
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sectors.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum setor disponível no momento.</p>
            <Button variant="outline" onClick={onClose} className="mt-4">
              Fechar
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 py-4">
            {sectors.map((sector) => {
              const Icon = getIcon(sector.icon);
              return (
                <button
                  key={sector.id}
                  onClick={() => onSelect(sector)}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-lg border text-left transition-all',
                    'hover:border-primary hover:bg-primary/5'
                  )}
                >
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${sector.color || '#3B82F6'}20` }}
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{ color: sector.color || '#3B82F6' }}
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{sector.name}</h4>
                    {sector.description && (
                      <p className="text-sm text-muted-foreground">
                        {sector.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
