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

/**
 * Events (Live-Bereich)
 * Lädt concerts.json und rendert daraus:
 * - das nächstgelegene zukünftige Event (inkl. heute) im "Anstehendes Event"-Bereich
 * - alle vergangenen Events, nach Jahr gruppiert, in "Besuchte Events"
 * Alle sonstigen zukünftigen Events werden ignoriert.
 */
(function () {
    'use strict';

    const upcomingContainer = document.getElementById('upcoming-event-container');
    const yearAccordion = document.getElementById('year-accordion');

    if (!upcomingContainer && !yearAccordion) {
        return;
    }

    // Parst ein "YYYY-MM-DD" Datum als lokale Mitternacht (vermeidet UTC-Verschiebung)
    const parseISODate = (isoDate) => {
        const [year, month, day] = isoDate.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const getStartOfToday = () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    };

    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    // Baut die Meta-Zeile (Datum + optionales Badge) für ein Event
    const buildMeta = (event) => {
        const meta = el('p', 'event-meta');
        const time = document.createElement('time');
        time.setAttribute('datetime', event.datetime);
        time.textContent = event.dateDisplay;
        meta.appendChild(time);

        if (event.badge) {
            const badgeClass = event.badgeAlt ? 'event-badge event-badge-alt' : 'event-badge';
            meta.appendChild(el('span', badgeClass, event.badge));
        }
        return meta;
    };

    const buildLabeledLine = (label, value) => {
        const p = el('p', 'event-line');
        p.appendChild(el('span', 'event-label', `${label}:`));
        const text = Array.isArray(value) ? value.join(', ') : value;
        p.appendChild(document.createTextNode(` ${text}`));
        return p;
    };

    // Baut die Detail-Absätze (Tour/Support bzw. Headliner/Line-Up) je nach Event-Typ
    const buildEventDetails = (event) => {
        const nodes = [];
        if (event.type === 'festival') {
            if (event.headliner) nodes.push(buildLabeledLine('Headliner', event.headliner));
            nodes.push(el('p', 'event-venue', event.venue));
            if (event.lineup) nodes.push(buildLabeledLine('Line-Up', event.lineup));
        } else {
            if (event.tour) nodes.push(el('p', 'event-tour', event.tour));
            nodes.push(el('p', 'event-venue', event.venue));
            if (event.support) nodes.push(buildLabeledLine('Support', event.support));
        }
        return nodes;
    };

    const buildTimelineItem = (event) => {
        const li = el('li', `event ${event.type === 'festival' ? 'event-festival' : 'event-concert'}`);
        const content = el('div', 'timeline-content');
        content.appendChild(buildMeta(event));
        content.appendChild(el('h3', null, event.title));
        buildEventDetails(event).forEach((node) => content.appendChild(node));
        li.appendChild(content);
        return li;
    };

    const buildUpcomingEventCard = (event) => {
        const article = el('article', 'upcoming-event');
        const info = el('div', 'upcoming-event-info');

        info.appendChild(el('span', 'upcoming-event-eyebrow', 'Nächstes Event'));
        info.appendChild(el('h4', 'upcoming-event-title', event.title));

        const meta = el('p', 'upcoming-event-meta');
        const when = el('span', 'upcoming-event-when');
        when.appendChild(el('span', null, '🗓️')).setAttribute('aria-hidden', 'true');
        const time = document.createElement('time');
        time.setAttribute('datetime', event.datetime);
        time.textContent = event.dateDisplay;
        when.appendChild(time);
        meta.appendChild(when);

        const where = el('span', 'upcoming-event-where');
        where.appendChild(el('span', null, '📍')).setAttribute('aria-hidden', 'true');
        where.appendChild(document.createTextNode(` ${event.venue}`));
        meta.appendChild(where);

        info.appendChild(meta);

        if (event.desc) {
            // Beschreibungstext deckt Tour/Support bereits narrativ ab
            info.appendChild(el('p', 'upcoming-event-desc', event.desc));
        } else {
            buildEventDetails(event)
                .filter((node) => !node.classList.contains('event-venue')) // Ort steht bereits in der Meta-Zeile
                .forEach((node) => info.appendChild(node));
        }

        article.appendChild(info);
        return article;
    };

    const renderUpcomingEvent = (events, today) => {
        if (!upcomingContainer) return;
        upcomingContainer.innerHTML = '';

        const futureEvents = events.filter((event) => parseISODate(event.datetime) >= today).sort((a, b) => parseISODate(a.datetime) - parseISODate(b.datetime));

        if (futureEvents.length === 0) {
            upcomingContainer.appendChild(el('p', 'note', 'Aktuell ist kein neues Event geplant. Schau bald wieder vorbei!'));
            return;
        }

        upcomingContainer.appendChild(buildUpcomingEventCard(futureEvents[0]));
    };

    const renderPastEvents = (events, today) => {
        if (!yearAccordion) return;
        yearAccordion.innerHTML = '';

        const pastEvents = events.filter((event) => parseISODate(event.datetime) < today);

        if (pastEvents.length === 0) {
            yearAccordion.appendChild(el('p', 'note', 'Noch keine besuchten Events vorhanden.'));
            return;
        }

        const byYear = new Map();
        pastEvents.forEach((event) => {
            const year = parseISODate(event.datetime).getFullYear();
            if (!byYear.has(year)) byYear.set(year, []);
            byYear.get(year).push(event);
        });

        const years = Array.from(byYear.keys()).sort((a, b) => b - a);

        years.forEach((year, index) => {
            // Neueste zuerst, älteste zuletzt
            const yearEvents = byYear.get(year).sort((a, b) => parseISODate(b.datetime) - parseISODate(a.datetime));

            const details = el('details', 'year');
            if (index === 0) details.open = true;

            const summary = document.createElement('summary');
            summary.appendChild(el('span', 'year-label', String(year)));
            summary.appendChild(el('span', 'year-count', yearEvents.length === 1 ? '1 Event' : `${yearEvents.length} Events`));
            const yearIcon = el('span', 'year-icon');
            yearIcon.setAttribute('aria-hidden', 'true');
            summary.appendChild(yearIcon);
            details.appendChild(summary);

            const ol = el('ol', 'timeline timeline-compact');
            ol.setAttribute('aria-label', `Events ${year}`);
            yearEvents.forEach((event) => ol.appendChild(buildTimelineItem(event)));
            details.appendChild(ol);

            yearAccordion.appendChild(details);
        });
    };

    fetch('concerts.json')
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then((data) => {
            const events = Array.isArray(data.events) ? data.events : [];
            const today = getStartOfToday();
            renderUpcomingEvent(events, today);
            renderPastEvents(events, today);
        })
        .catch(() => {
            const errorMsg = 'Events konnten nicht geladen werden.';
            if (upcomingContainer) {
                upcomingContainer.innerHTML = '';
                upcomingContainer.appendChild(el('p', 'note', errorMsg));
            }
            if (yearAccordion) {
                yearAccordion.innerHTML = '';
                yearAccordion.appendChild(el('p', 'note', errorMsg));
            }
        });
})();
