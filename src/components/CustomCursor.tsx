import { useEffect, useRef } from 'react';

type CursorMode = 'system' | 'custom';
type CursorSize = 'small' | 'medium' | 'large';

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reducedMotion) return;

    const cursor = cursorRef.current;
    if (!cursor) return;

    let targetX = -48;
    let targetY = -48;
    let currentX = -48;
    let currentY = -48;
    let frame = 0;

    const applyPreferences = (event?: Event) => {
      const detail = (event as CustomEvent<{ mode?: CursorMode; size?: CursorSize }> | undefined)?.detail;
      const mode = detail?.mode || (localStorage.getItem('nl_cursor_mode') as CursorMode) || 'custom';
      const size = detail?.size || (localStorage.getItem('nl_cursor_size') as CursorSize) || 'small';
      cursor.dataset.size = ['small', 'medium', 'large'].includes(size) ? size : 'small';
      cursor.dataset.enabled = mode === 'custom' ? 'true' : 'false';
      cursor.dataset.native = 'false';
      cursor.dataset.visible = 'false';
      document.documentElement.classList.toggle('custom-cursor-enabled', mode === 'custom');
    };

    const render = () => {
      currentX += (targetX - currentX) * 0.58;
      currentY += (targetY - currentY) * 0.58;
      cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      frame = requestAnimationFrame(render);
    };
    const move = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      const target = event.target instanceof Element ? event.target : null;
      cursor.dataset.native = target?.closest('.native-cursor-zone') ? 'true' : 'false';
      cursor.dataset.visible = 'true';
    };
    const leave = () => { cursor.dataset.visible = 'false'; };

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('cursor-preferences-change', applyPreferences);
    window.addEventListener('storage', applyPreferences);
    document.documentElement.addEventListener('mouseleave', leave);
    applyPreferences();
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove('custom-cursor-enabled');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('cursor-preferences-change', applyPreferences);
      window.removeEventListener('storage', applyPreferences);
      document.documentElement.removeEventListener('mouseleave', leave);
    };
  }, []);

  return <div ref={cursorRef} className="custom-cursor-pointer" aria-hidden="true" />;
}
