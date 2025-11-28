
import React, { useState, useCallback } from 'react';
import ParticleScene from './components/ParticleScene';
import HandTracker from './components/HandTracker';
import DrawingCanvas from './components/DrawingCanvas';
import { ShapeType, HandData } from './types';
import { 
  Heart, 
  Flower2, 
  Orbit, 
  User, 
  Sparkles, 
  Palette, 
  Maximize2,
  Hand,
  PenTool,
  Edit3,
  Gem,
  Type,
  Atom,
  Wind
} from 'lucide-react';

// Custom icons
const DoubleHeartIcon = () => (
    <div className="relative w-5 h-5 flex items-center justify-center">
        <Heart size={14} className="absolute left-0 top-0 text-pink-500 fill-current" />
        <Heart size={14} className="absolute right-0 bottom-0 text-white fill-current opacity-70" />
    </div>
);

const ButterflyIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12c0-3 2.5-5.5 5.5-5.5S23 9 23 12s-2.5 5.5-5.5 5.5S12 15 12 12z"/>
        <path d="M12 12c0-3-2.5-5.5-5.5-5.5S1 9 1 12s2.5 5.5 5.5 5.5S12 15 12 12z"/>
        <line x1="12" y1="12" x2="12" y2="6"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
    </svg>
);

// Define pool outside component to avoid dependency issues
const ROMANTIC_SHAPES = [
  ShapeType.HEART,
  ShapeType.DOUBLE_HEART,
  ShapeType.GALAXY,
  ShapeType.DNA,
  ShapeType.RING,
  ShapeType.BUTTERFLY,
  ShapeType.I_LOVE_U,
  ShapeType.FIREWORKS
];

const COLORS = ['#00f0ff', '#ff00aa', '#7000ff', '#00ff66', '#ffaa00', '#ffffff'];

const App: React.FC = () => {
  const [currentShape, setCurrentShape] = useState<ShapeType>(ShapeType.HEART);
  const [color, setColor] = useState<string>('#ff00aa');
  const [handData, setHandData] = useState<HandData>({
    isOpen: false,
    gestureValue: 0,
    position: { x: 0.5, y: 0.5 }
  });
  const [showUI, setShowUI] = useState(true);
  const [showDrawingCanvas, setShowDrawingCanvas] = useState(false);
  const [customPoints, setCustomPoints] = useState<Float32Array | null>(null);

  const handleHandUpdate = useCallback((data: HandData) => {
    setHandData(data);
  }, []);

  // Optimized: No dependencies to prevent HandTracker remounting
  const handleGestureTrigger = useCallback(() => {
    setCurrentShape((prevShape) => {
      let nextShape = prevShape;
      // Ensure we switch to a different shape
      while (nextShape === prevShape) {
          const idx = Math.floor(Math.random() * ROMANTIC_SHAPES.length);
          nextShape = ROMANTIC_SHAPES[idx];
      }
      return nextShape;
    });
    
    // Animate color change too for effect
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    setColor(randomColor);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleShapeSelect = (type: ShapeType) => {
    if (type === ShapeType.CUSTOM) {
        if (!customPoints) {
            setShowDrawingCanvas(true);
        } else {
            setCurrentShape(type);
        }
    } else {
        setCurrentShape(type);
    }
  };

  const handleSaveDrawing = (points: Float32Array) => {
      setCustomPoints(points);
      setCurrentShape(ShapeType.CUSTOM);
      setShowDrawingCanvas(false);
  };

  const shapes = [
    { type: ShapeType.GALAXY, label: 'Galaxy', icon: Wind },
    { type: ShapeType.DNA, label: 'DNA', icon: Atom },
    { type: ShapeType.HEART, label: 'Heart', icon: Heart },
    { type: ShapeType.DOUBLE_HEART, label: '2 Hearts', icon: DoubleHeartIcon },
    { type: ShapeType.RING, label: 'Ring', icon: Gem },
    { type: ShapeType.BUTTERFLY, label: 'Butterfly', icon: ButterflyIcon },
    { type: ShapeType.I_LOVE_U, label: 'I Love U', icon: Type },
    { type: ShapeType.FLOWER, label: 'Flower', icon: Flower2 },
    { type: ShapeType.SATURN, label: 'Saturn', icon: Orbit },
    { type: ShapeType.BUDDHA, label: 'Statue', icon: User },
    { type: ShapeType.FIREWORKS, label: 'Fireworks', icon: Sparkles },
    { type: ShapeType.CUSTOM, label: 'Custom', icon: PenTool },
  ];

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <ParticleScene 
          currentShape={currentShape} 
          color={color} 
          handData={handData}
          customPoints={customPoints}
        />
      </div>

      {/* Hand Tracker */}
      <HandTracker 
        onHandUpdate={handleHandUpdate} 
        onGestureTrigger={handleGestureTrigger} 
      />

      {/* Drawing Overlay */}
      {showDrawingCanvas && (
          <DrawingCanvas 
            onSave={handleSaveDrawing} 
            onClose={() => setShowDrawingCanvas(false)} 
          />
      )}

      {/* Main UI Overlay */}
      <div className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Header */}
        <div className="absolute top-6 left-6 pointer-events-auto">
          <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-lg">
            HOLO<span className="text-white">PARTICLE</span>
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-blue-300/70 mt-1">
             AI Gesture Control System v2.0
          </p>
          
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-cyan-100/80 bg-black/40 p-2 rounded border border-cyan-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(0,255,255,0.1)]">
                <Hand className={`w-4 h-4 ${handData.gestureValue > 0.2 ? 'text-cyan-400' : 'text-gray-600'}`} />
                <span className="font-mono">
                STATUS: {handData.gestureValue > 0.6 ? 'EXPANDED' : handData.gestureValue < 0.3 ? 'LOCKED' : 'TRACKING'}
                </span>
            </div>
             
             <div className="w-48 h-1.5 bg-gray-800 rounded-full overflow-hidden border border-white/10">
                <div 
                    className={`h-full transition-all duration-100 ease-out shadow-[0_0_10px_rgba(0,255,255,0.5)] ${handData.gestureValue > 0.6 ? 'bg-cyan-400' : 'bg-blue-600'}`}
                    style={{ width: `${handData.gestureValue * 100}%`}}
                />
             </div>
          </div>
        </div>

        {/* Right Control Panel */}
        <div className="absolute top-6 right-6 flex flex-col gap-4 pointer-events-auto w-14 md:w-auto items-end">
          
          <div className="flex gap-2">
            <button 
              onClick={toggleFullScreen}
              className="p-3 rounded-full bg-black/40 hover:bg-cyan-900/40 backdrop-blur-lg border border-white/10 hover:border-cyan-400/50 transition-all text-white shadow-lg"
              title="Fullscreen"
            >
              <Maximize2 size={20} />
            </button>
          </div>

          {/* Color Picker */}
          <div className="group relative">
             <div className="p-3 rounded-full bg-black/40 hover:bg-white/10 backdrop-blur-lg border border-white/10 transition-all text-white cursor-pointer shadow-lg">
               <Palette size={20} style={{ color: color, filter: 'drop-shadow(0 0 5px currentColor)' }} />
             </div>
             <input 
                type="color" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
             />
          </div>

          {/* Shape Selectors */}
          <div className="flex flex-col gap-2 bg-black/30 backdrop-blur-md p-2 rounded-2xl border border-white/10 max-h-[60vh] overflow-y-auto hide-scrollbar shadow-2xl">
            {shapes.map((s) => (
              <div key={s.type} className="relative flex items-center">
                 <button
                    onClick={() => handleShapeSelect(s.type)}
                    className={`
                    relative group p-3 rounded-xl transition-all duration-300 flex items-center gap-3 w-full border
                    ${currentShape === s.type 
                        ? 'bg-gradient-to-r from-cyan-900/80 to-blue-900/80 border-cyan-500/50 shadow-[0_0_15px_rgba(0,255,255,0.2)]' 
                        : 'border-transparent hover:bg-white/5 hover:border-white/10 text-white/50 hover:text-white'}
                    `}
                >
                    <s.icon size={20} className={currentShape === s.type ? 'text-cyan-300' : ''} />
                    <span className="hidden md:block text-xs font-bold tracking-wide uppercase pr-2">
                    {s.label}
                    </span>
                    
                    {/* Mobile Tooltip */}
                    <div className="absolute right-full mr-2 px-2 py-1 bg-black/80 border border-white/10 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity md:hidden whitespace-nowrap backdrop-blur-sm">
                    {s.label}
                    </div>
                </button>
                
                {s.type === ShapeType.CUSTOM && currentShape === ShapeType.CUSTOM && (
                     <button 
                        onClick={(e) => { e.stopPropagation(); setShowDrawingCanvas(true); }}
                        className="absolute right-1 p-1.5 rounded-full bg-black/60 hover:bg-cyan-900/60 text-white/80 hover:text-cyan-200 ml-2 z-20 border border-white/10"
                        title="Redraw"
                     >
                         <Edit3 size={12} />
                     </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Footer Toggle UI */}
      <button 
        onClick={() => setShowUI(!showUI)}
        className="absolute bottom-6 right-6 z-20 text-[10px] uppercase tracking-widest text-white/30 hover:text-cyan-400 transition-colors pointer-events-auto"
      >
        {showUI ? 'Hide Interface' : 'Show Interface'}
      </button>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

    </div>
  );
};

export default App;
