import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Image,
  Newspaper,
  Radio,
  Youtube,
  Play,
  Download,
  ExternalLink,
  Calendar,
  Eye,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type MediaType = "galeria" | "jornais" | "radios" | "videos";

interface MediaConfig {
  id: MediaType;
  title: string;
  icon: typeof Image;
  color: string;
}

const mediaTypes: MediaConfig[] = [
  { id: "galeria", title: "Galeria de Fotos", icon: Image, color: "bg-amber-500" },
  { id: "jornais", title: "Jornais", icon: Newspaper, color: "bg-slate-600" },
  { id: "radios", title: "Rádios", icon: Radio, color: "bg-emerald-500" },
  { id: "videos", title: "Vídeos", icon: Youtube, color: "bg-red-600" },
];

// ============ GALERIA ============
function GaleriaContent() {
  const [selectedImage, setSelectedImage] = useState<any>(null);
  
  const albums = [
    {
      id: "1",
      titulo: "Assembleia Geral 2024",
      data: "2024-03-15",
      fotos: [
        { id: "1", url: "https://via.placeholder.com/400x300/10B981/FFFFFF?text=Foto+1", descricao: "Abertura da assembleia" },
        { id: "2", url: "https://via.placeholder.com/400x300/10B981/FFFFFF?text=Foto+2", descricao: "Votação" },
        { id: "3", url: "https://via.placeholder.com/400x300/10B981/FFFFFF?text=Foto+3", descricao: "Encerramento" },
      ],
    },
    {
      id: "2",
      titulo: "Dia do Trabalhador",
      data: "2024-05-01",
      fotos: [
        { id: "4", url: "https://via.placeholder.com/400x300/F59E0B/FFFFFF?text=Foto+4", descricao: "Celebração" },
        { id: "5", url: "https://via.placeholder.com/400x300/F59E0B/FFFFFF?text=Foto+5", descricao: "Confraternização" },
      ],
    },
    {
      id: "3",
      titulo: "Campanha Salarial 2024",
      data: "2024-04-20",
      fotos: [
        { id: "6", url: "https://via.placeholder.com/400x300/3B82F6/FFFFFF?text=Foto+6", descricao: "Negociação" },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Confira os registros fotográficos dos eventos e atividades do sindicato.
      </p>
      
      <div className="space-y-4">
        {albums.map((album) => (
          <Card key={album.id} className="border shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4 border-b">
                <h4 className="font-semibold text-sm">{album.titulo}</h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(album.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                  <span>•</span>
                  <span>{album.fotos.length} fotos</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1">
                {album.fotos.slice(0, 3).map((foto, idx) => (
                  <div
                    key={foto.id}
                    className="aspect-square bg-muted rounded cursor-pointer overflow-hidden"
                    onClick={() => setSelectedImage(foto)}
                  >
                    <img src={foto.url} alt={foto.descricao} className="w-full h-full object-cover" />
                    {idx === 2 && album.fotos.length > 3 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold">+{album.fotos.length - 3}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          {selectedImage && (
            <>
              <img src={selectedImage.url} alt={selectedImage.descricao} className="w-full" />
              <div className="p-4">
                <p className="text-sm">{selectedImage.descricao}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ JORNAIS ============
function JornaisContent() {
  const jornais = [
    { id: "1", titulo: "Jornal do Trabalhador - Ed. 150", data: "2024-03-01", paginas: 12, downloadUrl: "#" },
    { id: "2", titulo: "Jornal do Trabalhador - Ed. 149", data: "2024-02-01", paginas: 10, downloadUrl: "#" },
    { id: "3", titulo: "Jornal do Trabalhador - Ed. 148", data: "2024-01-01", paginas: 14, downloadUrl: "#" },
    { id: "4", titulo: "Boletim Especial - CCT 2024", data: "2024-04-15", paginas: 4, downloadUrl: "#" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Leia as edições do nosso jornal e boletins informativos.
      </p>
      
      <div className="space-y-3">
        {jornais.map((jornal) => (
          <Card key={jornal.id} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
                  <Newspaper className="h-6 w-6 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate">{jornal.titulo}</h4>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(jornal.data), "dd/MM/yyyy")}</span>
                    <span>•</span>
                    <span>{jornal.paginas} páginas</span>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ RÁDIOS ============
function RadiosContent() {
  const radios = [
    { id: "1", nome: "Rádio Trabalhador FM", frequencia: "98.5 FM", status: "ao_vivo", streamUrl: "#" },
    { id: "2", nome: "Podcast Sindical", descricao: "Últimas notícias do mundo do trabalho", episodios: 45 },
  ];

  const podcasts = [
    { id: "1", titulo: "Ep. 45 - Reforma Trabalhista", duracao: "32:15", data: "2024-03-20" },
    { id: "2", titulo: "Ep. 44 - Negociação Coletiva", duracao: "28:40", data: "2024-03-13" },
    { id: "3", titulo: "Ep. 43 - Direitos do Trabalhador", duracao: "35:22", data: "2024-03-06" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ouça nossa rádio e podcasts com conteúdo exclusivo para trabalhadores.
      </p>
      
      {/* Rádio ao vivo */}
      <Card className="border shadow-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
              <Radio className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-lg">Rádio Trabalhador FM</h4>
                <Badge className="bg-red-500 text-white text-xs animate-pulse">AO VIVO</Badge>
              </div>
              <p className="text-sm opacity-90">98.5 FM</p>
            </div>
            <Button size="icon" className="bg-white text-emerald-600 hover:bg-gray-100">
              <Play className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Podcasts */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Podcast Sindical</h4>
        <div className="space-y-2">
          {podcasts.map((ep) => (
            <Card key={ep.id} className="border shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Button size="icon" variant="outline" className="h-10 w-10 rounded-full flex-shrink-0">
                    <Play className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-sm truncate">{ep.titulo}</h5>
                    <p className="text-xs text-muted-foreground">{ep.duracao} • {format(new Date(ep.data), "dd/MM/yyyy")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ VÍDEOS ============
function VideosContent() {
  const videos = [
    { id: "1", titulo: "Assembleia Geral 2024 - Resumo", duracao: "15:32", visualizacoes: 1250, data: "2024-03-16", thumbnail: "https://via.placeholder.com/320x180/EF4444/FFFFFF?text=Video+1" },
    { id: "2", titulo: "Entrevista: Presidente fala sobre CCT", duracao: "22:15", visualizacoes: 890, data: "2024-03-10", thumbnail: "https://via.placeholder.com/320x180/EF4444/FFFFFF?text=Video+2" },
    { id: "3", titulo: "Campanha Salarial - Mobilização", duracao: "08:45", visualizacoes: 2100, data: "2024-04-22", thumbnail: "https://via.placeholder.com/320x180/EF4444/FFFFFF?text=Video+3" },
    { id: "4", titulo: "Tutorial: Como emitir declarações", duracao: "05:30", visualizacoes: 3400, data: "2024-02-28", thumbnail: "https://via.placeholder.com/320x180/EF4444/FFFFFF?text=Video+4" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Assista aos vídeos institucionais, entrevistas e tutoriais do sindicato.
      </p>
      
      <div className="space-y-3">
        {videos.map((video) => (
          <Card key={video.id} className="border shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="flex gap-3 p-3">
                <div className="w-32 h-20 bg-muted rounded overflow-hidden flex-shrink-0 relative">
                  <img src={video.thumbnail} alt={video.titulo} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                      <Play className="h-5 w-5 text-red-600 ml-0.5" />
                    </div>
                  </div>
                  <Badge className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1">
                    {video.duracao}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm line-clamp-2">{video.titulo}</h4>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    <span>{video.visualizacoes.toLocaleString()} visualizações</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(video.data), "dd 'de' MMM", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ MAIN PAGE ============
export default function MobileCommunicationPage() {
  const navigate = useNavigate();
  const { mediaType } = useParams<{ mediaType?: string }>();
  const [selectedMedia, setSelectedMedia] = useState<MediaConfig | null>(null);

  useEffect(() => {
    if (mediaType) {
      const media = mediaTypes.find((m) => m.id === mediaType);
      setSelectedMedia(media || null);
    } else {
      setSelectedMedia(null);
    }
  }, [mediaType]);

  const renderMediaContent = () => {
    if (!selectedMedia) return null;

    switch (selectedMedia.id) {
      case "galeria":
        return <GaleriaContent />;
      case "jornais":
        return <JornaisContent />;
      case "radios":
        return <RadiosContent />;
      case "videos":
        return <VideosContent />;
      default:
        return null;
    }
  };

  // Media detail view
  if (selectedMedia) {
    return (
      <div className="min-h-screen bg-muted flex flex-col">
        {/* Header */}
        <header className={`${selectedMedia.color} text-white p-4 sticky top-0 z-50`}>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/app/home")}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div className="flex items-center gap-3">
              <selectedMedia.icon className="h-6 w-6" />
              <h1 className="text-xl font-bold">{selectedMedia.title}</h1>
            </div>
          </div>
        </header>

        {/* Content */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4">
            {renderMediaContent()}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Media types list view
  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/app/home")}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-bold">Comunicação</h1>
        </div>
      </header>

      {/* Media Types Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {mediaTypes.map((media) => (
            <Card
              key={media.id}
              className="border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/app/comunicacao/${media.id}`)}
            >
              <CardContent className="p-4 text-center">
                <div className={`w-16 h-16 mx-auto ${media.color} rounded-full flex items-center justify-center mb-3`}>
                  <media.icon className="h-8 w-8 text-white" />
                </div>
                <h4 className="font-semibold text-sm">{media.title}</h4>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
