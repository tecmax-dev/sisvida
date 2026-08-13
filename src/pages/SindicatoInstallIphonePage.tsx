import { useEffect } from "react";
import { Share, PlusSquare, Smartphone, CheckCircle2 } from "lucide-react";

const SINDICATO_LOGO = "/apple-touch-icon-sindicato.png";
const APP_URL = "https://prosinge.com.br/app";

export default function SindicatoInstallIphonePage() {
  useEffect(() => {
    document.title = "Instalar App no iPhone — SECMI";
    const meta =
      document.querySelector('meta[name="description"]') ||
      Object.assign(document.createElement("meta"), { name: "description" });
    (meta as HTMLMetaElement).content =
      "Passo a passo para instalar o aplicativo do SECMI no seu iPhone via Safari (Adicionar à Tela de Início).";
    if (!meta.parentNode) document.head.appendChild(meta);
  }, []);

  const steps = [
    {
      icon: <Smartphone className="h-6 w-6" />,
      title: "Abra no Safari",
      desc: "É obrigatório usar o navegador Safari no iPhone. Chrome, Firefox ou outros navegadores não funcionam para instalar.",
    },
    {
      icon: <Share className="h-6 w-6" />,
      title: "Toque em Compartilhar",
      desc: 'Toque no ícone de "Compartilhar" (quadrado com seta para cima) na barra inferior do Safari.',
    },
    {
      icon: <PlusSquare className="h-6 w-6" />,
      title: 'Selecione "Adicionar à Tela de Início"',
      desc: 'Role a lista de opções e toque em "Adicionar à Tela de Início" (Add to Home Screen).',
    },
    {
      icon: <CheckCircle2 className="h-6 w-6" />,
      title: "Confirme a instalação",
      desc: 'Toque em "Adicionar" no canto superior direito. Pronto! O app do SECMI aparecerá na sua tela inicial.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-600 to-emerald-800 text-white">
      <header className="px-6 pt-10 pb-6 text-center">
        <img
          src={SINDICATO_LOGO}
          alt="SECMI"
          className="mx-auto h-20 w-20 rounded-2xl bg-white p-2 shadow-lg"
        />
        <h1 className="mt-4 text-2xl font-bold">Instalar no iPhone</h1>
        <p className="mt-2 text-sm opacity-90">
          Aplicativo oficial do SECMI — Sindicato dos Comerciários
        </p>
      </header>

      <main className="mx-auto max-w-md px-6 pb-12">
        <div className="rounded-2xl bg-white p-6 text-gray-800 shadow-xl">
          <p className="mb-6 text-sm text-gray-600">
            Siga os 4 passos abaixo no <strong>Safari</strong> do seu iPhone para instalar
            o app:
          </p>

          <ol className="space-y-5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                  {s.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-600">
                      PASSO {i + 1}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold">{s.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
            <strong>Dica:</strong> se você está vendo esta página em outro navegador,
            copie o endereço{" "}
            <code className="rounded bg-white px-1 py-0.5 text-xs">
              {APP_URL}
            </code>{" "}
            e abra no Safari.
          </div>

          <a
            href={APP_URL}
            className="mt-6 block w-full rounded-lg bg-emerald-600 py-3 text-center font-semibold text-white shadow hover:bg-emerald-700"
          >
            Abrir o app agora
          </a>
        </div>

        <p className="mt-6 text-center text-xs opacity-80">
          Após instalado, o app abrirá em tela cheia, como um aplicativo nativo.
        </p>
      </main>
    </div>
  );
}