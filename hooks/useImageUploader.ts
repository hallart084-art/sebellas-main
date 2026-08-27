
import { useState, useCallback, useEffect, useRef } from 'react';
import { UploadedImage } from '../types';

/**
 * Konversi File ke data URL (base64) yang bersifat permanen.
 * Tidak seperti blob URL (URL.createObjectURL), data URL tidak bisa expired/revoked.
 */
const fileToDataUrl = (file: File): Promise<string> =>
 new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
 });

export const useImageUploader = (isImageMode: boolean, t: (key: any, params?: any) => string) => {
 const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
 const [isDraggingOverWindow, setIsDraggingOverWindow] = useState<boolean>(false);
 const [error, setError] = useState<string | null>(null);
 
 const fileInputRef = useRef<HTMLInputElement>(null);
 const dragCounter = useRef<number>(0);
 const isEventInsideDropzone = (target: EventTarget | null): boolean => {
  return target instanceof Element && !!target.closest('[data-upload-dropzone="true"]');
 };

 const handleImageFiles = useCallback(async (files: FileList | null) => {
  if (!files || !isImageMode) return;
  setError(null);
  const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

  if (imageFiles.length === 0 && files.length > 0) {
   setError(t('errorNonImageFileDropped'));
   return;
  }

  // Konversi semua file ke data URL secara paralel.
  const newImages: UploadedImage[] = await Promise.all(
   imageFiles.map(async (file) => ({
    id: `${file.name}-${Date.now()}-${Math.random()}`,
    name: file.name,
    type: file.type,
    objectUrl: await fileToDataUrl(file),
    file: file
   }))
  );

  setUploadedImages(prev => [...prev, ...newImages]);
 }, [isImageMode, t]);

 useEffect(() => {
  if (!isImageMode) {
   setIsDraggingOverWindow(false);
   dragCounter.current = 0;
   return;
  }

  const handleDragEnter = (e: DragEvent) => {
   e.preventDefault();
   e.stopPropagation();
   dragCounter.current++;
   if (e.dataTransfer?.items?.length) setIsDraggingOverWindow(true);
  };
  const handleDragLeave = (e: DragEvent) => {
   e.preventDefault();
   e.stopPropagation();
   dragCounter.current = Math.max(0, dragCounter.current - 1);
   if (dragCounter.current <= 0) setIsDraggingOverWindow(false);
  };
  const handleDragOver = (e: DragEvent) => {
   e.preventDefault();
   e.stopPropagation();
   const inside = isEventInsideDropzone(e.target);
   if (e.dataTransfer) e.dataTransfer.dropEffect = inside ? 'copy' : 'none';
   if (e.dataTransfer?.items?.length) setIsDraggingOverWindow(true);
   if (dragCounter.current === 0) dragCounter.current = 1;
  };
  const handleDrop = (e: DragEvent) => {
   e.preventDefault();
   e.stopPropagation();
   const inside = isEventInsideDropzone(e.target);
   setIsDraggingOverWindow(false);
   dragCounter.current = 0;
   if (inside && isImageMode && e.dataTransfer?.files?.length) handleImageFiles(e.dataTransfer.files);
  };
  const handleWindowPaste = (event: ClipboardEvent) => { 
   const target = event.target as Element | null;
   if (target && target.id !== 'concepts') {
    const tagName = target.tagName?.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || target.getAttribute('contenteditable') === 'true') {
     return;
    }
   }
   if (isImageMode && event.clipboardData) handleImageFiles(event.clipboardData.files); 
  };

  window.addEventListener('dragenter', handleDragEnter);
  window.addEventListener('dragleave', handleDragLeave);
  window.addEventListener('dragover', handleDragOver);
  window.addEventListener('drop', handleDrop);
  window.addEventListener('paste', handleWindowPaste);

  return () => {
   window.removeEventListener('dragenter', handleDragEnter);
   window.removeEventListener('dragleave', handleDragLeave);
   window.removeEventListener('dragover', handleDragOver);
   window.removeEventListener('drop', handleDrop);
   window.removeEventListener('paste', handleWindowPaste);
  };
 }, [isImageMode, handleImageFiles]);

 const handleDeleteImage = (id: string) => {
  // Data URL tidak perlu di-revoke — langsung hapus dari state.
  setUploadedImages(prev => prev.filter(img => img.id !== id));
  setError(null);
 };

 const clearUploadedImages = useCallback(() => {
  // Data URL tidak perlu di-revoke — langsung kosongkan state.
  setUploadedImages([]);
  if (fileInputRef.current) fileInputRef.current.value = "";
        setError(null);
    }, []);
    
    const clearError = useCallback(() => setError(null), []);

    return { uploadedImages, handleImageFiles, handleDeleteImage, isDraggingOverWindow, fileInputRef, clearUploadedImages, error, clearError };
};
