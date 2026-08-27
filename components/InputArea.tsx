import React, { memo } from 'react';
import { UseSettingsReturn } from '../hooks/useSettings';
import { VectorBrainstormCard } from './VectorBrainstormCard';

interface InputAreaProps {
  isLoading: boolean;
  disabled: boolean;
  settings: UseSettingsReturn;
  onGenerate: () => void;
  // Kept for interface compatibility
  isDraggingOverDropzone?: boolean;
  uploadedImages?: any[];
  handleImageFiles?: any;
  handleDeleteImage?: any;
  imageFileInputRef?: any;
  clearUploadedImages?: any;
  imageUploaderError?: any;
  clearImageUploaderError?: any;
  uploadedVideos?: any[];
  videoUrlInput?: any;
  isLoadingFromUrl?: any;
  videoUploaderError?: any;
  handleVideoFile?: any;
  handleLoadFromUrl?: any;
  handleUrlInputClick?: any;
  setVideoUrlInput?: any;
  clearAllVideos?: any;
  handleDeleteVideo?: any;
  videoFileInputRef?: any;
}

const InputArea: React.FC<InputAreaProps> = ({
  isLoading,
  disabled,
  settings,
  onGenerate,
}) => {
  return (
    <div className="editorial-input-area mb-3 w-full">
      <VectorBrainstormCard
        settings={settings}
        isLoading={isLoading}
        disabled={disabled}
        onGenerate={onGenerate}
      />
    </div>
  );
};

export default memo(InputArea);
