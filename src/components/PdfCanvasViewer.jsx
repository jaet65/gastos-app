import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PdfCanvasViewer = ({ data }) => {
    const scrollRef = useRef(null);
    const pageNodes = useRef(new Map());
    const [pdfDocument, setPdfDocument] = useState(null);
    const [pageCount, setPageCount] = useState(0);
    const [pageAspectRatio, setPageAspectRatio] = useState(612 / 792);
    const [error, setError] = useState('');
    const renderedPages = useRef(new Set());

    useEffect(() => {
        let cancelled = false;
        const loadingTask = getDocument({ data: new Uint8Array(data) });
        loadingTask.promise.then(async (document) => {
            const firstPage = await document.getPage(1);
            if (cancelled) return;
            const viewport = firstPage.getViewport({ scale: 1 });
            setPageAspectRatio(viewport.width / viewport.height);
            setPageCount(document.numPages);
            setPdfDocument(document);
        }).catch((loadError) => {
            if (!cancelled) setError(loadError.message || 'No se pudo renderizar el PDF.');
        });

        return () => {
            cancelled = true;
            void loadingTask.destroy();
        };
    }, [data]);

    useEffect(() => {
        if (!pdfDocument || !scrollRef.current) return undefined;

        const renderPage = async (pageNumber) => {
            if (renderedPages.current.has(pageNumber)) return;
            const container = pageNodes.current.get(pageNumber);
            const canvas = container?.querySelector('canvas');
            if (!canvas) return;
            renderedPages.current.add(pageNumber);

            try {
                const page = await pdfDocument.getPage(pageNumber);
                const baseViewport = page.getViewport({ scale: 1 });
                const scale = container.clientWidth / baseViewport.width;
                const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: context, viewport }).promise;
            } catch (renderError) {
                renderedPages.current.delete(pageNumber);
                setError(renderError.message || `No se pudo renderizar la página ${pageNumber}.`);
            }
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) renderPage(Number(entry.target.dataset.page));
            });
        }, { root: scrollRef.current, rootMargin: '700px 0px' });

        pageNodes.current.forEach((node) => observer.observe(node));
        return () => observer.disconnect();
    }, [pdfDocument, pageCount]);

    if (error) return <p role="alert" className="p-6 text-center text-sm text-red-200">{error}</p>;
    if (!pdfDocument) return <p className="p-6 text-center text-sm text-white">Cargando páginas...</p>;

    return (
        <div ref={scrollRef} className="h-full overflow-y-auto px-3 py-4 sm:px-6">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-4">
                {Array.from({ length: pageCount }, (_, index) => {
                    const pageNumber = index + 1;
                    return (
                        <div
                            key={pageNumber}
                            ref={(node) => {
                                if (node) pageNodes.current.set(pageNumber, node);
                                else pageNodes.current.delete(pageNumber);
                            }}
                            data-page={pageNumber}
                            className="w-full overflow-hidden bg-white shadow-xl"
                            style={{ aspectRatio: pageAspectRatio }}
                        >
                            <canvas className="block h-full w-full" aria-label={`Página ${pageNumber}`} />
                        </div>
                    );
                })}
            </div>
            <p className="py-3 text-center text-xs text-slate-300">{pageCount} páginas</p>
        </div>
    );
};

export default PdfCanvasViewer;