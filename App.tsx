
import React, { useState, useCallback, useRef } from 'react';
import ParticleScene from './components/ParticleScene';
import HandTracker from './components/HandTracker';
import DrawingCanvas from './components/DrawingCanvas';
import { audioManager } from './utils/audio';
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
  Wind,
  Volume2,
  VolumeX,
  Upload,
  Music,
  Play,
  ListMusic,
  Square
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

interface Track {
    name: string;
    url: string;
}

const App: React.FC = () => {
  const [currentShape, setCurrentShape] = useState<ShapeType>(ShapeType.HEART);
  const [color, setColor] = useState<string>('#ff00aa');
  const [handData, setHandData] = useState<HandData>({
    isOpen: false,
    gestureValue: 0,
    position: { x: 0.5, y: 0.5 }
  });
  const [showUI, setShowUI] = useState(true);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showDrawingCanvas, setShowDrawingCanvas] = useState(false);
  const [customPoints, setCustomPoints] = useState<Float32Array | null>(null);
  
  // Audio State
  const [isMuted, setIsMuted] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  
  // Computed Music Mode: If a track is selected, we are in music mode
  const isMusicMode = currentTrackIndex !== null;
  const songName = currentTrackIndex !== null ? playlist[currentTrackIndex]?.name : null;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInteraction = useCallback(() => {
      if (!hasInteracted) {
          audioManager.init();
          audioManager.toggleMute(false);
          setIsMuted(false);
          setHasInteracted(true);
      }
  }, [hasInteracted]);

  const toggleMute = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      
      if (!hasInteracted) {
          audioManager.init();
          setHasInteracted(true);
      }
      audioManager.toggleMute(newMuted);
  };

  const handleHandUpdate = useCallback((data: HandData) => {
    setHandData(data);
    // Only update filter with hand gesture if NOT in music mode
    // In music mode, filter is open or handled differently
    if (!isMusicMode) {
        audioManager.updateFilter(data.gestureValue);
    }
  }, [isMusicMode]);

  const handleGestureTrigger = useCallback(() => {
    // Disable gesture switching if in music mode
    if (isMusicMode) return;

    setCurrentShape((prevShape) => {
      let nextShape = prevShape;
      while (nextShape === prevShape) {
          const idx = Math.floor(Math.random() * ROMANTIC_SHAPES.length);
          nextShape = ROMANTIC_SHAPES[idx];
      }
      return nextShape;
    });
    
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    setColor(randomColor);
    audioManager.triggerWarp();
  }, [isMusicMode]);

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
    audioManager.triggerWarp();
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
      audioManager.triggerWarp();
  };

  const playTrack = async (index: number) => {
      try {
          const track = playlist[index];
          if (!track) return;
          
          await audioManager.playAudioUrl(track.url);
          setCurrentTrackIndex(index);
          
          if (isMuted) {
              setIsMuted(false);
              audioManager.toggleMute(false);
          }
      } catch (e) {
          alert("Error playing track.");
      }
  };

  const stopMusic = (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      audioManager.stopAudio();
      setCurrentTrackIndex(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              const url = audioManager.createAudioUrl(file);
              const newTrack = { name: file.name.replace(/\.[^/.]+$/, ""), url };
              
              setPlaylist(prev => [...prev, newTrack]);
              // Automatically play the new track
              const newIndex = playlist.length; // Index of item about to be added
              
              // We need to wait for state update in a real app, but here we can just do it
              audioManager.playAudioUrl(url).then(() => {
                   setCurrentTrackIndex(newIndex);
                   if (isMuted) {
                      setIsMuted(false);
                      audioManager.toggleMute(false);
                  }
                  setHasInteracted(true);
                  setShowPlaylist(true);
              }).catch(() => {
                  alert("Could not play this audio file.");
              });
              
          } catch (err) {
              console.error("Upload failed", err);
          }
      }
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
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
    <div 
        className="relative w-full h-screen bg-black overflow-hidden font-sans text-white"
        onClick={handleInteraction}
    >
      <div className="absolute inset-0 z-0">
        <ParticleScene 
          currentShape={currentShape} 
          color={color} 
          handData={handData}
          customPoints={customPoints}
          isMusicMode={isMusicMode}
        />
      </div>

      <HandTracker 
        onHandUpdate={handleHandUpdate} 
        onGestureTrigger={handleGestureTrigger} 
      />

      {showDrawingCanvas && (
          <DrawingCanvas 
            onSave={handleSaveDrawing} 
            onClose={() => setShowDrawingCanvas(false)} 
          />
      )}

      <div className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* TOP LEFT INFO */}
        <div className="absolute top-6 left-6 pointer-events-auto">
          <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-lg">
            HOLO<span className="text-white">PARTICLE</span>
          </h1>
          
          <div className="mt-4 flex flex-col gap-2">
            <div className={`flex items-center gap-2 text-xs p-2 rounded border backdrop-blur-md shadow-[0_0_15px_rgba(0,255,255,0.1)] transition-colors
                ${isMusicMode ? 'text-pink-100/80 bg-pink-900/30 border-pink-500/20' : 'text-cyan-100/80 bg-black/40 border-cyan-500/20'}
            `}>
                {isMusicMode ? <Music className="w-4 h-4 text-pink-400 animate-pulse" /> : <Hand className={`w-4 h-4 ${handData.gestureValue > 0.2 ? 'text-cyan-400' : 'text-gray-600'}`} />}
                <span className="font-mono">
                MODE: {isMusicMode ? 'AUDIO SYNC' : (handData.gestureValue > 0.6 ? 'EXPAND' : 'ROTATE')}
                </span>
            </div>

            {songName && (
                <div className="flex items-center gap-2 text-xs text-pink-200/80 bg-black/40 p-2 rounded border border-pink-500/20 backdrop-blur-md animate-pulse">
                    <Play className="w-3 h-3 text-pink-400 fill-current" />
                    <span className="font-mono truncate max-w-[150px]">
                    {songName}
                    </span>
                    <button onClick={stopMusic} className="ml-2 hover:text-white" title="Stop & Return to Gesture Mode">
                        <Square size={10} className="fill-current"/>
                    </button>
                </div>
            )}
          </div>
        </div>

        {/* TOP RIGHT CONTROLS */}
        <div className="absolute top-6 right-6 flex flex-col gap-4 pointer-events-auto w-14 md:w-auto items-end">
          
          <div className="flex gap-2">
            
             {/* Playlist Toggle */}
             {playlist.length > 0 && (
                <button 
                onClick={() => setShowPlaylist(!showPlaylist)}
                className={`p-3 rounded-full backdrop-blur-lg border transition-all text-white shadow-lg ${showPlaylist ? 'bg-cyan-900/60 border-cyan-400' : 'bg-black/40 border-white/10'}`}
                title="Playlist"
                >
                <ListMusic size={20} />
                </button>
             )}

             <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-full bg-black/40 hover:bg-cyan-900/40 backdrop-blur-lg border border-white/10 hover:border-cyan-400/50 transition-all text-white shadow-lg"
              title="Upload Music (.mp3, .m4a, .wav)"
            >
              <Upload size={20} />
            </button>
            <input 
                ref={fileInputRef}
                type="file" 
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.m4p,.aac" 
                className="hidden" 
                onChange={handleFileUpload}
            />

             <button 
              onClick={toggleMute}
              className={`p-3 rounded-full backdrop-blur-lg border transition-all text-white shadow-lg ${isMuted ? 'bg-red-900/40 border-red-500/30 text-red-200' : 'bg-black/40 hover:bg-cyan-900/40 border-white/10 hover:border-cyan-400/50'}`}
              title={isMuted ? "Unmute Sound" : "Mute Sound"}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>

            <button 
              onClick={toggleFullScreen}
              className="p-3 rounded-full bg-black/40 hover:bg-cyan-900/40 backdrop-blur-lg border border-white/10 hover:border-cyan-400/50 transition-all text-white shadow-lg"
              title="Fullscreen"
            >
              <Maximize2 size={20} />
            </button>
          </div>

          {/* PLAYLIST PANEL */}
          {showPlaylist && playlist.length > 0 && (
              <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-2 w-64 max-h-48 overflow-y-auto hide-scrollbar shadow-2xl">
                  <div className="flex items-center justify-between px-2 mb-2">
                    <div className="text-[10px] uppercase text-gray-500 font-bold">Library</div>
                    {isMusicMode && (
                        <button onClick={stopMusic} className="text-[10px] bg-red-900/50 hover:bg-red-800 text-red-200 px-2 py-0.5 rounded border border-red-500/30">
                            STOP & GESTURE
                        </button>
                    )}
                  </div>
                  {playlist.map((track, idx) => (
                      <button
                        key={idx}
                        onClick={() => playTrack(idx)}
                        className={`w-full text-left px-3 py-2 rounded text-xs truncate mb-1 flex items-center gap-2 transition-colors
                            ${currentTrackIndex === idx ? 'bg-pink-900/50 text-pink-200 border border-pink-500/30' : 'hover:bg-white/10 text-gray-300'}
                        `}
                      >
                          {currentTrackIndex === idx && <Play size={10} className="fill-current" />}
                          {track.name}
                      </button>
                  ))}
              </div>
          )}

          {/* COLOR PICKER */}
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

          {/* SHAPE SELECTOR */}
          <div className="flex flex-col gap-2 bg-black/30 backdrop-blur-md p-2 rounded-2xl border border-white/10 max-h-[50vh] overflow-y-auto hide-scrollbar shadow-2xl">
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
      
      <button 
        onClick={(e) => { e.stopPropagation(); setShowUI(!showUI); }}
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
