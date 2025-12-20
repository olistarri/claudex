import { AttachButton } from './AttachButton';
import { EnhanceButton } from './EnhanceButton';
import { PermissionModeSelector } from '@/components/chat/permission-mode-selector/PermissionModeSelector';
import { ModelSelector } from '@/components/chat/model-selector/ModelSelector';
import { ThinkingModeSelector } from '@/components/chat/thinking-mode-selector/ThinkingModeSelector';

export interface InputControlsProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  onAttach?: () => void;
  onEnhance?: () => void;
  dropdownPosition?: 'top' | 'bottom';
  isLoading?: boolean;
  isEnhancing?: boolean;
  hasMessage?: boolean;
}

export function InputControls({
  selectedModelId,
  onModelChange,
  onAttach,
  onEnhance,
  dropdownPosition = 'bottom',
  isLoading = false,
  isEnhancing = false,
  hasMessage = false,
}: InputControlsProps) {
  return (
    <div
      className="absolute bottom-2.5 left-3 right-14 flex flex-wrap items-center gap-1.5 sm:gap-2"
      onClick={(e) => e.preventDefault()}
    >
      {onAttach && <AttachButton onAttach={onAttach} />}

      {onEnhance && (
        <EnhanceButton
          onEnhance={onEnhance}
          isEnhancing={isEnhancing}
          disabled={isLoading || !hasMessage}
        />
      )}

      <PermissionModeSelector dropdownPosition={dropdownPosition} disabled={isLoading} />

      <ThinkingModeSelector dropdownPosition={dropdownPosition} disabled={isLoading} />

      <ModelSelector
        selectedModelId={selectedModelId}
        onModelChange={onModelChange}
        dropdownPosition={dropdownPosition}
        disabled={isLoading}
      />
    </div>
  );
}
