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
        if (!modal || modal.hidden) return;
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        activeModal = null;
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
        modal.dispatchEvent(new CustomEvent('modal:close'));
    };

    // Für den Event-Bereich (separater Scope)
    window.bpModal = { open: openModal, close: closeModal };

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

    /* ------------------------------------------------------------------
       Detail-Ansicht (Modal, teilbar per ?event=<id>)
       ------------------------------------------------------------------ */
    const eventModal = document.getElementById('modal-event');
    const eventModalTitle = document.getElementById('modal-event-title');
    const eventModalBody = document.getElementById('modal-event-body');

    // id -> Event; nur vergangene Events mit id haben eine Detail-Ansicht
    const detailEvents = new Map();

    const eventUrl = (id) => `?event=${encodeURIComponent(id)}`;
    const getEventParam = () => new URLSearchParams(window.location.search).get('event');

    /* Lightbox: eigene Tastatursteuerung, damit Esc nur sie und nicht das Event-Modal schließt */
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = lightbox && lightbox.querySelector('.lightbox-img');
    const lightboxCaption = lightbox && lightbox.querySelector('.lightbox-caption');
    const lightboxClose = lightbox && lightbox.querySelector('.lightbox-close');
    const lightboxPrev = lightbox && lightbox.querySelector('.lightbox-prev');
    const lightboxNext = lightbox && lightbox.querySelector('.lightbox-next');

    let lightboxPhotos = [];
    let lightboxIndex = 0;
    let lightboxTrigger = null;

    const showLightboxPhoto = (index) => {
        const count = lightboxPhotos.length;
        lightboxIndex = (index + count) % count;
        const photo = lightboxPhotos[lightboxIndex];
        lightboxImg.src = photo.src;
        const alt = photo.alt || '';
        lightboxCaption.textContent = count > 1 ? `${alt} (${lightboxIndex + 1} / ${count})` : alt;
    };

    const openLightbox = (photos, index, trigger) => {
        if (!lightbox) return;
        lightboxPhotos = photos;
        lightboxTrigger = trigger;
        lightboxPrev.hidden = photos.length < 2;
        lightboxNext.hidden = photos.length < 2;
        showLightboxPhoto(index);
        lightbox.hidden = false;
        lightbox.setAttribute('aria-hidden', 'false');
        lightboxClose.focus();
    };

    const closeLightbox = (restoreFocus = true) => {
        if (!lightbox || lightbox.hidden) return;
        lightbox.hidden = true;
        lightbox.setAttribute('aria-hidden', 'true');
        lightboxImg.removeAttribute('src');
        if (restoreFocus && lightboxTrigger) lightboxTrigger.focus();
        lightboxTrigger = null;
    };

    if (lightbox) {
        lightboxClose.addEventListener('click', () => closeLightbox());
        lightboxPrev.addEventListener('click', () => showLightboxPhoto(lightboxIndex - 1));
        lightboxNext.addEventListener('click', () => showLightboxPhoto(lightboxIndex + 1));

        // Klick neben Bild, Beschriftung und Buttons schließt
        lightbox.addEventListener('click', (e) => {
            if (!e.target.closest('.lightbox-btn, .lightbox-img, .lightbox-caption')) closeLightbox();
        });

        let touchStartX = 0;
        let touchStartY = 0;
        lightbox.addEventListener(
            'touchstart',
            (e) => {
                touchStartX = e.changedTouches[0].clientX;
                touchStartY = e.changedTouches[0].clientY;
            },
            { passive: true }
        );
        lightbox.addEventListener(
            'touchend',
            (e) => {
                if (lightboxPhotos.length < 2) return;
                const dx = e.changedTouches[0].clientX - touchStartX;
                const dy = e.changedTouches[0].clientY - touchStartY;
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
                    showLightboxPhoto(lightboxIndex + (dx < 0 ? 1 : -1));
                }
            },
            { passive: true }
        );

        // Capture-Phase, damit der Handler des Modals nicht zusätzlich reagiert
        document.addEventListener(
            'keydown',
            (e) => {
                if (lightbox.hidden) return;
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    closeLightbox();
                } else if (e.key === 'ArrowLeft' && lightboxPhotos.length > 1) {
                    e.preventDefault();
                    showLightboxPhoto(lightboxIndex - 1);
                } else if (e.key === 'ArrowRight' && lightboxPhotos.length > 1) {
                    e.preventDefault();
                    showLightboxPhoto(lightboxIndex + 1);
                } else if (e.key === 'Tab') {
                    e.stopPropagation();
                    const buttons = [lightboxClose, lightboxPrev, lightboxNext].filter((b) => !b.hidden);
                    const first = buttons[0];
                    const last = buttons[buttons.length - 1];
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    } else if (!buttons.includes(document.activeElement)) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            },
            true
        );
    }

    const buildPhotos = (photos) => {
        const list = el('ul', 'event-photos');
        list.setAttribute('role', 'list');
        list.dataset.count = String(photos.length);
        const viewable = photos.filter((photo) => photo.src);
        photos.forEach((photo) => {
            const li = el('li', 'event-photo');
            if (photo.src) {
                const button = el('button', 'event-photo-btn');
                button.type = 'button';
                button.setAttribute('aria-label', `Foto vergrößern: ${photo.alt || ''}`);
                const img = document.createElement('img');
                img.src = photo.src;
                img.alt = '';
                img.loading = 'lazy';
                button.appendChild(img);
                button.addEventListener('click', () => openLightbox(viewable, viewable.indexOf(photo), button));
                li.appendChild(button);
            } else {
                const placeholder = el('div', 'event-photo-placeholder');
                placeholder.setAttribute('role', 'img');
                placeholder.setAttribute('aria-label', photo.alt || 'Foto-Platzhalter');
                placeholder.appendChild(el('span', null, '📷')).setAttribute('aria-hidden', 'true');
                li.appendChild(placeholder);
            }
            list.appendChild(li);
        });
        return list;
    };

    // Standard-Besetzung, solange eine Detail-JSON kein eigenes `crew` festlegt
    const CREW = {
        vanessa: { name: 'Vanessa', avatar: 'avatar-vanessa' },
        stefan: { name: 'Stefan', avatar: 'avatar-stefan' }
    };
    const DEFAULT_CREW = ['vanessa', 'stefan'];

    const buildFact = (label, content) => {
        const fact = el('div', 'event-fact');
        fact.appendChild(el('span', 'event-label', `${label}:`));
        fact.appendChild(content);
        return fact;
    };

    const buildCrew = (ids) => {
        const members = ids.filter((id) => CREW[id]);
        if (!members.length) return null;
        const list = el('ul', 'event-crew');
        list.setAttribute('role', 'list');
        members.forEach((id) => {
            const li = el('li', 'event-crew-member');
            const avatar = el('span', `crew-avatar crew-avatar-sm ${CREW[id].avatar}`);
            avatar.setAttribute('aria-hidden', 'true');
            li.appendChild(avatar);
            li.appendChild(el('span', null, CREW[id].name));
            list.appendChild(li);
        });
        return list;
    };

    const buildRating = (rating) => {
        const value = Math.round(Number(rating));
        if (!(value >= 1 && value <= 5)) return null;
        const wrap = el('span', 'event-rating');
        wrap.setAttribute('role', 'img');
        wrap.setAttribute('aria-label', `Bewertung: ${value} von 5 Totenköpfen`);
        for (let i = 1; i <= 5; i += 1) {
            const skull = el('span', i > value ? 'event-rating-skull is-empty' : 'event-rating-skull', '💀');
            skull.setAttribute('aria-hidden', 'true');
            wrap.appendChild(skull);
        }
        return wrap;
    };

    const renderFacts = (holder, detail) => {
        holder.innerHTML = '';
        const crew = buildCrew(Array.isArray(detail.crew) ? detail.crew : DEFAULT_CREW);
        if (crew) holder.appendChild(buildFact('Dabei', crew));
        const rating = buildRating(detail.rating);
        if (rating) holder.appendChild(buildFact('Bewertung', rating));
    };

    // `report` darf ein String oder eine Liste von Absätzen sein
    const renderReport = (holder, report) => {
        holder.innerHTML = '';
        const paragraphs = [].concat(report || []).filter((text) => typeof text === 'string' && text.trim());
        if (!paragraphs.length) return;
        const section = el('section', 'event-report');
        section.appendChild(el('h3', null, 'Kurzbericht'));
        paragraphs.forEach((text) => section.appendChild(el('p', null, text)));
        holder.appendChild(section);
    };

    const renderInstagram = (holder, url) => {
        holder.innerHTML = '';
        if (typeof url !== 'string' || !/^https:\/\//.test(url)) return;
        const link = el('a', 'event-details-link event-external-link', 'Auf Instagram ansehen');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.appendChild(el('span', 'visually-hidden', ' (öffnet in neuem Tab)'));
        holder.appendChild(link);
    };

    const showEventDetail = (event, push) => {
        if (!eventModal || !window.bpModal) return;

        closeLightbox(false);
        eventModal.dataset.eventId = event.id;
        eventModalTitle.textContent = event.title;
        eventModalBody.innerHTML = '';
        eventModalBody.appendChild(buildMeta(event));
        buildEventDetails(event).forEach((node) => eventModalBody.appendChild(node));

        const factsHolder = el('div', 'event-facts');
        const reportHolder = el('div');
        const instagramHolder = el('div', 'event-instagram');
        renderFacts(factsHolder, {});
        eventModalBody.appendChild(factsHolder);
        eventModalBody.appendChild(reportHolder);

        const photosSection = el('section', 'event-photos-section');
        photosSection.appendChild(el('h3', null, 'Fotos'));
        const photosHolder = el('div');
        photosHolder.appendChild(el('p', 'note', 'Lade Fotos…'));
        photosSection.appendChild(photosHolder);
        eventModalBody.appendChild(photosSection);
        eventModalBody.appendChild(instagramHolder);

        window.bpModal.open(eventModal);
        if (push) history.pushState({ bpEvent: event.id }, '', eventUrl(event.id));

        fetch(`events/${encodeURIComponent(event.id)}.json`)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((detail) => {
                if (eventModal.dataset.eventId !== event.id) return;
                renderFacts(factsHolder, detail);
                renderReport(reportHolder, detail.report);
                renderInstagram(instagramHolder, detail.instagram);
                photosHolder.innerHTML = '';
                const photos = Array.isArray(detail.photos) ? detail.photos : [];
                photosHolder.appendChild(photos.length ? buildPhotos(photos) : el('p', 'note', 'Keine Fotos vorhanden.'));
            })
            .catch(() => {
                if (eventModal.dataset.eventId !== event.id) return;
                photosHolder.innerHTML = '';
                photosHolder.appendChild(el('p', 'note', 'Fotos konnten nicht geladen werden.'));
            });
    };

    // Statisches Markup, enthält keine Nutzereingaben
    const NOT_FOUND_MAP = `
        <svg viewBox="0 0 320 180" role="img" aria-label="Schatzkarte: Ein Schiff auf Rädern steht mitten im Binnenland, ein gestrichelter Weg führt zu einem X." focusable="false">
            <path class="nf-paper" d="M12 14 L60 8 L120 14 L190 7 L260 13 L308 9 L312 70 L306 120 L311 168 L250 173 L180 167 L110 174 L50 168 L9 172 L14 110 L8 60 Z" />
            <path class="nf-sea" d="M262 22 q10 -6 20 0 t20 0 M262 34 q10 -6 20 0 t20 0" />
            <g class="nf-ship">
                <path d="M30 118 h52 l-8 16 h-36 z" />
                <path class="nf-mast" d="M56 118 v-42" />
                <path d="M58 80 l22 30 h-22 z" />
                <circle cx="42" cy="139" r="5" />
                <circle cx="70" cy="139" r="5" />
            </g>
            <path class="nf-route" d="M84 132 C 120 150, 140 90, 170 110 S 205 125, 226 102" />
            <g class="nf-x"><path d="M218 88 L242 112 M242 88 L218 112" /></g>
            <g class="nf-skull" transform="translate(207.6 83.2) scale(1.4)">
                <path d="M16 2 C 9.5 2, 5 6.5, 5 12.5 C 5 16, 6.5 18.5, 8.5 20 L 8.5 22.5 L 13 22.5 L 13 20.5 L 15 20.5 L 15 22.5 L 17 22.5 L 17 20.5 L 19 20.5 L 19 22.5 L 23.5 22.5 L 23.5 20 C 25.5 18.5, 27 16, 27 12.5 C 27 6.5, 22.5 2, 16 2 Z" />
                <g class="skull-cutout">
                    <ellipse cx="11.5" cy="12.5" rx="2.4" ry="3" />
                    <ellipse cx="20.5" cy="12.5" rx="2.4" ry="3" />
                    <path d="M16 15 L14.5 18 L17.5 18 Z" />
                </g>
            </g>
        </svg>`;

    // Easter Egg: das X auf der Karte antippen
    const DIG_MESSAGES = [
        'Hier ist nichts vergraben..',
        'Du gräbst immer noch? Die Landratte in dir ist stark.',
        'Immer noch am Graben? Du kannst es wohl nicht lassen.',
        'Vielleicht solltest du aufhören zu graben.',
        'Na gut: Der wahre Schatz sind die Konzerte, die wir unterwegs erleben. Arr!'
    ];

    const buildNotFound = () => {
        const wrap = el('div', 'notfound');

        const map = el('div', 'notfound-map');
        map.innerHTML = NOT_FOUND_MAP;
        const dig = el('button', 'notfound-x');
        dig.type = 'button';
        dig.setAttribute('aria-label', 'Hier graben');
        map.appendChild(dig);
        wrap.appendChild(map);

        wrap.appendChild(el('p', 'notfound-lead', 'Dieses Logbuch-Blatt gibt es nicht. Vielleicht ist der Link verrutscht oder der Kraken hat die Karte gefressen.'));

        const digText = el('p', 'notfound-dig');
        digText.setAttribute('aria-live', 'polite');
        wrap.appendChild(digText);

        let digs = 0;
        dig.addEventListener('click', () => {
            digs += 1;
            digText.textContent = DIG_MESSAGES[Math.min(digs, DIG_MESSAGES.length) - 1];
            if (digs >= DIG_MESSAGES.length) wrap.classList.add('is-found');
        });

        const back = el('button', 'btn btn-primary', 'Zurück zum Logbuch');
        back.type = 'button';
        back.addEventListener('click', () => window.bpModal.close(eventModal));
        wrap.appendChild(back);

        return wrap;
    };

    const showEventNotFound = () => {
        if (!eventModal || !window.bpModal) return;
        eventModal.dataset.eventId = '';
        eventModalTitle.textContent = '404. Falscher Kurs, Landratte!';
        eventModalBody.innerHTML = '';
        eventModalBody.appendChild(buildNotFound());
        window.bpModal.open(eventModal);
    };

    // Öffnet bzw. schließt das Modal passend zur aktuellen URL
    const syncModalWithUrl = () => {
        if (!eventModal || !window.bpModal) return;
        const id = getEventParam();
        if (!id) {
            window.bpModal.close(eventModal);
            return;
        }
        const event = detailEvents.get(id);
        if (event) showEventDetail(event, false);
        else showEventNotFound();
    };

    if (eventModal) {
        eventModal.addEventListener('modal:close', () => {
            closeLightbox(false);
            if (!getEventParam()) return;
            if (history.state && history.state.bpEvent) {
                history.back();
            } else {
                history.replaceState(null, '', window.location.pathname + window.location.hash);
            }
        });
        window.addEventListener('popstate', syncModalWithUrl);
    }

    const buildTimelineItem = (event) => {
        const li = el('li', `event ${event.type === 'festival' ? 'event-festival' : 'event-concert'}`);
        const content = el('div', 'timeline-content');
        content.appendChild(buildMeta(event));
        content.appendChild(el('h3', null, event.title));
        buildEventDetails(event).forEach((node) => content.appendChild(node));

        if (detailEvents.has(event.id)) {
            const link = el('a', 'event-details-link', 'Details ansehen');
            link.href = eventUrl(event.id);
            link.setAttribute('aria-label', `Details zu ${event.title} ansehen`);
            link.addEventListener('click', (e) => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                showEventDetail(event, true);
            });
            content.appendChild(link);
        }

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
            events.forEach((event) => {
                if (event.id && parseISODate(event.datetime) < today) detailEvents.set(event.id, event);
            });
            renderUpcomingEvent(events, today);
            renderPastEvents(events, today);
            if (getEventParam()) syncModalWithUrl();
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

/**
 * Musik (Playlists & Featured Album)
 * Lädt music.json; Streaming-Links werden nur angezeigt, wenn sie konfiguriert sind.
 */
(function () {
    'use strict';

    const playlistsContainer = document.getElementById('playlists-container');
    const featuredContainer = document.getElementById('featured-album-container');

    if (!playlistsContainer && !featuredContainer) {
        return;
    }

    // Reihenfolge entspricht der Anzeige der Buttons
    const SERVICES = {
        apple: { label: 'Apple Music', icon: 'icon-apple', className: 'stream-btn-apple' },
        spotify: { label: 'Spotify', icon: 'icon-spotify', className: 'stream-btn-spotify' },
        youtube: { label: 'YouTube', icon: 'icon-youtube', className: 'stream-btn-youtube' }
    };

    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const isHttpsUrl = (value) => typeof value === 'string' && /^https:\/\//.test(value);

    const buildIcon = (iconId, size) => {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.setAttribute('focusable', 'false');
        const use = document.createElementNS(ns, 'use');
        use.setAttribute('href', `#${iconId}`);
        svg.appendChild(use);
        return svg;
    };

    const externalLink = (className, url) => {
        const link = el('a', className);
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        return link;
    };

    const buildPlaylistCard = (playlist) => {
        const service = SERVICES[playlist.service];
        if (!service || !isHttpsUrl(playlist.url) || !playlist.title) return null;

        const li = el('li');
        const card = externalLink('playlist-card', playlist.url);

        const icon = el('span', 'playlist-icon');
        icon.setAttribute('aria-hidden', 'true');
        icon.appendChild(buildIcon(service.icon, 28));
        card.appendChild(icon);

        const text = el('span', 'playlist-text');
        text.appendChild(el('span', 'playlist-label', `${service.label} · Playlist`));
        text.appendChild(el('span', 'playlist-title', playlist.title));
        if (playlist.description) text.appendChild(el('span', 'playlist-desc', playlist.description));
        card.appendChild(text);

        const cta = el('span', 'playlist-cta', '▶');
        cta.setAttribute('aria-hidden', 'true');
        card.appendChild(cta);
        card.appendChild(el('span', 'visually-hidden', `Playlist auf ${service.label} öffnen (öffnet in neuem Tab)`));

        li.appendChild(card);
        return li;
    };

    const renderPlaylists = (playlists) => {
        if (!playlistsContainer) return;
        playlistsContainer.innerHTML = '';

        const items = (Array.isArray(playlists) ? playlists : []).map(buildPlaylistCard).filter(Boolean);
        if (!items.length) {
            playlistsContainer.appendChild(el('p', 'note', 'Aktuell sind keine Playlists verfügbar.'));
            return;
        }

        const list = el('ul', 'playlists');
        list.setAttribute('role', 'list');
        items.forEach((item) => list.appendChild(item));
        playlistsContainer.appendChild(list);
    };

    const buildStreamLinks = (links) => {
        const items = Object.keys(SERVICES)
            .filter((key) => links && isHttpsUrl(links[key]))
            .map((key) => {
                const service = SERVICES[key];
                const li = el('li');
                const link = externalLink(`stream-btn ${service.className}`, links[key]);

                const icon = el('span', 'stream-btn-icon');
                icon.setAttribute('aria-hidden', 'true');
                icon.appendChild(buildIcon(service.icon, 18));
                link.appendChild(icon);
                link.appendChild(el('span', null, service.label));
                link.appendChild(el('span', 'visually-hidden', '(öffnet in neuem Tab)'));

                li.appendChild(link);
                return li;
            });
        if (!items.length) return null;

        const list = el('ul', 'featured-links');
        list.setAttribute('role', 'list');
        list.setAttribute('aria-label', 'Album auf Streaming-Diensten anhören');
        items.forEach((item) => list.appendChild(item));
        return list;
    };

    const renderFeaturedAlbum = (album) => {
        if (!featuredContainer) return;
        featuredContainer.innerHTML = '';

        if (!album || !album.artist || !album.title) {
            featuredContainer.appendChild(el('p', 'note', 'Aktuell ist kein Album ausgewählt.'));
            return;
        }

        const article = el('article', 'featured-album');

        const cover = el('span', 'featured-cover');
        cover.setAttribute('aria-hidden', 'true');
        cover.appendChild(el('span', 'featured-cover-icon', '🎧'));
        const hint = el('span', 'featured-cover-hint');
        hint.appendChild(el('span', 'featured-cover-artist', album.artist.toUpperCase()));
        hint.appendChild(el('span', 'featured-cover-title', album.title));
        cover.appendChild(hint);
        article.appendChild(cover);

        const info = el('div', 'featured-info');
        info.appendChild(el('span', 'featured-eyebrow', album.year ? `Featured Album · ${album.year}` : 'Featured Album'));
        info.appendChild(el('p', 'featured-artist', album.artist));
        info.appendChild(el('p', 'featured-album-title', album.title));
        if (album.description) info.appendChild(el('p', 'featured-desc', album.description));
        const links = buildStreamLinks(album.links);
        if (links) info.appendChild(links);
        article.appendChild(info);

        featuredContainer.appendChild(article);
    };

    fetch('music.json')
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then((data) => {
            renderPlaylists(data.playlists);
            renderFeaturedAlbum(data.featuredAlbum);
        })
        .catch(() => {
            const errorMsg = 'Musik-Einträge konnten nicht geladen werden.';
            [playlistsContainer, featuredContainer].forEach((container) => {
                if (!container) return;
                container.innerHTML = '';
                container.appendChild(el('p', 'note', errorMsg));
            });
        });
})();
