import { useModal } from "@/contexts/ModalContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import UnionMemberDetailPage from "@/pages/union/UnionMemberDetailPage";
import EmployerDetailPage from "@/pages/dashboard/EmployerDetailPage";

export function GlobalUnionModals() {
  const { isModalOpen, closeModal, getModalData } = useModal();
  
  const employerOpen = isModalOpen('employerEdit');
  const employerModalData = getModalData('employerEdit');
  const memberOpen = isModalOpen('unionMemberEdit');
  const memberModalData = getModalData('unionMemberEdit');

  return (
    <>
      <Dialog 
        open={memberOpen} 
        onOpenChange={(open) => !open && closeModal('unionMemberEdit')}
        modal={false}
      >
        <DialogContent 
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="max-w-[98vw] sm:max-w-[95vw] w-full sm:w-[1400px] h-[95vh] sm:h-[90vh] p-0 flex flex-col rounded-none sm:rounded-xl shadow-2xl border-teal-500/20 z-[100] pointer-events-auto"
        >
          <div className="flex-1 w-full overflow-y-auto custom-scrollbar-teal relative">
            {memberOpen && (
              <UnionMemberDetailPage 
                memberIdOverride={memberModalData?.memberId || memberModalData?.id} 
                isModalMode={true} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog 
        open={employerOpen} 
        onOpenChange={(open) => !open && closeModal('employerEdit')}
        modal={false}
      >
        <DialogContent 
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="max-w-[98vw] sm:max-w-[95vw] w-full sm:w-[1400px] h-[95vh] sm:h-[90vh] p-0 flex flex-col rounded-none sm:rounded-xl shadow-2xl border-teal-500/20 z-[100] pointer-events-auto"
        >
          <div className="flex-1 w-full overflow-y-auto custom-scrollbar-teal relative">
            {employerOpen && (
              <EmployerDetailPage 
                employerIdOverride={employerModalData?.employerId || employerModalData?.id} 
                isModalMode={true} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
