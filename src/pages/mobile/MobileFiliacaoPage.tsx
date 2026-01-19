import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { MobileFiliacaoForm } from "@/components/mobile/MobileFiliacaoForm";

export default function MobileFiliacaoPage() {
  const navigate = useNavigate();

  return (
    <MobileLayout showBottomNav={false}>
      <MobileFiliacaoForm 
        onBack={() => navigate(-1)}
        onSuccess={() => {
          // Permanece na tela de sucesso do formulário
        }}
      />
    </MobileLayout>
  );
}
