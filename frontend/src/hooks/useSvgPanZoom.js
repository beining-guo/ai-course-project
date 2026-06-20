import { useRef, useState } from "react";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function useSvgPanZoom({ viewBoxWidth, viewBoxHeight }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  const zoomAt = (nextZoom, point = { x: viewBoxWidth / 2, y: viewBoxHeight / 2 }) => {
    setZoom((currentZoom) => {
      const targetZoom = clamp(nextZoom, 0.55, 2.35);
      setPan((currentPan) => ({
        x: point.x - (point.x - currentPan.x) * (targetZoom / currentZoom),
        y: point.y - (point.y - currentPan.y) * (targetZoom / currentZoom),
      }));
      return targetZoom;
    });
  };

  const zoomIn = () => zoomAt(zoom * 1.16);
  const zoomOut = () => zoomAt(zoom / 1.16);
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const onWheel = (event) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * viewBoxWidth,
      y: ((event.clientY - rect.top) / rect.height) * viewBoxHeight,
    };
    zoomAt(zoom * (event.deltaY < 0 ? 1.12 : 0.88), point);
  };

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event) => {
    if (!dragRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = ((event.clientX - dragRef.current.x) / rect.width) * viewBoxWidth;
    const dy = ((event.clientY - dragRef.current.y) / rect.height) * viewBoxHeight;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setPan((currentPan) => ({
      x: currentPan.x + dx / zoom,
      y: currentPan.y + dy / zoom,
    }));
  };

  const onPointerUp = (event) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    reset,
    svgHandlers: {
      onPointerDown,
      onPointerLeave: onPointerUp,
      onPointerMove,
      onPointerUp,
      onWheel,
    },
    transform: `translate(${pan.x} ${pan.y}) scale(${zoom})`,
    zoom,
    zoomIn,
    zoomOut,
  };
}
