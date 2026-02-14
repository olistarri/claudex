import { useState } from 'react';
import { Button, Input, Label } from '@/components/ui';
import { BaseModal } from '@/components/ui/shared/BaseModal';

interface ProjectDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  name: string;
  folderName: string;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  onNameChange: (value: string) => void;
  onFolderNameChange: (value: string) => void;
}

export function ProjectDialog({
  isOpen,
  isEditing,
  name,
  folderName,
  error,
  onClose,
  onSubmit,
  onNameChange,
  onFolderNameChange,
}: ProjectDialogProps) {
  const [folderManuallyEdited, setFolderManuallyEdited] = useState(false);

  const handleNameChange = (value: string) => {
    onNameChange(value);
    if (!isEditing && !folderManuallyEdited) {
      onFolderNameChange(
        value
          .toLowerCase()
          .replace(/[^a-z0-9_\-\.]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, ''),
      );
    }
  };

  const handleFolderNameChange = (value: string) => {
    setFolderManuallyEdited(true);
    onFolderNameChange(value.replace(/[^a-zA-Z0-9_\-\.]/g, ''));
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} size="lg" className="max-h-[90vh] overflow-y-auto">
      <div className="p-5">
        <h3 className="mb-5 text-sm font-medium text-text-primary dark:text-text-dark-primary">
          {isEditing ? 'Rename Project' : 'Create Project'}
        </h3>

        {error && (
          <div className="mb-4 rounded-xl border border-border p-3 dark:border-border-dark">
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 text-xs text-text-secondary dark:text-text-dark-secondary">
              Project Name
            </Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Project"
            />
          </div>

          {!isEditing && (
            <div>
              <Label className="mb-1.5 text-xs text-text-secondary dark:text-text-dark-secondary">
                Folder Name
              </Label>
              <Input
                value={folderName}
                onChange={(e) => handleFolderNameChange(e.target.value)}
                placeholder="my-project"
                className="font-mono text-xs"
              />
              <p className="mt-1 text-2xs text-text-quaternary dark:text-text-dark-quaternary">
                Letters, numbers, hyphens, underscores, and dots only
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" onClick={onClose} variant="outline" size="sm">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            variant="primary"
            size="sm"
            disabled={!name.trim() || (!isEditing && !folderName.trim())}
          >
            {isEditing ? 'Rename' : 'Create'}
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}
