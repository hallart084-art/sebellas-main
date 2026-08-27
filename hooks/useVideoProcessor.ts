
import { useState, useCallback, useEffect, useRef } from 'react';
import { UploadedVideo } from '../types';

const MAX_VIDEO_SIZE_MB = 100;
const VIDEO_FILE_EXTENSION_REGEX = /\.(mp4|mov|m4v|avi|wmv|webm|mkv|mpeg|mpg|ogv|3gp)$/i;
const isLikelyVideoFile = (file: File): boolean => file.type.startsWith('video/') || VIDEO_FILE_EXTENSION_REGEX.test(file.name);

/**
 * Konversi File ke data URL (base64) yang bersifat permanen.
 */
const fileToDataUrl = (file: File): Promise<string> =>
 new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
 });

export const useVideoProcessor = (isVideoMode: boolean, t: (key: any, params?: any) => string) => {
 const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>([]);
 const [videoUrlInput, setVideoUrlInput] = useState('');
 const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [isDraggingOverWindow, setIsDraggingOverWindow] = useState<boolean>(false);

 const fileInputRef = useRef<HTMLInputElement>(null);
 const dragCounter = useRef<number>(0);
 const isEventInsideDropzone = (target: EventTarget | null): boolean => {
 return target instanceof Element && !!target.closest('[data-upload-dropzone="true"]');
 };
 
 const clearAllVideos = useCallback(() => {
  // Data URL tidak perlu di-revoke.
  setUploadedVideos([]);
  setVideoUrlInput('');
  setError(null);
  if(fileInputRef.current) fileInputRef.current.value = "";
 }, []);

 const handleDeleteVideo = (id: string) => {
  // Data URL tidak perlu di-revoke.
  setUploadedVideos(prev => prev.filter(v => v.id !== id));
 };

 const handleVideoFile = useCallback(async (files: FileList | null) => {
  if (!files || files.length === 0 || !isVideoMode) return;
  setError(null);

  const videoFiles = Array.from(files).filter(isLikelyVideoFile);

  if (videoFiles.length === 0 && files.length > 0) {
   setError(t('errorNonVideoFileDropped'));
   if (fileInputRef.current) fileInputRef.current.value = "";
   return;
  }

  const newVideos: UploadedVideo[] = [];
  
  for (const file of videoFiles) {
   if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
    setError(prev => {
     const newError = `Video file ${file.name} is too large (max ${MAX_VIDEO_SIZE_MB}MB)`;
     return prev ? `${prev}\n${newError}` : newError;
    });
    continue;
   }
   const dataUrl = await fileToDataUrl(file);
   newVideos.push({
    id: `${file.name}-${Date.now()}-${Math.random()}`,
    name: file.name,
    objectUrl: dataUrl,
    file: file,
   });
  }
  
  if (newVideos.length > 0) {
   setUploadedVideos(prev => [...prev, ...newVideos]);
  }
  if (fileInputRef.current) fileInputRef.current.value = "";
 }, [isVideoMode, t]);

 const handleLoadFromUrl = useCallback(async (url: string) => {
 if (!url.trim() || !/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(url)) {
 setError(t('errorInvalidVideoUrl'));
 return;
 }
 
 setIsLoadingFromUrl(true);
 setError(null);

 try {
 // Use fetch to get the video data as a blob. This respects CORS.
 const response = await fetch(url);
 if (!response.ok) {
 // response.ok is false for 4xx/5xx statuses.
 throw new Error(t('errorLoadingVideoUrl'));
 }
 const blob = await response.blob();

 if (blob.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
 // Using a more specific error message here.
 throw new Error(`Video file from URL is too large (max ${MAX_VIDEO_SIZE_MB}MB).`);
 }

 let videoName: string;
 try {
 const urlObj = new URL(url);
 const pathname = urlObj.pathname;
 videoName = pathname.substring(pathname.lastIndexOf('/') + 1) || 'video_from_url.mp4';
 } catch {
 videoName = 'video_from_url.mp4';
 }

  const file = new File([blob], videoName, { type: blob.type || 'video/mp4' });
  const dataUrl = await fileToDataUrl(file);

  const newVideo: UploadedVideo = {
   id: `${videoName}-${Date.now()}-${Math.random()}`,
   name: file.name,
   objectUrl: dataUrl,
   file: file,
  };

 setUploadedVideos(prev => [...prev, newVideo]);
 setVideoUrlInput('');
 } catch (err) {
 console.error("Error loading video from URL:", err);
 // The catch block will handle network errors and CORS issues from fetch.
 if (err instanceof Error && err.message.includes('too large')) {
 setError(err.message);
 } else {
 setError(t('errorLoadingVideoUrl'));
 }
 } finally {
 setIsLoadingFromUrl(false);
 }
 }, [t]);

 const handleUrlInputClick = async () => {
 if (isLoadingFromUrl) return;
 try {
 const clipboardText = await navigator.clipboard.readText();
 if (clipboardText && /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(clipboardText)) {
 setVideoUrlInput(clipboardText);
 await handleLoadFromUrl(clipboardText);
 }
 } catch (err) {
 console.warn("Could not read from clipboard:", err);
 }
 };

 useEffect(() => {
 if (!isVideoMode) {
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
 if (inside && isVideoMode && e.dataTransfer?.files?.length) handleVideoFile(e.dataTransfer.files);
 };
 const handleWindowPaste = (event: ClipboardEvent) => {
 const target = event.target as Element | null;
 if (target && target.id !== 'concepts') {
 const tagName = target.tagName?.toLowerCase();
 if (tagName === 'input' || tagName === 'textarea' || target.getAttribute('contenteditable') === 'true') {
 return;
 }
 }
 if (!isVideoMode || !event.clipboardData?.files?.length) return;
 handleVideoFile(event.clipboardData.files);
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
    }, [isVideoMode, handleVideoFile]);
    
    return {
        uploadedVideos,
        videoUrlInput,
        isLoadingFromUrl,
        handleVideoFile,
        handleLoadFromUrl,
        handleUrlInputClick,
        setVideoUrlInput,
        clearAllVideos,
        handleDeleteVideo,
        isDraggingOverWindow: isVideoMode && isDraggingOverWindow,
        fileInputRef,
        videoUploaderError: error,
    };
};
