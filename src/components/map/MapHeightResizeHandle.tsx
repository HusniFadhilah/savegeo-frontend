import { useRef, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import "./map-height-resize.css";

const MIN_MAP_HEIGHT = 220;
const MAX_MAP_HEIGHT = 1600;
const KEYBOARD_STEP = 24;

interface Props {
  mapShellRef: RefObject<HTMLElement>;
}

interface DragState {
  pointerId: number;
  startY: number;
  startHeight: number;
}

function findMapElement(shell: HTMLElement | null) {
  return shell?.querySelector<HTMLElement>(".leaflet-container") ?? null;
}

function applyHeight(shell: HTMLElement, height: number) {
  const nextHeight = Math.max(MIN_MAP_HEIGHT, Math.min(MAX_MAP_HEIGHT, height));
  const value = `${nextHeight}px`;
  const mapElement = findMapElement(shell);

  for (const element of [shell, shell.firstElementChild, mapElement]) {
    if (!(element instanceof HTMLElement)) continue;
    element.style.height = value;
    element.style.minHeight = `${MIN_MAP_HEIGHT}px`;
    element.style.maxHeight = `${MAX_MAP_HEIGHT}px`;
  }
}

export default function MapHeightResizeHandle({ mapShellRef }: Props) {
  const dragRef = useRef<DragState | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const shell = mapShellRef.current;
    if (!shell || !findMapElement(shell)) return;

    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: shell.getBoundingClientRect().height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const shell = mapShellRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !shell) return;
    applyHeight(shell, drag.startHeight + event.clientY - drag.startY);
  };

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const direction = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!direction) return;
    const shell = mapShellRef.current;
    if (!shell) return;
    event.preventDefault();
    applyHeight(shell, shell.getBoundingClientRect().height + direction * KEYBOARD_STEP);
  };

  return (
    <button
      type="button"
      className="map-height-resize-handle"
      title="Seret tepi bawah untuk mengatur tinggi peta"
      aria-label="Atur tinggi peta; gunakan panah atas dan bawah"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onKeyDown={handleKeyDown}
    />
  );
}
