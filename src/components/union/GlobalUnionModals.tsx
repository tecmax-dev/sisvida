import { useEffect, useRef } from "react";
import { useModal } from "@/contexts/ModalContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import UnionMemberDetailPage from "@/pages/union/UnionMemberDetailPage";
import EmployerDetailPage from "@/pages/dashboard/EmployerDetailPage";

export function GlobalUnionModals() {
  const { isModalOpen, closeModal, getModalData } = useModal();
  const employerRenderCount = useRef(0);
  const employerOpen = isModalOpen('employerEdit');
  const employerModalData = getModalData('employerEdit');
  employerRenderCount.current += 1;

  console.log('[EMPRESA MODAL] CONTROLLER RENDER', {
    renderCount: employerRenderCount.current,
    open: employerOpen,
    modalData: employerModalData,
  });

  useEffect(() => {
    if (!employerOpen) return;
    console.log('[EMPRESA MODAL] MOUNT CONTENT', employerModalData);
    return () => console.log('[EMPRESA MODAL] UNMOUNT CONTENT');
  }, [employerOpen]);

  return (
    <>
      <Dialog 
        open={isModalOpen('unionMemberEdit')} 
        onOpenChange={(open) => !open && closeModal('unionMemberEdit')}
      >
        <DialogContent className="max-w-[98vw] sm:max-w-[95vw] w-full sm:w-[1400px] h-[95vh] sm:h-[90vh] p-0 overflow-hidden flex flex-col rounded-none sm:rounded-xl shadow-2xl border-teal-500/20">
          <ScrollArea className="flex-1 w-full">
            {isModalOpen('unionMemberEdit') && (
              <UnionMemberDetailPage 
                memberIdOverride={getModalData('unionMemberEdit')?.id} 
                isModalMode={true} 
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog 
        open={employerOpen} 
        onOpenChange={(open) => !open && closeModal('employerEdit')}
      >
        <DialogContent className="max-w-[98vw] sm:max-w-[95vw] w-full sm:w-[1400px] h-[95vh] sm:h-[90vh] p-0 overflow-hidden flex flex-col rounded-none sm:rounded-xl shadow-2xl border-teal-500/20">
          <ScrollArea className="flex-1 w-full">
            {employerOpen && (
              <EmployerDetailPage 
                employerIdOverride={employerModalData?.employerId} 
                isModalMode={true} 
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
