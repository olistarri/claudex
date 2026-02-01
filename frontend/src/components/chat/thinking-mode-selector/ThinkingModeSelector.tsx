import { memo } from 'react';
import { Brain } from 'lucide-react';
import { Dropdown } from '@/components/ui';
import { useUIStore } from '@/store';

export interface ThinkingModeOption {
  value: string | null;
  label: string;
  tokens: string;
}

const THINKING_MODES: ThinkingModeOption[] = [
  { value: null, label: 'Off', tokens: '0' },
  { value: 'low', label: 'Low', tokens: '4k' },
  { value: 'medium', label: 'Medium', tokens: '10k' },
  { value: 'high', label: 'High', tokens: '15k' },
  { value: 'ultra', label: 'Ultra', tokens: '32k' },
];

export interface ThinkingModeSelectorProps {
  dropdownPosition?: 'top' | 'bottom';
  disabled?: boolean;
}

export const ThinkingModeSelector = memo(function ThinkingModeSelector({
  dropdownPosition = 'bottom',
  disabled = false,
}: ThinkingModeSelectorProps) {
  const thinkingMode = useUIStore((state) => state.thinkingMode);
  const setThinkingMode = useUIStore((state) => state.setThinkingMode);
  const isSplitMode = useUIStore((state) => state.isSplitMode);

  const selectedMode = THINKING_MODES.find((m) => m.value === thinkingMode) || THINKING_MODES[0];

  return (
    <Dropdown
      value={selectedMode}
      items={THINKING_MODES}
      getItemKey={(mode) => mode.value || 'off'}
      getItemLabel={(mode) => mode.label}
      onSelect={(mode) => setThinkingMode(mode.value)}
      leftIcon={Brain}
      width="w-32"
      dropdownPosition={dropdownPosition}
      disabled={disabled}
      compactOnMobile
      forceCompact={isSplitMode}
      renderItem={(mode, isSelected) => (
        <div className="flex w-full items-center justify-between">
          <span
            className={`text-xs font-medium text-text-primary ${isSelected ? 'dark:text-text-dark-primary' : 'dark:text-text-dark-secondary'}`}
          >
            {mode.label}
          </span>
          <span className="text-2xs text-text-quaternary dark:text-text-dark-tertiary">
            {mode.tokens}
          </span>
        </div>
      )}
    />
  );
});
