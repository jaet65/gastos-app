/* globals global */
import '@testing-library/jest-dom/vitest';
// Mock ResizeObserver para entornos de prueba JSDOM
global.ResizeObserver = class ResizeObserver {
    observe() {
        // do nothing
    }
    unobserve() {
        // do nothing
    }
    disconnect() {
        // do nothing
    }
};
