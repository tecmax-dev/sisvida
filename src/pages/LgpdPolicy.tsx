import { Shield, Lock, Eye, FileText, UserCheck, Bell, Trash2, Mail } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function LgpdPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 lg:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
                <Shield className="h-5 w-5" />
                <span className="text-sm font-medium">Em conformidade com a LGPD</span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
                Política de Privacidade e Proteção de Dados
              </h1>
              <p className="text-lg text-muted-foreground">
                A Tecmax Tecnologia (CNPJ: 03.025.212/0001-11) está comprometida com a proteção dos seus dados pessoais, 
                em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
              </p>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-16">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              {/* Intro */}
              <div className="prose prose-lg dark:prose-invert max-w-none mb-12">
                <p className="text-muted-foreground leading-relaxed">
                  Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos 
                  seus dados pessoais quando você utiliza o sistema Eclini. Ao utilizar nossos serviços, 
                  você concorda com os termos desta política.
                </p>
              </div>

              {/* Sections */}
              <div className="space-y-12">
                {/* Section 1 */}
                <div className="bg-card rounded-xl p-6 lg:p-8 border border-border">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground mb-4">
                        1. O que é a LGPD?
                      </h2>
                      <p className="text-muted-foreground leading-relaxed">
                        A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) é a legislação brasileira que 
                        regula o tratamento de dados pessoais, tanto em meios físicos quanto digitais. 
                        Ela garante aos cidadãos maior controle sobre suas informações pessoais e estabelece 
                        regras claras para empresas sobre coleta, armazenamento e uso desses dados.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2 */}
                <div className="bg-card rounded-xl p-6 lg:p-8 border border-border">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <Eye className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground mb-4">
                        2. Dados que Coletamos
                      </h2>
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        Para fornecer nossos serviços de gestão de clínicas, coletamos os seguintes tipos de dados:
                      </p>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span><strong>Dados de identificação:</strong> nome, CPF, RG, data de nascimento, telefone e e-mail</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span><strong>Dados de saúde:</strong> histórico de atendimentos, anamnese, prontuários, prescrições e exames</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span><strong>Dados financeiros:</strong> informações de pagamento e histórico de transações</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span><strong>Dados de uso:</strong> logs de acesso, preferências e interações com o sistema</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Section 3 */}
                <div className="bg-card rounded-xl p-6 lg:p-8 border border-border">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <UserCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground mb-4">
                        3. Como Utilizamos seus Dados
                      </h2>
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        Os dados coletados são utilizados exclusivamente para:
                      </p>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Prestação e melhoria dos serviços de gestão clínica</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Agendamento de consultas e comunicação com pacientes</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Envio de lembretes e notificações autorizadas</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Cumprimento de obrigações legais e regulatórias</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Geração de relatórios e análises estatísticas anonimizadas</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Section 4 */}
                <div className="bg-card rounded-xl p-6 lg:p-8 border border-border">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <Lock className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground mb-4">
                        4. Segurança dos Dados
                      </h2>
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        Implementamos medidas técnicas e organizacionais robustas para proteger seus dados:
                      </p>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Criptografia de dados em trânsito e em repouso (SSL/TLS)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Controle de acesso baseado em funções (RBAC)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Autenticação segura e políticas de senha forte</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Backups regulares e planos de recuperação de desastres</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Monitoramento contínuo e logs de auditoria</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Section 5 */}
                <div className="bg-card rounded-xl p-6 lg:p-8 border border-border">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <Bell className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground mb-4">
                        5. Seus Direitos
                      </h2>
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        De acordo com a LGPD, você tem os seguintes direitos sobre seus dados pessoais:
                      </p>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <h3 className="font-medium text-foreground mb-1">Acesso</h3>
                          <p className="text-sm text-muted-foreground">Solicitar informações sobre quais dados possuímos sobre você</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <h3 className="font-medium text-foreground mb-1">Correção</h3>
                          <p className="text-sm text-muted-foreground">Solicitar a correção de dados incompletos ou incorretos</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <h3 className="font-medium text-foreground mb-1">Eliminação</h3>
                          <p className="text-sm text-muted-foreground">Solicitar a exclusão de dados desnecessários</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <h3 className="font-medium text-foreground mb-1">Portabilidade</h3>
                          <p className="text-sm text-muted-foreground">Solicitar a transferência dos seus dados para outro serviço</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <h3 className="font-medium text-foreground mb-1">Revogação</h3>
                          <p className="text-sm text-muted-foreground">Revogar o consentimento para tratamento de dados</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <h3 className="font-medium text-foreground mb-1">Informação</h3>
                          <p className="text-sm text-muted-foreground">Saber com quem seus dados foram compartilhados</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 6 */}
                <div className="bg-card rounded-xl p-6 lg:p-8 border border-border">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <Trash2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground mb-4">
                        6. Retenção e Exclusão de Dados
                      </h2>
                      <p className="text-muted-foreground leading-relaxed">
                        Os dados pessoais são mantidos pelo tempo necessário para cumprir as finalidades 
                        para as quais foram coletados, incluindo obrigações legais. Dados de saúde são 
                        retidos conforme exigências do Conselho Federal de Medicina (CFM) e demais órgãos 
                        reguladores. Após o término do tratamento, os dados serão eliminados de forma segura, 
                        exceto quando houver obrigação legal de retenção.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 7 - Contact */}
                <div className="bg-primary/5 rounded-xl p-6 lg:p-8 border border-primary/20">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <Mail className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground mb-4">
                        7. Contato e Encarregado de Dados
                      </h2>
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato:
                      </p>
                      <div className="space-y-2">
                        <p className="text-foreground">
                          <strong>Empresa:</strong> Tecmax Tecnologia
                        </p>
                        <p className="text-foreground">
                          <strong>CNPJ:</strong> 03.025.212/0001-11
                        </p>
                        <p className="text-foreground">
                          <strong>E-mail:</strong>{" "}
                          <a href="mailto:contato@eclini.com.br" className="text-primary hover:underline">
                            contato@eclini.com.br
                          </a>
                        </p>
                        <p className="text-foreground">
                          <strong>WhatsApp:</strong>{" "}
                          <a href="https://wa.me/5571982786864" className="text-primary hover:underline">
                            (71) 98278-6864
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Last Update */}
              <div className="mt-12 text-center text-sm text-muted-foreground">
                <p>Última atualização: Janeiro de 2026</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
