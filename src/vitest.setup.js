/* globals global */
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
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

// Polyfill para window.matchMedia requerido por SweetAlert2 en JSDOM
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Polyfill para getAnimations para silenciar advertencias de Headless UI
if (!Element.prototype.getAnimations) {
    Element.prototype.getAnimations = () => [];
}
