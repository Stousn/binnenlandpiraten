/**
 * Binnenland-Piraten – Interaktion
 * - Mobiles Menü
 * - Barrierefreie Modals (Fokus-Falle, ESC, Backdrop)
 */
(function () {
    'use strict';

    // Jahr im Footer setzen
    const yearEl = document.getElementById('year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    /* ------------------------------------------------------------------
       Mobiles Menü
       ------------------------------------------------------------------ */
    const menuToggle = document.querySelector('.menu-toggle');
    const primaryNav = document.getElementById('primary-nav');

    if (menuToggle && primaryNav) {
        const setMenuState = (open) => {
            menuToggle.setAttribute('aria-expanded', String(open));
            menuToggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
            primaryNav.classList.toggle('is-open', open);
        };

        menuToggle.addEventListener('click', () => {
            const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
            setMenuState(!isOpen);
        });

        // Menü schließen, wenn ein Link geklickt wird
        primaryNav.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => setMenuState(false));
        });

        // Menü schließen, wenn Fenster vergrößert wird
        const mq = window.matchMedia('(min-width: 48rem)');
        const handleMq = (e) => {
            if (e.matches) setMenuState(false);
        };
        if (mq.addEventListener) {
            mq.addEventListener('change', handleMq);
        } else if (mq.addListener) {
            mq.addListener(handleMq);
        }
    }

    /* ------------------------------------------------------------------
       Modals
       ------------------------------------------------------------------ */
    const FOCUSABLE_SELECTOR = ['a[href]', 'button:not([disabled])', 'textarea:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])'].join(',');

    let lastFocusedElement = null;
    let activeModal = null;

    const getFocusable = (container) => Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

    const openModal = (modal) => {
        if (!modal) return;
        lastFocusedElement = document.activeElement;
        activeModal = modal;

        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');

        // Fokus setzen: erstes fokussierbares Element im Modal (in der Regel der Schließen-Button)
        const focusables = getFocusable(modal);
        const target = focusables[0] || modal.querySelector('.modal-dialog');
        if (target) {
            // Kleines Delay, damit Animation & Screenreader gleich starten
            window.requestAnimationFrame(() => target.focus());
        }
    };

    const closeModal = (modal) => {
        if (!modal) return;
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        activeModal = null;
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
    };

    // Öffner
    document.querySelectorAll('[data-open-modal]').forEach((trigger) => {
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            const id = trigger.getAttribute('data-open-modal');
            const modal = document.getElementById(id);
            openModal(modal);
        });
    });

    // Schließer (Buttons & Backdrop)
    document.querySelectorAll('[data-close-modal]').forEach((el) => {
        el.addEventListener('click', (event) => {
            event.preventDefault();
            const modal = el.closest('.modal');
            closeModal(modal);
        });
    });

    // ESC schließt & Tab-Falle
    document.addEventListener('keydown', (event) => {
        if (!activeModal) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeModal(activeModal);
            return;
        }

        if (event.key === 'Tab') {
            const focusables = getFocusable(activeModal);
            if (focusables.length === 0) {
                event.preventDefault();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const current = document.activeElement;

            if (event.shiftKey && current === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && current === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });
})();
