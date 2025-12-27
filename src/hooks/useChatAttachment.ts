import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AttachmentData {
  url: string;
  name: string;
  type: string;
  size: number;
}

export const useChatAttachment = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadAttachment = useCallback(async (
    file: File,
    conversationId: string
  ): Promise<AttachmentData | null> => {
    setIsUploading(true);
    setProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${conversationId}/${Date.now()}.${fileExt}`;

      // Simulate progress (since supabase doesn't provide upload progress)
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file);

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      return {
        url: data.path,
        name: file.name,
        type: file.type,
        size: file.size,
      };
    } catch (error) {
      console.error('Error uploading attachment:', error);
      return null;
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  }, []);

  const getAttachmentUrl = useCallback(async (path: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(path, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting attachment URL:', error);
      return null;
    }
  }, []);

  const isImage = (type: string) => {
    return type.startsWith('image/');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return {
    uploadAttachment,
    getAttachmentUrl,
    isUploading,
    progress,
    isImage,
    formatFileSize,
  };
};
