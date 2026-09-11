import { useEffect } from "react";
import {
  Heart,
  GraduationCap,
  Sparkles,
  Scale,
  Stethoscope,
  Smile,
  Bone,
  Baby,
  FlaskConical,
  Eye,
  Brain,
  Hospital,
  Leaf,
  CheckCircle2,
  Shield,
  MapPin,
  Users,
  Zap,
  Phone,
} from "lucide-react";

const LOGO_URL = "/apple-touch-icon-sindicato.png";

interface Benefit {
  name: string;
  description: string;
  icon: React.ElementType;
  category: "saude" | "estudos" | "estetica" | "juridico";
}

const benefits: Benefit[] = [
  { name: "Dr. José Alcides", description: "Clínico Geral — Consulta 100% gratuita", icon: Stethoscope, category: "saude" },
  { name: "Dra. Juliane Leite", description: "Dentista — Atendimento 100% gratuito", icon: Smile, category: "saude" },
  { name: "Dr. Jorge Avelar", description: "Ortopedista — Consulta 100% gratuita", icon: Bone, category: "saude" },
  { name: "Dr. Pedro Roberto", description: "Urologista — Consulta 100% gratuita", icon: Stethoscope, category: "saude" },
  { name: "Dra. Uiara Tiuba", description: "Pediatra — Cuidados para seus filhos", icon: Baby, category: "saude" },
  { name: "Hospital São José", description: "Descontos em exames hospitalares", icon: Hospital, category: "saude" },
  { name: "Laboratório Lidi", description: "Preventivo ginecológico 100% gratuito + desconto em exames", icon: FlaskConical, category: "saude" },
  { name: "Laboratório Biolife", description: "Desconto em exames laboratoriais", icon: FlaskConical, category: "saude" },
  { name: "Clínica OftalmoSul", description: "Desconto em consultas e exames oftalmológicos", icon: Eye, category: "saude" },
  { name: "Clínica Medico Center", description: "Desconto em consultas e exames", icon: Stethoscope, category: "saude" },
  { name: "Clínica Pensar", description: "Desconto em consultas — Saúde mental", icon: Brain, category: "saude" },
  { name: "Faculdade de Ilhéus", description: "Desconto para titular e dependentes", icon: GraduationCap, category: "estudos" },
  { name: "Uniasselvi", description: "Desconto para titular e dependentes", icon: GraduationCap, category: "estudos" },
  { name: "CCAA", description: "Desconto na mensalidade de idiomas", icon: GraduationCap, category: "estudos" },
  { name: "Drª Daniela Sales", description: "Terapia Holística — Bem-estar e saúde integrativa", icon: Leaf, category: "estetica" },
  { name: "Espaçolaser", description: "Desconto para titular e dependentes", icon: Sparkles, category: "estetica" },
  { name: "Dra. Dione Mattos", description: "Assessoria jurídica trabalhista", icon: Scale, category: "juridico" },
];

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  saude: { label: "Saúde", icon: Heart, color: "#094798" },
  estudos: { label: "Educação", icon: GraduationCap, color: "#2563eb" },
  estetica: { label: "Estética & Beleza", icon: Sparkles, color: "#d97706" },
  juridico: { label: "Jurídico", icon: Scale, color: "#7c3aed" },
};

const advantages = [
  { icon: Shield, title: "Proteção Trabalhista", desc: "Direitos garantidos pela Convenção Coletiva de Trabalho." },
  { icon: Heart, title: "Saúde Acessível", desc: "Consultas, exames e tratamentos com valores reduzidos." },
  { icon: GraduationCap, title: "Educação com Desconto", desc: "Faculdades e cursos de idiomas para você e família." },
  { icon: Scale, title: "Assessoria Jurídica", desc: "Orientação trabalhista gratuita para associados." },
  { icon: Users, title: "Representação Forte", desc: "Negociações coletivas que valorizam seu trabalho." },
  { icon: Zap, title: "Serviços Digitais", desc: "App exclusivo com carteirinha digital e agendamento." },
];

export default function SindicatoBeneficiosPrintPage() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
    document.title = "SECMI - Benefícios do Associado (Impressão)";

    // Auto-print after rendering
    const timer = setTimeout(() => window.print(), 800);
    return () => clearTimeout(timer);
  }, []);

  const grouped = {
    saude: benefits.filter((b) => b.category === "saude"),
    estudos: benefits.filter((b) => b.category === "estudos"),
    estetica: benefits.filter((b) => b.category === "estetica"),
    juridico: benefits.filter((b) => b.category === "juridico"),
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 [color-scheme:light] print:p-0" data-theme="light">
      {/* Print-only styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 12mm 10mm; size: A4; }
          .no-print { display: none !important; }
          .print-page-break { page-break-before: always; }
        }
        @media screen {
          .print-container { max-width: 210mm; margin: 0 auto; padding: 20px; }
        }
      `}</style>

      {/* Print button - only on screen */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="bg-[#094798] text-white px-6 py-3 rounded-full font-semibold shadow-lg hover:bg-[#138a7d] transition-colors"
        >
          🖨️ Imprimir
        </button>
        <button
          onClick={() => window.history.back()}
          className="bg-gray-200 text-gray-700 px-6 py-3 rounded-full font-semibold shadow-lg hover:bg-gray-300 transition-colors"
        >
          ← Voltar
        </button>
      </div>

      <div className="print-container">
        {/* === PAGE 1: Header + Benefits === */}
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#094798] pb-4 mb-6">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="SECMI" className="w-14 h-14 rounded-xl" />
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">SECMI</h1>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                Sindicato dos Empregados no Comércio de Ilhéus e Região
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-[#094798]">89 anos</div>
            <div className="text-xs text-gray-500">defendendo seus direitos</div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
            Benefícios do Associado
          </h2>
          <p className="text-gray-500 text-sm">
            Consultas médicas, descontos em faculdades, assessoria jurídica e muito mais — para você e toda sua família.
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3 mb-8 bg-[#094798] rounded-xl p-4 text-white text-center">
          {[
            { value: "17+", label: "Convênios" },
            { value: "12", label: "Especialidades" },
            { value: "5", label: "Cidades" },
            { value: "50%", label: "Desconto" },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-xl font-extrabold">{s.value}</div>
              <div className="text-[10px] text-white/80 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Benefits by Category */}
        {(Object.keys(grouped) as Array<keyof typeof grouped>).map((cat) => {
          const config = categoryConfig[cat];
          const items = grouped[cat];
          if (items.length === 0) return null;
          const IconComp = config.icon;

          return (
            <div key={cat} className="mb-6">
              {/* Category header */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: config.color }}
                >
                  <IconComp className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{config.label}</h3>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${config.color}15`, color: config.color }}
                >
                  {items.length} {items.length === 1 ? "convênio" : "convênios"}
                </span>
              </div>

              {/* Benefit items */}
              <div className="grid grid-cols-2 gap-2">
                {items.map((b, i) => {
                  const BIcon = b.icon;
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 bg-white"
                    >
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${config.color}12` }}
                      >
                        <BIcon className="w-3.5 h-3.5" style={{ color: config.color }} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-xs leading-tight">{b.name}</div>
                        <div className="text-[10px] text-gray-500 leading-snug mt-0.5">{b.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* === PAGE 2: Advantages + Coverage + Contact === */}
        <div className="print-page-break" />

        {/* Re-print header on page 2 */}
        <div className="flex items-center justify-between border-b-2 border-[#094798] pb-4 mb-8">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="SECMI" className="w-14 h-14 rounded-xl" />
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">SECMI</h1>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                Sindicato dos Empregados no Comércio de Ilhéus e Região
              </p>
            </div>
          </div>
        </div>

        {/* Why Join */}
        <div className="mb-10">
          <h2 className="text-xl font-extrabold text-gray-900 mb-5 text-center">
            Por que se associar ao SECMI?
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {advantages.map((a, i) => {
              const AIcon = a.icon;
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="w-9 h-9 rounded-lg bg-[#094798]/10 flex items-center justify-center shrink-0">
                    <AIcon className="w-4.5 h-4.5 text-[#094798]" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{a.title}</div>
                    <div className="text-xs text-gray-500 leading-relaxed">{a.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* How to join - Steps */}
        <div className="mb-10">
          <h2 className="text-xl font-extrabold text-gray-900 mb-5 text-center">
            3 passos para se associar
          </h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              { step: "1", title: "Preencha o cadastro", desc: "Acesse nosso formulário online e informe seus dados. Leva menos de 3 minutos!" },
              { step: "2", title: "Confirmação rápida", desc: "Nossa equipe valida suas informações e ativa sua associação em até 24h." },
              { step: "3", title: "Use seus benefícios!", desc: "Receba sua carteirinha digital e comece a economizar!" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-xl bg-[#094798] text-white text-xl font-extrabold flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <div className="font-bold text-gray-900 text-sm mb-1">{item.title}</div>
                <div className="text-[11px] text-gray-500 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Coverage */}
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-[#094798]" />
            <h2 className="text-xl font-extrabold text-gray-900">Abrangência Regional</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {["Ilhéus", "Itacaré", "Ubaitaba", "Una", "Uruçuca"].map((city) => (
              <span
                key={city}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#094798]/10 text-[#094798] font-semibold text-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {city}
              </span>
            ))}
          </div>
        </div>

        {/* CTA box */}
        <div className="bg-[#0c4a42] rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-extrabold mb-3">Não fique de fora!</h2>
          <p className="text-white/80 text-sm mb-4 max-w-lg mx-auto">
            Cada dia sem associação é um dia pagando mais caro em consultas, exames e educação.
            Associe-se hoje e comece a usar os benefícios amanhã!
          </p>
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-white/70" />
              <span className="text-sm font-semibold">(73) 3223-9980</span>
            </div>
            <div className="text-white/40">•</div>
            <div className="text-sm">
              <span className="font-semibold">prosinge.com.br/sindicato</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400">
          <p>SECMI — Sindicato dos Empregados no Comércio de Ilhéus e Região • 89 anos de história</p>
          <p>Material informativo para associados e interessados</p>
        </div>
      </div>
    </div>
  );
}
