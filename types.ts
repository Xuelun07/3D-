
export enum ShapeType {
  HEART = 'Heart',
  DOUBLE_HEART = 'Double Heart',
  FLOWER = 'Flower',
  FLOWER_SEA = 'Flower Sea',
  SATURN = 'Saturn',
  SOLAR_SYSTEM = 'Solar System',
  RING = 'Ring',
  BUTTERFLY = 'Butterfly',
  I_LOVE_U = 'I Love U',
  BUDDHA = 'Buddha',
  FIREWORKS = 'Fireworks',
  GALAXY = 'Galaxy',
  DNA = 'DNA',
  SPHERE = 'Sphere',
  CUSTOM = 'Custom' // User drawn shape
}

export interface HandData {
  isOpen: boolean;
  gestureValue: number; // 0.0 (closed/small) to 1.0 (open/wide)
  position: { x: number; y: number };
}

export interface ParticleConfig {
  count: number;
  color: string;
  size: number;
  shape: ShapeType;
}
