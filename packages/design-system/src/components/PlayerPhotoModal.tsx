import { useState } from 'react';
import { Modal, type ModalProps } from './Modal.js';
import { FileInput } from './FileInput.js';
import { Button } from './Button.js';

export interface PlayerPhotoModalProps extends Omit<ModalProps, 'children' | 'onClose'> {
  onPhotoPicked?: (file: File) => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export function PlayerPhotoModal({
  onPhotoPicked,
  onCancel,
  open = false,
  title = 'Upload Player Photo',
  onClose,
}: PlayerPhotoModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (selectedFile) {
      onPhotoPicked?.(selectedFile);
      setSelectedFile(null);
      onClose?.();
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        onCancel?.();
        setSelectedFile(null);
        onClose?.();
      }}
    >
      <div className="space-y-4">
        <FileInput
          accept="image/*"
          onChange={(files) => setSelectedFile(files[0] || null)}
          label="Select a photo"
        />

        {selectedFile && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Selected: <strong>{selectedFile.name}</strong>
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            onClick={() => {
              onCancel?.();
              setSelectedFile(null);
              onClose?.();
            }}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile}>
            Upload Photo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
