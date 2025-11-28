
// @ts-nocheck
import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { ShapeType, HandData } from '../types';
import { generateParticles } from '../utils/shapes';

interface ParticleSceneProps {
  currentShape: ShapeType;
  color: string;
  handData: HandData;
  customPoints?: Float32Array | null;
}

const ParticleMesh: React.FC<ParticleSceneProps> = ({ currentShape, color, handData, customPoints }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 10000;
  
  // Memoize positions based on shape
  const targetPositions = useMemo(() => {
    if (currentShape === ShapeType.CUSTOM && customPoints) {
        return customPoints;
    }
    return generateParticles(currentShape, count);
  }, [currentShape, customPoints]);

  // Initial positions (sphere)
  const currentPositions = useMemo(() => {
    return generateParticles(ShapeType.SPHERE, count);
  }, []); 

  // Geometry Setup with Colors
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
    
    // Add color attribute for holographic effect
    const colors = new Float32Array(count * 3);
    for(let i=0; i<count*3; i++) {
        colors[i] = 1.0;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return geo;
  }, [currentPositions]);

  // Reference for "Warp Speed" transition effect
  const transitionRef = useRef(0);
  const prevShapeRef = useRef(currentShape);

  if (prevShapeRef.current !== currentShape) {
      transitionRef.current = 1.0; // Trigger warp
      prevShapeRef.current = currentShape;
  }

  // Helper to parse hex string to r,g,b
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const colors = pointsRef.current.geometry.attributes.color.array as Float32Array;
    const time = state.clock.getElapsedTime();

    // Responsive Physics Constants
    // Scale expansion: 1.0 to 4.0 based on hand
    const expansionFactor = 1 + (Math.pow(handData.gestureValue, 1.5) * 3.5); 
    
    // Noise/Turbulence increases with gesture
    const noiseAmount = handData.gestureValue * 0.8;
    
    // Adaptive Lerp Speed: Faster when transitioning or interacting
    let lerpSpeed = 0.12; 
    if (handData.gestureValue > 0.1) lerpSpeed = 0.2; // Fast response on interaction
    if (transitionRef.current > 0.1) lerpSpeed = 0.15; // Moderate speed on shape switch

    // Decrease warp effect over time
    if (transitionRef.current > 0) {
        transitionRef.current *= 0.92;
        if (transitionRef.current < 0.01) transitionRef.current = 0;
    }

    if (targetPositions) {
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            
            // 1. Get Target Position
            let tx = targetPositions[i3];
            let ty = targetPositions[i3 + 1];
            let tz = targetPositions[i3 + 2];

            // 2. Apply "Warp" Transition (Explode out then suck in)
            if (transitionRef.current > 0) {
                // Random scatter during transition
                const warp = transitionRef.current * 10;
                tx += (Math.random() - 0.5) * warp;
                ty += (Math.random() - 0.5) * warp;
                tz += (Math.random() - 0.5) * warp;
            }

            // 3. Apply Hand Expansion
            tx *= expansionFactor;
            ty *= expansionFactor;
            tz *= expansionFactor;

            // 4. Apply "Tech" Vortex Rotation (Orbiting around Y axis)
            // The closer to center, the faster the spin
            const dist = Math.sqrt(tx*tx + tz*tz);
            const spinSpeed = 0.2 + (1.0 / (dist + 0.1)) * 0.5;
            const spin = time * spinSpeed * 0.5;
            
            // Rotate the Target (not the current pos, to guide it)
            const rx = tx * Math.cos(spin) - tz * Math.sin(spin);
            const rz = tx * Math.sin(spin) + tz * Math.cos(spin);
            tx = rx;
            tz = rz;

            // 5. Apply Noise/Jitter
            if (noiseAmount > 0.01) {
                tx += (Math.random() - 0.5) * noiseAmount;
                ty += (Math.random() - 0.5) * noiseAmount;
                tz += (Math.random() - 0.5) * noiseAmount;
            }

            // 6. Physics Update (Interpolation)
            positions[i3] += (tx - positions[i3]) * lerpSpeed;
            positions[i3 + 1] += (ty - positions[i3 + 1]) * lerpSpeed;
            positions[i3 + 2] += (tz - positions[i3 + 2]) * lerpSpeed;

            // 7. Holographic Coloring
            // Mix base color with position-based hue
            // Normalize pos roughly between -5 and 5
            const nx = positions[i3] / 5; 
            const ny = positions[i3 + 1] / 5;
            const nz = positions[i3 + 2] / 5;

            // Tech Gradient: Mix Base Color with Cyan/Purple offsets
            const rBase = baseColor.r;
            const gBase = baseColor.g;
            const bBase = baseColor.b;

            // Dynamic Pulse
            const pulse = (Math.sin(time * 3 + ny * 5) + 1) * 0.5; // 0 to 1
            
            // Assign Colors
            colors[i3]     = rBase + (nx * 0.5) + (pulse * 0.2); // R
            colors[i3 + 1] = gBase + (ny * 0.5) + (pulse * 0.2); // G
            colors[i3 + 2] = bBase + (nz * 0.8) + (pulse * 0.5); // B (More blue for tech feel)
        }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;
    
    // Global System Rotation
    pointsRef.current.rotation.y = time * 0.05;
  });

  return (
    // @ts-ignore
    <points ref={pointsRef} geometry={geometry}>
      {/* @ts-ignore */}
      <pointsMaterial
        size={0.06}
        vertexColors={true} // IMPORTANT: Enable per-particle colors
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        transparent={true}
        opacity={0.9}
      />
    </points>
  );
};

const ParticleScene: React.FC<ParticleSceneProps> = (props) => {
  return (
    <Canvas camera={{ position: [0, 0, 12], fov: 60 }} dpr={[1, 2]}>
      {/* @ts-ignore */}
      <color attach="background" args={['#020205']} /> {/* Darker, slightly blue background */}
      <Stars radius={150} depth={50} count={6000} factor={4} saturation={1} fade speed={0.5} />
      
      {/* Volumetric Fog helper using simple lights for now to keep performance high */}
      {/* @ts-ignore */}
      <ambientLight intensity={0.2} />
      
      <ParticleMesh {...props} />
      <OrbitControls enableZoom={true} enablePan={false} autoRotate={false} />
    </Canvas>
  );
};

export default ParticleScene;
