import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

  return (
    <>
      <Dialog open={isMemberEditOpen} onOpenChange={(open) => !open && closeModal('unionMemberEdit')}>
        <DialogContent className="max-w-[95vw] w-[1200px] max-h-[95vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              Editar Sócio
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {isMemberEditOpen && memberData.memberId && (
              <ScrollArea className="h-full">
                <div className="p-6">
                  <UnionMemberDetailPage memberIdOverride={memberData.memberId} isModalMode />
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEmployerEditOpen} onOpenChange={(open) => !open && closeModal('employerEdit')}>
        <DialogContent className="max-w-[95vw] w-[1200px] max-h-[95vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              Editar Empresa
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {isEmployerEditOpen && employerData.employerId && (
              <ScrollArea className="h-full">
                <div className="p-6">
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
