import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PdfCanvasViewer from '../PdfCanvasViewer';
import { getDocument } from 'pdfjs-dist';

vi.mock('pdfjs-dist', () => ({
    GlobalWorkerOptions: {},
    getDocument: vi.fn(),
}));

let observer;

class MockIntersectionObserver {
    constructor(callback) {
        this.callback = callback;
        observer = this;
    }

    observe(node) {
        if (node.dataset.page === '1') {
            this.callback([{ target: node, isIntersecting: true }]);
        }
    }

    disconnect() {}

    reveal(node) {
        this.callback([{ target: node, isIntersecting: true }]);
    }
}

describe('PdfCanvasViewer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    });

    it('renderiza en canvas únicamente las páginas que entran en el área visible', async () => {
        const renderPage = vi.fn(() => ({ promise: Promise.resolve() }));
        const page = {
            getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
            render: renderPage,
        };
        const pdfDocument = {
            numPages: 2,
            getPage: vi.fn().mockResolvedValue(page),
        };
        const loadingTask = {
            promise: Promise.resolve(pdfDocument),
            destroy: vi.fn(),
        };
        getDocument.mockReturnValue(loadingTask);

        const { container, unmount } = render(<PdfCanvasViewer data={new Uint8Array([1])} />);
        expect(await screen.findByText('2 páginas')).toBeInTheDocument();
        await waitFor(() => expect(renderPage).toHaveBeenCalledTimes(1));
        expect(container.querySelectorAll('canvas')).toHaveLength(2);

        observer.reveal(container.querySelector('[data-page="2"]'));
        await waitFor(() => expect(renderPage).toHaveBeenCalledTimes(2));

        unmount();
        expect(loadingTask.destroy).toHaveBeenCalledOnce();
    });
});