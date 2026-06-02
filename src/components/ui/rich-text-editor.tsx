import { useEffect, useMemo, useRef, useState } from "react";
import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  AlignLeft, AlignCenter, AlignRight, Maximize2, Trash2,
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  /** Pasta dentro do bucket public `email-assets` (ex.: "campaigns"). */
  uploadFolder?: string;
}

// Register extended image format preserving width/height/style/data-align
let imageFormatRegistered = false;
function ensureImageFormat() {
  if (imageFormatRegistered) return;
  try {
    const ImageBlot: any = Quill.import("formats/image");
    const ATTRIBUTES = ["alt", "height", "width", "style", "data-align"];
    class StyledImage extends ImageBlot {
      static formats(domNode: HTMLElement) {
        return ATTRIBUTES.reduce((acc: any, k) => {
          if (domNode.hasAttribute(k)) acc[k] = domNode.getAttribute(k);
          return acc;
        }, {});
      }
      format(name: string, value: any) {
        if (ATTRIBUTES.includes(name)) {
          if (value) (this as any).domNode.setAttribute(name, value);
          else (this as any).domNode.removeAttribute(name);
        } else {
          super.format(name, value);
        }
      }
    }
    StyledImage.blotName = "image";
    StyledImage.tagName = "IMG";
    Quill.register(StyledImage, true);
  } catch (_) {}
  imageFormatRegistered = true;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = 320,
  uploadFolder = "campaigns",
}: RichTextEditorProps) {
  ensureImageFormat();
  const quillRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadAndInsertImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Envie uma imagem.", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Máximo 8 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${uploadFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("email-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("email-assets").getPublicUrl(path);
      const url = pub?.publicUrl;
      if (!url) throw new Error("URL pública indisponível");
      const editor = quillRef.current?.getEditor?.();
      if (editor) {
        const range = editor.getSelection(true) || { index: editor.getLength(), length: 0 };
        editor.insertEmbed(range.index, "image", url, "user");
        editor.setSelection(range.index + 1, 0);
        onChange(editor.root.innerHTML);
      }
    } catch (e: any) {
      console.error("upload image error", e);
      toast({ title: "Falha no upload", description: e?.message || "Erro", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const openImagePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) uploadAndInsertImage(file);
    };
    input.click();
  };

  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        [{ font: [] }],
        [{ size: ["small", false, "large", "huge"] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ indent: "-1" }, { indent: "+1" }],
        ["blockquote", "code-block"],
        ["link", "image"],
        ["clean"],
      ],
      // intercepta o botão de imagem nativo do Quill para subir ao storage
      // (evita inserir como base64 dentro do HTML)
      clipboard: { matchVisual: false },
    }),
    []
  );

  // Registra handlers do toolbar + colagem/arrasto de imagens após o mount
  useEffect(() => {
    const editor = quillRef.current?.getEditor?.();
    if (!editor) return;
    const toolbar = editor.getModule("toolbar");
    toolbar?.addHandler?.("image", openImagePicker);

    const root: HTMLElement = editor.root;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) {
            e.preventDefault();
            uploadAndInsertImage(file);
            return;
          }
        }
      }
    };
    const onDrop = (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (files && files.length && files[0].type.startsWith("image/")) {
        e.preventDefault();
        uploadAndInsertImage(files[0]);
      }
    };
    root.addEventListener("paste", onPaste);
    root.addEventListener("drop", onDrop);
    return () => {
      root.removeEventListener("paste", onPaste);
      root.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formats = [
    "header", "font", "size",
    "bold", "italic", "underline", "strike",
    "color", "background",
    "align",
    "list", "bullet", "indent",
    "blockquote", "code-block",
    "link", "image", "width", "height", "style", "data-align",
  ];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const editor = container.querySelector(".ql-editor") as HTMLElement | null;
    if (!editor) return;

    const updateToolbarPos = (img: HTMLImageElement) => {
      const cRect = container.getBoundingClientRect();
      const iRect = img.getBoundingClientRect();
      setToolbarPos({
        top: iRect.top - cRect.top - 44,
        left: iRect.left - cRect.left,
      });
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG") {
        const img = target as HTMLImageElement;
        editor.querySelectorAll("img").forEach((i) => {
          if (i !== img) i.classList.remove("rte-img-selected");
        });
        img.classList.add("rte-img-selected");
        setSelectedImg(img);
        updateToolbarPos(img);
      } else {
        editor.querySelectorAll("img").forEach((i) => i.classList.remove("rte-img-selected"));
        setSelectedImg(null);
        setToolbarPos(null);
      }
    };

    editor.addEventListener("click", onClick);
    return () => {
      editor.removeEventListener("click", onClick);
    };
  }, []);

  const fireChange = () => {
    const editor = quillRef.current?.getEditor?.();
    if (editor) onChange(editor.root.innerHTML);
  };

  const setImageWidth = (pct: number) => {
    if (!selectedImg) return;
    selectedImg.setAttribute("width", `${pct}%`);
    selectedImg.style.width = `${pct}%`;
    selectedImg.style.height = "auto";
    fireChange();
    setTimeout(() => {
      if (containerRef.current && selectedImg) {
        const cRect = containerRef.current.getBoundingClientRect();
        const iRect = selectedImg.getBoundingClientRect();
        setToolbarPos({ top: iRect.top - cRect.top - 44, left: iRect.left - cRect.left });
      }
    }, 30);
  };

  const setImageAlign = (align: "left" | "center" | "right") => {
    if (!selectedImg) return;
    selectedImg.style.float = "";
    selectedImg.style.display = "";
    const margin = selectedImg.style.margin;
    selectedImg.style.margin = "";
    selectedImg.setAttribute("data-align", align);
    if (align === "left") {
      selectedImg.style.float = "left";
      selectedImg.style.margin = "0 12px 8px 0";
    } else if (align === "right") {
      selectedImg.style.float = "right";
      selectedImg.style.margin = "0 0 8px 12px";
    } else {
      selectedImg.style.display = "block";
      selectedImg.style.margin = "8px auto";
    }
    void margin;
    fireChange();
  };

  const deleteImage = () => {
    if (!selectedImg) return;
    selectedImg.remove();
    setSelectedImg(null);
    setToolbarPos(null);
    fireChange();
  };

  return (
    <div
      ref={containerRef}
      className={cn("rich-text-editor relative bg-background rounded-md border", className)}
      style={{ ["--rte-min-height" as any]: `${minHeight}px` }}
    >
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
      {selectedImg && toolbarPos && (
        <div
          className="absolute z-50 flex items-center gap-1 rounded-md border bg-popover px-1.5 py-1 shadow-md"
          style={{ top: Math.max(4, toolbarPos.top), left: Math.max(4, toolbarPos.left) }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button type="button" onClick={() => setImageWidth(25)} className="px-1.5 py-0.5 text-[11px] hover:bg-accent rounded">25%</button>
          <button type="button" onClick={() => setImageWidth(50)} className="px-1.5 py-0.5 text-[11px] hover:bg-accent rounded">50%</button>
          <button type="button" onClick={() => setImageWidth(75)} className="px-1.5 py-0.5 text-[11px] hover:bg-accent rounded">75%</button>
          <button type="button" onClick={() => setImageWidth(100)} className="p-1 hover:bg-accent rounded" title="Largura total"><Maximize2 className="h-3 w-3" /></button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button type="button" onClick={() => setImageAlign("left")} className="p-1 hover:bg-accent rounded" title="Alinhar à esquerda"><AlignLeft className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => setImageAlign("center")} className="p-1 hover:bg-accent rounded" title="Centralizar"><AlignCenter className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => setImageAlign("right")} className="p-1 hover:bg-accent rounded" title="Alinhar à direita"><AlignRight className="h-3.5 w-3.5" /></button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button type="button" onClick={deleteImage} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Remover imagem"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {uploading && (
        <div className="absolute top-2 right-2 z-50 rounded bg-popover px-2 py-1 text-[11px] shadow border">
          Enviando imagem...
        </div>
      )}
      <style>{`
        .rich-text-editor .ql-toolbar {
          border: none;
          border-bottom: 1px solid hsl(var(--border));
          border-top-left-radius: 0.375rem;
          border-top-right-radius: 0.375rem;
          background: hsl(var(--muted) / 0.4);
        }
        .rich-text-editor .ql-container {
          border: none;
          font-family: inherit;
          font-size: 0.95rem;
        }
        .rich-text-editor .ql-editor {
          min-height: var(--rte-min-height);
          color: hsl(var(--foreground));
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground));
          font-style: normal;
        }
        .rich-text-editor .ql-editor img {
          cursor: pointer;
          max-width: 100%;
        }
        .rich-text-editor .ql-editor img.rte-img-selected {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 2px;
        }
        .rich-text-editor .ql-stroke { stroke: hsl(var(--foreground)); }
        .rich-text-editor .ql-fill { fill: hsl(var(--foreground)); }
        .rich-text-editor .ql-picker { color: hsl(var(--foreground)); }
        .rich-text-editor .ql-picker-options {
          background: hsl(var(--popover));
          color: hsl(var(--popover-foreground));
          border-color: hsl(var(--border));
        }
      `}</style>
    </div>
  );
}