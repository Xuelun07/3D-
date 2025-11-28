
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Use refs for callbacks to prevent re-triggering useEffect when parent state changes
  const latestOnHandUpdate = useRef(onHandUpdate);
  const latestOnGestureTrigger = useRef(onGestureTrigger);

  useEffect(() => {
    latestOnHandUpdate.current = onHandUpdate;
    latestOnGestureTrigger.current = onGestureTrigger;
  }, [onHandUpdate, onGestureTrigger]);
  
  // State for gesture detection
  const wasOpenRef = useRef<boolean>(false);
  const lastTriggerTimeRef = useRef<number>(0);
  
  // Smoothing refs
  const prevPosRef = useRef({ x: 0.5, y: 0.5 });
  const prevOpennessRef = useRef(0);

  // Safety refs for async cleanup
  const isMountedRef = useRef<boolean>(true);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  // Manual start function
  const startCamera = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    // Reset states for retry
    setError(null);
    setIsInitializing(true);

    // Check for API support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMountedRef.current) {
            setError("Camera API not supported in this browser.");
            setIsInitializing(false);
        }
        return;
    }
    
    try {
      // Create camera instance if needed (though useEffect usually handles this)
      if (cameraRef.current) {
        // Calling start() triggers the permission prompt if not already granted
        await cameraRef.current.start();
        
        if (isMountedRef.current) {
            setCameraActive(true);
            setIsInitializing(false);
        }
      } else {
         // Should not happen if useEffect runs first, but safeguard
         if (isMountedRef.current) setIsInitializing(false);
      }
    } catch (err: any) {
      console.error("Camera start error", err);
      if (isMountedRef.current) {
        setCameraActive(false);
        setIsInitializing(false);
        
        const msg = err.message || err.toString();
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || msg.includes('Permission denied')) {
            setError("Camera access denied. Please click the lock icon in your URL bar and 'Allow' camera access, then click Retry.");
        } else if (err.name === 'NotFoundError') {
            setError("No camera device found.");
        } else if (err.name === 'NotReadableError') {
            setError("Camera is in use by another application.");
        } else {
            setError("Failed to access camera: " + msg);
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
        // Lock version to match index.html to prevent asset mismatch errors
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
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
      // Strict check to prevent processing results after unmount
      if (!isMountedRef.current) return;

      // --- Draw Skeleton on Canvas ---
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const FINGER_CONNECTIONS = [
            [0, 1], [1, 2], [2, 3], [3, 4],         // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],         // Index
            [9, 10], [10, 11], [11, 12],            // Middle
            [13, 14], [14, 15], [15, 16],           // Ring
            [0, 17], [17, 18], [18, 19], [19, 20],  // Pinky
            [5, 9], [9, 13], [13, 17]               // Palm
        ];

        if (results.multiHandLandmarks) {
          ctx.lineWidth = 2;
          
          results.multiHandLandmarks.forEach((landmarks: any[]) => {
            // Draw Connections (Bones)
            ctx.strokeStyle = '#00f0ff'; // Cyan color
            ctx.beginPath();
            
            FINGER_CONNECTIONS.forEach(([startIdx, endIdx]) => {
                const start = landmarks[startIdx];
                const end = landmarks[endIdx];
                ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
                ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
            });
            ctx.stroke();

            // Draw Landmarks (Joints)
            ctx.fillStyle = '#ffffff';
            landmarks.forEach((point) => {
                const x = point.x * canvas.width;
                const y = point.y * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, 2 * Math.PI); // Small white dots
                ctx.fill();
            });
          });
        }
      }

      // --- Original Processing Logic ---
      let rawOpenness = 0;
      let rawX = 0.5;
      let rawY = 0.5;
      let hasHand = false;

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        hasHand = true;
        if (results.multiHandLandmarks.length === 2) {
           // Two hands
           const hand1 = results.multiHandLandmarks[0][0]; 
           const hand2 = results.multiHandLandmarks[1][0]; 
           
           const dist = Math.sqrt(
               Math.pow(hand1.x - hand2.x, 2) + 
               Math.pow(hand1.y - hand2.y, 2)
           );
           
           rawOpenness = Math.min(Math.max((dist - 0.05) * 2.5, 0), 1);
           rawX = (hand1.x + hand2.x) / 2;
           rawY = (hand1.y + hand2.y) / 2;

        } else {
            // One hand
            const landmarks = results.multiHandLandmarks[0];
            const wrist = landmarks[0];
            const middleTip = landmarks[12];
            
            const dist = Math.sqrt(
                Math.pow(wrist.x - middleTip.x, 2) + 
                Math.pow(wrist.y - middleTip.y, 2)
            );
            
            rawOpenness = Math.min(Math.max((dist - 0.12) * 3.5, 0), 1);
            rawX = landmarks[9].x; 
            rawY = landmarks[9].y;
        }
      } 

      // --- Smoothing ---
      const posAlpha = 0.7; 
      const gestureAlpha = 0.6;

      const smoothX = prevPosRef.current.x + (rawX - prevPosRef.current.x) * posAlpha;
      const smoothY = prevPosRef.current.y + (rawY - prevPosRef.current.y) * posAlpha;
      const targetOpenness = hasHand ? rawOpenness : 0.1;
      const smoothOpenness = prevOpennessRef.current + (targetOpenness - prevOpennessRef.current) * gestureAlpha;

      prevPosRef.current = { x: smoothX, y: smoothY };
      prevOpennessRef.current = smoothOpenness;

      // --- Gesture Trigger ---
      const now = Date.now();
      const isOpen = smoothOpenness > 0.60;
      const isClosed = smoothOpenness < 0.25;

      if (isOpen) {
          wasOpenRef.current = true;
      }

      if (wasOpenRef.current && isClosed) {
          if (now - lastTriggerTimeRef.current > 450) {
              if (latestOnGestureTrigger.current) {
                  latestOnGestureTrigger.current();
              }
              lastTriggerTimeRef.current = now;
              wasOpenRef.current = false; 
          }
      }

      if (latestOnHandUpdate.current) {
          latestOnHandUpdate.current({
            isOpen: smoothOpenness > 0.5,
            gestureValue: smoothOpenness,
            position: { x: smoothX, y: smoothY },
          });
      }
    });

    // Initialize Camera
    // We explicitly pass `video` options to ensure it tries to get user facing camera
    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        // Strict check: make sure component is mounted and hands instance exists
        if (isMountedRef.current && videoRef.current && handsRef.current) {
          try {
            await handsRef.current.send({ image: videoRef.current });
          } catch (e: any) {
            // Suppress the specific "deleted object" or "SolutionWasm" errors which happen during race conditions
            const msg = e ? e.toString() : '';
            if (msg.includes("SolutionWasm") || msg.includes("deleted object")) {
                return;
            }
            // Suppress context lost errors
            if (msg.includes("context") || msg.includes("gl")) return;
            
            console.warn("MediaPipe send error:", e);
          }
        }
      },
      width: 640,
      height: 480,
    });
    cameraRef.current = camera;

    startCamera();

    return () => {
        isMountedRef.current = false;
        if (cameraRef.current) {
            try { cameraRef.current.stop(); } catch(e) {}
        }
        if (handsRef.current) {
            try { handsRef.current.close(); } catch(e) {}
            handsRef.current = null; // Prevent further access in async callbacks
        }
    };
  }, [startCamera]); // Dependencies

  return (
    <div className="absolute bottom-4 left-4 z-50 pointer-events-auto">
      {/* Container for Video + Canvas Overlay */}
      <div className="relative rounded-lg overflow-hidden border-2 border-white/20 shadow-lg bg-black w-32 h-24">
        {/* Video Element */}
        <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${cameraActive ? 'opacity-60' : 'opacity-0'}`}
            playsInline
            muted
            autoPlay
        />
        
        {/* Canvas Overlay for Skeleton - Matches Video Transform */}
        <canvas 
            ref={canvasRef}
            width={640}
            height={480}
            className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
        />
        
        {/* Loading Overlay */}
        {(isInitializing || (!cameraActive && !error)) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-2 text-center z-10">
                <RefreshCw className="animate-spin mb-1 opacity-70" size={20} />
                <span className="text-[10px] opacity-70">Starting Camera...</span>
            </div>
        )}

        {/* Error / Retry Overlay */}
        {error && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95 text-white p-2 text-center z-20">
                <AlertCircle className="text-red-400 mb-1" size={20} />
                <span className="text-[10px] text-red-200 mb-2 leading-tight px-1">{error}</span>
                <button 
                    onClick={startCamera}
                    className="bg-white/20 hover:bg-white/30 text-white text-[10px] px-2 py-1 rounded transition-colors flex items-center gap-1 mt-1"
                >
                    <CameraIcon size={10} /> Retry
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default HandTracker;
