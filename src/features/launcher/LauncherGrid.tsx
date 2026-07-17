import { useMemo, useState } from "react";
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
import { useT } from "../../i18n";
import type { LauncherItem } from "../../types/desktop";
import { launchItem } from "./launchItem";
import { useItemsByCategory, useFavoriteItems } from "./launcherSelectors";
import { useLauncherStore } from "./launcherStore";
import { showLaunchError, showSuccess } from "./toastStore";
import { AppCutout } from "../../components/comic/AppCutout";
import { AddCutout } from "../../components/comic/AddCutout";
import { AddShortcutDialog } from "../../components/comic/AddShortcutDialog";

interface SortableCutoutProps {
  item: LauncherItem;
  index: number;
  total: number;
  confirmDelete: boolean;
  onLaunch: () => void;
  onRemove: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SortableCutout({
  item,
  index,
  total,
  confirmDelete,
  onLaunch,
  onRemove,
  onEdit,
  onToggleFavorite,
  onMoveUp,
  onMoveDown,
}: SortableCutoutProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} role="listitem">
      <AppCutout
        id={item.id}
        name={item.name}
        type={item.type}
        category={item.category}
        index={index}
        accent={item.accent}
        isFavorite={item.favorite}
        confirmDelete={confirmDelete}
        sortable
        dragHandleProps={{ ...attributes, ...listeners }}
        onLaunch={onLaunch}
        onRemove={onRemove}
        onEdit={onEdit}
        onToggleFavorite={onToggleFavorite}
        onMoveUp={index > 0 ? onMoveUp : undefined}
        onMoveDown={index < total - 1 ? onMoveDown : undefined}
      />
    </div>
  );
}

interface LauncherGridProps {
  category: LauncherItem["category"];
  showAdd?: boolean;
  gridClassName?: string;
}

export function LauncherGrid({
  category,
  showAdd = true,
  gridClassName = "",
}: LauncherGridProps) {
  const t = useT();
  const items = useItemsByCategory(category);
  const addItem = useLauncherStore((state) => state.addItem);
  const updateItem = useLauncherStore((state) => state.updateItem);
  const removeItem = useLauncherStore((state) => state.removeItem);
  const toggleFavorite = useLauncherStore((state) => state.toggleFavorite);
  const reorderItems = useLauncherStore((state) => state.reorderItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<LauncherItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LauncherItem | null>(null);

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
    showSuccess(t("launcher.toasts.added"));
  };

  const handleEdit = async (input: Parameters<typeof updateItem>[1]) => {
    if (!editItem) return;
    await updateItem(editItem.id, input);
    showSuccess(t("launcher.toasts.updated"));
  };

  const handleRemove = async (item: LauncherItem) => {
    if (pendingDelete?.id !== item.id) {
      setPendingDelete(item);
      return;
    }

    try {
      await removeItem(item.id);
      showSuccess(t("launcher.toasts.removed", { name: item.name }));
      setPendingDelete(null);
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
    void reorderItems(category, nextIds);
  };

  const moveItem = async (itemId: string, direction: -1 | 1) => {
    const index = itemIds.indexOf(itemId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= itemIds.length) return;
    const nextIds = arrayMove(itemIds, index, targetIndex);
    await reorderItems(category, nextIds);
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          <div className={`cutout-grid ${gridClassName}`.trim()} role="list">
            {items.map((item, index) => (
              <SortableCutout
                key={item.id}
                item={item}
                index={index}
                total={items.length}
                confirmDelete={pendingDelete?.id === item.id}
                onLaunch={() => void handleLaunch(item)}
                onRemove={() => void handleRemove(item)}
                onEdit={() => setEditItem(item)}
                onToggleFavorite={() => void toggleFavorite(item.id)}
                onMoveUp={() => void moveItem(item.id, -1)}
                onMoveDown={() => void moveItem(item.id, 1)}
              />
            ))}
            {showAdd ? (
              <AddCutout label={t("launcher.addWithPlus")} onClick={() => setDialogOpen(true)} />
            ) : null}
          </div>
        </SortableContext>
      </DndContext>

      <AddShortcutDialog
        open={dialogOpen}
        defaultCategory={category}
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
    </>
  );
}

interface FavoritesGridProps {
  gridClassName?: string;
}

export function FavoritesGrid({ gridClassName = "cutout-grid--home" }: FavoritesGridProps) {
  const t = useT();
  const items = useFavoriteItems();
  const updateItem = useLauncherStore((state) => state.updateItem);
  const removeItem = useLauncherStore((state) => state.removeItem);
  const toggleFavorite = useLauncherStore((state) => state.toggleFavorite);
  const [editItem, setEditItem] = useState<LauncherItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LauncherItem | null>(null);

  const handleLaunch = async (item: LauncherItem) => {
    try {
      await launchItem(item);
    } catch (error) {
      showLaunchError(error);
    }
  };

  const handleEdit = async (input: Parameters<typeof updateItem>[1]) => {
    if (!editItem) return;
    await updateItem(editItem.id, input);
    showSuccess(t("launcher.toasts.updated"));
  };

  const handleRemove = async (item: LauncherItem) => {
    if (pendingDelete?.id !== item.id) {
      setPendingDelete(item);
      return;
    }

    try {
      await removeItem(item.id);
      showSuccess(t("launcher.toasts.removed", { name: item.name }));
      setPendingDelete(null);
    } catch (error) {
      showLaunchError(error);
    }
  };

  return (
    <>
      <div className={`cutout-grid ${gridClassName}`.trim()} role="list">
        {items.map((item, index) => (
          <AppCutout
            key={item.id}
            id={item.id}
            name={item.name}
            type={item.type}
            category={item.category}
            index={index}
            accent={item.accent}
            isFavorite={item.favorite}
            confirmDelete={pendingDelete?.id === item.id}
            onLaunch={() => void handleLaunch(item)}
            onRemove={() => void handleRemove(item)}
            onEdit={() => setEditItem(item)}
            onToggleFavorite={() => void toggleFavorite(item.id)}
          />
        ))}
      </div>

      {editItem ? (
        <AddShortcutDialog
          mode="edit"
          open
          initialItem={editItem}
          onClose={() => setEditItem(null)}
          onSubmit={handleEdit}
        />
      ) : null}
    </>
  );
}
