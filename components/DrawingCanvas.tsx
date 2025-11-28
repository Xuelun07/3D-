
import React, { useRef, useState, useEffect } from 'react';
import { X, Check, Trash2, PenTool } from 'lucide-react';
import * as THREE from 'three';

interface DrawingCanvasProps {
  onSave: (points: Float32Array) => void;
  onClose: () => void;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<Array<{x: number, y: number}[]>>([]);
  const [currentPath, setCurrentPath] = useState<{x: number, y: number}[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        redraw();
      }
    };

    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [paths, currentPath]); // Re-bind on state change for redraw access

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background grid
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<canvas.width; i+=40) { ctx.moveTo(i,0); ctx.lineTo(i, canvas.height); }
    for(let i=0; i<canvas.height; i+=40) { ctx.moveTo(0,i); ctx.lineTo(canvas.width, i); }
    ctx.stroke();

    // Center Crosshair
    ctx.strokeStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(canvas.width/2, 0); ctx.lineTo(canvas.width/2, canvas.height);
    ctx.moveTo(0, canvas.height/2); ctx.lineTo(canvas.width, canvas.height/2);
    ctx.stroke();

    // Paths
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#00ffcc';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffcc';

    const allPaths = [...paths, currentPath];
    
    allPaths.forEach(path => {
      if (path.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
    });
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling on touch
    setIsDrawing(true);
    const pos = getPos(e);
    setCurrentPath([pos]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    setCurrentPath(prev => {
        const newPath = [...prev, pos];
        // Instant redraw
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx && newPath.length >= 2) {
             const last = newPath[newPath.length - 2];
             ctx.lineCap = 'round';
             ctx.lineJoin = 'round';
             ctx.lineWidth = 8;
             ctx.strokeStyle = '#00ffcc';
             ctx.shadowBlur = 10;
             ctx.shadowColor = '#00ffcc';
             ctx.beginPath();
             ctx.moveTo(last.x, last.y);
             ctx.lineTo(pos.x, pos.y);
             ctx.stroke();
        }
        return newPath;
    });
  };

  const stopDrawing = () => {
    if (isDrawing) {
      if (currentPath.length > 0) {
        setPaths(prev => [...prev, currentPath]);
      }
      setCurrentPath([]);
      setIsDrawing(false);
    }
  };

  const clearCanvas = () => {
    setPaths([]);
    setCurrentPath([]);
    redraw(); // Clear visuals
  };

  const processAndSave = () => {
    if (paths.length === 0 && currentPath.length === 0) {
        onClose();
        return;
    }

    const COUNT = 8000;
    const positions = new Float32Array(COUNT * 3);
    const allPoints = [...paths.flat()];
    
    if (allPoints.length < 2) {
        onClose();
        return;
    }

    // Calculate total length
    let totalLength = 0;
    const pathLengths: number[] = [];
    const flatPaths = [...paths];
    
    flatPaths.forEach(path => {
        let pLen = 0;
        for(let i=1; i<path.length; i++) {
            const dx = path[i].x - path[i-1].x;
            const dy = path[i].y - path[i-1].y;
            pLen += Math.sqrt(dx*dx + dy*dy);
        }
        pathLengths.push(pLen);
        totalLength += pLen;
    });

    const canvas = canvasRef.current!;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = Math.min(canvas.width, canvas.height) / 5; // Normalize scale

    // Distribute points based on path lengths
    let pIdx = 0;
    
    flatPaths.forEach((path, idx) => {
        if (totalLength === 0) return;
        const numPointsForPath = Math.floor((pathLengths[idx] / totalLength) * COUNT);
        
        // Walk the path
        if (path.length < 2) return;
        
        let distanceWalked = 0;
        let currentSegIdx = 0;
        const step = pathLengths[idx] / numPointsForPath;

        for(let i=0; i<numPointsForPath && pIdx < COUNT; i++) {
             // Basic interpolation logic could be complex, let's simplify:
             // Just Randomly sample along the segments or uniform walk
             // Uniform walk:
             const targetDist = i * step;
             
             // Find segment
             let segDist = 0;
             while(currentSegIdx < path.length - 1) {
                 const p1 = path[currentSegIdx];
                 const p2 = path[currentSegIdx + 1];
                 const segLen = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                 
                 if (distanceWalked + segLen >= targetDist) {
                     // Interpolate here
                     const t = (targetDist - distanceWalked) / segLen;
                     const x = p1.x + (p2.x - p1.x) * t;
                     const y = p1.y + (p2.y - p1.y) * t;

                     // Normalize to 3D space centered at 0,0
                     positions[pIdx * 3] = (x - centerX) / scale;
                     positions[pIdx * 3 + 1] = -(y - centerY) / scale; // Flip Y
                     positions[pIdx * 3 + 2] = (Math.random() - 0.5) * 0.5; // Slight Z depth
                     
                     pIdx++;
                     break;
                 } else {
                     distanceWalked += segLen;
                     currentSegIdx++;
                 }
             }
        }
    });

    // Fill remaining if any (due to rounding)
    while (pIdx < COUNT) {
        // Just duplicate random existing points or center
        const sourceIdx = Math.floor(Math.random() * pIdx);
        positions[pIdx * 3] = positions[sourceIdx * 3];
        positions[pIdx * 3 + 1] = positions[sourceIdx * 3 + 1];
        positions[pIdx * 3 + 2] = positions[sourceIdx * 3 + 2];
        pIdx++;
    }

    onSave(positions);
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      <div className="absolute top-4 left-0 right-0 text-center pointer-events-none">
          <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
              <PenTool size={20}/> Draw Your Shape
          </h2>
          <p className="text-gray-400 text-sm">Draw lines to create a particle cloud</p>
      </div>

      <div className="relative w-full h-full md:w-[80%] md:h-[80%] border border-white/20 rounded-xl overflow-hidden bg-black cursor-crosshair">
        <canvas 
            ref={canvasRef}
            className="w-full h-full block"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
        />
      </div>

      <div className="absolute bottom-8 flex gap-4">
          <button onClick={clearCanvas} className="p-3 bg-red-500/20 text-red-200 hover:bg-red-500/40 rounded-full border border-red-500/30 transition-all flex items-center gap-2 px-6">
              <Trash2 size={20}/> Clear
          </button>
          <button onClick={onClose} className="p-3 bg-white/10 text-white hover:bg-white/20 rounded-full border border-white/10 transition-all flex items-center gap-2 px-6">
              <X size={20}/> Cancel
          </button>
          <button onClick={processAndSave} className="p-3 bg-green-500/20 text-green-200 hover:bg-green-500/40 rounded-full border border-green-500/30 transition-all flex items-center gap-2 px-6 font-bold">
              <Check size={20}/> Create Particles
          </button>
      </div>
    </div>
  );
};

export default DrawingCanvas;
