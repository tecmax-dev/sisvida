import { useState } from "react";

export function SecurityPopup() {
  const [copiedText, setCopiedText] = useState("📋 Copiar link do grupo");

  const handleCopy = () => {
    navigator.clipboard.writeText("https://chat.whatsapp.com/IWXJNQnsLj089fbjzf7796").then(() => {
      setCopiedText("✅ Link copiado!");
      setTimeout(() => setCopiedText("📋 Copiar link do grupo"), 2000);
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.85)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#1a1a2e",
          borderRadius: "16px",
          padding: "32px 24px",
          maxWidth: "440px",
          width: "100%",
          color: "#fff",
          textAlign: "center",
          boxShadow: "0 0 40px rgba(0,255,156,0.15)",
          border: "1px solid rgba(0,255,156,0.2)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <img
          src="https://leigosacademy.site/logo.png"
          alt="Leigos Academy"
          style={{ display: "block", margin: "0 auto 16px auto", maxWidth: "140px" }}
        />

        <div style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "16px", color: "#ff4444" }}>
          ⚠️ Aviso de Segurança
        </div>

        <div
          style={{
            background: "rgba(255,68,68,0.1)",
            border: "1px solid rgba(255,68,68,0.3)",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "16px",
            fontSize: "14px",
            lineHeight: "1.6",
          }}
        >
          Detectamos que você está utilizando uma <b>extensão não oficial / pirata</b>.<br />
          A extensão oficial é da <b>Leigos Academy</b>.
        </div>

        <div style={{ fontSize: "14px", lineHeight: "1.8", marginBottom: "20px", color: "#ccc" }}>
          Extensões piratas podem conter <span style={{ color: "#ff4444", fontWeight: "bold" }}>códigos maliciosos</span> capazes de:
          <br /><br />
          • Roubar seus dados e acessos<br />
          • Vazamento de projetos<br />
          • Comprometer sua conta<br />
          • Fazer sua conta na plataforma ser <span style={{ color: "#ff4444", fontWeight: "bold" }}>banida permanentemente</span>
          <br /><br />
          Para evitar riscos, utilize apenas a <b>versão oficial da Leigos Academy</b>.<br />
          Acesse:{" "}
          <a href="https://leigosacademy.site" target="_blank" rel="noopener noreferrer" style={{ color: "#00ff9c" }}>
            leigosacademy.site
          </a>
        </div>

        <a
          href="https://chat.whatsapp.com/IWXJNQnsLj089fbjzf7796"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            background: "#25D366",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "bold",
            fontSize: "15px",
            marginBottom: "10px",
          }}
        >
          Entrar no Grupo Oficial
        </a>

        <button
          onClick={handleCopy}
          style={{
            display: "block",
            width: "100%",
            background: "rgba(0,255,156,0.1)",
            color: "#00ff9c",
            padding: "12px 20px",
            borderRadius: "8px",
            border: "1px solid rgba(0,255,156,0.3)",
            fontWeight: "bold",
            fontSize: "15px",
            cursor: "pointer",
            marginBottom: "16px",
          }}
        >
          {copiedText}
        </button>

        <div style={{ fontSize: "13px", color: "#00ff9c", fontWeight: "500" }}>
          🎁 Adquira a versão oficial com <b>50% de desconto</b> dentro do grupo.
        </div>

        <div style={{ fontSize: "13px", color: "#ccc", marginTop: "10px" }}>
          📞 Ou entre em contato: <b>21 95949-6703</b>
        </div>
      </div>
    </div>
  );
}
