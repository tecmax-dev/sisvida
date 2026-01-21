import { useState, useCallback } from "react";
import { Upload, X, File, FolderPlus, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PatientFolder {
  id: string;
  name: string;
  parent_folder_id: string | null;
}

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (files: File[], folderId: string | null, description?: string) => Promise<void>;
  folders?: PatientFolder[];
  currentFolderId?: string | null;
  onCreateFolder?: (name: string, parentId?: string | null) => Promise<PatientFolder | null>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDialog({ 
  open, 
  onOpenChange, 
  onUpload, 
  folders = [], 
  currentFolderId = null,
  onCreateFolder 
}: UploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Sync selectedFolderId when currentFolderId changes
  useState(() => {
    setSelectedFolderId(currentFolderId);
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    try {
      await onUpload(files, selectedFolderId, description);
      setFiles([]);
      setDescription("");
      setSelectedFolderId(currentFolderId);
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFiles([]);
      setDescription("");
      setSelectedFolderId(currentFolderId);
      setShowNewFolder(false);
      setNewFolderName("");
      onOpenChange(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !onCreateFolder) return;
    
    setCreatingFolder(true);
    try {
      const folder = await onCreateFolder(newFolderName.trim());
      if (folder) {
        setSelectedFolderId(folder.id);
        setNewFolderName("");
        setShowNewFolder(false);
      }
    } finally {
      setCreatingFolder(false);
    }
  };

  const selectedFolderName = selectedFolderId 
    ? folders.find(f => f.id === selectedFolderId)?.name 
    : null;

  return (
    <PopupBase open={open} onClose={handleClose} maxWidth="lg" title="Enviar Anexos">
      <div className="space-y-4">
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">
            Arraste arquivos aqui ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, imagens, documentos (máx. 10MB por arquivo)
          </p>
          <Input
            id="file-input"
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 p-2 bg-muted rounded-md"
              >
                <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm flex-1 truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Folder Selection */}
        <div className="space-y-2">
          <Label>Pasta de destino</Label>
          <div className="flex gap-2">
            <Select
              value={selectedFolderId || "root"}
              onValueChange={(value) => setSelectedFolderId(value === "root" ? null : value)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue>
                  <span className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    {selectedFolderName || "Raiz (sem pasta)"}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">
                  <span className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    Raiz (sem pasta)
                  </span>
                </SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    <span className="flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      {folder.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {onCreateFolder && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowNewFolder(!showNewFolder)}
                title="Nova pasta"
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* New Folder Input */}
          {showNewFolder && onCreateFolder && (
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Nome da nova pasta"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateFolder();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || creatingFolder}
              >
                {creatingFolder ? "Criando..." : "Criar"}
              </Button>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="description">Descrição (opcional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Adicione uma descrição para os arquivos..."
            className="mt-1.5"
            rows={2}
          />
        </div>
      </div>

      <PopupFooter>
        <Button variant="outline" onClick={handleClose} disabled={uploading}>
          Cancelar
        </Button>
        <Button onClick={handleUpload} disabled={files.length === 0 || uploading}>
          {uploading ? "Enviando..." : `Enviar ${files.length} arquivo(s)`}
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
