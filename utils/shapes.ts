
import { ShapeType } from '../types';
import * as THREE from 'three';

const COUNT = 10000; // Increased count for richer density

const getRandomPointInSphere = (radius: number) => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random()) * radius;
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    r * sinPhi * Math.cos(theta),
    r * sinPhi * Math.sin(theta),
    r * Math.cos(phi)
  );
};

// Rejection sampling for Volumetric Heart
const getVolumetricHeartPoint = (scale: number): THREE.Vector3 => {
  let p = new THREE.Vector3();
  let found = false;
  
  while (!found) {
    const x = (Math.random() * 3 - 1.5);
    const y = (Math.random() * 3 - 1.5);
    const z = (Math.random() * 3 - 1.5);

    const a = x * x + (9/4) * y * y + z * z - 1;
    const result = Math.pow(a, 3) - x * x * Math.pow(z, 3) - (9/80) * y * y * Math.pow(z, 3);

    if (result < 0) {
      p.set(x, z, y); // Swap Y and Z to orient it upright in Three.js space
      found = true;
    }
  }
  return p.multiplyScalar(scale);
};

export const generateParticles = (shape: ShapeType, count: number = COUNT): Float32Array => {
  const positions = new Float32Array(count * 3);
  
  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0;
    const idx = i * 3;

    switch (shape) {
      case ShapeType.HEART: {
        const p = getVolumetricHeartPoint(2.0);
        x = p.x; y = p.y; z = p.z;
        break;
      }

      case ShapeType.DOUBLE_HEART: {
        const isFirst = Math.random() < 0.5;
        const p = getVolumetricHeartPoint(1.8);
        if (isFirst) {
            x = p.x - 0.8; y = p.y; z = p.z;
        } else {
            const angle = Math.PI / 4;
            const rx = p.x * Math.cos(angle) - p.z * Math.sin(angle);
            const rz = p.x * Math.sin(angle) + p.z * Math.cos(angle);
            x = rx + 0.8; y = p.y; z = rz;
        }
        break;
      }

      case ShapeType.GALAXY: {
        // Spiral Galaxy
        const arms = 3;
        const armIndex = i % arms;
        const randomOffset = Math.random(); 
        // Logarithmic spiral
        const angle = randomOffset * Math.PI * 4 + (armIndex * (Math.PI * 2 / arms));
        const distance = 0.2 + randomOffset * 3.5;
        
        x = Math.cos(angle) * distance;
        z = Math.sin(angle) * distance;
        y = (Math.random() - 0.5) * (1 - randomOffset) * 0.8; // Thicker at center
        
        // Add some random scatter
        x += (Math.random() - 0.5) * 0.2;
        z += (Math.random() - 0.5) * 0.2;
        break;
      }

      case ShapeType.DNA: {
        const t = (i / count) * Math.PI * 20; // Multiple turns
        const radius = 1.0;
        const height = 6.0;
        const yPos = (i / count) * height - (height / 2);
        
        if (i % 10 === 0) {
            // Rungs connecting strands
            const tRung = Math.floor((i / count) * 20) * (Math.PI); // Quantize
            const mix = Math.random(); // Position along rung
            x = Math.cos(tRung) * radius * (mix * 2 - 1);
            z = Math.sin(tRung) * radius * (mix * 2 - 1);
            y = yPos;
        } else {
            // Strands
            const isStrandA = i % 2 === 0;
            const offset = isStrandA ? 0 : Math.PI;
            x = Math.cos(t + offset) * radius;
            z = Math.sin(t + offset) * radius;
            y = yPos;
        }
        break;
      }

      case ShapeType.FLOWER: {
        const theta = Math.random() * Math.PI * 2;
        const k = 5; // petals
        const r_rose = 3 * Math.cos(k * theta); 
        const r2 = Math.random() * 2;
        x = (r_rose + r2) * Math.cos(theta);
        y = (r_rose + r2) * Math.sin(theta);
        z = (Math.random() - 0.5) * 1.5;
        break;
      }
      
      case ShapeType.FLOWER_SEA: {
        // Terrain / Field generation
        const width = 14;
        const depth = 14;
        x = (Math.random() - 0.5) * width;
        z = (Math.random() - 0.5) * depth;
        // Rolling hills equation
        y = Math.sin(x * 0.5) * Math.cos(z * 0.5) * 1.5 - 2.5;
        // Lift slightly to center visuals
        y += 1.0;
        // Add some vertical scatter for "grass/stems" look
        y += Math.random() * 0.6;
        break;
      }

      case ShapeType.RING: {
        if (Math.random() < 0.15) {
            const h = Math.random() * 1.5;
            const r = (1 - Math.abs(h - 0.75) / 0.75) * 0.8;
            const theta = Math.random() * Math.PI * 2;
            x = r * Math.cos(theta);
            z = r * Math.sin(theta);
            y = h + 2.0;
        } else {
            const majorR = 2.0;
            const minorR = 0.2 + Math.random() * 0.1;
            const u = Math.random() * Math.PI * 2;
            const v = Math.random() * Math.PI * 2;
            x = (majorR + minorR * Math.cos(v)) * Math.cos(u);
            y = (majorR + minorR * Math.cos(v)) * Math.sin(u);
            z = minorR * Math.sin(v);
            const tempY = y; y = x; x = tempY;
        }
        break;
      }

      case ShapeType.BUTTERFLY: {
        let t = Math.random() * Math.PI * 4;
        const e = Math.exp(Math.cos(t));
        const c4 = 2 * Math.cos(4 * t);
        const s5 = Math.pow(Math.sin(t / 12), 5);
        const r = e - c4 + s5;
        const bx = r * Math.sin(t);
        const by = r * Math.cos(t);
        x = bx * 0.8;
        y = by * 0.8;
        const dist = Math.sqrt(x*x + y*y);
        z = Math.abs(x) * 0.5 * Math.sin(dist * 0.5) + (Math.random() - 0.5) * 0.5;
        break;
      }

      case ShapeType.I_LOVE_U: {
        const section = Math.random();
        if (section < 0.2) {
            x = -2.5 + (Math.random() * 0.5);
            y = (Math.random() * 4) - 2;
            z = (Math.random() - 0.5) * 0.5;
        } else if (section < 0.6) {
            const p = getVolumetricHeartPoint(1.2);
            x = p.x; y = p.y; z = p.z;
        } else {
            const t = Math.random() * Math.PI;
            const r = 1.5;
            const ux = Math.cos(t + Math.PI) * r; 
            let uy = Math.sin(t + Math.PI) * r * 1.5; 
            if (Math.random() > 0.7) uy += Math.random() * 2;
            x = ux + 2.5;
            y = uy + 0.5;
            z = (Math.random() - 0.5) * 0.5;
        }
        break;
      }

      case ShapeType.SATURN: {
        const ratio = 0.6; 
        if (Math.random() < ratio) {
          const p = getRandomPointInSphere(1.8);
          x = p.x; y = p.y; z = p.z;
        } else {
          const angle = Math.random() * Math.PI * 2;
          const dist = 2.8 + Math.random() * 1.5;
          x = Math.cos(angle) * dist;
          z = Math.sin(angle) * dist; 
          y = (Math.random() - 0.5) * 0.1; 
        }
        break;
      }
      
      case ShapeType.SOLAR_SYSTEM: {
        // Probabilistic distribution for components
        const r = Math.random();
        
        if (r < 0.15) {
            // Sun (Center)
            const p = getRandomPointInSphere(0.8);
            x = p.x; y = p.y; z = p.z;
        } else if (r < 0.55) {
            // Orbital Rings (Visual guides)
            const orbitRadii = [1.5, 2.2, 3.2, 4.5, 6.5, 8.5, 10.5, 12.5];
            // Pick random orbit
            const selectedOrbit = orbitRadii[Math.floor(Math.random() * orbitRadii.length)];
            const rad = selectedOrbit + (Math.random() - 0.5) * 0.1; // Thickness
            const theta = Math.random() * Math.PI * 2;
            x = rad * Math.cos(theta);
            z = rad * Math.sin(theta);
            y = (Math.random() - 0.5) * 0.05; // Flat plane
        } else {
            // Planets (Spheres at specific locations)
            // Radii: Mer(1.5), Ven(2.2), Ear(3.2), Mar(4.5), Jup(6.5), Sat(8.5), Ura(10.5), Nep(12.5)
            // Relative sizes approx
            const planets = [
                { r: 1.5, size: 0.1, angle: 0 }, 
                { r: 2.2, size: 0.18, angle: 1.2 }, 
                { r: 3.2, size: 0.2, angle: 2.5 }, 
                { r: 4.5, size: 0.15, angle: 4.0 }, 
                { r: 6.5, size: 0.5, angle: 5.5 }, 
                { r: 8.5, size: 0.45, angle: 0.5 }, 
                { r: 10.5, size: 0.3, angle: 2.0 }, 
                { r: 12.5, size: 0.3, angle: 3.5 }  
            ];
            
            const pIdx = Math.floor(Math.random() * planets.length);
            const planet = planets[pIdx];
            
            // Calculate Planet Center
            const centerX = planet.r * Math.cos(planet.angle);
            const centerZ = planet.r * Math.sin(planet.angle);
            
            const p = getRandomPointInSphere(planet.size);
            x = centerX + p.x;
            y = p.y;
            z = centerZ + p.z;
            
            // Add Saturn's Rings specifically for index 5
            if (pIdx === 5 && Math.random() > 0.5) {
                 const ringR = planet.size * (1.4 + Math.random() * 0.8);
                 const ringTheta = Math.random() * Math.PI * 2;
                 x = centerX + ringR * Math.cos(ringTheta);
                 z = centerZ + ringR * Math.sin(ringTheta);
                 y = (Math.random()-0.5) * 0.05 + Math.sin(ringTheta)*0.1; // Tilted
            }
        }
        break;
      }

      case ShapeType.BUDDHA: {
        const part = Math.random();
        if (part < 0.2) {
            const p = getRandomPointInSphere(0.8);
            x = p.x; y = p.y + 2.5; z = p.z;
        } else if (part < 0.6) {
            const h = Math.random() * 3; 
            const r = 1.0 + (3 - h) * 0.5;
            const theta = Math.random() * Math.PI * 2;
            x = r * Math.cos(theta) * Math.sqrt(Math.random());
            z = r * Math.sin(theta) * Math.sqrt(Math.random());
            y = h - 1.5;
        } else {
            const theta = Math.random() * Math.PI * 2; 
            const r = 2.5 * Math.sqrt(Math.random());
            x = r * Math.cos(theta);
            z = r * Math.sin(theta);
            y = -1.5 + (Math.random() * 0.5);
        }
        break;
      }

      case ShapeType.FIREWORKS: {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = Math.random() * 6;
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
        break;
      }
      
      case ShapeType.CUSTOM: {
        const p = getRandomPointInSphere(3);
        x = p.x; y = p.y; z = p.z;
        break;
      }

      case ShapeType.SPHERE:
      default: {
        const p = getRandomPointInSphere(3);
        x = p.x; y = p.y; z = p.z;
        break;
      }
    }

    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
  }

  return positions;
};
