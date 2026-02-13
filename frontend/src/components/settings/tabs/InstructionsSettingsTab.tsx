import { Label } from '@/components/ui/primitives/Label';
import { Textarea } from '@/components/ui/primitives/Textarea';
import { cn } from '@/utils/cn';

interface InstructionsSettingsTabProps {
  instructions: string;
  onInstructionsChange: (value: string) => void;
}

export const InstructionsSettingsTab: React.FC<InstructionsSettingsTabProps> = ({
  instructions,
  onInstructionsChange,
}) => (
  <div className="space-y-5">
    <div>
      <h2 className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
        Custom Instructions
      </h2>
      <p className="mt-1 text-xs text-text-tertiary dark:text-text-dark-tertiary">
        These instructions will be added to every conversation with the AI.
      </p>
    </div>
    <div className={cn('rounded-xl border border-border p-5 dark:border-border-dark')}>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs text-text-secondary dark:text-text-dark-secondary">
          Instructions for the AI assistant
        </Label>
        <span className="text-2xs tabular-nums text-text-quaternary dark:text-text-dark-quaternary">
          {instructions.length}/1500
        </span>
      </div>
      <Textarea
        value={instructions}
        onChange={(e) => onInstructionsChange(e.target.value)}
        placeholder="Enter custom instructions for how the AI should behave, respond, or approach tasks..."
        maxLength={1500}
        rows={8}
        className="min-h-32"
      />
    </div>
  </div>
);
