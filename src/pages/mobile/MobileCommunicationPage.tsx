import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  Pause,
  Download,
  ExternalLink,
  Calendar,
  Eye,
  ChevronRight,
  ChevronLeft,
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

// ============ GALERIA - ÁLBUNS DINÂMICOS ============
function GaleriaContent() {
  const [albums, setAlbums] = useState<any[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  
  // Swipe gesture state
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  const selectedImage = selectedImageIndex !== null ? photos[selectedImageIndex] : null;

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlay || selectedImageIndex === null || photos.length <= 1) return;

    const timer = setInterval(() => {
      setSelectedImageIndex((prev) => {
        if (prev === null) return null;
        return prev >= photos.length - 1 ? 0 : prev + 1;
      });
    }, 3000);

    return () => clearInterval(timer);
  }, [isAutoPlay, selectedImageIndex, photos.length]);

  const goToPrevious = useCallback(() => {
    if (selectedImageIndex === null) return;
    setSelectedImageIndex(selectedImageIndex <= 0 ? photos.length - 1 : selectedImageIndex - 1);
  }, [selectedImageIndex, photos.length]);

  const goToNext = useCallback(() => {
    if (selectedImageIndex === null) return;
    setSelectedImageIndex(selectedImageIndex >= photos.length - 1 ? 0 : selectedImageIndex + 1);
  }, [selectedImageIndex, photos.length]);

  const closeViewer = () => {
    setSelectedImageIndex(null);
    setIsAutoPlay(false);
  };

  // Touch handlers for swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };

  useEffect(() => {
    loadAlbums();
  }, []);

  const loadAlbums = async () => {
    try {
      const clinicId = localStorage.getItem('mobile_clinic_id');
      if (!clinicId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("union_app_albums")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      
      // Get photo counts
      const albumsWithCounts = await Promise.all(
        (data || []).map(async (album: any) => {
          const { count } = await supabase
            .from("union_app_album_photos")
            .select("*", { count: "exact", head: true })
            .eq("album_id", album.id);
          return { ...album, photos_count: count || 0 };
        })
      );
      
      setAlbums(albumsWithCounts);
    } catch (err) {
      console.error("Error loading albums:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPhotos = async (albumId: string) => {
    setLoadingPhotos(true);
    try {
      const { data, error } = await supabase
        .from("union_app_album_photos")
        .select("*")
        .eq("album_id", albumId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setPhotos(data || []);
    } catch (err) {
      console.error("Error loading photos:", err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handleAlbumClick = (album: any) => {
    setSelectedAlbum(album);
    loadPhotos(album.id);
  };

  const handleBackToAlbums = () => {
    setSelectedAlbum(null);
    setPhotos([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  // Show photos when album is selected
  if (selectedAlbum) {
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleBackToAlbums}
          className="gap-2 -ml-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar aos álbuns
        </Button>
        
        <div>
          <h3 className="font-semibold text-lg">{selectedAlbum.title}</h3>
          {selectedAlbum.description && (
            <p className="text-sm text-muted-foreground mt-1">{selectedAlbum.description}</p>
          )}
        </div>

        {loadingPhotos ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-8">
            <Image className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma foto neste álbum ainda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo, index) => (
              <Card 
                key={photo.id} 
                className="border shadow-sm overflow-hidden cursor-pointer"
                onClick={() => {
                  setSelectedImageIndex(index);
                  setIsAutoPlay(false);
                }}
              >
                <CardContent className="p-0">
                  <div className="aspect-square bg-muted">
                    <img 
                      src={photo.image_url} 
                      alt={photo.title || "Foto"} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {photo.title && (
                    <div className="p-2">
                      <p className="text-xs font-medium line-clamp-2">{photo.title}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Image Preview Dialog with Navigation */}
        <Dialog open={selectedImageIndex !== null} onOpenChange={closeViewer}>
          <DialogContent className="max-w-md p-0 overflow-visible bg-black/95 [&>button]:hidden">
            {/* Counter */}
            {photos.length > 1 && (
              <div className="absolute top-3 left-3 z-50">
                <Badge variant="secondary" className="bg-black/60 text-white border-0">
                  {(selectedImageIndex ?? 0) + 1} / {photos.length}
                </Badge>
              </div>
            )}

            {/* Auto-play button */}
            {photos.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-50 text-white hover:bg-white/20 bg-black/40"
                onClick={() => setIsAutoPlay(!isAutoPlay)}
              >
                {isAutoPlay ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
            )}

            {/* Previous Button - OUTSIDE content flow with higher z-index */}
            {photos.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-50 text-white bg-black/50 hover:bg-black/70 h-12 w-12 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
            )}

            {/* Next Button - OUTSIDE content flow with higher z-index */}
            {photos.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-50 text-white bg-black/50 hover:bg-black/70 h-12 w-12 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            )}

            {selectedImage && (
              <div 
                className="relative touch-pan-y"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <img 
                  src={selectedImage.image_url} 
                  alt={selectedImage.title || "Foto"} 
                  className="w-full max-h-[70vh] object-contain select-none pointer-events-none" 
                  draggable={false}
                />
                {(selectedImage.title || selectedImage.description) && (
                  <div className="p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
                    {selectedImage.title && <h4 className="font-semibold">{selectedImage.title}</h4>}
                    {selectedImage.description && (
                      <p className="text-sm text-white/80 mt-1">{selectedImage.description}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Dots Indicator */}
            {photos.length > 1 && photos.length <= 10 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
                {photos.map((_, idx) => (
                  <button
                    key={idx}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      idx === selectedImageIndex ? "bg-white w-5" : "bg-white/50"
                    }`}
                    onClick={() => setSelectedImageIndex(idx)}
                  />
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Show albums list
  if (albums.length === 0) {
    return (
      <div className="text-center py-8">
        <Image className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhum álbum de fotos disponível.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Confira os álbuns de fotos dos eventos e atividades do sindicato.
      </p>
      
      <div className="grid grid-cols-2 gap-3">
        {albums.map((album) => (
          <Card 
            key={album.id} 
            className="border shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleAlbumClick(album)}
          >
            <CardContent className="p-0">
              {album.cover_image_url ? (
                <div className="aspect-video bg-muted relative">
                  <img 
                    src={album.cover_image_url} 
                    alt={album.title} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 right-2">
                    <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                      {album.photos_count} fotos
                    </span>
                  </div>
                </div>
              ) : (
                <div className="aspect-video bg-muted flex items-center justify-center relative">
                  <Image className="h-8 w-8 text-muted-foreground" />
                  <div className="absolute bottom-2 right-2">
                    <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                      {album.photos_count} fotos
                    </span>
                  </div>
                </div>
              )}
              <div className="p-3">
                <p className="text-sm font-medium line-clamp-1">{album.title}</p>
                {album.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{album.description}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
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
        .order("created_at", { ascending: false });

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
          <Card 
            key={jornal.id} 
            className="border shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
              const url = jornal.external_link || jornal.file_url;
              if (url) window.open(url, '_blank');
            }}
          >
            {jornal.image_url && (
              <div className="w-full h-40 bg-muted">
                <img 
                  src={jornal.image_url} 
                  alt={jornal.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {!jornal.image_url && (
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Newspaper className="h-6 w-6 text-slate-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm line-clamp-2">{jornal.title}</h4>
                  {jornal.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{jornal.description}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">
                    {format(new Date(jornal.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
                <div className={`w-14 h-14 ${idx === 0 ? 'bg-white/20' : 'bg-emerald-100'} rounded-full flex items-center justify-center overflow-hidden flex-shrink-0`}>
                  {radio.image_url ? (
                    <img 
                      src={radio.image_url} 
                      alt={radio.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Radio className={`h-7 w-7 ${idx === 0 ? 'text-white' : 'text-emerald-600'}`} />
                  )}
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
        .order("created_at", { ascending: false });

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
