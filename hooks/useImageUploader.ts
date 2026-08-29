
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

 const handleImageFiles = useCallback(async (files: FileList | File[] | null) => {
  if (!files) return;
  setError(null);
  const fileArray = Array.isArray(files) ? files : Array.from(files);
  const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));

  if (imageFiles.length === 0 && fileArray.length > 0) {
   setError(t('errorNonImageFileDropped'));
   return;
  }

  // Konversi semua file ke data URL secara paralel.
  const newImages: UploadedImage[] = await Promise.all(
   imageFiles.map(async (file) => ({
    id: `${file.name || 'pasted-image'}-${Date.now()}-${Math.random()}`,
    name: file.name || `Pasted Image ${new Date().toLocaleTimeString()}`,
    type: file.type || 'image/png',
    objectUrl: await fileToDataUrl(file),
    file: file
   }))
  );

  setUploadedImages(prev => [...prev, ...newImages]);
 }, [t]);

 useEffect(() => {
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
   if (inside && e.dataTransfer?.files?.length) handleImageFiles(e.dataTransfer.files);
  };
  const handleWindowPaste = (event: ClipboardEvent) => { 
   // Tangkap gambar dari clipboard (screenshot Win+Shift+S atau Copy Image)
   const clipboardItems = event.clipboardData?.items ? Array.from(event.clipboardData.items) : [];
   const imageItem = clipboardItems.find(item => item.type.startsWith('image/'));
   
   if (imageItem) {
     const file = imageItem.getAsFile();
     if (file) {
       event.preventDefault();
       handleImageFiles([file]);
       return;
     }
   }

   const target = event.target as Element | null;
   if (target && target.id !== 'concepts') {
    const tagName = target.tagName?.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || target.getAttribute('contenteditable') === 'true') {
     return;
    }
   }

   if (event.clipboardData?.files?.length) {
     const imgFiles = Array.from(event.clipboardData.files).filter(f => f.type.startsWith('image/'));
     if (imgFiles.length > 0) {
       event.preventDefault();
       handleImageFiles(imgFiles);
     }
   }
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
 }, [handleImageFiles]);

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
