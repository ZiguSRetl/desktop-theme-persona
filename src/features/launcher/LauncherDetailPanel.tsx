import { useState } from "react";
import {
  FolderOpen,
  Info,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import type { LauncherItem } from "../../types/desktop";
import { ComicPanel } from "../../components/comic/ComicPanel";
import { canRevealLocation, itemDescription } from "./itemDescription";
import { LauncherItemIcon } from "./LauncherItemIcon";
import { tileDisplayName } from "./LauncherTile";
import styles from "./LauncherDetailPanel.module.css";

interface LauncherDetailPanelProps {
  item: LauncherItem | null;
  onLaunch: (item: LauncherItem) => void;
  onEdit: (item: LauncherItem) => void;
  onToggleFavorite: (item: LauncherItem) => void;
  onReveal: (item: LauncherItem) => void;
  onRemove: (item: LauncherItem) => void;
}

export function LauncherDetailPanel({
  item,
  onLaunch,
  onEdit,
  onToggleFavorite,
  onReveal,
  onRemove,
}: LauncherDetailPanelProps) {
  const [confirmForId, setConfirmForId] = useState<string | null>(null);
  const confirmDelete = item ? confirmForId === item.id : false;

  if (!item) {
    return (
      <ComicPanel variant="white" rotation={-1} shadowColor="red" className={styles.panel}>
        <p className={styles.empty}>Selecciona un acceso para ver detalles y acciones.</p>
      </ComicPanel>
    );
  }

  const showReveal = canRevealLocation(item);

  return (
    <ComicPanel variant="white" rotation={-1} shadowColor="red" className={styles.panel}>
      <div className={styles.hero}>
        <LauncherItemIcon type={item.type} icon={item.icon} className={styles.iconWrap} />
        <h2 className={styles.name}>{tileDisplayName(item.name, item.target)}</h2>
        <p className={styles.description}>{itemDescription(item)}</p>
        <p className={styles.target} title={item.target}>
          {item.target}
        </p>
      </div>

      <div className={styles.primaryActions}>
        <button type="button" className={styles.openBtn} onClick={() => onLaunch(item)}>
          Abrir
        </button>
        <button
          type="button"
          className={styles.settingsBtn}
          aria-label={`Editar ${item.name}`}
          onClick={() => onEdit(item)}
        >
          <Settings size={20} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.actionBtn} ${item.favorite ? styles.actionBtnActive : ""}`}
          onClick={() => onToggleFavorite(item)}
        >
          <Star size={16} fill={item.favorite ? "currentColor" : "none"} aria-hidden="true" />
          {item.favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
        </button>

        <button type="button" className={styles.actionBtn} onClick={() => onEdit(item)}>
          <Info size={16} aria-hidden="true" />
          Más información
        </button>

        {showReveal ? (
          <button type="button" className={styles.actionBtn} onClick={() => onReveal(item)}>
            <FolderOpen size={16} aria-hidden="true" />
            Abrir ubicación del archivo
          </button>
        ) : null}

        {confirmDelete ? (
          <div className={styles.confirmRow}>
            <button
              type="button"
              className={`${styles.confirmBtn} ${styles.confirmYes}`}
              onClick={() => {
                onRemove(item);
                setConfirmForId(null);
              }}
            >
              Confirmar
            </button>
            <button
              type="button"
              className={`${styles.confirmBtn} ${styles.confirmNo}`}
              onClick={() => setConfirmForId(null)}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() => setConfirmForId(item.id)}
          >
            <Trash2 size={16} aria-hidden="true" />
            Eliminar acceso
          </button>
        )}
      </div>
    </ComicPanel>
  );
}
