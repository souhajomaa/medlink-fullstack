import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ title, onClose, children }) {
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Portail vers <body> : sans lui, l'animation .fade-in des pages (transform) devient le repère de
    // position: fixed et l'overlay ne couvre plus la fenêtre.
    return createPortal(
        <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-on-surface/40 p-4"
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            >
                <div className="mb-5 flex items-center justify-between">
                    <h3 className="font-display text-xl font-bold">{title}</h3>
                    <button type="button" onClick={onClose} className="btn-ghost" aria-label="Fermer">✕</button>
                </div>
                {children}
            </div>
        </div>,
        document.body
    );
}