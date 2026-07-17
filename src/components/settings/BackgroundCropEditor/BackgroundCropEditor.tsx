import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion } from "motion/react";
import type { WallpaperCrop } from "../../../types/desktop";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import {
  clampWallpaperCrop,
  defaultWallpaperCrop,
  fitImageInBox,
  getScreenAspectRatio,
} from "../../../features/settings/wallpaperUtils";
import { CutoutButton } from "../../comic/CutoutButton";
import { ComicPanel } from "../../comic/ComicPanel";
import styles from "./BackgroundCropEditor.module.css";

interface BackgroundCropEditorProps {
  open: boolean;
  imageSrc: string;
  initialCrop?: WallpaperCrop;
  onConfirm: (crop: WallpaperCrop) => void;
  onCancel: () => void;
}

const PREVIEW_MAX_WIDTH = 560;
const PREVIEW_MAX_HEIGHT = 360;

export function BackgroundCropEditor({
  open,
  imageSrc,
  initialCrop,
  onConfirm,
  onCancel,
}: BackgroundCropEditorProps) {
  const reduceMotion = useEffectiveReducedMotion();
  const dragState = useRef<{ startX: number; startY: number; crop: WallpaperCrop } | null>(null);
  const [crop, setCrop] = useState<WallpaperCrop>(
    () => initialCrop ?? { x: 0, y: 0, width: 1, height: 1 },
  );
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null);
  const [loadError, setLoadError] = useState(false);

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      const fitted = fitImageInBox(
        image.naturalWidth,
        image.naturalHeight,
        PREVIEW_MAX_WIDTH,
        PREVIEW_MAX_HEIGHT,
      );

      setLoadError(false);
      setDisplaySize(fitted);

      if (!initialCrop) {
        setCrop(
          defaultWallpaperCrop(
            image.naturalWidth,
            image.naturalHeight,
            getScreenAspectRatio(),
          ),
        );
      }
    },
    [initialCrop],
  );

  const handleImageError = useCallback(() => {
    setLoadError(true);
    setDisplaySize(null);
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      crop,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current || !displaySize) return;

    const dx = (event.clientX - dragState.current.startX) / displaySize.width;
    const dy = (event.clientY - dragState.current.startY) / displaySize.height;

    setCrop(
      clampWallpaperCrop({
        ...dragState.current.crop,
        x: dragState.current.crop.x + dx,
        y: dragState.current.crop.y + dy,
      }),
    );
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragState.current = null;
  };

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={onCancel}>
      <motion.div
        className={styles.dialogWrap}
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <ComicPanel variant="white" shadowColor="black" rotation={-0.5}>
          <div className={styles.content}>
            <h2 className={styles.title}>Recortar fondo</h2>
            <p className={styles.description}>
              Arrastra el recuadro azul para elegir la zona que ocupará toda la pantalla.
            </p>

            <div className={styles.stage}>
              {displaySize ? (
                <div
                  className={styles.imageFrame}
                  style={{ width: displaySize.width, height: displaySize.height }}
                >
                  <img
                    className={styles.image}
                    src={imageSrc}
                    alt=""
                    draggable={false}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                  />
                  <div
                    className={styles.cropRect}
                    style={{
                      left: `${crop.x * 100}%`,
                      top: `${crop.y * 100}%`,
                      width: `${crop.width * 100}%`,
                      height: `${crop.height * 100}%`,
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    role="presentation"
                  />
                </div>
              ) : (
                <div className={styles.loadingFrame}>
                  {loadError ? (
                    <p className={styles.errorText}>No se pudo cargar la imagen.</p>
                  ) : (
                    <img
                      className={styles.imageHidden}
                      src={imageSrc}
                      alt=""
                      draggable={false}
                      onLoad={handleImageLoad}
                      onError={handleImageError}
                    />
                  )}
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <CutoutButton variant="default" rotation={-1} onClick={onCancel}>
                Cancelar
              </CutoutButton>
              <CutoutButton
                variant="active"
                rotation={1}
                disabled={!displaySize || loadError}
                onClick={() => onConfirm(clampWallpaperCrop(crop))}
              >
                Aplicar
              </CutoutButton>
            </div>
          </div>
        </ComicPanel>
      </motion.div>
    </div>
  );
}
