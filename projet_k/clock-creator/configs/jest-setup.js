// Mock DragEvent as '@lumino/dragdrop' already requires it at require time
global.DragEvent = class DragEvent {};

// React Flow uses ResizeObserver and DOMMatrixReadOnly in jsdom tests
if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}

if (typeof global.DOMMatrixReadOnly === 'undefined') {
    global.DOMMatrixReadOnly = class DOMMatrixReadOnly {
        constructor() {
            this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
            this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
            this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
            this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
            this.a = 1; this.b = 1;
            this.c = 1; this.d = 1;
            this.e = 0; this.f = 0;
        }
        static fromMatrix() {
            return new DOMMatrixReadOnly();
        }
    };
}