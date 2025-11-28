
// @ts-nocheck
import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { ShapeType, HandData } from '../types';
import { generateParticles } from '../utils/shapes';
import { audioManager } from '../utils/audio';

interface ParticleSceneProps {
  currentShape: ShapeType;
  color: string;
  handData: HandData;
  customPoints?: Float32Array | null;
  isMusicMode: boolean; // New prop to switch modes
}

const ParticleMesh: React.FC<ParticleSceneProps> = ({ currentShape, color, handData, customPoints, isMusicMode }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  
  const PARTICLE_COUNT = 8000;
  const TRAIL_LENGTH = 5;
  const TOTAL_VERTICES = PARTICLE_COUNT * TRAIL_LENGTH;

  const physicsPositions = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));

  const randomOffsets = useMemo(() => {
    const offsets = new Float32Array(PARTICLE_COUNT);
    for(let i=0; i<PARTICLE_COUNT; i++) offsets[i] = Math.random() * Math.PI * 2;
    return offsets;
  }, []);

  const targetPositions = useMemo(() => {
    let targets: Float32Array;
    if (currentShape === ShapeType.CUSTOM && customPoints) {
        if (customPoints.length !== PARTICLE_COUNT * 3) {
             const resampled = new Float32Array(PARTICLE_COUNT * 3);
             for(let i=0; i<PARTICLE_COUNT; i++) {
                 const srcIdx = Math.floor(Math.random() * (customPoints.length / 3));
                 resampled[i*3] = customPoints[srcIdx*3];
                 resampled[i*3+1] = customPoints[srcIdx*3+1];
                 resampled[i*3+2] = customPoints[srcIdx*3+2];
             }
             targets = resampled;
        } else {
            targets = customPoints;
        }
    } else {
        targets = generateParticles(currentShape, PARTICLE_COUNT);
    }
    return targets;
  }, [currentShape, customPoints]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(TOTAL_VERTICES * 3);
    const colors = new Float32Array(TOTAL_VERTICES * 3);
    const startPos = generateParticles(ShapeType.SPHERE, PARTICLE_COUNT);

    for(let i=0; i<PARTICLE_COUNT; i++) {
        physicsPositions.current[i*3] = startPos[i*3];
        physicsPositions.current[i*3+1] = startPos[i*3+1];
        physicsPositions.current[i*3+2] = startPos[i*3+2];

        for(let t=0; t<TRAIL_LENGTH; t++) {
            const idx = (i * TRAIL_LENGTH + t) * 3;
            positions[idx] = startPos[i*3];
            positions[idx+1] = startPos[i*3+1];
            positions[idx+2] = startPos[i*3+2];
            colors[idx] = 1.0;
            colors[idx+1] = 1.0;
            colors[idx+2] = 1.0;
        }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  const transitionRef = useRef(0);
  const prevShapeRef = useRef(currentShape);

  if (prevShapeRef.current !== currentShape) {
      transitionRef.current = 1.0;
      prevShapeRef.current = currentShape;
  }

  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const positionsAttribute = pointsRef.current.geometry.attributes.position;
    const colorsAttribute = pointsRef.current.geometry.attributes.color;
    const positions = positionsAttribute.array as Float32Array;
    const colors = colorsAttribute.array as Float32Array;
    
    const time = state.clock.getElapsedTime();
    const { bass, mid, high } = audioManager.getAudioData();

    // ==========================================================
    // MODE SWITCHING LOGIC
    // ==========================================================

    let expansionFactor = 1.0;
    let autoSpinX = 0;
    let autoSpinY = 0;
    let lerpBase = 0.08;

    if (isMusicMode) {
        // --- MUSIC MODE: Driven PURELY by audio ---
        
        // 1. Rotation: Auto spin based on Mid/High energy
        // Continuous rotation that speeds up with music intensity
        const spinSpeed = 0.002 + (high * 0.02);
        pointsRef.current.rotation.y += spinSpeed;
        pointsRef.current.rotation.x = Math.sin(time * 0.5) * 0.1 + (bass * 0.1); 

        // 2. Expansion: Driven by Bass (The Beat)
        // Bass > 0.4 triggers a "Kick" expansion
        expansionFactor = 1.0 + (bass * 2.5);
        // Add a rhythmic wave
        expansionFactor += Math.sin(time * 3.0) * (bass * 0.5);

        // 3. Physics Speed: React faster on beats
        lerpBase = 0.1 + (bass * 0.2);

    } else {
        // --- GESTURE MODE: Driven by Hand ---
        
        // 1. Rotation: Controlled by Hand Position
        const targetRotY = (handData.position.x - 0.5) * 3.0; 
        const targetRotX = (handData.position.y - 0.5) * 1.5;
        pointsRef.current.rotation.y += (targetRotY - pointsRef.current.rotation.y) * 0.05;
        pointsRef.current.rotation.x += (targetRotX - pointsRef.current.rotation.x) * 0.05;

        // 2. Expansion: Controlled by Hand Gesture (Openness)
        expansionFactor = 1 + (Math.pow(handData.gestureValue, 1.5) * 3.0); 
        // Subtle bass influence remains for ambient drone
        expansionFactor += bass * 0.5; 
        
        // Pulse effect
        const pulseFreq = 2.0 + (handData.gestureValue * 5.0); 
        expansionFactor += Math.sin(time * pulseFreq) * (0.05 + bass * 0.1);

        // 3. Physics Speed
        lerpBase = 0.08 + (handData.gestureValue * 0.05);
    }

    // Material Updates (Size & Opacity)
    if (materialRef.current) {
        let targetSize = 0.04;
        let targetOpacity = 0.6;

        if (isMusicMode) {
             // Music Mode: Particles pulse with bass
             targetSize += bass * 0.15;
             targetOpacity = 0.5 + mid * 0.5;
        } else {
             // Gesture Mode: Particles grow with hand open
             targetSize += Math.pow(handData.gestureValue, 1.2) * 0.12; 
             targetOpacity = 0.6 + (handData.gestureValue * 0.3);
        }
        
        materialRef.current.size += (targetSize - materialRef.current.size) * 0.1;
        materialRef.current.opacity = targetOpacity;
    }


    // ==========================================================
    // COMMON PHYSICS LOOP
    // ==========================================================

    if (transitionRef.current > 0) {
        transitionRef.current *= 0.92;
        if (transitionRef.current < 0.01) transitionRef.current = 0;
    }

    // Pre-calculate Color Base
    const rBase = baseColor.r;
    const gBase = baseColor.g;
    const bBase = baseColor.b;
    // Boost brightness with audio (applies to both modes, but stronger in music mode usually)
    const boost = bass * 0.6 + high * 0.4;

    if (targetPositions) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const pIdx = i * 3;
            
            const currentX = physicsPositions.current[pIdx];
            const currentY = physicsPositions.current[pIdx + 1];
            const currentZ = physicsPositions.current[pIdx + 2];

            // 1. Target Calc
            let tx = targetPositions[pIdx];
            let ty = targetPositions[pIdx + 1];
            let tz = targetPositions[pIdx + 2];

            // Warp Transition
            if (transitionRef.current > 0) {
                const warp = transitionRef.current * 12;
                tx += (Math.random() - 0.5) * warp;
                ty += (Math.random() - 0.5) * warp;
                tz += (Math.random() - 0.5) * warp;
            }

            // Apply Expansion
            tx *= expansionFactor;
            ty *= expansionFactor;
            tz *= expansionFactor;

            // Apply Vortex/Spin (Micro-movement within the shape)
            const dist = Math.sqrt(tx*tx + tz*tz);
            // In music mode, the vortex is driven purely by audio high freqs
            // In gesture mode, it's driven by gesture value
            let vortexStrength = isMusicMode 
                ? (high * 0.8) 
                : (handData.gestureValue * 0.5);
                
            const spin = time * (0.2 + high * 0.5) + (1.0/(dist+0.1)) * vortexStrength;
            
            const rx = tx * Math.cos(spin) - tz * Math.sin(spin);
            const rz = tx * Math.sin(spin) + tz * Math.cos(spin);
            tx = rx;
            tz = rz;

            // Noise / Fluid Dynamics
            const offset = randomOffsets[i];
            const noiseFreq = 0.5; 
            const noiseAmp = isMusicMode 
                ? 0.1 + (high * 0.5) // More chaotic in music mode
                : 0.15 + (handData.gestureValue * 0.2);

            const fluidX = Math.sin(time * 0.8 + currentY * noiseFreq + offset) * noiseAmp;
            const fluidY = Math.cos(time * 0.7 + currentZ * noiseFreq + offset) * noiseAmp;
            const fluidZ = Math.sin(time * 0.9 + currentX * noiseFreq + offset) * noiseAmp;

            tx += fluidX;
            ty += fluidY;
            tz += fluidZ;

            // Audio Jitter (Kick drum shockwave)
            if (bass > 0.3) {
                const jit = bass * 0.05;
                tx += (Math.random()-0.5) * jit;
                ty += (Math.random()-0.5) * jit;
                tz += (Math.random()-0.5) * jit;
            }

            // 2. Integration
            physicsPositions.current[pIdx] += (tx - currentX) * lerpBase;
            physicsPositions.current[pIdx + 1] += (ty - currentY) * lerpBase;
            physicsPositions.current[pIdx + 2] += (tz - currentZ) * lerpBase;

            const newX = physicsPositions.current[pIdx];
            const newY = physicsPositions.current[pIdx + 1];
            const newZ = physicsPositions.current[pIdx + 2];

            // 3. Trail Update
            const bufferStartIdx = i * TRAIL_LENGTH * 3;
            for (let t = TRAIL_LENGTH - 1; t > 0; t--) {
                const currT = bufferStartIdx + (t * 3);
                const prevT = bufferStartIdx + ((t - 1) * 3);
                positions[currT] = positions[prevT];
                positions[currT + 1] = positions[prevT + 1];
                positions[currT + 2] = positions[prevT + 2];
            }
            positions[bufferStartIdx] = newX;
            positions[bufferStartIdx + 1] = newY;
            positions[bufferStartIdx + 2] = newZ;

            // 4. Color Update
            const nx = newX / 5; 
            const ny = newY / 5;
            const nz = newZ / 5;
            
            const r = rBase + (nx * 0.4) + boost;
            const g = gBase + (ny * 0.4) + boost;
            const b = bBase + (nz * 0.6) + boost;

            for (let t = 0; t < TRAIL_LENGTH; t++) {
                const colorIdx = bufferStartIdx + (t * 3);
                const fade = 1.0 - (t / TRAIL_LENGTH);
                const alpha = fade * fade; 
                colors[colorIdx] = r * alpha;
                colors[colorIdx + 1] = g * alpha;
                colors[colorIdx + 2] = b * alpha;
            }
        }
    }

    positionsAttribute.needsUpdate = true;
    colorsAttribute.needsUpdate = true;
  });

  return (
    // @ts-ignore
    <points ref={pointsRef} geometry={geometry}>
      {/* @ts-ignore */}
      <pointsMaterial
        ref={materialRef}
        size={0.06}
        vertexColors={true}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        transparent={true}
        opacity={0.8}
      />
    </points>
  );
};

const ParticleScene: React.FC<ParticleSceneProps> = (props) => {
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 60 }} dpr={[1, 2]}>
      {/* @ts-ignore */}
      <color attach="background" args={['#020205']} />
      <Stars radius={150} depth={50} count={6000} factor={4} saturation={1} fade speed={0.5} />
      {/* @ts-ignore */}
      <ambientLight intensity={0.2} />
      <ParticleMesh {...props} />
      <OrbitControls enableZoom={true} enablePan={false} autoRotate={false} />
    </Canvas>
  );
};

export default ParticleScene;
