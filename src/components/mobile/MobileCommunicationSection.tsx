import { Image, Newspaper, Radio, Youtube } from "lucide-react";

export function MobileCommunicationSection() {
  const items = [
    { icon: Image, label: "Galeria", color: "bg-amber-500" },
    { icon: Newspaper, label: "Jornais", color: "bg-slate-600" },
    { icon: Radio, label: "Rádios", color: "bg-emerald-500" },
    { icon: Youtube, label: "Vídeos", color: "bg-red-600" },
  ];

  return (
    <section className="px-4 py-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">COMUNICAÇÃO</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((item, idx) => (
          <button key={idx} className="flex-shrink-0 flex flex-col items-center gap-2">
            <div className={`w-14 h-14 ${item.color} rounded-full flex items-center justify-center`}>
              <item.icon className="h-6 w-6 text-white" />
            </div>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
