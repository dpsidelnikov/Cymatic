import * as Tone from 'tone';
import { PARAMS } from './controls.js';

// Audio synthesis setup variables
let synth; // Polyphonic synthesizer instance
let audioEnabled = false; // Audio state flag
let activeKeysStack = []; // Stack to manage multiple pressed keys
let analyzer; // Audio analyzer for real-time analysis
let reverb, delay, filter; // Effect processors

// Map of keyboard keys to Chladni patterns
export const baseKeyPatternMap = {
    A: { basePattern: { m: 1, n: 9, a: 2, b: -2, type: 'flower' } }, // Flower/clover pattern
    S: { basePattern: { m: 5, n: 8, a: -1, b: -2, type: 'complex' } }, // Complex crosses
    D: { basePattern: { m: 1, n: 5, a: 1, b: -1, type: 'grid' } }, // Simple grid
    F: { basePattern: { m: 8, n: 4, a: 1, b: 1, type: 'diamond' } }, // Diamond grid
    G: { basePattern: { m: 5, n: 5, a: 1, b: -1, type: 'concentric' } }, // Concentric squares
    // Additional keys with variations
    Q: { basePattern: { m: 7, n: 7, a: 1, b: 1, type: 'simple' } },
    W: { basePattern: { m: 11, n: 2, a: -1, b: 2, type: 'complex' } },
    E: { basePattern: { m: 4, n: 10, a: -2, b: 1, type: 'grid' } },
    R: { basePattern: { m: 4, n: 9, a: -2, b: -1, type: 'diamond' } },
    T: { basePattern: { m: 4, n: 11, a: 1, b: -2, type: 'concentric' } },
    // Special key for current pattern
    SPACE: { basePattern: null }, // Pattern will be set dynamically from current controls
};

/**
 * Calculate frequency from Chladni pattern parameters
 * Based on the physical equation f ∝ √((m² + n²)/ρ)
 * where ρ is the plate density (assumed constant)
 */
function calculateFrequencyFromPattern(pattern) {
    // Base frequency calculation from mode numbers
    const baseFreq = Math.sqrt(pattern.m * pattern.m + pattern.n * pattern.n) * 55;

    // Amplitude coefficients affect the frequency through tension/stress
    const amplitudeEffect = Math.sqrt(pattern.a * pattern.a + pattern.b * pattern.b);

    // Return the final frequency, clamped between 20Hz and 2000Hz
    return Math.min(Math.max(baseFreq * amplitudeEffect, 20), 2000);
}

/**
 * Sets up the audio synthesis system
 */
export async function setupAudio() {
    // Create effects chain
    reverb = new Tone.Reverb({
        decay: 2.5,
        preDelay: 0.1,
        wet: 0.5,
    }).toDestination();

    delay = new Tone.PingPongDelay({
        delayTime: '8n',
        feedback: 0.2,
        wet: 0.515,
    }).connect(reverb);

    filter = new Tone.Filter({
        type: 'bandpass',
        frequency: 700,
        Q: 2,
    }).connect(delay);

    // Create a synth with FM synthesis for rich harmonics
    synth = new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 10,
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.8,
            release: 0.25,
        },
        modulation: {
            type: 'square',
        },
        modulationEnvelope: {
            attack: 0.5,
            decay: 0.31,
            sustain: 1,
            release: 0.25,
        },
    }).connect(filter); // Connect to filter first in effects chain

    // Create analyzer for visualizing waveform
    analyzer = new Tone.Analyser('waveform', 128);
    reverb.connect(analyzer); // Connect analyzer at the end of chain
}

/**
 * Handles keydown events for audio and pattern control
 */
export function handleKeyDown(event) {
    if (!audioEnabled || !synth || event.repeat) return null;

    // Ensure effects are initialized
    if (!filter || !delay || !reverb) {
        console.warn('Effects not initialized, skipping key event');
        return null;
    }

    const keyUpper = event.key.toUpperCase();
    const keyData = baseKeyPatternMap[keyUpper];
    const isActive = activeKeysStack.some((item) => item.key === keyUpper);

    if (keyData && !isActive) {
        // For space key, use current pattern from controls
        const pattern =
            keyUpper === 'SPACE'
                ? {
                      m: PARAMS.m,
                      n: PARAMS.n,
                      a: PARAMS.patternMixX,
                      b: PARAMS.patternMixY,
                      type: 'current',
                  }
                : { ...keyData.basePattern };
        const freq = calculateFrequencyFromPattern(pattern);

        const activeKeyData = {
            key: keyUpper,
            pattern: pattern,
            frequency: freq,
        };
        activeKeysStack.push(activeKeyData);

        try {
            // Update synth parameters based on pattern
            const patternSum = pattern.m + pattern.n;

            // Safely update filter parameters
            if (filter && filter.frequency && filter.Q) {
                const filterFreq = Math.min(10000, freq * 2);
                filter.frequency.value = filterFreq;
                filter.Q.value = Math.max(1, patternSum / 4);
            }

            // Safely update delay parameters
            if (delay && delay.delayTime) {
                delay.delayTime.value = Math.min(0.5, 0.1 + patternSum * 0.02);
            }

            synth.set({
                harmonicity: Math.max(1, patternSum / 2),
                modulationIndex: Math.min(15, patternSum * 1.5),
                envelope: {
                    attack: 0.01,
                    decay: 0.1,
                    sustain: 0.7,
                    release: 0.25,
                },
            });

            synth.triggerAttack(freq);
            return pattern;
        } catch (error) {
            console.error('Error updating audio parameters:', error);
            return null;
        }
    }
    return null;
}

/**
 * Handles keyup events
 */
export function handleKeyUp(event) {
    if (!audioEnabled || !synth) return null;

    const keyUpper = event.key.toUpperCase();
    const releasedKeyIndex = activeKeysStack.findIndex((item) => item.key === keyUpper);

    if (releasedKeyIndex !== -1) {
        synth.triggerRelease();
        activeKeysStack.splice(releasedKeyIndex, 1);

        if (activeKeysStack.length > 0) {
            const lastActiveKeyData = activeKeysStack[activeKeysStack.length - 1];
            synth.triggerAttack(lastActiveKeyData.frequency);
            return lastActiveKeyData.pattern;
        }
    }
    return null;
}

export function isAudioEnabled() {
    return audioEnabled;
}

export function getAudioLevel() {
    if (analyzer && audioEnabled) {
        const waveform = analyzer.getValue();
        return Math.max(...waveform.map(Math.abs));
    }
    return 0;
}

export async function startAudio(frequency, volume) {
    try {
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        // Always ensure synth and effects are set up
        if (!synth || !filter || !delay || !reverb) {
            await setupAudio();
        }
        synth.volume.value = Tone.gainToDb(volume);
        audioEnabled = true;
    } catch (error) {
        console.error('Error starting audio:', error);
        audioEnabled = false;
    }
}

export function stopAudio() {
    if (synth && audioEnabled) {
        synth.triggerRelease();
        audioEnabled = false;
        // Clear any active keys
        activeKeysStack = [];

        // Dispose effects when stopping
        if (reverb) reverb.dispose();
        if (delay) delay.dispose();
        if (filter) filter.dispose();
        reverb = null;
        delay = null;
        filter = null;
    }
}

export function updateFrequency(frequency) {
    if (synth && audioEnabled) {
        synth.frequency.value = frequency;
    }
}

export function updateVolume(volume) {
    if (synth && audioEnabled) {
        synth.volume.value = Tone.gainToDb(volume);
    }
}
