
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private droneGain: GainNode | null = null;
  
  // Audio Element for streaming files
  private audioElement: HTMLAudioElement | null = null;
  private mediaElementSource: MediaElementAudioSourceNode | null = null;
  
  private oscillators: OscillatorNode[] = [];
  
  private dataArray: Uint8Array | null = null;
  private isInitialized: boolean = false;
  private isMuted: boolean = false;
  private isPlayingFile: boolean = false;

  constructor() {
    // Defer init
  }

  init() {
    if (this.isInitialized) return;

    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    this.ctx = new AudioContextClass();

    if (!this.ctx) return;

    // 1. Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.4;

    // 2. Analyser (For Visualization)
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.8;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    // 3. Filter (Hand Control - only effective in manual mode logic)
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 400;
    this.filterNode.Q.value = 1;

    // Graph Connection
    this.filterNode.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // 4. Initialize Audio Element for User Music
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = "anonymous";
    this.audioElement.loop = true;
    
    // Connect AudioElement to the graph
    this.mediaElementSource = this.ctx.createMediaElementSource(this.audioElement);
    this.mediaElementSource.connect(this.filterNode);

    // 5. Start Drone (Default)
    this.startDrone();

    this.isInitialized = true;
  }

  startDrone() {
    if (!this.ctx || !this.filterNode || this.isPlayingFile) return;
    if (this.droneGain) return;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.5;
    this.droneGain.connect(this.filterNode);

    const freqs = [110, 110.5, 220.2]; 
    const types: OscillatorType[] = ['sawtooth', 'sine', 'triangle'];

    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = types[i % types.length];
      osc.frequency.value = f;
      osc.start();
      osc.connect(this.droneGain!);
      this.oscillators.push(osc);
    });
  }

  stopDrone() {
    this.oscillators.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch(e){}
    });
    this.oscillators = [];
    if (this.droneGain) {
        this.droneGain.disconnect();
        this.droneGain = null;
    }
  }

  // Create a blob URL from the file object (for playlist storage)
  createAudioUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  // Play a specific URL (from playlist)
  async playAudioUrl(url: string) {
    if (!this.ctx) this.init();
    if (!this.ctx || !this.audioElement) throw new Error("Audio System not initialized");

    if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
    }

    try {
        // Stop Drone when music starts
        this.stopDrone();
        
        this.audioElement.src = url;
        await this.audioElement.play();
        this.isPlayingFile = true;

        // Open up the filter so the music sounds clear by default
        if (this.filterNode) {
            this.filterNode.frequency.setValueAtTime(20000, this.ctx.currentTime);
        }
        
    } catch (e) {
        console.error("Audio playback error:", e);
        this.isPlayingFile = false;
        this.startDrone();
        throw new Error("Unable to play audio. Format may be unsupported.");
    }
  }

  stopAudio() {
    if (this.audioElement && !this.audioElement.paused) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
    }
    this.isPlayingFile = false;
    this.startDrone(); // Resume idle ambient sound
    
    // Reset filter for gesture mode
    if (this.filterNode && this.ctx) {
         this.filterNode.frequency.setTargetAtTime(400, this.ctx.currentTime, 0.1);
    }
  }

  toggleMute(shouldMute: boolean) {
    this.isMuted = shouldMute;
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(shouldMute ? 0 : 0.4, now + 0.5);
    }
    if (!shouldMute && this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Updates filter based on gesture (Only used if NOT in music mode)
  updateFilter(gestureValue: number) {
    if (!this.ctx || !this.filterNode || this.isMuted) return;
    
    // If playing file, we generally want full frequency unless we explicitly want to filter it
    // For now, let's keep the filter wide open if playing file to let the visualizer handle things
    if (this.isPlayingFile) {
        this.filterNode.frequency.setTargetAtTime(20000, this.ctx.currentTime, 0.1);
        return;
    }

    const now = this.ctx.currentTime;
    const minFreq = 150;
    const maxFreq = 6000;
    const targetFreq = minFreq + (maxFreq - minFreq) * (gestureValue * gestureValue);
    
    this.filterNode.frequency.setTargetAtTime(targetFreq, now, 0.1);
    this.filterNode.Q.setTargetAtTime(1 + (gestureValue * 8), now, 0.1);
  }

  getAudioData() {
    if (!this.analyser || !this.dataArray) return { bass: 0, mid: 0, high: 0 };
    
    this.analyser.getByteFrequencyData(this.dataArray);
    
    const getAvg = (start: number, end: number) => {
        let sum = 0;
        for(let i=start; i<end; i++) sum += this.dataArray![i];
        return sum / (end - start);
    };

    const bass = getAvg(0, 15) / 255;
    const mid = getAvg(15, 80) / 255;
    const high = getAvg(80, 200) / 255;

    return { bass, mid, high };
  }

  triggerWarp() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }
}

export const audioManager = new AudioManager();
