// Import required libraries
import * as THREE from 'three';
import { setupControls, PARAMS, updateControlValues } from './controls.js';
import * as audio from './audio.js';

// Global variables for Three.js scene
let scene, camera, renderer, particles;
let particlePositions, particleVelocities; // Arrays to store particle data

// Constants
const PLANE_SIZE = 2.4;
const PI = Math.PI;

/**
 * Calculate Chladni pattern value at a point (x,y)
 * Using the equation: f(x,y) = a*sin(πnx)*sin(πmy) + b*sin(πmx)*sin(πny)
 * where:
 * - m,n are mode numbers that determine the basic pattern shape
 * - a,b are amplitude coefficients that control relative strength of components
 */
function chladni(x, y, m, n) {
    // Convert from [-1,1] to [0,1] range for consistent pattern with reference
    x = (x + 1) / 2;
    y = (y + 1) / 2;

    // First standing wave pattern: a*sin(πnx)*sin(πmy)
    const pattern1 = Math.sin(PI * n * x) * Math.sin(PI * m * y);

    // Second standing wave pattern: b*sin(πmx)*sin(πny)
    const pattern2 = Math.sin(PI * m * x) * Math.sin(PI * n * y);

    // Mix the patterns using the amplitude coefficients
    return PARAMS.patternMixX * pattern1 + PARAMS.patternMixY * pattern2;
}

/**
 * Calculate the natural frequency for given Chladni parameters
 * Based on the physical equation f ∝ √((m² + n²)/ρ)
 * where ρ is the plate density (assumed constant)
 */
function calculateFrequency(m, n, a, b) {
    // Base frequency from mode numbers
    const baseFreq = Math.sqrt(m * m + n * n) * 55; // 55Hz is A1, used as base

    // Calculate mixing effect - stronger mixing (a,b) increases frequency
    const mixingEffect = Math.sqrt(a * a + b * b);

    // Return the final frequency, clamped between 20Hz and 2000Hz
    return Math.min(Math.max(baseFreq * mixingEffect, 20), 2000);
}

/**
 * Calculate point size based on window dimensions
 */
function calculatePointSize() {
    const container = document.getElementById('simulationContainer');
    if (!container) return 1.0; // fallback to default

    const size = Math.max(container.clientWidth, container.clientHeight);
    const baseSize = 1.0;
    return (baseSize * size) / 1000; // Normalized to a 1000px reference
}

/**
 * Initialize Three.js scene
 */
function init() {
    const container = document.getElementById('simulationContainer');

    // Setup scene
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(
        PLANE_SIZE / -2.01,
        PLANE_SIZE / 2.01,
        PLANE_SIZE / 2.01,
        PLANE_SIZE / -2.01,
        0.1,
        100,
    );
    camera.position.z = 5;
    camera.lookAt(scene.position);

    // Setup renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x111111);
    container.appendChild(renderer.domElement);

    // Create initial particles
    createParticles();

    // Setup window resize handler
    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();
}

/**
 * Create or update particle system
 */
function createParticles() {
    const newPositions = new Float32Array(PARAMS.particles * 3);
    const newVelocities = new Float32Array(PARAMS.particles * 2);

    if (particles) {
        // Get existing particle data
        const currentPositions = particles.geometry.attributes.position.array;
        const currentVelocities = particleVelocities;
        const currentCount = currentPositions.length / 3;

        // Copy existing particle data
        const preserveCount = Math.min(currentCount, PARAMS.particles);
        for (let i = 0; i < preserveCount; i++) {
            // Copy positions
            newPositions[i * 3] = currentPositions[i * 3];
            newPositions[i * 3 + 1] = currentPositions[i * 3 + 1];
            newPositions[i * 3 + 2] = currentPositions[i * 3 + 2];

            // Copy velocities
            newVelocities[i * 2] = currentVelocities[i * 2];
            newVelocities[i * 2 + 1] = currentVelocities[i * 2 + 1];
        }

        // Initialize any additional particles near existing ones
        for (let i = preserveCount; i < PARAMS.particles; i++) {
            // Pick a random existing particle to spawn near
            const sourceIdx = Math.floor(Math.random() * preserveCount);
            const offsetScale = 0.1; // How far from source particle to spawn

            newPositions[i * 3] =
                currentPositions[sourceIdx * 3] + (Math.random() - 0.5) * offsetScale;
            newPositions[i * 3 + 1] =
                currentPositions[sourceIdx * 3 + 1] + (Math.random() - 0.5) * offsetScale;
            newPositions[i * 3 + 2] = 0;

            newVelocities[i * 2] = currentVelocities[sourceIdx * 2] * 0.5;
            newVelocities[i * 2 + 1] = currentVelocities[sourceIdx * 2 + 1] * 0.5;
        }

        // Clean up old geometry and material
        if (particles.geometry) particles.geometry.dispose();
        if (particles.material) particles.material.dispose();
        scene.remove(particles);
    } else {
        // First time creation - initialize all particles randomly
        for (let i = 0; i < PARAMS.particles; i++) {
            newPositions[i * 3] = (Math.random() - 0.5) * PLANE_SIZE;
            newPositions[i * 3 + 1] = (Math.random() - 0.5) * PLANE_SIZE;
            newPositions[i * 3 + 2] = 0;

            newVelocities[i * 2] = 0;
            newVelocities[i * 2 + 1] = 0;
        }
    }

    // Create new geometry with updated particle count
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));

    // Calculate initial point size based on current window size
    const initialPointSize = calculatePointSize();

    // Create material with custom shaders
    const material = new THREE.ShaderMaterial({
        vertexShader: `
            uniform float pointSize;
            void main() {
                gl_PointSize = pointSize;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            void main() {
                gl_FragColor = vec4(1.0, 1.0, 1.0, 0.75);
            }
        `,
        transparent: true,
        uniforms: {
            pointSize: { value: initialPointSize },
        },
    });

    // Update global references
    particles = new THREE.Points(geometry, material);
    particlePositions = newPositions;
    particleVelocities = newVelocities;

    scene.add(particles);
}

/**
 * Handle window resize
 */
function onWindowResize() {
    const container = document.getElementById('simulationContainer');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const size = Math.max(width, height);

    // Update point size based on new window dimensions
    if (particles && particles.material.uniforms) {
        particles.material.uniforms.pointSize.value = calculatePointSize();
    }

    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setViewport((width - size) / 2, (height - size) / 2, size, size);
}

/**
 * Animation loop
 */
function animate() {
    requestAnimationFrame(animate);
    if (!particles || !particlePositions || !particleVelocities) return;

    const positions = particles.geometry.attributes.position.array;
    const velocities = particleVelocities;

    // Get audio level to determine particle movement intensity
    const audioLevel = audio.getAudioLevel();
    const isAudioActive = audio.isAudioEnabled() && audioLevel > 0.01; // Increased threshold for more responsive stopping

    // Update each particle
    for (let i = 0; i < PARAMS.particles; i++) {
        let x = positions[i * 3];
        let y = positions[i * 3 + 1];
        let vx = velocities[i * 2];
        let vy = velocities[i * 2 + 1];

        // Convert to normalized coordinates [-1, 1]
        const x_norm = x / (PLANE_SIZE / 2);
        const y_norm = y / (PLANE_SIZE / 2);

        if (isAudioActive) {
            // Calculate Chladni value at current position
            const value = chladni(x_norm, y_norm, PARAMS.m, PARAMS.n);

            // Add force based on Chladni value with more randomness and wider spread
            const force = value * PARAMS.vibrationStrength * (1 + audioLevel * 2);
            const randomAngle = Math.random() * Math.PI * 2;
            const randomness = 0.07;
            vx += force * Math.cos(randomAngle) * randomness;
            vy += force * Math.sin(randomAngle) * randomness;

            // Apply normal damping during active sound
            vx *= 0.85;
            vy *= 0.85;
        } else {
            // When no sound, apply immediate velocity reduction
            // First, apply a strong initial reduction to quickly slow down fast-moving particles
            vx *= 0.85;
            vy *= 0.85;

            // Then apply additional damping for particles still moving
            const speed = Math.sqrt(vx * vx + vy * vy);
            if (speed > 0.001) {
                const dampingFactor = Math.max(0.5, 1 - speed * 2);
                vx *= dampingFactor;
                vy *= dampingFactor;
            } else {
                // If moving very slowly, stop completely
                vx = 0;
                vy = 0;
            }
        }

        // Update position
        x += vx;
        y += vy;

        // Boundary conditions (bounce off edges with some energy loss)
        const bound = PLANE_SIZE / 2 - 0.01;
        const bounceDamping = 0.7; // Energy loss on bounce
        if (Math.abs(x) > bound) {
            x = Math.sign(x) * bound;
            vx *= -bounceDamping;
        }
        if (Math.abs(y) > bound) {
            y = Math.sign(y) * bound;
            vy *= -bounceDamping;
        }

        // Store updated values
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        velocities[i * 2] = vx;
        velocities[i * 2 + 1] = vy;
    }

    particles.geometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
}

// Setup controls
setupControls({
    onPatternChange: () => {
        // Update audio frequency when pattern parameters change
        if (PARAMS.isPlaying && audio.isAudioEnabled()) {
            const newFreq = calculateFrequency(
                PARAMS.m,
                PARAMS.n,
                PARAMS.patternMixX,
                PARAMS.patternMixY,
            );
            audio.updateFrequency(newFreq);
        }
    },
    onVibrationChange: () => {
        // Vibration strength updated
    },
    onParticlesChange: () => {
        createParticles();
    },
    onVolumeChange: (value) => {
        if (PARAMS.isPlaying && audio.isAudioEnabled()) {
            audio.updateVolume(value);
        }
    },
    onPlayingChange: async (value) => {
        try {
            if (value) {
                const freq = calculateFrequency(
                    PARAMS.m,
                    PARAMS.n,
                    PARAMS.patternMixX,
                    PARAMS.patternMixY,
                );
                await audio.startAudio(freq, PARAMS.volume);
                // Simulate space key press to form the pattern
                if (audio.isAudioEnabled()) {
                    audio.handleKeyDown({ key: 'SPACE' });
                    // Automatically release after 0.7 seconds
                    setTimeout(() => {
                        if (audio.isAudioEnabled()) {
                            audio.handleKeyUp({ key: 'SPACE' });
                        }
                    }, 450);
                }
            } else {
                audio.stopAudio();
                // Release space key when sound is toggled off
                if (audio.isAudioEnabled()) {
                    audio.handleKeyUp({ key: 'SPACE' });
                }
            }
        } catch (error) {
            console.error('Error handling audio state change:', error);
            PARAMS.isPlaying = false;
        }
    },
});

// Initialize and start animation
document.addEventListener('DOMContentLoaded', () => {
    init();
    animate();

    // Add keyboard event listeners
    document.addEventListener('keydown', (event) => {
        // Handle space key for temporary sound with current parameters
        if (event.code === 'Space' && !event.repeat) {
            event.preventDefault(); // Prevent page scrolling
            if (audio.isAudioEnabled()) {
                const freq = calculateFrequency(
                    PARAMS.m,
                    PARAMS.n,
                    PARAMS.patternMixX,
                    PARAMS.patternMixY,
                );
                // Trigger sound with current parameters
                audio.updateFrequency(freq);
                audio.handleKeyDown({ key: 'SPACE' });
            }
            return;
        }

        // Handle other keys as before
        if (audio.isAudioEnabled() || PARAMS.isPlaying) {
            const pattern = audio.handleKeyDown(event);
            if (pattern) {
                // Update UI controls
                PARAMS.m = pattern.m;
                PARAMS.n = pattern.n;
                PARAMS.patternMixX = pattern.a;
                PARAMS.patternMixY = pattern.b;
                // Refresh the control UI
                updateControlValues(PARAMS);
            }
        }
    });

    document.addEventListener('keyup', (event) => {
        // Handle space key release
        if (event.code === 'Space') {
            if (audio.isAudioEnabled()) {
                audio.handleKeyUp({ key: 'SPACE' });
            }
            return;
        }

        // Handle other keys as before
        if (audio.isAudioEnabled()) {
            const pattern = audio.handleKeyUp(event);
            if (pattern) {
                // Update UI controls to show current active pattern
                PARAMS.m = pattern.m;
                PARAMS.n = pattern.n;
                PARAMS.patternMixX = pattern.a;
                PARAMS.patternMixY = pattern.b;
                // Refresh the control UI
                updateControlValues(PARAMS);
            }
        }
    });
});
