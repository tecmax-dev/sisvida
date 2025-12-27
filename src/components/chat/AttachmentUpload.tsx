import { useRef } from 'react';
import { Paperclip, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AttachmentUploadProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  isUploading: boolean;
  progress: number;
  disabled?: boolean;
}

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const AttachmentUpload = ({
  selectedFile,
  onFileSelect,
  isUploading,
  progress,
  disabled = false,
}: AttachmentUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido. Use imagens, PDF ou documentos Word.');
      return;
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      toast.error('Arquivo muito grande. Máximo permitido: 10MB');
      return;
    }

    onFileSelect(file);
    
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onFileSelect(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = selectedFile?.type.startsWith('image/');

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {!selectedFile ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className="text-muted-foreground hover:text-foreground"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
      ) : (
        <div className={cn(
          'flex items-center gap-2 p-2 rounded-lg border bg-muted/50',
          isUploading && 'opacity-70'
        )}>
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isImage ? (
            <ImageIcon className="h-4 w-4 text-primary" />
          ) : (
            <FileText className="h-4 w-4 text-primary" />
          )}
          
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate max-w-[120px]">
              {selectedFile.name}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {formatSize(selectedFile.size)}
            </p>
          </div>

          {!isUploading && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {isUploading && (
        <div className="absolute -bottom-2 left-0 right-0">
          <Progress value={progress} className="h-1" />
        </div>
      )}
    </div>
  );
};
