import { useCallback, useRef, useState, type FormEvent } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Alert,
  Button,
  Modal,
  cn,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { Camera, Trash2, Upload } from 'lucide-react';
import {
  deletePlayerPhoto,
  PlayerPhotoApiError,
  uploadPlayerPhoto,
} from '../../lib/player-photo-api';
import { PlayerAvatar } from './PlayerAvatar';

interface PlayerPhotoModalProps {
  open: boolean;
  onClose: () => void;
  player: {
    id: number;
    firstName: string;
    lastName: string;
    photoUrl?: string | null;
  };
  onChanged: (photoUrl: string | null) => void;
}

function centerSquareCrop(mediaWidth: number, mediaHeight: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, 1, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

async function cropToBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(crop.width * scaleX));
  const height = Math.max(1, Math.floor(crop.height * scaleY));
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    width,
    height,
    0,
    0,
    width,
    height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('blob'))),
      'image/jpeg',
      0.92,
    );
  });
}

export function PlayerPhotoModal({ open, onClose, player, onChanged }: PlayerPhotoModalProps) {
  const { t } = useTranslation();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const resetSelection = useCallback(() => {
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setError(null);
    setConfirmDelete(false);
  }, [src]);

  const handleClose = () => {
    resetSelection();
    onClose();
  };

  const onSelectFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(t('players.photo.errors.tooLarge'));
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      setError(t('players.photo.errors.format'));
      return;
    }
    if (src) URL.revokeObjectURL(src);
    const url = URL.createObjectURL(file);
    setSrc(url);
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerSquareCrop(width, height));
  };

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!imgRef.current || !completedCrop?.width || !completedCrop?.height) {
      setError(t('players.photo.errors.crop'));
      return;
    }
    setUploading(true);
    try {
      const blob = await cropToBlob(imgRef.current, completedCrop);
      const result = await uploadPlayerPhoto(player.id, blob, `${player.firstName}.jpg`);
      onChanged(result.photoUrl);
      handleClose();
    } catch (err) {
      setError(
        err instanceof PlayerPhotoApiError
          ? err.message
          : t('players.photo.errors.generic'),
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deletePlayerPhoto(player.id);
      onChanged(null);
      handleClose();
    } catch (err) {
      setError(
        err instanceof PlayerPhotoApiError
          ? err.message
          : t('players.photo.errors.delete'),
      );
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('players.photo.title', { name: player.firstName })}
    >
      <form onSubmit={(e) => void handleUpload(e)} className="space-y-4">
        <p className="text-sm text-text-secondary">
          {t('players.photo.subtitle', { name: player.firstName })}
        </p>

        <div className="flex justify-center">
          <PlayerAvatar
            player={{
              firstName: player.firstName,
              lastName: player.lastName,
              photoUrl: player.photoUrl,
            }}
            size="xl"
          />
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {!src ? (
          <label
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-bg-muted/40 px-4 py-8 text-center transition hover:border-brand',
            )}
          >
            <Camera className="h-8 w-8 text-brand" aria-hidden="true" />
            <span className="text-sm font-medium text-text-primary">
              {t('players.photo.choose')}
            </span>
            <span className="text-xs text-text-muted">{t('players.photo.hint')}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(e) => onSelectFile(e.target.files?.[0])}
            />
          </label>
        ) : (
          <div className="mx-auto max-w-sm">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop
            >
              <img
                ref={imgRef}
                src={src}
                alt=""
                onLoad={onImageLoad}
                className="max-h-72 w-full object-contain"
              />
            </ReactCrop>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          {player.photoUrl && !src && (
            confirmDelete ? (
              <div className="mr-auto flex flex-wrap items-center gap-2">
                <span className="text-sm text-text-secondary">{t('players.photo.deleteConfirm')}</span>
                <Button
                  type="button"
                  variant="secondary"
                  loading={deleting}
                  onClick={() => void handleDelete()}
                  className="text-feedback-error"
                >
                  {t('players.photo.deleteYes')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="mr-auto inline-flex items-center gap-2 text-feedback-error"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('players.photo.delete')}
              </Button>
            )
          )}
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            loading={uploading}
            disabled={!src}
            className="inline-flex items-center gap-2"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {t('players.photo.upload')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
