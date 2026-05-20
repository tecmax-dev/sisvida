import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const inter = loadInter("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920; // vertical 9:16 (mobile tutorial)

// Scene durations (frames)
const S = [
  90,  // 0 - intro
  120, // 1 - abrir app
  120, // 2 - já sou associado
  120, // 3 - primeiro acesso
  150, // 4 - cpf + email
  150, // 5 - código no email
  150, // 6 - criar senha
  90,  // 7 - pronto
];
export const TOTAL_FRAMES = S.reduce((a, b) => a + b, 0);

const TEAL = "#16a394";
const TEAL_DARK = "#0e7d70";
const TEAL_DEEP = "#08433c";
const CREAM = "#f5f7f6";

// ---------- Captions ----------
type Caption = { from: number; dur: number; text: string };

let acc = 0;
const SC = S.map((d) => {
  const start = acc;
  acc += d;
  return start;
});

const CAPTIONS: Caption[] = [
  { from: SC[0], dur: S[0], text: "Como criar seu primeiro acesso" },
  { from: SC[1], dur: S[1], text: "Abra o app do Sindicato" },
  { from: SC[2], dur: S[2], text: "Toque em \"Já sou associado\"" },
  { from: SC[3], dur: S[3], text: "Selecione \"Primeiro acesso\"" },
  { from: SC[4], dur: S[4], text: "Informe seu CPF e e-mail cadastrado" },
  { from: SC[5], dur: S[5], text: "Digite o código recebido no e-mail" },
  { from: SC[6], dur: S[6], text: "Crie e confirme sua nova senha" },
  { from: SC[7], dur: S[7], text: "Pronto! Bem-vindo(a) ao app" },
];

// ---------- Helpers ----------
const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const float = Math.sin(frame / 30) * 6;
  return (
    <div
      style={{
        width: 620,
        height: 1260,
        borderRadius: 64,
        background: "#0b0b0b",
        padding: 14,
        boxShadow: "0 40px 90px rgba(0,0,0,0.35), 0 0 0 2px rgba(255,255,255,0.06) inset",
        transform: `translateY(${float}px)`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 52,
          background: CREAM,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* status bar */}
        <div style={{ height: 36, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", fontFamily: inter.fontFamily, fontSize: 14, fontWeight: 600, color: "#333" }}>
          <span>9:41</span>
          <span>●●●●●</span>
        </div>
        {children}
      </div>
    </div>
  );
};

const Tap: React.FC<{ x: number; y: number; from: number }> = ({ x, y, from }) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  if (local < 0) return null;
  const ringScale = interpolate(local, [0, 25], [0.4, 2.2], { extrapolateRight: "clamp" });
  const ringOp = interpolate(local, [0, 25], [0.9, 0], { extrapolateRight: "clamp" });
  const dotScale = spring({ frame: local, fps: 30, config: { damping: 10, stiffness: 200 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none" }}>
      <div style={{ position: "absolute", width: 60, height: 60, marginLeft: -30, marginTop: -30, borderRadius: "50%", border: `4px solid ${TEAL}`, transform: `scale(${ringScale})`, opacity: ringOp }} />
      <div style={{ position: "absolute", width: 28, height: 28, marginLeft: -14, marginTop: -14, borderRadius: "50%", background: TEAL, transform: `scale(${dotScale})`, boxShadow: `0 0 20px ${TEAL}` }} />
    </div>
  );
};

// ---------- Scenes ----------
const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const titleY = interpolate(spring({ frame, fps: 30, config: { damping: 14 } }), [0, 1], [60, 0]);
  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const logoScale = spring({ frame, fps: 30, config: { damping: 9, stiffness: 110 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40 }}>
      <div
        style={{
          width: 220, height: 220, borderRadius: 56,
          background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: `scale(${logoScale})`,
          boxShadow: "0 30px 60px rgba(0,0,0,0.25)",
          fontFamily: inter.fontFamily, fontWeight: 800, color: TEAL, fontSize: 86, letterSpacing: -3,
        }}
      >S</div>
      <div style={{ fontFamily: inter.fontFamily, color: "#fff", fontWeight: 800, fontSize: 64, textAlign: "center", lineHeight: 1.05, transform: `translateY(${titleY}px)`, opacity: titleOp, letterSpacing: -1 }}>
        Primeiro Acesso
        <div style={{ fontSize: 32, fontWeight: 600, opacity: 0.85, marginTop: 12 }}>App do Sindicato</div>
      </div>
    </AbsoluteFill>
  );
};

const SceneOpenApp: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = spring({ frame, fps: 30, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${0.85 + scale * 0.15})` }}>
        <PhoneFrame>
          <div style={{ flex: 1, background: TEAL, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: inter.fontFamily, padding: 32 }}>
            <div style={{ width: 130, height: 130, borderRadius: 32, background: "#fff", color: TEAL, fontWeight: 800, fontSize: 56, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>S</div>
            <div style={{ fontSize: 38, fontWeight: 800, marginBottom: 8 }}>Bem-vindo(a)</div>
            <div style={{ fontSize: 20, opacity: 0.9, textAlign: "center", marginBottom: 40, lineHeight: 1.4 }}>Entre em sua conta ou cadastre-se.</div>
            <div style={{ width: "100%", padding: "20px 0", background: "#fff", color: TEAL_DARK, fontWeight: 700, fontSize: 22, borderRadius: 999, textAlign: "center", marginBottom: 14 }}>Cadastrar-se agora</div>
            <div style={{ width: "100%", padding: "20px 0", background: TEAL_DARK, color: "#fff", fontWeight: 700, fontSize: 22, borderRadius: 999, textAlign: "center", border: `2px solid ${TEAL}` }}>Já sou associado</div>
          </div>
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

const SceneLogin: React.FC = () => {
  const frame = useCurrentFrame();
  const highlight = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <PhoneFrame>
        <div style={{ flex: 1, background: TEAL, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: inter.fontFamily, padding: 32 }}>
          <div style={{ width: 130, height: 130, borderRadius: 32, background: "#fff", color: TEAL, fontWeight: 800, fontSize: 56, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>S</div>
          <div style={{ fontSize: 38, fontWeight: 800, marginBottom: 40 }}>Bem-vindo(a)</div>
          <div style={{ width: "100%", padding: "20px 0", background: "#fff", color: TEAL_DARK, fontWeight: 700, fontSize: 22, borderRadius: 999, textAlign: "center", marginBottom: 14, opacity: 0.6 }}>Cadastrar-se agora</div>
          <div style={{ width: "100%", padding: "20px 0", background: "#fff", color: TEAL_DEEP, fontWeight: 800, fontSize: 22, borderRadius: 999, textAlign: "center", border: `4px solid #ffd84a`, boxShadow: `0 0 ${20 * highlight}px rgba(255,216,74,${highlight})`, transform: `scale(${1 + highlight * 0.04})` }}>Já sou associado</div>
        </div>
        <Tap x={310} y={1040} from={40} />
      </PhoneFrame>
    </AbsoluteFill>
  );
};

const SceneFirstAccess: React.FC = () => {
  const frame = useCurrentFrame();
  const highlight = interpolate(frame, [25, 40], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <PhoneFrame>
        <div style={{ flex: 1, background: CREAM, height: "100%", padding: 30, fontFamily: inter.fontFamily, color: "#222" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: TEAL_DEEP, marginBottom: 28 }}>Entrar</div>
          <div style={{ background: "#fff", border: "2px solid #e5e7eb", borderRadius: 16, padding: "20px 18px", marginBottom: 14, color: "#9ca3af", fontSize: 20 }}>CPF</div>
          <div style={{ background: "#fff", border: "2px solid #e5e7eb", borderRadius: 16, padding: "20px 18px", marginBottom: 24, color: "#9ca3af", fontSize: 20 }}>Senha</div>
          <div style={{ background: TEAL, color: "#fff", padding: "20px 0", borderRadius: 999, fontWeight: 700, fontSize: 22, textAlign: "center", marginBottom: 28 }}>Entrar</div>
          <div style={{
            textAlign: "center", fontWeight: 800, color: TEAL_DARK, fontSize: 20,
            padding: 16, borderRadius: 14,
            background: `rgba(255,216,74,${0.25 * highlight})`,
            border: `3px solid rgba(255,216,74,${highlight})`,
            transform: `scale(${1 + highlight * 0.04})`,
          }}>Primeiro acesso? Cadastre sua senha</div>
        </div>
        <Tap x={310} y={930} from={50} />
      </PhoneFrame>
    </AbsoluteFill>
  );
};

const SceneCpfEmail: React.FC = () => {
  const frame = useCurrentFrame();
  const cpf = "898.151.305-87".slice(0, Math.floor(interpolate(frame, [10, 50], [0, 14], { extrapolateRight: "clamp" })));
  const email = "ricardo@email.com".slice(0, Math.floor(interpolate(frame, [55, 110], [0, 17], { extrapolateRight: "clamp" })));
  const btn = interpolate(frame, [115, 135], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <PhoneFrame>
        <div style={{ flex: 1, background: CREAM, height: "100%", padding: 30, fontFamily: inter.fontFamily, color: "#222" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: TEAL_DEEP, marginBottom: 8 }}>Primeiro acesso</div>
          <div style={{ fontSize: 16, color: "#6b7280", marginBottom: 28, lineHeight: 1.4 }}>Informe seu CPF e e-mail cadastrado no sindicato.</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>CPF</div>
          <div style={{ background: "#fff", border: `2px solid ${TEAL}`, borderRadius: 16, padding: "20px 18px", marginBottom: 18, fontSize: 22, color: "#111", minHeight: 28 }}>{cpf}<span style={{ opacity: (frame % 30) < 15 ? 1 : 0 }}>|</span></div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>E-mail</div>
          <div style={{ background: "#fff", border: `2px solid ${TEAL}`, borderRadius: 16, padding: "20px 18px", marginBottom: 28, fontSize: 22, color: "#111", minHeight: 28 }}>{email}<span style={{ opacity: frame > 55 && (frame % 30) < 15 ? 1 : 0 }}>|</span></div>
          <div style={{ background: TEAL, color: "#fff", padding: "20px 0", borderRadius: 999, fontWeight: 700, fontSize: 22, textAlign: "center", opacity: 0.5 + btn * 0.5, transform: `scale(${1 + btn * 0.03})` }}>Enviar código</div>
        </div>
        <Tap x={310} y={1080} from={138} />
      </PhoneFrame>
    </AbsoluteFill>
  );
};

const SceneEmailCode: React.FC = () => {
  const frame = useCurrentFrame();
  const codeStr = "847209";
  const filled = Math.floor(interpolate(frame, [40, 110], [0, 6], { extrapolateRight: "clamp" }));

  // floating email envelope
  const envY = interpolate(spring({ frame, fps: 30, config: { damping: 14 } }), [0, 1], [-30, 0]);
  const envOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <PhoneFrame>
        <div style={{ flex: 1, background: CREAM, height: "100%", padding: 30, fontFamily: inter.fontFamily, color: "#222" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: TEAL_DEEP, marginBottom: 8 }}>Código de verificação</div>
          <div style={{ fontSize: 15, color: "#6b7280", marginBottom: 26, lineHeight: 1.4 }}>Enviamos um código para seu e-mail.</div>

          {/* email mock card */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 18, marginBottom: 24, transform: `translateY(${envY}px)`, opacity: envOp, boxShadow: "0 10px 24px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: TEAL, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✉</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>SECMI — Sindicato</div>
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>Seu código:</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: TEAL_DARK, letterSpacing: 10 }}>{codeStr}</div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20 }}>
            {codeStr.split("").map((ch, i) => (
              <div key={i} style={{
                width: 64, height: 76, borderRadius: 14,
                border: `2px solid ${i < filled ? TEAL : "#d1d5db"}`,
                background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, fontWeight: 800, color: TEAL_DEEP,
              }}>{i < filled ? ch : ""}</div>
            ))}
          </div>

          <div style={{ background: TEAL, color: "#fff", padding: "18px 0", borderRadius: 999, fontWeight: 700, fontSize: 20, textAlign: "center", opacity: filled === 6 ? 1 : 0.5 }}>Confirmar</div>
        </div>
      </PhoneFrame>
    </AbsoluteFill>
  );
};

const SceneNewPassword: React.FC = () => {
  const frame = useCurrentFrame();
  const pwd = "••••••••".slice(0, Math.floor(interpolate(frame, [15, 60], [0, 8], { extrapolateRight: "clamp" })));
  const pwd2 = "••••••••".slice(0, Math.floor(interpolate(frame, [70, 115], [0, 8], { extrapolateRight: "clamp" })));
  const btn = interpolate(frame, [118, 138], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <PhoneFrame>
        <div style={{ flex: 1, background: CREAM, height: "100%", padding: 30, fontFamily: inter.fontFamily, color: "#222" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: TEAL_DEEP, marginBottom: 8 }}>Crie sua senha</div>
          <div style={{ fontSize: 15, color: "#6b7280", marginBottom: 26, lineHeight: 1.4 }}>Mínimo de 6 caracteres.</div>

          <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Nova senha</div>
          <div style={{ background: "#fff", border: `2px solid ${TEAL}`, borderRadius: 16, padding: "20px 18px", marginBottom: 18, fontSize: 26, color: "#111", letterSpacing: 6, minHeight: 32 }}>{pwd}</div>

          <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Confirmar senha</div>
          <div style={{ background: "#fff", border: `2px solid ${TEAL}`, borderRadius: 16, padding: "20px 18px", marginBottom: 28, fontSize: 26, color: "#111", letterSpacing: 6, minHeight: 32 }}>{pwd2}</div>

          <div style={{ background: TEAL, color: "#fff", padding: "20px 0", borderRadius: 999, fontWeight: 700, fontSize: 22, textAlign: "center", opacity: 0.5 + btn * 0.5, transform: `scale(${1 + btn * 0.03})` }}>Salvar senha</div>
        </div>
        <Tap x={310} y={1080} from={140} />
      </PhoneFrame>
    </AbsoluteFill>
  );
};

const SceneDone: React.FC = () => {
  const frame = useCurrentFrame();
  const checkScale = spring({ frame, fps: 30, config: { damping: 8, stiffness: 140 } });
  const titleOp = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 }}>
      <div style={{
        width: 240, height: 240, borderRadius: "50%",
        background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        transform: `scale(${checkScale})`,
        boxShadow: "0 30px 70px rgba(0,0,0,0.25)",
      }}>
        <div style={{ fontSize: 130, color: TEAL, fontWeight: 800, lineHeight: 1 }}>✓</div>
      </div>
      <div style={{ fontFamily: inter.fontFamily, color: "#fff", fontWeight: 800, fontSize: 64, textAlign: "center", opacity: titleOp, letterSpacing: -1 }}>
        Tudo pronto!
        <div style={{ fontSize: 28, fontWeight: 600, opacity: 0.9, marginTop: 14 }}>Acesse seus benefícios</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Background ----------
const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 80) * 30;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${TEAL} 0%, ${TEAL_DARK} 60%, ${TEAL_DEEP} 100%)` }}>
      <div style={{ position: "absolute", top: -120 + drift, left: -120, width: 480, height: 480, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "absolute", bottom: -150 - drift, right: -150, width: 560, height: 560, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <div style={{ position: "absolute", top: "40%", left: -60, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
    </AbsoluteFill>
  );
};

// ---------- Captions overlay ----------
const CaptionBar: React.FC = () => {
  const frame = useCurrentFrame();
  const active = CAPTIONS.find((c) => frame >= c.from && frame < c.from + c.dur);
  if (!active) return null;
  const local = frame - active.from;
  const op = interpolate(local, [0, 8, active.dur - 8, active.dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(spring({ frame: local, fps: 30, config: { damping: 16 } }), [0, 1], [40, 0]);
  return (
    <div style={{
      position: "absolute", bottom: 90, left: 0, right: 0,
      display: "flex", justifyContent: "center", padding: "0 60px",
      opacity: op, transform: `translateY(${y}px)`, pointerEvents: "none",
    }}>
      <div style={{
        background: "rgba(0,0,0,0.72)", color: "#fff",
        padding: "20px 32px", borderRadius: 22,
        fontFamily: inter.fontFamily, fontWeight: 700, fontSize: 38, lineHeight: 1.25,
        textAlign: "center", maxWidth: 920,
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>{active.text}</div>
    </div>
  );
};

const StepBadge: React.FC = () => {
  const frame = useCurrentFrame();
  let stepIdx = -1;
  for (let i = 0; i < SC.length; i++) {
    if (frame >= SC[i] && frame < SC[i] + S[i]) { stepIdx = i; break; }
  }
  if (stepIdx <= 0 || stepIdx >= 7) return null;
  return (
    <div style={{ position: "absolute", top: 80, left: 60, display: "flex", gap: 10, alignItems: "center", fontFamily: inter.fontFamily, color: "#fff", fontWeight: 700 }}>
      <div style={{ background: "rgba(255,255,255,0.18)", padding: "10px 18px", borderRadius: 999, fontSize: 22, border: "1px solid rgba(255,255,255,0.25)" }}>Passo {stepIdx} de 6</div>
    </div>
  );
};

// ---------- Main ----------
export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: TEAL_DEEP, fontFamily: inter.fontFamily }}>
      <Background />

      <Sequence from={SC[0]} durationInFrames={S[0]}><SceneIntro /></Sequence>
      <Sequence from={SC[1]} durationInFrames={S[1]}><SceneOpenApp /></Sequence>
      <Sequence from={SC[2]} durationInFrames={S[2]}><SceneLogin /></Sequence>
      <Sequence from={SC[3]} durationInFrames={S[3]}><SceneFirstAccess /></Sequence>
      <Sequence from={SC[4]} durationInFrames={S[4]}><SceneCpfEmail /></Sequence>
      <Sequence from={SC[5]} durationInFrames={S[5]}><SceneEmailCode /></Sequence>
      <Sequence from={SC[6]} durationInFrames={S[6]}><SceneNewPassword /></Sequence>
      <Sequence from={SC[7]} durationInFrames={S[7]}><SceneDone /></Sequence>

      <StepBadge />
      <CaptionBar />
    </AbsoluteFill>
  );
};