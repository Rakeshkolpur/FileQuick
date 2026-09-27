import React, { useRef } from 'react';
import { LuCheck } from 'react-icons/lu';
import { deltaToFrame, penPath } from './geometry';

const MIN = 4; // pt

/**
 * One placed object (whiteout, highlight, shape, image, signature, drawing,
 * link, form field). Object geometry is in page points, top-left origin, in
 * the page's unrotated frame. Drag the body to move, the corner to resize.
 */
const ObjectItem = ({
  obj, scale, R, selected, onSelect, onChange, onBeginEdit,
}) => {
  const drag = useRef(null);
  const W = obj.w * scale;
  const H = obj.h * scale;

  const start = (e, mode) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(obj.id);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, o: { ...obj }, pushed: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const f = deltaToFrame(e.clientX - d.sx, e.clientY - d.sy, R);
    if (!d.pushed) {
      if (Math.abs(f.x) + Math.abs(f.y) < 2) return;
      onBeginEdit(obj.id);
      d.pushed = true;
    }
    const dx = f.x / scale;
    const dy = f.y / scale;
    if (d.mode === 'move') {
      onChange(obj.id, { x: d.o.x + dx, y: d.o.y + dy });
    } else {
      const w = Math.max(MIN, d.o.w + dx);
      let h = Math.max(MIN, d.o.h + dy);
      if (d.o.type === 'image') h = w * (d.o.h / d.o.w);
      onChange(obj.id, { w, h });
    }
  };
  const end = () => { drag.current = null; };

  const lw = Math.max(1, (obj.width || 1) * scale);
  let body = null;
  switch (obj.type) {
    case 'whiteout':
      body = <div className="absolute inset-0" style={{ background: obj.color }} />;
      break;
    case 'highlight':
      body = <div className="absolute inset-0" style={{ background: obj.color, opacity: 0.4, mixBlendMode: 'multiply' }} />;
      break;
    case 'underline':
      body = <div className="absolute inset-x-0 bottom-0" style={{ height: lw, background: obj.color }} />;
      break;
    case 'strike':
      body = <div className="absolute inset-x-0 top-1/2 -translate-y-1/2" style={{ height: lw, background: obj.color }} />;
      break;
    case 'rect':
    case 'ellipse':
      body = (
        <div
          className="absolute inset-0"
          style={{
            border: `${lw}px solid ${obj.color}`,
            background: obj.fill || 'transparent',
            borderRadius: obj.type === 'ellipse' ? '50%' : 0,
          }}
        />
      );
      break;
    case 'line':
      body = (
        <svg className="absolute inset-0 overflow-visible" width={W} height={H}>
          <line
            x1={0}
            y1={obj.dir === 'up' ? H : 0}
            x2={W}
            y2={obj.dir === 'up' ? 0 : H}
            stroke={obj.color}
            strokeWidth={lw}
            strokeLinecap="round"
          />
        </svg>
      );
      break;
    case 'pen':
      body = (
        <svg className="absolute inset-0 overflow-visible" width={W} height={H} viewBox={`0 0 ${obj.pw} ${obj.ph}`} preserveAspectRatio="none">
          <path d={penPath(obj.points)} fill="none" stroke={obj.color} strokeWidth={obj.width} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
      break;
    case 'image':
      body = <img src={obj.src} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />;
      break;
    case 'link':
      body = (
        <div className="absolute inset-0 rounded-sm border-2 border-dashed border-blue-500 bg-blue-500/10">
          <span className="absolute left-0 top-full mt-0.5 max-w-[16rem] truncate rounded bg-blue-600 px-1.5 py-px text-[10px] text-white">
            {obj.url || 'Add a link address'}
          </span>
        </div>
      );
      break;
    case 'field-text':
      body = (
        <div className="absolute inset-0 flex items-center rounded-sm border border-sky-500 bg-sky-100/70 px-1 text-[10px] text-sky-800">
          {obj.name}
        </div>
      );
      break;
    case 'field-check':
      body = (
        <div className="absolute inset-0 grid place-items-center rounded-sm border border-sky-500 bg-white text-sky-600">
          <LuCheck className="h-3/4 w-3/4" />
        </div>
      );
      break;
    default:
      break;
  }

  return (
    <div
      data-fq-keep=""
      data-obj-id={obj.id}
      className={`absolute ${selected ? 'outline outline-2 outline-offset-1 outline-blue-500' : 'hover:outline hover:outline-1 hover:outline-blue-400'}`}
      style={{ left: obj.x * scale, top: obj.y * scale, width: W, height: H, cursor: 'move', touchAction: 'none' }}
      onPointerDown={(e) => start(e, 'move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {body}
      {selected && (
        <div
          className="absolute -bottom-2 -right-2 h-3.5 w-3.5 rounded-sm border-2 border-white bg-blue-600 shadow"
          style={{ cursor: 'nwse-resize', touchAction: 'none' }}
          onPointerDown={(e) => start(e, 'resize')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      )}
    </div>
  );
};

export default ObjectItem;
