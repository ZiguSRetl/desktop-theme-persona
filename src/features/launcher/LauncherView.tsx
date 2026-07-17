import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LauncherItem } from "../../types/desktop";
import { AddShortcutDialog } from "../../components/comic/AddShortcutDialog";
import { launchItem } from "./launchItem";
import { useFavoriteItems, useItemsByCategory } from "./launcherSelectors";
import { useLauncherStore } from "./launcherStore";
import { revealItemInDir } from "./revealItem";
import { showLaunchError, showSuccess } from "./toastStore";
import { LauncherAddTile } from "./LauncherAddTile";
import { LauncherDetailPanel } from "./LauncherDetailPanel";
import { LauncherTile, tileDisplayName } from "./LauncherTile";
import { SectionBadge } from "./SectionBadge";
import styles from "./LauncherView.module.css";

const DEFAULT_ITEMS_PER_PAGE = 8;

function useItemsPerPage(gridRef: React.RefObject<HTMLDivElement | null>) {
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);

  useEffect(() => {
    const node = gridRef.current;
    if (!node) return;

    const update = () => {
      const width = node.clientWidth;
      const tileMin = 120;
      const gap = 16;
      const cols = Math.max(2, Math.floor((width + gap) / (tileMin + gap)));
      const rows = 2;
      setItemsPerPage(cols * rows);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [gridRef]);

  return itemsPerPage;
}

interface SortableTileProps {
  item: LauncherItem;
  selected: boolean;
  onSelect: () => void;
  onLaunch: () => void;
  onRemove: () => void;
}

function SortableTile({ item, selected, onSelect, onLaunch, onRemove }: SortableTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} role="listitem">
      <LauncherTile
        name={item.name}
        target={item.target}
        type={item.type}
        icon={item.icon}
        selected={selected}
        dragging={isDragging}
        sortable
        dragHandleProps={{ ...attributes, ...listeners }}
        onSelect={onSelect}
        onLaunch={onLaunch}
        onRemove={onRemove}
      />
    </div>
  );
}

type LauncherViewProps =
  | {
      source: "favorites";
      sectionBadge: string;
      showStar?: boolean;
    }
  | {
      category: LauncherItem["category"];
      sectionBadge: string;
      showAdd?: boolean;
    };

export function LauncherView(props: LauncherViewProps) {
  const isFavorites = "source" in props && props.source === "favorites";
  const category = "category" in props ? props.category : undefined;
  const showAdd = "category" in props ? (props.showAdd ?? true) : false;

  const categoryItems = useItemsByCategory(category ?? "apps");
  const favoriteItems = useFavoriteItems();
  const items = isFavorites ? favoriteItems : categoryItems;

  const addItem = useLauncherStore((state) => state.addItem);
  const updateItem = useLauncherStore((state) => state.updateItem);
  const removeItem = useLauncherStore((state) => state.removeItem);
  const toggleFavorite = useLauncherStore((state) => state.toggleFavorite);
  const reorderItems = useLauncherStore((state) => state.reorderItems);
  const reorderFavorites = useLauncherStore((state) => state.reorderFavorites);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<LauncherItem | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const itemsPerPage = useItemsPerPage(gridRef);

  const selectedItem = useMemo(() => {
    if (items.length === 0) return null;
    const match = selectedId ? items.find((item) => item.id === selectedId) : undefined;
    return match ?? items[0] ?? null;
  }, [items, selectedId]);

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(safePage * itemsPerPage, safePage * itemsPerPage + itemsPerPage);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  const handleLaunch = async (item: LauncherItem) => {
    try {
      await launchItem(item);
    } catch (error) {
      showLaunchError(error);
    }
  };

  const handleAdd = async (input: Parameters<typeof addItem>[0]) => {
    await addItem(input);
    showSuccess("Acceso añadido correctamente.");
  };

  const handleEdit = async (input: Parameters<typeof updateItem>[1]) => {
    if (!editItem) return;
    await updateItem(editItem.id, input);
    showSuccess("Acceso actualizado.");
  };

  const handleRemove = async (item: LauncherItem) => {
    try {
      await removeItem(item.id);
      showSuccess(`"${tileDisplayName(item.name, item.target)}" eliminado.`);
    } catch (error) {
      showLaunchError(error);
    }
  };

  const confirmRemove = (item: LauncherItem) => {
    const label = tileDisplayName(item.name, item.target);
    if (window.confirm(`¿Eliminar el acceso "${label}"?\n\nRuta: ${item.target}`)) {
      void handleRemove(item);
    }
  };

  const handleReveal = async (item: LauncherItem) => {
    try {
      await revealItemInDir(item.target);
    } catch (error) {
      showLaunchError(error);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const nextIds = arrayMove(itemIds, oldIndex, newIndex);
    if (isFavorites) {
      void reorderFavorites(nextIds);
      return;
    }
    if (!category) return;
    void reorderItems(category, nextIds);
  };

  const gridContent = (
    <>
      {pageItems.map((item) => (
        <SortableTile
          key={item.id}
          item={item}
          selected={selectedItem?.id === item.id}
          onSelect={() => setSelectedId(item.id)}
          onLaunch={() => void handleLaunch(item)}
          onRemove={() => confirmRemove(item)}
        />
      ))}
      {showAdd ? <LauncherAddTile onClick={() => setDialogOpen(true)} /> : null}
    </>
  );

  return (
    <div className="page-layout launcher-page">
      <SectionBadge label={props.sectionBadge} showStar={"showStar" in props ? props.showStar : false} />

      <div className="launcher-layout">
        <div className={styles.main}>
          <div className={styles.gridWrap}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={itemIds} strategy={rectSortingStrategy}>
                <div ref={gridRef} className={styles.grid} role="list">
                  {gridContent}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {totalPages > 1 ? (
            <nav className={styles.pagination} aria-label="Paginación del grid">
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`${styles.dot} ${index === safePage ? styles.dotActive : ""}`}
                  aria-label={`Página ${index + 1}`}
                  aria-current={index === safePage ? "page" : undefined}
                  onClick={() => setPage(index)}
                />
              ))}
            </nav>
          ) : null}
        </div>

        <aside className={styles.detailAside} aria-label="Panel de detalle">
          <details className="context-panel__details launcher-panel__details" open>
            <summary className="context-panel__toggle">Detalle del acceso</summary>
            <div className="context-panel__content">
              <LauncherDetailPanel
                item={selectedItem}
                onLaunch={(item) => void handleLaunch(item)}
                onEdit={setEditItem}
                onToggleFavorite={(item) => void toggleFavorite(item.id)}
                onReveal={(item) => void handleReveal(item)}
                onRemove={(item) => void handleRemove(item)}
              />
            </div>
          </details>
        </aside>
      </div>

      <AddShortcutDialog
        open={dialogOpen}
        defaultCategory={category ?? "apps"}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleAdd}
      />

      {editItem ? (
        <AddShortcutDialog
          mode="edit"
          open
          initialItem={editItem}
          onClose={() => setEditItem(null)}
          onSubmit={handleEdit}
        />
      ) : null}
    </div>
  );
}
