import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

type HostDropStatePayload = {
  phase?: 'drag-enter' | 'drag-over' | 'drag-leave' | 'drop';
  inside?: boolean;
  active?: boolean;
};

type HostDropPayload = {
  files?: string[];
};

type HostFileDropTargetOptions = {
  targetRef: Ref<HTMLElement | null>;
  onFiles: (paths: string[]) => void | Promise<void>;
  message?: string;
};

const getDroppedFilePaths = (dataTransfer: DataTransfer | null | undefined) => {
  if (!dataTransfer) {
    return [];
  }

  const directPaths = window.rubick.getPathsForFiles(dataTransfer.files || []);
  if (directPaths.length) {
    return directPaths.filter(Boolean);
  }

  return Array.from(dataTransfer.items || [])
    .filter((item) => item.kind === 'file')
    .map((item) =>
      typeof item.getAsFile === 'function' ? item.getAsFile() : null
    )
    .filter(Boolean)
    .map((file) => window.rubick.getPathForFile(file))
    .filter(Boolean);
};

const isFileDrag = (event?: DragEvent | null) => {
  const dataTransfer = event?.dataTransfer;
  if (!dataTransfer) {
    return false;
  }

  if (Array.from(dataTransfer.items || []).some((item) => item.kind === 'file')) {
    return true;
  }

  if ((dataTransfer.files?.length || 0) > 0) {
    return true;
  }

  return Array.from(dataTransfer.types || []).includes('Files');
};

const prepareFileDrag = (event?: DragEvent | null) => {
  if (!isFileDrag(event)) {
    return false;
  }

  event?.preventDefault();
  if (event?.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }

  return true;
};

const useHostFileDropTarget = ({
  targetRef,
  onFiles,
  message = 'Click or drag files/folders here',
}: HostFileDropTargetOptions) => {
  const isDragging = ref(false);
  const dragDepth = ref(0);
  let resizeObserver: ResizeObserver | undefined;
  let syncFrame = 0;

  const resetDragState = () => {
    dragDepth.value = 0;
    isDragging.value = false;
  };

  const syncHostDropTarget = () => {
    if (!targetRef.value) {
      window.rubick.updateHostDropTarget({ visible: false });
      return;
    }

    const rect = targetRef.value.getBoundingClientRect();
    window.rubick.updateHostDropTarget({
      visible: rect.width > 0 && rect.height > 0,
      bounds: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      message,
      darkMode: document.documentElement.classList.contains('dark'),
    });
  };

  const scheduleHostDropTargetSync = () => {
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(() => {
      syncHostDropTarget();
    });
  };

  const handleHostDrop = async (payload?: HostDropPayload) => {
    resetDragState();
    const nextFiles = Array.isArray(payload?.files)
      ? payload?.files.filter(Boolean)
      : [];
    if (!nextFiles.length) {
      return;
    }

    await onFiles(nextFiles);
  };

  const handleHostDropState = (payload?: HostDropStatePayload) => {
    const active = Boolean(payload?.active);
    const inside = Boolean(payload?.inside);

    if (!active) {
      resetDragState();
      return;
    }

    isDragging.value = inside;
  };

  const handleGlobalDragEnter = (event: DragEvent) => {
    prepareFileDrag(event);
  };

  const handleGlobalDragOver = (event: DragEvent) => {
    prepareFileDrag(event);
  };

  const handleGlobalDragLeave = (event: DragEvent) => {
    if (event.relatedTarget) {
      return;
    }

    resetDragState();
  };

  const handleDrop = async (event: DragEvent) => {
    if (!prepareFileDrag(event)) {
      return;
    }

    const nextFiles = getDroppedFilePaths(event.dataTransfer);
    resetDragState();
    if (!nextFiles.length) {
      return;
    }

    await onFiles(nextFiles);
  };

  const handleGlobalDrop = (event: DragEvent) => {
    if (!prepareFileDrag(event)) {
      return;
    }

    resetDragState();
  };

  const handleZoneDragEnter = (event: DragEvent) => {
    if (!prepareFileDrag(event)) {
      return;
    }

    dragDepth.value += 1;
    isDragging.value = true;
  };

  const handleZoneDragOver = (event: DragEvent) => {
    if (!prepareFileDrag(event)) {
      return;
    }

    isDragging.value = true;
  };

  const handleZoneDragLeave = (event: DragEvent) => {
    if (!isFileDrag(event)) {
      return;
    }

    const nextTarget = event?.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget instanceof HTMLElement) {
      if (event.currentTarget.contains(nextTarget)) {
        return;
      }
    }

    dragDepth.value = Math.max(0, dragDepth.value - 1);
    if (dragDepth.value === 0) {
      isDragging.value = false;
    }
  };

  const observeTarget = (element: HTMLElement | null) => {
    resizeObserver?.disconnect?.();
    resizeObserver = undefined;

    if (typeof ResizeObserver === 'undefined' || !element) {
      return;
    }

    resizeObserver = new ResizeObserver(() => {
      scheduleHostDropTargetSync();
    });
    resizeObserver.observe(element);
  };

  onMounted(() => {
    window.rubick.setHostFileDropEnabled(true);
    scheduleHostDropTargetSync();
    window.rubick.onHostDrop(handleHostDrop);
    window.rubick.onHostDropTargetState(handleHostDropState);
    window.addEventListener('dragenter', handleGlobalDragEnter, true);
    window.addEventListener('dragover', handleGlobalDragOver, true);
    window.addEventListener('dragleave', handleGlobalDragLeave, true);
    window.addEventListener('drop', handleGlobalDrop, true);
    window.addEventListener('resize', scheduleHostDropTargetSync);
    window.addEventListener('scroll', scheduleHostDropTargetSync, true);
    observeTarget(targetRef.value);
  });

  watch(
    targetRef,
    (element) => {
      observeTarget(element);
      scheduleHostDropTargetSync();
    },
    { flush: 'post' }
  );

  onBeforeUnmount(() => {
    window.rubick.setHostFileDropEnabled(false);
    window.rubick.updateHostDropTarget({ visible: false });
    window.rubick.onHostDrop();
    window.rubick.onHostDropTargetState();
    window.removeEventListener('dragenter', handleGlobalDragEnter, true);
    window.removeEventListener('dragover', handleGlobalDragOver, true);
    window.removeEventListener('dragleave', handleGlobalDragLeave, true);
    window.removeEventListener('drop', handleGlobalDrop, true);
    window.removeEventListener('resize', scheduleHostDropTargetSync);
    window.removeEventListener('scroll', scheduleHostDropTargetSync, true);
    resizeObserver?.disconnect?.();
    resizeObserver = undefined;
    cancelAnimationFrame(syncFrame);
    resetDragState();
  });

  return {
    isDragging,
    handleDrop,
    handleZoneDragEnter,
    handleZoneDragOver,
    handleZoneDragLeave,
    scheduleHostDropTargetSync,
    resetDragState,
  };
};

export { useHostFileDropTarget };
