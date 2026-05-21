import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, interpolate, spring } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const inter = loadInter("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920; // vertical 9:16 (mobile tutorial)

// Scene durations (frames)
const S = [
  75,  // 0 - intro
  105, // 1 - welcome (tap Já sou associado)
  105, // 2 - login (tap Primeiro acesso?)
  120, // 3 - CPF
  120, // 4 - data de nascimento
  120, // 5 - criar senha
  90,  // 6 - sucesso
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
  { from: SC[1], dur: S[1], text: "No app, toque em \"Já sou associado\"" },
  { from: SC[2], dur: S[2], text: "Toque em \"Primeiro acesso\"" },
  { from: SC[3], dur: S[3], text: "Informe seu CPF e toque em \"Continuar\"" },
  { from: SC[4], dur: S[4], text: "Confirme sua data de nascimento" },
  { from: SC[5], dur: S[5], text: "Crie sua senha e confirme" },
  { from: SC[6], dur: S[6], text: "Pronto! Acesse o app do Sindicato" },
];

// ---------- Phone Frame ----------
// Inner area sized to match the captured screenshot aspect ratio 390:844
const INNER_W = 580;
const INNER_H = Math.round(INNER_W * (844 / 390)); // 1256
const PAD = 16;

const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const float = Math.sin(frame / 30) * 6;
  return (
    <div
      style={{
        width: INNER_W + PAD * 2,
        height: INNER_H + PAD * 2,
        borderRadius: 64,
        background: "#0b0b0b",
        padding: PAD,
        boxShadow: "0 40px 90px rgba(0,0,0,0.35), 0 0 0 2px rgba(255,255,255,0.06) inset",
        transform: `translateY(${float}px)`,
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 50,
          background: CREAM,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const Screen: React.FC<{ src: string; opacity?: number }> = ({ src, opacity = 1 }) => (
  <Img
    src={staticFile(src)}
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity }}
  />
);

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

// Tap positions are based on screenshot coords (390x844) scaled into the
// phone frame (INNER_W x INNER_H). Use scaleX = INNER_W/390, scaleY = INNER_H/844.
const sx = (x: number) => (x * INNER_W) / 390;
const sy = (y: number) => (y * INNER_H) / 844;

const SceneScreenshot: React.FC<{
  src: string;
  srcAfter?: string;
  switchAt?: number; // frame to crossfade to srcAfter
  tap?: { x: number; y: number; at: number };
  entry?: boolean;
}> = ({ src, srcAfter, switchAt = 60, tap, entry = true }) => {
  const frame = useCurrentFrame();
  const enter = entry ? spring({ frame, fps: 30, config: { damping: 14 } }) : 1;
  const scale = 0.92 + enter * 0.08;
  const op = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const afterOp = srcAfter ? interpolate(frame, [switchAt, switchAt + 14], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }) : 0;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <div style={{ transform: `scale(${scale})` }}>
        <PhoneFrame>
          <Screen src={src} />
          {srcAfter && <Screen src={srcAfter} opacity={afterOp} />}
          {tap && <Tap x={PAD + sx(tap.x)} y={PAD + sy(tap.y)} from={tap.at} />}
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// Overlay typed text on top of the empty CPF screenshot
const SceneCpf: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 14 } });
  const scale = 0.92 + enter * 0.08;
  const op = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  // Fictitious CPF (não pertence a nenhuma pessoa real)
  const cpfFull = "123.456.789-00";
  const typed = cpfFull.slice(0, Math.floor(interpolate(frame, [18, 70], [0, cpfFull.length], { extrapolateRight: "clamp" })));
  // Input position in screenshot: ~y 357-396, x ~30-360, font roughly 17px
  const inputX = PAD + sx(48);
  const inputY = PAD + sy(368);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <div style={{ transform: `scale(${scale})` }}>
        <PhoneFrame>
          <Screen src="screens/03-cpf.png" />
          {/* white overlay to mask the placeholder */}
          <div style={{
            position: "absolute",
            left: PAD + sx(30),
            top: PAD + sy(355),
            width: sx(330),
            height: sy(45),
            background: "#fff",
            borderRadius: 8,
          }} />
          <div style={{
            position: "absolute", left: inputX, top: inputY,
            fontFamily: inter.fontFamily, fontSize: sy(22), fontWeight: 600, color: "#111",
            letterSpacing: 0.5,
          }}>
            {typed}<span style={{ opacity: (frame % 30) < 15 ? 1 : 0, color: TEAL }}>|</span>
          </div>
          {/* Tap on Continuar button (~y 468) */}
          <Tap x={PAD + sx(195)} y={PAD + sy(468)} from={85} />
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// Generic typed-input overlay over a screenshot
const SceneTyped: React.FC<{
  src: string;
  fullText: string;
  inputBox: { x: number; y: number; w: number; h: number }; // in screenshot coords
  textOffset?: { x: number; y: number };
  typeFrom?: number;
  typeTo?: number;
  tap?: { x: number; y: number; at: number };
  fontSize?: number;
  mask?: boolean;
}> = ({ src, fullText, inputBox, textOffset = { x: 18, y: 13 }, typeFrom = 18, typeTo = 70, tap, fontSize = 22, mask = false }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 14 } });
  const scale = 0.92 + enter * 0.08;
  const op = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const count = Math.floor(interpolate(frame, [typeFrom, typeTo], [0, fullText.length], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }));
  const typed = mask ? "•".repeat(count) : fullText.slice(0, count);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <div style={{ transform: `scale(${scale})` }}>
        <PhoneFrame>
          <Screen src={src} />
          <div style={{
            position: "absolute",
            left: PAD + sx(inputBox.x),
            top: PAD + sy(inputBox.y),
            width: sx(inputBox.w),
            height: sy(inputBox.h),
            background: "#fff",
            borderRadius: 8,
          }} />
          <div style={{
            position: "absolute",
            left: PAD + sx(inputBox.x + textOffset.x),
            top: PAD + sy(inputBox.y + textOffset.y),
            fontFamily: inter.fontFamily, fontSize: sy(fontSize), fontWeight: 600, color: "#111",
            letterSpacing: mask ? 2 : 0.5,
          }}>
            {typed}<span style={{ opacity: (frame % 30) < 15 ? 1 : 0, color: TEAL }}>|</span>
          </div>
          {tap && <Tap x={PAD + sx(tap.x)} y={PAD + sy(tap.y)} from={tap.at} />}
        </PhoneFrame>
      </div>
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
        width: 260, height: 260, borderRadius: "50%",
        background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        transform: `scale(${checkScale})`,
        boxShadow: "0 30px 70px rgba(0,0,0,0.25)",
      }}>
        <div style={{ fontSize: 150, color: TEAL, fontWeight: 800, lineHeight: 1 }}>✓</div>
      </div>
      <div style={{ fontFamily: inter.fontFamily, color: "#fff", fontWeight: 800, fontSize: 68, textAlign: "center", opacity: titleOp, letterSpacing: -1 }}>
        Senha cadastrada!
        <div style={{ fontSize: 30, fontWeight: 600, opacity: 0.9, marginTop: 14 }}>Bem-vindo(a) ao App do Sindicato</div>
      </div>
    </AbsoluteFill>
  );
};

// (SceneDone defined above)

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
  if (stepIdx <= 0 || stepIdx >= 6) return null;
  return (
    <div style={{ position: "absolute", top: 80, left: 60, display: "flex", gap: 10, alignItems: "center", fontFamily: inter.fontFamily, color: "#fff", fontWeight: 700 }}>
      <div style={{ background: "rgba(255,255,255,0.18)", padding: "10px 18px", borderRadius: 999, fontSize: 22, border: "1px solid rgba(255,255,255,0.25)" }}>Passo {stepIdx} de 5</div>
    </div>
  );
};

// ---------- Main ----------
export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: TEAL_DEEP, fontFamily: inter.fontFamily }}>
      <Background />

      <Sequence from={SC[0]} durationInFrames={S[0]}><SceneIntro /></Sequence>

      {/* Welcome -> tap "Já sou associado" (~y 718) */}
      <Sequence from={SC[1]} durationInFrames={S[1]}>
        <SceneScreenshot src="screens/01-welcome.png" tap={{ x: 195, y: 718, at: 60 }} />
      </Sequence>

      {/* Login -> tap "Primeiro acesso? Clique aqui..." (~y 655) */}
      <Sequence from={SC[2]} durationInFrames={S[2]}>
        <SceneScreenshot src="screens/02-login.png" tap={{ x: 195, y: 655, at: 60 }} />
      </Sequence>

      {/* CPF step with typing overlay */}
      <Sequence from={SC[3]} durationInFrames={S[3]}>
        <SceneCpf />
      </Sequence>

      {/* Birth date: crossfade empty -> filled, tap Validar */}
      <Sequence from={SC[4]} durationInFrames={S[4]}>
        <SceneScreenshot src="screens/04-birthdate.png" srcAfter="screens/04b-birthdate-filled.png" switchAt={25} tap={{ x: 195, y: 528, at: 85 }} />
      </Sequence>

      {/* Password: crossfade empty -> filled, tap Cadastrar senha */}
      <Sequence from={SC[5]} durationInFrames={S[5]}>
        <SceneScreenshot src="screens/05-password.png" srcAfter="screens/05b-password-filled.png" switchAt={25} tap={{ x: 195, y: 616, at: 85 }} />
      </Sequence>

      <Sequence from={SC[6]} durationInFrames={S[6]}><SceneDone /></Sequence>

      <StepBadge />
      <CaptionBar />
    </AbsoluteFill>
  );
};