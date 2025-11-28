
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HandData } from '../types';

// Workaround for MediaPipe imports in environments where named exports are not detected
import * as cameraUtils from '@mediapipe/camera_utils';
import * as handsUtils from '@mediapipe/hands';
import { Camera as CameraIcon, RefreshCw, AlertCircle } from 'lucide-react';

// Extract the classes from default export or named export
// @ts-ignore
const Camera = cameraUtils.Camera || cameraUtils.default?.Camera;
// @ts-ignore
const Hands = handsUtils.Hands || handsUtils.default?.Hands;

interface HandTrackerProps {
  onHandUpdate: (data: HandData) => void;
  onGestureTrigger?: () => void;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onHandUpdate, onGestureTrigger }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // State for gesture detection
  const wasOpenRef = useRef<boolean>(false);
  const lastTriggerTimeRef = useRef<number>(0);

  // Safety refs for async cleanup
  const isMountedRef = useRef<boolean>(true);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  // Manual start function to be triggered by user gesture if needed
  const startCamera = useCallback(async () => {
    if (!cameraRef.current) return;
    
    setError(null);
    setIsInitializing(true);
    
    try {
      await cameraRef.current.start();
      if (isMountedRef.current) {
        setCameraActive(true);
        setIsInitializing(false);
      }
    } catch (err: any) {
      console.error("Camera start error", err);
      if (isMountedRef.current) {
        setCameraActive(false);
        setIsInitializing(false);
        if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
            setError("Permission denied. Please allow camera access.");
        } else {
            setError("Failed to access camera.");
        }
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (!videoRef.current) return;
    
    if (!Camera || !Hands) {
      setError("Failed to load computer vision libraries.");
      setIsInitializing(false);
      return;
    }

    // Initialize Hands
    const hands = new Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });
    handsRef.current = hands;

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results: any) => {
      if (!isMountedRef.current) return;

      let openness = 0;
      let centerX = 0;
      let centerY = 0;

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        if (results.multiHandLandmarks.length === 2) {
           // Two hands
           const hand1 = results.multiHandLandmarks[0][0]; 
           const hand2 = results.multiHandLandmarks[1][0]; 
           
           const dist = Math.sqrt(
               Math.pow(hand1.x - hand2.x, 2) + 
               Math.pow(hand1.y - hand2.y, 2)
           );
           
           openness = Math.min(Math.max((dist - 0.1) * 2, 0), 1);
           centerX = (hand1.x + hand2.x) / 2;
           centerY = (hand1.y + hand2.y) / 2;

        } else {
            // One hand
            const landmarks = results.multiHandLandmarks[0];
            const wrist = landmarks[0];
            const middleTip = landmarks[12];
            
            const dist = Math.sqrt(
                Math.pow(wrist.x - middleTip.x, 2) + 
                Math.pow(wrist.y - middleTip.y, 2)
            );
            
            openness = Math.min(Math.max((dist - 0.2) * 3, 0), 1);
            centerX = landmarks[9].x; 
            centerY = landmarks[9].y;
        }

        // Gesture Trigger Logic
        const now = Date.now();
        const isOpen = openness > 0.65;
        const isClosed = openness < 0.25;

        if (isOpen) {
            wasOpenRef.current = true;
        }

        if (wasOpenRef.current && isClosed) {
            if (now - lastTriggerTimeRef.current > 1000) {
                if (onGestureTrigger) {
                    onGestureTrigger();
                }
                lastTriggerTimeRef.current = now;
                wasOpenRef.current = false; 
            }
        }

        onHandUpdate({
          isOpen: openness > 0.5,
          gestureValue: openness,
          position: { x: centerX, y: centerY },
        });

      } else {
        wasOpenRef.current = false;
        onHandUpdate({
            isOpen: false,
            gestureValue: 0.1, 
            position: { x: 0.5, y: 0.5 },
        });
      }
    });

    // Initialize Camera
    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (isMountedRef.current && videoRef.current && handsRef.current) {
          try {
            await hands.send({ image: videoRef.current });
          } catch (e) {
            console.warn("MediaPipe send error:", e);
          }
        }
      },
      width: 640,
      height: 480,
    });
    cameraRef.current = camera;

    // Attempt auto-start
    startCamera();

    return () => {
        isMountedRef.current = false;
        if (cameraRef.current) {
            // Camera.stop() is sometimes not enough to release the stream in some browsers
            // but it's what the library provides.
            cameraRef.current.stop(); 
        }
        if (handsRef.current) {
            handsRef.current.close();
        }
    };
  }, [onHandUpdate, onGestureTrigger, startCamera]);

  return (
    <div className="absolute bottom-4 left-4 z-50 pointer-events-auto">
      {/* Video Preview */}
      <div className="relative rounded-lg overflow-hidden border-2 border-white/20 shadow-lg bg-black">
        <video
            ref={videoRef}
            className={`w-32 h-24 object-cover transform scale-x-[-1] transition-opacity duration-500 ${cameraActive ? 'opacity-70' : 'opacity-0'}`}
            playsInline
        />
        
        {/* Loading Overlay */}
        {!cameraActive && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-2 text-center">
                <RefreshCw className="animate-spin mb-1 opacity-70" size={20} />
                <span className="text-[10px] opacity-70">Starting Camera...</span>
            </div>
        )}

        {/* Error / Retry Overlay */}
        {error && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-white p-2 text-center">
                <AlertCircle className="text-red-400 mb-1" size={20} />
                <span className="text-[10px] text-red-200 mb-2 leading-tight">{error}</span>
                <button 
                    onClick={startCamera}
                    className="bg-white/20 hover:bg-white/30 text-white text-[10px] px-2 py-1 rounded transition-colors flex items-center gap-1"
                >
                    <CameraIcon size={10} /> Enable
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default HandTracker;
