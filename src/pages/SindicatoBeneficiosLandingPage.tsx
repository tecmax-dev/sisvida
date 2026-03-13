import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  ArrowRight,
  CheckCircle2,
  Users,
  Shield,
  Phone,
  MapPin,
  Star,
  Zap,
} from "lucide-react";
import { SINDICATO_UNION_ENTITY_ID } from "@/constants/sindicato";

const LOGO_URL =
  "https://eahhszmbyxapxzilfdlo.supabase.co/storage/v1/object/public/clinic-assets/89e7585e-7bce-4e58-91fa-c37080d1170d/logo.png";

const FILIACAO_URL = `/sindical/filiacao/${SINDICATO_UNION_ENTITY_ID}`;
const WHATSAPP_URL = "https://wa.me/557332311784?text=Olá! Quero saber mais sobre os benefícios do sindicato.";

interface Benefit {
  name: string;
  description: string;
  icon: React.ElementType;
  category: "saude" | "estudos" | "estetica" | "juridico";
}

const benefits: Benefit[] = [
  // Saúde
  { name: "Dr. José Alcides", description: "Clínico Geral — Consultas com valores reduzidos", icon: Stethoscope, category: "saude" },
  { name: "Dra. Juliane Leite", description: "Dentista — Tratamentos odontológicos acessíveis", icon: Smile, category: "saude" },
  { name: "Dr. Jorge Avelar", description: "Ortopedista — Consultas especializadas", icon: Bone, category: "saude" },
  { name: "Dr. Pedro Roberto", description: "Urologista — Atendimento com desconto", icon: Stethoscope, category: "saude" },
  { name: "Drª Daniela Sales", description: "Terapia Holística — Bem-estar e saúde integrativa", icon: Leaf, category: "saude" },
  { name: "Dra. Uiara Tiuba", description: "Pediatra — Cuidados para seus filhos", icon: Baby, category: "saude" },
  { name: "Hospital São José", description: "Descontos em exames hospitalares", icon: Hospital, category: "saude" },
  { name: "Laboratório Lidi", description: "Desconto em exames laboratoriais", icon: FlaskConical, category: "saude" },
  { name: "Laboratório Biolife", description: "Desconto em exames laboratoriais", icon: FlaskConical, category: "saude" },
  { name: "Clínica OftalmoSul", description: "Desconto em consultas e exames oftalmológicos", icon: Eye, category: "saude" },
  { name: "Clínica Medico Center", description: "Desconto em consultas e exames", icon: Stethoscope, category: "saude" },
  { name: "Clínica Pensar", description: "Desconto em consultas — Saúde mental", icon: Brain, category: "saude" },
  // Estudos
  { name: "Faculdade de Ilhéus", description: "Desconto para titular e dependentes", icon: GraduationCap, category: "estudos" },
  { name: "Uniasselvi", description: "Desconto para titular e dependentes", icon: GraduationCap, category: "estudos" },
  { name: "CCAA", description: "Desconto na mensalidade de idiomas", icon: GraduationCap, category: "estudos" },
  // Estética
  { name: "Espaçolaser", description: "Desconto para titular e dependentes", icon: Sparkles, category: "estetica" },
  // Jurídico
  { name: "Dra. Dione Mattos", description: "Assessoria jurídica trabalhista", icon: Scale, category: "juridico" },
];

const categoryConfig = {
  saude: { label: "Saúde", icon: Heart, color: "from-red-500 to-rose-600", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  estudos: { label: "Educação", icon: GraduationCap, color: "from-blue-500 to-indigo-600", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  estetica: { label: "Estética & Beleza", icon: Sparkles, color: "from-pink-500 to-fuchsia-600", bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" },
  juridico: { label: "Jurídico", icon: Scale, color: "from-amber-500 to-orange-600", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

const stats = [
  { value: "89", label: "Anos de história" },
  { value: "17+", label: "Convênios ativos" },
  { value: "5", label: "Cidades atendidas" },
  { value: "100%", label: "Compromisso com você" },
];

const reasons = [
  { icon: Shield, title: "Proteção Trabalhista", desc: "Seus direitos garantidos pela Convenção Coletiva de Trabalho." },
  { icon: Heart, title: "Saúde Acessível", desc: "Consultas médicas, exames e tratamentos com valores reduzidos." },
  { icon: GraduationCap, title: "Educação com Desconto", desc: "Faculdades e cursos de idiomas para você e sua família." },
  { icon: Scale, title: "Assessoria Jurídica", desc: "Orientação trabalhista gratuita para associados." },
  { icon: Users, title: "Representação Forte", desc: "Negociações coletivas que valorizam o seu trabalho." },
  { icon: Zap, title: "Serviços Digitais", desc: "App exclusivo com carteirinha digital e agendamento online." },
];

export default function SindicatoBeneficiosLandingPage() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
    document.title = "SECMI - Benefícios do Associado | Sindicato dos Comerciários de Ilhéus";
    
    // Set favicon
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) link.href = LOGO_URL;
  }, []);

  const grouped = {
    saude: benefits.filter((b) => b.category === "saude"),
    estudos: benefits.filter((b) => b.category === "estudos"),
    estetica: benefits.filter((b) => b.category === "estetica"),
    juridico: benefits.filter((b) => b.category === "juridico"),
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 [color-scheme:light]" data-theme="light">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="SECMI" className="w-10 h-10 rounded-xl" />
            <div>
              <span className="font-bold text-gray-900 text-sm leading-tight block">Sindicato dos Comerciários</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Ilhéus • Itacaré • Ubaitaba • Una • Uruçuca</span>
            </div>
          </div>
          <Button
            className="bg-[#16a394] hover:bg-[#138a7d] text-white rounded-full px-6 text-sm font-semibold shadow-md"
            asChild
          >
            <a href={FILIACAO_URL}>Filiar-se agora</a>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0c4a42 0%, #16a394 50%, #1baf8e 100%)" }}>
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/5 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />
          {/* Pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
        </div>
        <div className="container mx-auto px-4 py-20 md:py-28 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
              <Star className="w-4 h-4 text-yellow-300" />
              <span className="text-white/90 text-sm font-medium">89 anos defendendo seus direitos</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
              Benefícios exclusivos para{" "}
              <span className="relative">
                <span className="relative z-10">comerciários</span>
                <span className="absolute bottom-1 left-0 right-0 h-3 bg-yellow-400/30 rounded-sm -z-0" />
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
              Associe-se ao SECMI e tenha acesso a <strong className="text-white">consultas médicas, descontos em educação, assessoria jurídica</strong> e muito mais para você e sua família.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-white text-[#0c4a42] hover:bg-gray-100 rounded-full px-8 h-14 text-base font-bold shadow-xl transition-all hover:scale-105"
                asChild
              >
                <a href={FILIACAO_URL} className="flex items-center gap-2">
                  Quero me associar
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <Button
                size="lg"
                className="border-2 border-white/30 bg-transparent text-white hover:bg-white/10 rounded-full px-8 h-14 text-base font-semibold"
                asChild
              >
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Fale conosco
                </a>
              </Button>
            </div>
          </div>
        </div>
        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 80V40C240 0 480 0 720 40C960 80 1200 80 1440 40V80H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-extrabold text-[#16a394] mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Join */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest text-[#16a394] uppercase mb-3">Vantagens</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Por que se associar ao SECMI?
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Mais do que representação — é uma rede completa de benefícios para sua vida profissional e pessoal.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {reasons.map((r, i) => (
              <Card key={i} className="border-gray-200 bg-white hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-[#16a394]/10 flex items-center justify-center mb-4">
                    <r.icon className="w-6 h-6 text-[#16a394]" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{r.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{r.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits by Category */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest text-[#16a394] uppercase mb-3">Convênios</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Rede de convênios exclusiva
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Descontos e atendimento diferenciado em saúde, educação, estética e assessoria jurídica.
            </p>
          </div>

          <div className="space-y-16 max-w-5xl mx-auto">
            {(Object.keys(grouped) as Array<keyof typeof grouped>).map((cat) => {
              const config = categoryConfig[cat];
              const items = grouped[cat];
              if (items.length === 0) return null;

              return (
                <div key={cat}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow-md`}>
                      <config.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{config.label}</h3>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${config.bg} ${config.text}`}>
                      {items.length} {items.length === 1 ? "convênio" : "convênios"}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((b, i) => (
                      <div
                        key={i}
                        className={`group flex items-start gap-4 p-4 rounded-xl border ${config.border} bg-white hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
                      >
                        <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                          <b.icon className={`w-5 h-5 ${config.text}`} />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{b.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{b.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How to join */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest text-[#16a394] uppercase mb-3">Como associar-se</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              É simples e rápido!
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", title: "Preencha o cadastro", desc: "Acesse nosso formulário online e informe seus dados pessoais e profissionais." },
              { step: "2", title: "Confirmação", desc: "Nossa equipe vai validar suas informações e ativar sua associação." },
              { step: "3", title: "Aproveite os benefícios", desc: "Receba sua carteirinha digital e comece a usar todos os convênios!" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#16a394] text-white text-2xl font-extrabold flex items-center justify-center mx-auto mb-4 shadow-lg">
                  {item.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-lg">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <MapPin className="w-8 h-8 text-[#16a394] mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4">
              Abrangência regional
            </h2>
            <p className="text-gray-500 mb-8">
              Representamos os trabalhadores do comércio de toda a região:
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["Ilhéus", "Itacaré", "Ubaitaba", "Una", "Uruçuca"].map((city) => (
                <span
                  key={city}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#16a394]/10 text-[#16a394] font-semibold text-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {city}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden py-20" style={{ background: "linear-gradient(135deg, #0c4a42 0%, #16a394 60%, #1baf8e 100%)" }}>
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-6">
              Valorize quem valoriza você!
            </h2>
            <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
              Junte-se aos milhares de comerciários que já contam com os benefícios do SECMI. A filiação é rápida, fácil e muda a sua vida.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-white text-[#0c4a42] hover:bg-gray-100 rounded-full px-8 h-14 text-base font-bold shadow-xl transition-all hover:scale-105"
                asChild
              >
                <a href={FILIACAO_URL} className="flex items-center gap-2">
                  Filiar-se agora
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <Button
                size="lg"
                className="border-2 border-white/30 bg-transparent text-white hover:bg-white/10 rounded-full px-8 h-14 text-base font-semibold"
                asChild
              >
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  WhatsApp
                </a>
              </Button>
            </div>
            <p className="mt-8 text-white/50 text-sm">
              Sindicato dos Empregados no Comércio de Ilhéus e Região • SECMI
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="SECMI" className="w-8 h-8 rounded-lg" />
              <span className="text-sm">SECMI — Sindicato dos Empregados no Comércio de Ilhéus e Região</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <a href="https://www.comerciariosilheus.org.br" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Site oficial
              </a>
              <span className="text-gray-700">•</span>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Contato
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
