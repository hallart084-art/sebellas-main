
import React, { useEffect, useRef, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { UseSettingsReturn } from '../hooks/useSettings';
import { UploadedImage, UploadedVideo } from '../types';
import Spinner from './Spinner';
import { useLocalizationContext } from '../contexts/LocalizationContext';
import ModelSelector from './ModelSelector';
import StyleSelector from './StyleSelector';
import PromptQualitySelector from './PromptQualitySelector';
import { getModelsForInputMode } from '../constants';

const TYPING_PLACEHOLDER_SAMPLES = [
 'Astronaut on Mars, dragon in an enchanted forest, cyberpunk city in the rain',
 'Editorial fashion portrait in soft window light, silver jewelry, cinematic shadows',
 'Brutalist concrete villa on a cliff, stormy sea, moody architectural photography',
 'Futuristic sushi bar in Tokyo, reflective chrome, rainy neon street atmosphere',
 'Ancient jungle temple overtaken by bioluminescent plants, fog, cinematic adventure frame',
 'Luxury perfume bottle floating above black water, ripples, glossy studio lighting',
 'Minimal Scandinavian bedroom, warm morning sun, linen textures, calm editorial interior shot',
 'Medieval knight walking through a burning battlefield, ash in the air, epic dramatic realism',
 'Retro-futuristic race car in a desert salt flat, golden hour, heat haze, high-speed composition',
 'Elegant wedding portrait under candlelight, ivory fabric, soft skin tones, timeless photography',
 'Underground techno club in Berlin, laser haze, metallic reflections, raw documentary energy',
 'Tiny ramen stall in a narrow alley, midnight rain, glowing paper lanterns, cinematic street photo',
 'Surreal glass greenhouse in the Arctic, snowstorm outside, lush tropical plants inside',
 'High-fashion beauty close-up with wet skin, sharp eyeliner, deep shadows, magazine cover aesthetic',
 'Massive library carved inside a canyon wall, warm dust beams, fantasy architectural grandeur',
 'Vintage motorcycle parked outside a neon motel, thunderclouds, Americana film still mood',
 'Product shot of futuristic headphones on brushed steel, precise reflections, premium ad lighting',
 'Nomad camp in the Sahara at blue hour, firelight, layered textiles, atmospheric travel photography',
 'Cybernetic samurai standing in a flooded alley, red signage, steam, night rain realism',
 'Organic ceramic tableware on stone, olive branches, natural daylight, refined lifestyle editorial',
 'Monolithic spaceship hangar interior, tiny human silhouettes, volumetric light, sci-fi scale',
 'Dreamy ballet rehearsal in an abandoned theater, dust particles, faded velvet, poetic realism',
 'Artisanal bakery counter at sunrise, flour in the air, crust texture, warm cinematic food shot',
 'Glass observatory above the clouds, moonlit sky, silver-blue palette, serene futuristic landscape',
];

interface InputAreaProps {
 isLoading: boolean;
 disabled: boolean;
 isDraggingOverDropzone: boolean;
 settings: UseSettingsReturn;
 // Image Mode Props
 uploadedImages: UploadedImage[];
 handleImageFiles: (files: FileList | null) => void;
 handleDeleteImage: (id: string) => void;
 imageFileInputRef: React.RefObject<HTMLInputElement>;
 clearUploadedImages: () => void;
 imageUploaderError: string | null;
 clearImageUploaderError: () => void;
 // Video Mode Props
 uploadedVideos: UploadedVideo[];
 videoUrlInput: string;
 isLoadingFromUrl: boolean;
 videoUploaderError: string | null;
 handleVideoFile: (files: FileList | null) => void;
 handleLoadFromUrl: (url: string) => void;
 handleUrlInputClick: () => void;
 setVideoUrlInput: (url: string) => void;
 clearAllVideos: () => void;
 handleDeleteVideo: (id: string) => void;
 videoFileInputRef: React.RefObject<HTMLInputElement>;
}

const InputArea: React.FC<InputAreaProps> = ({
 isLoading, disabled, isDraggingOverDropzone, settings,
 uploadedImages, handleImageFiles, handleDeleteImage, imageFileInputRef, clearUploadedImages, imageUploaderError, clearImageUploaderError,
 uploadedVideos, videoUrlInput, isLoadingFromUrl, videoUploaderError,
 handleVideoFile, handleLoadFromUrl, handleUrlInputClick, setVideoUrlInput, clearAllVideos, handleDeleteVideo, videoFileInputRef,
}) => {
 const { t } = useLocalizationContext();
 const conceptTextareaRef = useRef<HTMLTextAreaElement>(null);
 const footerRef = useRef<HTMLDivElement>(null);
 const compactExitWidthRef = useRef<number | null>(null);
 const resizeFrameRef = useRef<number | null>(null);
 const unifiedInputHeightClass = 'h-[152px] min-h-[152px]';
 const [isFooterCompact, setIsFooterCompact] = useState(false);
 const [isLocalFileDragOver, setIsLocalFileDragOver] = useState(false);
 const [animatedPlaceholder, setAnimatedPlaceholder] = useState(TYPING_PLACEHOLDER_SAMPLES[0]);
 const [visibleVideoIds, setVisibleVideoIds] = useState<Set<string>>(() => new Set());
 const dragDepthRef = useRef(0);
 const videoVisibilityObserverRef = useRef<IntersectionObserver | null>(null);
 const videoUrlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
 const isFileDragEvent = (event: React.DragEvent<HTMLElement>) => {
 const types = event.dataTransfer?.types;
 return !!types && Array.from(types).includes('Files');
 };
 const handleDropzoneDragEnter = (event: React.DragEvent<HTMLElement>) => {
 if (!isFileDragEvent(event) || disabled) return;
 event.preventDefault();
 event.stopPropagation();
 dragDepthRef.current += 1;
 setIsLocalFileDragOver(true);
 };
 const handleDropzoneDragLeave = (event: React.DragEvent<HTMLElement>) => {
 if (!isFileDragEvent(event) || disabled) return;
 event.preventDefault();
 event.stopPropagation();
 dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
 if (dragDepthRef.current === 0) setIsLocalFileDragOver(false);
 };
 const handleDropzoneDragOver = (event: React.DragEvent<HTMLElement>) => {
 if (!isFileDragEvent(event) || disabled) return;
 event.preventDefault();
 event.stopPropagation();
 event.dataTransfer.dropEffect = 'copy';
 if (!isLocalFileDragOver) setIsLocalFileDragOver(true);
 };
 const handleDropzoneDrop = (event: React.DragEvent<HTMLElement>) => {
 if (!isFileDragEvent(event) || disabled) return;
 event.preventDefault();
 event.stopPropagation();
 dragDepthRef.current = 0;
 setIsLocalFileDragOver(false);
 const files = event.dataTransfer?.files ?? null;
 if (settings.inputMode === 'image') handleImageFiles(files);
 if (settings.inputMode === 'video') handleVideoFile(files);
 };
 const shouldShowLocalDropOverlay =
 (isDraggingOverDropzone || isLocalFileDragOver) && (settings.inputMode === 'image' || settings.inputMode === 'video');
 const dragDropPromptText = 'Lepaskan file disini';

 const handleSetInputMode = (mode: 'text' | 'image' | 'video') => {
 if (settings.inputMode === mode) return;
 settings.setInputMode(mode);
 };
 const modeOrder: Array<'text' | 'image' | 'video'> = ['text', 'image', 'video'];
 const activeModeIndex = modeOrder.indexOf(settings.inputMode);

 useEffect(() => {
 const footerEl = footerRef.current;
 if (!footerEl) return;

 const updateCompactState = () => {
 // Always use full controls on wide screens.
 if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
 if (isFooterCompact) setIsFooterCompact(false);
 compactExitWidthRef.current = null;
 return;
 }

 const clientWidth = footerEl.clientWidth;
 const overflowed = footerEl.scrollWidth > clientWidth + 4;

 if (overflowed) {
 if (!isFooterCompact) {
 setIsFooterCompact(true);
 }
 const nextExitWidth = clientWidth + 88;
 if (compactExitWidthRef.current === null || compactExitWidthRef.current < nextExitWidth) {
 compactExitWidthRef.current = nextExitWidth;
 }
 return;
 }

 if (isFooterCompact) {
 const exitWidth = compactExitWidthRef.current ?? (clientWidth + 88);
 if (clientWidth >= exitWidth) {
 setIsFooterCompact(false);
 compactExitWidthRef.current = null;
 }
 return;
 }

 compactExitWidthRef.current = null;
 };

 const scheduleUpdate = () => {
 if (resizeFrameRef.current !== null) {
 cancelAnimationFrame(resizeFrameRef.current);
 }
 resizeFrameRef.current = requestAnimationFrame(() => {
 resizeFrameRef.current = null;
 updateCompactState();
 });
 };

 updateCompactState();

 const resizeObserver = typeof ResizeObserver !== 'undefined'
 ? new ResizeObserver(scheduleUpdate)
 : null;

 if (resizeObserver) resizeObserver.observe(footerEl);
 window.addEventListener('resize', scheduleUpdate);

 return () => {
 if (resizeObserver) resizeObserver.disconnect();
 window.removeEventListener('resize', scheduleUpdate);
 if (resizeFrameRef.current !== null) {
 cancelAnimationFrame(resizeFrameRef.current);
 resizeFrameRef.current = null;
 }
 };
 }, [isFooterCompact, settings.inputMode, settings.styleOption, settings.selectedModel, settings.promptQualityOption, settings.numPrompts]);

 useEffect(() => {
 if (settings.inputMode !== 'text' || settings.conceptsInput.trim().length > 0 || disabled) {
 setAnimatedPlaceholder(TYPING_PLACEHOLDER_SAMPLES[0]);
 return;
 }

 const phrases = TYPING_PLACEHOLDER_SAMPLES;
 let phraseIndex = 0;
 let charIndex = 0;
 let isDeleting = false;
 let timeoutId: number | null = null;

 const tick = () => {
 const currentPhrase = phrases[phraseIndex];

 if (!isDeleting) {
 charIndex = Math.min(currentPhrase.length, charIndex + 2);
 setAnimatedPlaceholder(currentPhrase.slice(0, charIndex));

 if (charIndex >= currentPhrase.length) {
 isDeleting = true;
 timeoutId = window.setTimeout(tick, 950);
 return;
 }

 timeoutId = window.setTimeout(tick, 18);
 return;
 }

 charIndex = Math.max(0, charIndex - 4);
 setAnimatedPlaceholder(currentPhrase.slice(0, charIndex));

 if (charIndex === 0) {
 isDeleting = false;
 phraseIndex = (phraseIndex + 1) % phrases.length;
 timeoutId = window.setTimeout(tick, 180);
 return;
 }

 timeoutId = window.setTimeout(tick, 12);
 };

 setAnimatedPlaceholder('');
 timeoutId = window.setTimeout(tick, 160);

 return () => {
 if (timeoutId !== null) window.clearTimeout(timeoutId);
 };
 }, [disabled, settings.conceptsInput, settings.inputMode]);

 useEffect(() => {
 if (typeof IntersectionObserver === 'undefined') return;

 const observer = new IntersectionObserver((entries) => {
 setVisibleVideoIds((prev) => {
 const next = new Set(prev);
 let changed = false;

 for (const entry of entries) {
 const id = (entry.target as HTMLElement).dataset.videoId;
 if (!id) continue;

 if (entry.isIntersecting) {
 if (!next.has(id)) {
 next.add(id);
 changed = true;
 }
 } else if (next.delete(id)) {
 changed = true;
 }
 }

 return changed ? next : prev;
 });
 }, { threshold: 0.35 });

 videoVisibilityObserverRef.current = observer;
 return () => {
 observer.disconnect();
 videoVisibilityObserverRef.current = null;
 };
 }, []);
 
 const renderContent = () => {
 switch (settings.inputMode) {
 case 'image':
 return (
 <>
 <div
 className={`flat-input relative ${unifiedInputHeightClass} ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
 onClick={() => !disabled && imageFileInputRef.current?.click()}
 tabIndex={0} role="button" aria-label={t('imageDropAreaLabel_aria')}
 aria-disabled={disabled}
 >
 <div data-upload-drop-message="true" className={`absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none ${shouldShowLocalDropOverlay ? 'hidden' : ''}`}>
 <span className={`material-symbols-outlined text-[42px] leading-none w-[42px] h-[42px] mb-1 ${shouldShowLocalDropOverlay ? 'drop-active-icon' : 'opacity-70'}`}>
 {shouldShowLocalDropOverlay ? 'upload' : 'add_photo_alternate'}
 </span>
 <span className={`text-sm font-medium ${shouldShowLocalDropOverlay ? 'drop-active-text' : 'opacity-90'}`}>
 {shouldShowLocalDropOverlay ? dragDropPromptText : t('imagePlaceholder_uploadOrDrag')}
 </span>
 {!shouldShowLocalDropOverlay && (
 <span className="text-xs opacity-60 mt-1">{t('imagePlaceholder_supportedFormats')}</span>
 )}
 </div>
 </div>
 {imageUploaderError && <p role="alert" className="text-xs mt-1 text-red-500">{imageUploaderError}</p>}
 </>
 );
 case 'video':
 return (
 <>
 <div
 className={`flat-input relative ${unifiedInputHeightClass} ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
 onClick={() => !disabled && videoFileInputRef.current?.click()}
 tabIndex={0} role="button" aria-label={t('videoDropAreaLabel_aria')}
 aria-disabled={disabled}
 >
 <div data-upload-drop-message="true" className={`absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none ${shouldShowLocalDropOverlay ? 'hidden' : ''}`}>
 <span className={`material-symbols-outlined text-[42px] leading-none w-[42px] h-[42px] mb-1 ${shouldShowLocalDropOverlay ? 'drop-active-icon' : 'opacity-70'}`}>
 {shouldShowLocalDropOverlay ? 'upload' : 'video_call'}
 </span>
 <span className={`text-sm font-medium ${shouldShowLocalDropOverlay ? 'drop-active-text' : 'opacity-90'}`}>
 {shouldShowLocalDropOverlay ? dragDropPromptText : t('videoPlaceholder_uploadOrDrag')}
 </span>
 {!shouldShowLocalDropOverlay && (
 <span className="text-xs opacity-60 mt-1">{t('videoPlaceholder_supportedFormats')}</span>
 )}
 </div>
 </div>
 </>
 );
 case 'text':
 default:
 return (
 <textarea
 id="concepts" ref={conceptTextareaRef} value={settings.conceptsInput}
 onChange={(e) => settings.setConceptsInput(e.target.value)}
 placeholder={animatedPlaceholder}
 className={`flat-input text-sm resize-none ${unifiedInputHeightClass} block w-full m-0`}
 aria-label={t('conceptPlaceholderText_aria')}
 disabled={disabled}
 />
 );
 }
 };

 const handleVideoUrlPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
 if (disabled || isLoadingFromUrl) return;
 const pastedText = event.clipboardData.getData('text').trim();
 if (!videoUrlRegex.test(pastedText)) return;
 event.preventDefault();
 setVideoUrlInput(pastedText);
 handleLoadFromUrl(pastedText);
 };

 const handleVideoUrlKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
 if (event.key !== 'Enter') return;
 event.preventDefault();
 const url = videoUrlInput.trim();
 if (!url) return;
 handleLoadFromUrl(url);
 };
 
 return (
 <div className="editorial-input-area mb-3">
 <div className="editorial-mode-row flex items-center justify-between mb-4">
 <div className="input-mode-selector !mb-0">
 <span
 className="input-mode-slider"
 style={{ transform: `translateX(${Math.max(activeModeIndex, 0) * 100}%)` }}
 aria-hidden="true"
 />
 <button onClick={() => handleSetInputMode('text')} className={`input-mode-button ${settings.inputMode === 'text' ? 'active' : ''}`} disabled={disabled} aria-pressed={settings.inputMode === 'text'} aria-controls="concept-input-area">
 <span className="material-symbols-outlined">edit_note</span>
 <span className="input-mode-text-full">{t('textToPromptSelector')}</span>
 <span className="input-mode-text-short">{t('textToPromptSelectorShort')}</span>
 </button>
 <button onClick={() => handleSetInputMode('image')} className={`input-mode-button ${settings.inputMode === 'image' ? 'active' : ''}`} disabled={disabled} aria-pressed={settings.inputMode === 'image'} aria-controls="concept-input-area">
 <span className="material-symbols-outlined">image</span>
 <span className="input-mode-text-full">{t('imageToPromptSelector')}</span>
 <span className="input-mode-text-short">{t('imageToPromptSelectorShort')}</span>
 </button>
 <button onClick={() => handleSetInputMode('video')} className={`input-mode-button ${settings.inputMode === 'video' ? 'active' : ''}`} disabled={disabled} aria-pressed={settings.inputMode === 'video'} aria-controls="concept-input-area">
 <span className="material-symbols-outlined">movie</span>
 <span className="input-mode-text-full">{t('videoToPromptSelector')}</span>
 <span className="input-mode-text-short">{t('videoToPromptSelectorShort')}</span>
 </button>
 </div>
 </div>
 
 <div
 className={`editorial-command-canvas unified-input-container relative ${shouldShowLocalDropOverlay ? 'upload-drop-active' : ''}`}
 data-upload-dropzone="true"
 onDragEnter={handleDropzoneDragEnter}
 onDragLeave={handleDropzoneDragLeave}
 onDragOver={handleDropzoneDragOver}
 onDrop={handleDropzoneDrop}
 >
 <div key={settings.inputMode} id="concept-input-area" className="unified-input-body">
 {renderContent()}
 </div>
 {shouldShowLocalDropOverlay && (settings.inputMode === 'image' || settings.inputMode === 'video') && (
 <div className="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none">
 <div data-upload-drop-message="true" className="flex flex-col items-center justify-center text-center">
 <span className="material-symbols-outlined text-[42px] leading-none w-[42px] h-[42px] mb-1 drop-active-icon">
 upload
 </span>
 <span className="text-sm font-medium drop-active-text">
 {dragDropPromptText}
 </span>
 </div>
 </div>
 )}
 {/* Footer with settings */}
 <div ref={footerRef} className="unified-footer overflow-x-auto overflow-y-hidden">
 {/* LEFT: Style */}
 <div className="flex items-center gap-1 flex-shrink-0">
 <StyleSelector
 currentStyle={settings.styleOption}
 onStyleChange={settings.setStyleOption}
 inputMode={settings.inputMode}
 disabled={disabled || settings.inputMode === 'video'}
 inline
 iconOnly={isFooterCompact}
 showFeatureLabel={!settings.hasUserSelectedStyleOption && settings.inputMode !== 'video'}
 />
 </div>

 {/* SPACER */}
 <div className="flex-grow"></div>

 {/* RIGHT: Model + Quality/Format (shared slot) + Jumlah */}
 <div className="ml-auto flex items-center gap-1.5 flex-shrink-0 min-w-max">
 {/* Slot bersama: Quality ATAU Format — lebar tetap agar tidak bergeser */}
 <ModelSelector
 currentModel={settings.selectedModel}
 availableModels={getModelsForInputMode(settings.inputMode)}
 onModelChange={settings.setSelectedModel}
 disabled={disabled}
 inline
 iconOnly={isFooterCompact}
 />
 <div
 style={{
 width: (settings.styleOption === 'footage' || settings.styleOption === 'isolated' || settings.styleOption === 'custom')
 ? '0px'
 : (isFooterCompact ? '42px' : '102px'),
 flexShrink: 0,
 }}
 className="flex items-center justify-center"
 >
 {settings.styleOption !== 'footage' && settings.styleOption !== 'isolated' && settings.styleOption !== 'custom' && (
 <PromptQualitySelector
 currentQuality={settings.promptQualityOption}
 onQualityChange={settings.setPromptQualityOption}
 disabled={disabled}
 inline
 iconOnly={isFooterCompact}
 showFeatureLabel={!settings.hasUserSelectedPromptQuality}
 />
 )}
 </div>

 {/* Jumlah Prompt */}
 <div className="num-prompts-control">
 <input
 type="number"
 min="1"
 value={settings.numPrompts}
 onChange={settings.handleNumPromptsChange}
 disabled={disabled}
 className="num-prompts-input"
 aria-label="Jumlah prompt"
 />
 <div className="num-prompts-stepper">
 <button
 type="button"
 className="num-prompts-step-btn"
 onClick={() => settings.setNumPrompts(settings.numPrompts + 1)}
 disabled={disabled}
 aria-label="Tambah jumlah prompt"
 >
 <span className="material-symbols-outlined">keyboard_arrow_up</span>
 </button>
 <button
 type="button"
 className="num-prompts-step-btn"
 onClick={() => settings.setNumPrompts(Math.max(1, settings.numPrompts - 1))}
 disabled={disabled || settings.numPrompts <= 1}
 aria-label="Kurangi jumlah prompt"
 >
 <span className="material-symbols-outlined">keyboard_arrow_down</span>
 </button>
 </div>
 </div>
 </div>

 </div>
 </div>

 {settings.inputMode === 'image' && uploadedImages.length > 0 && (
 <div className="image-thumbnail-grid mt-3">
 {uploadedImages.map(image => (
 <div key={image.id} className="image-thumbnail-item !w-[48px] !h-[48px]" aria-label={`${t('thumbnailAriaLabelPrefix')} ${image.name}`}>
 <img src={image.objectUrl} alt={image.name} />
 <button onClick={(e) => { e.stopPropagation(); handleDeleteImage(image.id); }} className="image-thumbnail-delete-btn" aria-label={`${t('deleteImageAriaLabelPrefix')} ${image.name}`}>
 <span className="material-symbols-outlined">close</span>
 </button>
 </div>
 ))}
 </div>
 )}

 {settings.inputMode === 'video' && (
 <div className="mt-3">
 <div className="flex items-start space-x-2">
 <div className="flex-grow">
 <input
 type="url"
 value={videoUrlInput}
 onChange={(e) => setVideoUrlInput(e.target.value)}
 onClick={handleUrlInputClick}
 onPaste={handleVideoUrlPaste}
 onKeyDown={handleVideoUrlKeyDown}
 placeholder={t('videoUrlInputPlaceholder')}
 className="flat-input text-sm flex-grow w-full !py-2"
 disabled={disabled || isLoadingFromUrl}
 aria-label={t('videoUrlInputPlaceholder')}
 />
 {videoUploaderError && <p role="alert" className="text-xs mt-1 text-red-500">{videoUploaderError}</p>}
 </div>
 <button
 onClick={() => handleLoadFromUrl(videoUrlInput)}
 className="btn btn-action video-load-btn !py-2 text-sm w-28 justify-center"
 disabled={disabled || isLoadingFromUrl || !videoUrlInput.trim()}
 >
 <div className="relative h-5 flex items-center justify-center">
 <span className={isLoadingFromUrl ? 'opacity-0' : 'opacity-100'}>
 {t('loadVideoButtonLabel')}
 </span>
 {isLoadingFromUrl && (
 <div className="absolute inset-0 flex items-center justify-center">
 <Spinner size="w-4 h-4" />
 </div>
 )}
 </div>
 </button>
 </div>
 </div>
 )}

 <input ref={imageFileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageFiles(e.target.files)} aria-hidden="true" />
 <input ref={videoFileInputRef} type="file" multiple accept="video/*" style={{ display: 'none' }} onChange={(e) => handleVideoFile(e.target.files)} aria-hidden="true" />

 {settings.inputMode === 'video' && uploadedVideos.length > 0 && (
 <div className="video-thumbnail-grid">
 {uploadedVideos.map(video => (
 <div
 key={video.id}
 className="video-thumbnail-item"
 aria-label={`Thumbnail for video ${video.name}`}
 data-video-id={video.id}
 ref={(node) => {
 const observer = videoVisibilityObserverRef.current;
 if (!observer || !node) return;
 observer.observe(node);
 }}
 >
 <video
 key={video.objectUrl}
 src={`${video.objectUrl}#t=0.1`}
 muted
 loop
 playsInline
 preload="metadata"
 className="w-full h-full object-cover"
 onMouseEnter={(e) => {
 if (settings.inputMode !== 'video' || !visibleVideoIds.has(video.id)) return;
 e.currentTarget.play().catch(() => {
 // Autoplay was prevented. This can be ignored.
 });
 }}
 onMouseLeave={(e) => {
 e.currentTarget.pause();
 e.currentTarget.currentTime = 0;
 }}
 />
 <button onClick={() => handleDeleteVideo(video.id)} className="video-thumbnail-delete-btn" aria-label={`Delete video ${video.name}`}>
 <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default memo(InputArea);
