import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Pen, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/contexts/ModalContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import UnionMemberDetailPage from "@/pages/union/UnionMemberDetailPage";
import EmployerDetailPage from "@/pages/dashboard/EmployerDetailPage";

export function GlobalUnionModals() {
  const { isModalOpen, closeModal, getModalData } = useModal();
  
  const isMemberEditOpen = isModalOpen('unionMemberEdit');
  const memberData = getModalData('unionMemberEdit');
  
  const isEmployerEditOpen = isModalOpen('employerEdit');
  const employerData = getModalData('employerEdit');

  const handleMemberClose = (open: boolean) => {
    if (!open) {
      closeModal('unionMemberEdit');
      if (memberData.onUpdate) memberData.onUpdate();
    }
  };

  const handleEmployerClose = (open: boolean) => {
    if (!open) {
      closeModal('employerEdit');
      if (employerData.onUpdate) employerData.onUpdate();
    }
  };

  return (
    <>
      <Dialog open={isMemberEditOpen} onOpenChange={handleMemberClose}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] p-0 overflow-hidden flex flex-col rounded-xl shadow-2xl border-teal-500/20">
          <DialogHeader className="px-6 py-3 border-b bg-muted/30 shrink-0 text-left">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-teal-700">
              <Pen className="w-5 h-5" />
              Editar Sócio
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-background">
            {isMemberEditOpen && memberData.memberId && (
              <ScrollArea className="h-full">
                <div className="p-0">
                  <UnionMemberDetailPage memberIdOverride={memberData.memberId} isModalMode />
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEmployerEditOpen} onOpenChange={handleEmployerClose}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] p-0 overflow-hidden flex flex-col rounded-xl shadow-2xl border-teal-500/20">
          <DialogHeader className="px-6 py-3 border-b bg-muted/30 shrink-0 text-left">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-teal-700">
              <Building2 className="w-5 h-5" />
              Editar Empresa
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-background">
            {isEmployerEditOpen && employerData.employerId && (
              <ScrollArea className="h-full">
                <div className="p-0">
                  <EmployerDetailPage employerIdOverride={employerData.employerId} isModalMode />
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
