import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/contexts/ModalContext";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import UnionMemberDetailPage from "@/pages/union/UnionMemberDetailPage";

export function UnionMemberEditModal() {
  const { isModalOpen, closeModal, getModalData } = useModal();
  const isOpen = isModalOpen('unionMemberEdit');
  const { memberId, onUpdate } = getModalData('unionMemberEdit');

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeModal('unionMemberEdit');
      if (onUpdate) onUpdate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[95vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            Editar Sócio
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden relative">
          {isOpen && memberId && (
             <ScrollArea className="h-full">
                <div className="p-6">
                   {/* We pass a custom prop or use context to tell UnionMemberDetailPage it's in a modal if needed */}
                   {/* For now, it will use useParams() which will be empty. We need to fix this. */}
                   <UnionMemberDetailPageModalWrapper memberId={memberId} />
                </div>
             </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Wrapper to provide the ID since UnionMemberDetailPage normally gets it from useParams
function UnionMemberDetailPageModalWrapper({ memberId }: { memberId: string }) {
  // We can't easily change useParams in the existing page without modifying it.
  // Instead, we'll modify UnionMemberDetailPage to accept an optional ID prop.
  return <UnionMemberDetailPage memberIdOverride={memberId} isModalMode />;
}
