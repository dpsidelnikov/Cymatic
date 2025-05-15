import { Pane } from 'tweakpane';

// Initial parameters matching the physical Chladni plate equation
export const PARAMS = {
    m: 3, // Mode number for x direction
    n: 2, // Mode number for y direction
    patternMixX: 1.0, // Amplitude coefficient 'a' for first standing wave
    patternMixY: 1.0, // Amplitude coefficient 'b' for second standing wave
    vibrationStrength: 0.1,
    particles: 50000,
    volume: 1,
    isPlaying: false, // Ensure sound is off by default
};

// Store control references for external updates
let controlRefs = {
    m: null,
    n: null,
    patternMixX: null,
    patternMixY: null,
};

// Export function to update control values
export function updateControlValues(values) {
    if (values.m !== undefined && controlRefs.m) {
        controlRefs.m.refresh();
    }
    if (values.n !== undefined && controlRefs.n) {
        controlRefs.n.refresh();
    }
    if (values.patternMixX !== undefined && controlRefs.patternMixX) {
        controlRefs.patternMixX.refresh();
    }
    if (values.patternMixY !== undefined && controlRefs.patternMixY) {
        controlRefs.patternMixY.refresh();
    }
}

// Setup controls function
export function setupControls(callbacks) {
    const pane = new Pane();

    // Pattern mode numbers
    const patternFolder = pane.addFolder({
        title: 'Mode Numbers',
        description: 'Integer values that determine number of nodal lines',
    });
    controlRefs.m = patternFolder
        .addBinding(PARAMS, 'm', {
            min: 1,
            max: 15,
            step: 1,
            label: 'X Mode',
        })
        .on('change', ({ value }) => callbacks.onPatternChange?.(value));
    controlRefs.n = patternFolder
        .addBinding(PARAMS, 'n', {
            min: 1,
            max: 15,
            step: 1,
            label: 'Y Mode',
        })
        .on('change', ({ value }) => callbacks.onPatternChange?.(value));

    // Amplitude coefficients
    const mixingFolder = pane.addFolder({
        title: 'Amplitude Coefficients',
        description: 'Control relative strength of standing wave components',
    });
    controlRefs.patternMixX = mixingFolder
        .addBinding(PARAMS, 'patternMixX', {
            min: -2,
            max: 2,
            step: 1,
            label: '1st Wave',
        })
        .on('change', ({ value }) => callbacks.onPatternChange?.(value));
    controlRefs.patternMixY = mixingFolder
        .addBinding(PARAMS, 'patternMixY', {
            min: -2,
            max: 2,
            step: 1,
            label: '2nd Wave',
        })
        .on('change', ({ value }) => callbacks.onPatternChange?.(value));

    // Simulation parameters
    const simulationFolder = pane.addFolder({ title: 'Simulation Parameters' });
    simulationFolder
        .addBinding(PARAMS, 'vibrationStrength', {
            min: 0.01,
            max: 0.2,
            step: 0.01,
            label: 'Vibration',
        })
        .on('change', ({ value }) => callbacks.onVibrationChange?.(value));
    simulationFolder
        .addBinding(PARAMS, 'particles', {
            min: 1000,
            max: 100000,
            step: 1000,
            label: 'Particles',
        })
        .on('change', ({ value }) => callbacks.onParticlesChange?.(value));

    // Audio parameters
    const audioFolder = pane.addFolder({ title: 'Audio' });
    audioFolder
        .addBinding(PARAMS, 'volume', {
            min: 0,
            max: 1,
            step: 0.1,
            label: 'Volume',
        })
        .on('change', ({ value }) => callbacks.onVolumeChange?.(value));

    // Add play button with dynamic styling
    const btn = audioFolder.addButton({
        title: 'Off',
        label: 'Sound',
    });

    // Style the button based on state
    const updateButtonStyle = (playing) => {
        btn.title = playing ? 'On' : 'Off';
        btn.element.style.opacity = playing ? '1' : '0.6';
    };

    // Initial button style
    updateButtonStyle(PARAMS.isPlaying);

    // Handle button click
    btn.on('click', () => {
        PARAMS.isPlaying = !PARAMS.isPlaying;
        updateButtonStyle(PARAMS.isPlaying);
        callbacks.onPlayingChange?.(PARAMS.isPlaying);
    });

    return pane;
}
