import { Users, Wallet, Scale, MessageCircle, Smartphone, ArrowRight } from "lucide-react";

export function BentoFeaturesSection() {
  return (
    <section id="features" className="bg-prosinge-cream px-6 py-24 font-body">
      <div className="mx-auto max-w-7xl">
        {/* Magazine header */}
        <div className="mb-12 flex flex-col gap-4 border-b border-prosinge-emerald/10 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-prosinge-emerald-mid">
              Edição · Plataforma
            </div>
            <h2 className="font-display text-4xl font-bold leading-tight text-prosinge-emerald md:text-5xl">
              Ecossistema Integrado<br />de Gestão Sindical
            </h2>
          </div>
          <p className="max-w-md text-prosinge-emerald-mid">
            Ferramentas modulares desenhadas para suprir todas as demandas
            da diretoria e do corpo administrativo.
          </p>
        </div>

        {/* Magazine grid: featured + secondary stories */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Featured story */}
          <article className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-prosinge-emerald p-10 lg:col-span-7 lg:min-h-[480px]">
            <div className="relative z-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-prosinge-cream/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-prosinge-cream/80">
                <Users className="h-3 w-3" /> Capa
              </div>
              <h3 className="mb-4 font-display text-3xl font-bold leading-tight text-prosinge-cream md:text-4xl">
                Gestão estratégica de associados, do cadastro à carteirinha digital
              </h3>
              <p className="max-w-lg text-prosinge-cream/70">
                Ficha completa, dependentes, histórico de contribuições,
                carteirinha digital e controle de acesso integrado em uma
                única plataforma.
              </p>
            </div>
            <div className="relative z-10 mt-10 flex items-center gap-2 text-sm font-semibold text-prosinge-cream">
              Ler matéria completa
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
            <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-prosinge-emerald-mid/40 blur-3xl" />
          </article>

          {/* Secondary column */}
          <div className="flex flex-col gap-6 lg:col-span-5">
            <article className="group rounded-3xl border border-prosinge-emerald/10 bg-white p-7 transition-all hover:-translate-y-0.5 hover:shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-prosinge-cream text-prosinge-emerald">
                  <Wallet className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-prosinge-emerald-mid">
                  Financeiro
                </span>
              </div>
              <h3 className="mb-2 font-display text-xl font-bold text-prosinge-emerald">
                Arrecadação automatizada
              </h3>
              <p className="text-sm text-prosinge-emerald-mid/80">
                Boletos, PIX e repasses bancários com baixa automática em
                tempo real.
              </p>
            </article>

            <article className="group rounded-3xl border border-prosinge-emerald/10 bg-white p-7 transition-all hover:-translate-y-0.5 hover:shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-prosinge-cream text-prosinge-emerald">
                  <Scale className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-prosinge-emerald-mid">
                  Jurídico
                </span>
              </div>
              <h3 className="mb-2 font-display text-xl font-bold text-prosinge-emerald">
                Processos sob controle
              </h3>
              <p className="text-sm text-prosinge-emerald-mid/80">
                Pautas, prazos e honorários integrados ao módulo financeiro.
              </p>
            </article>
          </div>

          {/* Wide bottom story */}
          <article className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-prosinge-emerald/10 bg-white p-10 lg:col-span-12">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-prosinge-emerald-mid">
                  Comunicação
                </div>
                <h3 className="mb-3 font-display text-2xl font-bold text-prosinge-emerald md:text-3xl">
                  App PWA & WhatsApp oficial conectando a base de filiados
                </h3>
                <p className="text-prosinge-emerald-mid/80">
                  Push notifications, chatbot inteligente, carteirinha
                  digital e canal de atendimento humano — tudo na palma da
                  mão do associado.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-prosinge-emerald px-4 py-2 text-xs font-bold uppercase tracking-wider text-prosinge-cream">
                  <Smartphone className="h-4 w-4" /> App PWA
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-prosinge-emerald-mid px-4 py-2 text-xs font-bold uppercase tracking-wider text-prosinge-cream">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}