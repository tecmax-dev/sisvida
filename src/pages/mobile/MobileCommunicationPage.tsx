import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PopupBase } from "@/components/ui/popup-base";
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
  Loader2,
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

// ============ GALERIA - DINÂMICO ============
function GaleriaContent() {
  const [fotos, setFotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<any>(null);

  useEffect(() => {
    loadFotos();
  }, []);

  const loadFotos = async () => {
    try {
      const clinicId = localStorage.getItem('mobile_clinic_id');
      if (!clinicId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("union_app_content")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("content_type", "galeria")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setFotos(data || []);
    } catch (err) {
      console.error("Error loading galeria:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (fotos.length === 0) {
    return (
      <div className="text-center py-8">
        <Image className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhuma foto cadastrada na galeria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Confira os registros fotográficos dos eventos e atividades do sindicato.
      </p>
      
      <div className="grid grid-cols-2 gap-3">
        {fotos.map((foto) => (
          <Card 
            key={foto.id} 
            className="border shadow-sm overflow-hidden cursor-pointer"
            onClick={() => setSelectedImage(foto)}
          >
            <CardContent className="p-0">
              {foto.image_url ? (
                <div className="aspect-square bg-muted">
                  <img 
                    src={foto.image_url} 
                    alt={foto.title} 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-square bg-muted flex items-center justify-center">
                  <Image className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-2">
                <p className="text-xs font-medium line-clamp-2">{foto.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Image Preview Popup */}
      <PopupBase 
        open={!!selectedImage} 
        onClose={() => setSelectedImage(null)}
        maxWidth="md"
        className="p-0 overflow-hidden"
      >
        {selectedImage && (
          <>
            <img 
              src={selectedImage.image_url} 
              alt={selectedImage.title} 
              className="w-full" 
            />
            <div className="p-4">
              <h4 className="font-semibold">{selectedImage.title}</h4>
              {selectedImage.description && (
                <p className="text-sm text-muted-foreground mt-1">{selectedImage.description}</p>
              )}
            </div>
          </>
        )}
      </PopupBase>
    </div>
  );
}

// ============ JORNAIS - DINÂMICO ============
function JornaisContent() {
  const [jornais, setJornais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJornais();
  }, []);

  const loadJornais = async () => {
    try {
      const clinicId = localStorage.getItem('mobile_clinic_id');
      if (!clinicId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("union_app_content")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("content_type", "jornal")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setJornais(data || []);
    } catch (err) {
      console.error("Error loading jornais:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
      </div>
    );
  }

  if (jornais.length === 0) {
    return (
      <div className="text-center py-8">
        <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhum jornal cadastrado.
        </p>
      </div>
    );
  }

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
                  <h4 className="font-semibold text-sm truncate">{jornal.title}</h4>
                  {jornal.description && (
                    <p className="text-xs text-muted-foreground mt-1">{jornal.description}</p>
                  )}
                </div>
                {jornal.file_url && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.open(jornal.file_url, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ RÁDIOS - DINÂMICO ============
function RadiosContent() {
  const [radios, setRadios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRadios();
  }, []);

  const loadRadios = async () => {
    try {
      const clinicId = localStorage.getItem('mobile_clinic_id');
      if (!clinicId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("union_app_content")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("content_type", "radio")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setRadios(data || []);
    } catch (err) {
      console.error("Error loading radios:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (radios.length === 0) {
    return (
      <div className="text-center py-8">
        <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhuma rádio ou podcast cadastrado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ouça nossa rádio e podcasts com conteúdo exclusivo para trabalhadores.
      </p>
      
      <div className="space-y-3">
        {radios.map((radio, idx) => (
          <Card 
            key={radio.id} 
            className={`border shadow-sm ${idx === 0 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white' : ''}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 ${idx === 0 ? 'bg-white/20' : 'bg-emerald-100'} rounded-full flex items-center justify-center`}>
                  <Radio className={`h-7 w-7 ${idx === 0 ? 'text-white' : 'text-emerald-600'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-bold ${idx === 0 ? 'text-lg' : 'text-sm'}`}>{radio.title}</h4>
                    {idx === 0 && radio.metadata?.ao_vivo && (
                      <Badge className="bg-red-500 text-white text-xs animate-pulse">AO VIVO</Badge>
                    )}
                  </div>
                  {radio.description && (
                    <p className={`text-sm ${idx === 0 ? 'opacity-90' : 'text-muted-foreground'}`}>
                      {radio.description}
                    </p>
                  )}
                </div>
                {radio.external_link && (
                  <Button 
                    size="icon" 
                    className={idx === 0 ? "bg-white text-emerald-600 hover:bg-gray-100" : ""}
                    onClick={() => window.open(radio.external_link, '_blank')}
                  >
                    <Play className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ VÍDEOS - DINÂMICO ============
function VideosContent() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const clinicId = localStorage.getItem('mobile_clinic_id');
      if (!clinicId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("union_app_content")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("content_type", "video")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setVideos(data || []);
    } catch (err) {
      console.error("Error loading videos:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-red-600" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-8">
        <Youtube className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhum vídeo cadastrado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Assista aos vídeos institucionais, entrevistas e tutoriais do sindicato.
      </p>
      
      <div className="space-y-3">
        {videos.map((video) => (
          <Card 
            key={video.id} 
            className="border shadow-sm overflow-hidden cursor-pointer"
            onClick={() => video.external_link && window.open(video.external_link, '_blank')}
          >
            <CardContent className="p-0">
              <div className="flex gap-3 p-3">
                <div className="w-32 h-20 bg-muted rounded overflow-hidden flex-shrink-0 relative">
                  {video.image_url ? (
                    <img 
                      src={video.image_url} 
                      alt={video.title} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full bg-red-100 flex items-center justify-center">
                      <Youtube className="h-8 w-8 text-red-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                      <Play className="h-5 w-5 text-red-600 ml-0.5" />
                    </div>
                  </div>
                  {video.metadata?.duracao && (
                    <Badge className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1">
                      {video.metadata.duracao}
                    </Badge>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm line-clamp-2">{video.title}</h4>
                  {video.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.description}</p>
                  )}
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
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <selectedMedia.icon className="h-5 w-5" />
              <h1 className="font-bold text-lg">{selectedMedia.title}</h1>
            </div>
          </div>
        </header>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {renderMediaContent()}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Main menu view
  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {/* Header */}
      <header className="bg-primary text-white p-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/app/home")}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-lg">Comunicação</h1>
        </div>
      </header>

      {/* Media type cards */}
      <div className="flex-1 p-4">
        <div className="grid grid-cols-2 gap-4">
          {mediaTypes.map((media) => (
            <Card
              key={media.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/app/comunicacao/${media.id}`)}
            >
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <div className={`w-16 h-16 ${media.color} rounded-full flex items-center justify-center mb-3`}>
                  <media.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-semibold text-sm">{media.title}</h3>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
