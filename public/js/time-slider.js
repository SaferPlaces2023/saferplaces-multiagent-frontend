// TimeSlider: slider temporale con play, velocità, ticks orari e intervalli evidenziati.
// API:
// TimeSlider.init({ startISO, endISO, valueISO?, stepMinutes?:60, intervals?:[{start,end,label,color}] })
// TimeSlider.setRange(startISO, endISO)
// TimeSlider.setValue(iso)
// TimeSlider.setIntervals(list)
// TimeSlider.play(), TimeSlider.pause(), TimeSlider.isPlaying()

const TimeSlider = (() => {
    let el, track, ticks, handle, wrap, tooltip, highlights, playBtn, speedSel, nowLbl, startLbl, endLbl;
    let start = null, end = null, value = null;
    let stepMinutes = 5;
    let timer = null;

    let intervalColors = [
        '#6ee7b7',
        '#60a5fa',
        '#f472b6',
        '#facc15',
        '#fb923c',
        '#f87171',
        '#a78bfa',
        '#34d399',
        '#38bdf8',
        '#c084fc',
    ]

    let timestampRegister = new Map();

    function init({ startISO, endISO, valueISO, stepMinutes: step = 60, intervals = [] }) {
        el = document.getElementById('timeSlider');
        track = document.getElementById('tsTrack');
        ticks = document.getElementById('tsTicks');
        handle = document.getElementById('tsHandle');
        wrap = document.getElementById('tsTrackWrap');
        tooltip = document.getElementById('tsTooltip');
        highlights = document.getElementById('tsHighlights');
        playBtn = document.getElementById('tsPlay');
        speedSel = document.getElementById('tsSpeed');
        nowLbl = document.getElementById('tsNow');
        startLbl = document.getElementById('tsStartLabel');
        endLbl = document.getElementById('tsEndLabel');

        document.getElementById('tsToggleBtn').onclick = () => el.classList.toggle('closed');

        stepMinutes = step || stepMinutes || 60;

        setRange(startISO, endISO);
        setValue(valueISO || startISO);
        setIntervals(intervals);

        // UI
        el.classList.remove('hidden');
        // drag
        enableDrag();
        // play
        playBtn.addEventListener('click', togglePlay);
        speedSel.addEventListener('change', () => { if (isPlaying()) { pause(); play(); } });
        // click su track
        track.addEventListener('pointerdown', onTrackPointer);

        if (intervals.length > 0) {
            el.classList.remove('closed');
            el.classList.remove('disabled');
        }
    }

    function setRange(aISO, bISO) {
        start = new Date(aISO);
        end = new Date(bISO);
        if (!(+start) || !(+end) || end <= start) throw new Error('Time range not valid');
        startLbl.textContent = fmtDate(start);
        endLbl.textContent = fmtDate(end);
        layoutTicks();
        if (value === null || value < start || value > end) setValue(aISO);
    }

    function setValue(iso) {
        value = new Date(iso);
        if (!(+value)) value = new Date(start);
        const p = posPct(value);
        handle.style.left = p + '%';
        nowLbl.textContent = fmtDateTime(value);
        dispatchChange();
    }

    function clearIntervals() {
        highlights.innerHTML = '';
        // ???: timestampRegister.clear();
    }

    function setIntervals(list) {
        // highlights.innerHTML = '';
        let n_intervals = highlights.children.length;
        if (!Array.isArray(list)) return;
        for (const it of list) {
            const s = new Date(it.start), e = new Date(it.end);
            if (!(+s) || !(+e) || e <= start || s >= end) continue;
            const left = Math.max(0, pctBetween(s));
            const right = Math.min(100, pctBetween(e));
            const w = Math.max(0, right - left);
            const div = document.createElement('div');
            div.className = 'ts-highlight';
            div.style.left = left + '%';
            div.style.width = w + '%';
            it.color = it.color || intervalColors[n_intervals++ % intervalColors.length];
            if (it.color) {
                div.style.background = `linear-gradient(180deg, ${hexOr(it.color, .20)}, ${hexOr(it.color, .08)})`;
                div.style.borderLeftColor = hexOr(it.color, .35);
                div.style.borderRightColor = hexOr(it.color, .35);
            }
            // tooltip
            if (it.label) {
                div.addEventListener('pointerenter', (ev) => showTooltip(ev, it.label));
                div.addEventListener('pointermove', (ev) => moveTooltip(ev));
                div.addEventListener('pointerleave', () => hideTooltip());
            }
            highlights.appendChild(div);
        }
    }

    // --- internals ---
    function enableDrag() {
        let dragging = false;
        handle.addEventListener('pointerdown', (e) => {
            dragging = true; handle.setPointerCapture(e.pointerId);
        });
        handle.addEventListener('pointerup', (e) => {
            dragging = false; handle.releasePointerCapture(e.pointerId);
        });
        handle.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            moveToClientX(e.clientX);
        });
    }

    function onTrackPointer(e) {
        moveToClientX(e.clientX);
    }

    function moveToClientX(x) {
        const rect = track.getBoundingClientRect();
        const clampX = Math.max(rect.left, Math.min(x, rect.right));
        const ratio = (clampX - rect.left) / rect.width;
        const ts = start.getTime() + ratio * (end.getTime() - start.getTime());
        const snapped = snapToMinutes(new Date(ts), stepMinutes);
        setValue(snapped.toISOString());
    }

    function layoutTicks() {
        // base: ripetizione ogni 60px = 1h; ridimensioniamo in base alla durata

        const hours = (end - start) / (1000 * 60 * 60);
        const desiredPxPerHour = 60; // target
        const width = track.clientWidth || 600;
        const scale = Math.max(0.4, Math.min(3, width / (hours * desiredPxPerHour)));
        ticks.style.transform = `scaleX(${scale})`;

        // ticks.style.display = 'none'    // !!!: viene brutto a video, disabilito per ora

        // etichette ogni ora + data alle 00
        const labels = track.querySelectorAll('.ts-tick-label');
        labels.forEach(l => l.remove());
        const startH = new Date(start);
        startH.setMinutes(0, 0, 0);
        for (let t = +startH; t <= +end; t += 3600 * 2e3) {
            const dt = new Date(t);
            const p = pctBetween(dt);
            if (p < 0 || p > 100) continue;
            const lab = document.createElement('div');
            lab.className = 'ts-tick-label';
            lab.style.position = 'absolute';
            lab.style.left = p + '%';
            lab.style.top = '25%';
            lab.style.transform = 'translateX(-50%)';
            lab.style.color = '#9aa0a6';
            lab.style.fontSize = '.7rem';
            lab.style.marginTop = '0px';
            lab.textContent = (dt.getHours() === 0) ? fmtDate(dt) : fmtHour(dt);
            track.appendChild(lab);
        }
    }

    function play() {
        if (timer) return;
        const interval = +speedSel.value || 500; // ms per step
        timer = setInterval(() => stepForward(), interval);
        playBtn.innerHTML = '<span class="material-symbols-outlined">pause</span>';
    }
    function pause() {
        if (!timer) return;
        clearInterval(timer); timer = null;
        playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
    }
    function togglePlay() { isPlaying() ? pause() : play(); }
    function isPlaying() { return !!timer; }

    function stepForward() {
        const next = new Date(value.getTime() + stepMinutes * 60 * 1000);
        if (next > end) { pause(); return; }
        setValue(next.toISOString());
    }

    function dispatchChange() {
        document.dispatchEvent(new CustomEvent('timeslider:change', {
            detail: { iso: value.toISOString(), date: new Date(value) }
        }));
    }

    // tooltip
    function showTooltip(ev, text) {
        tooltip.textContent = text;
        tooltip.classList.remove('hidden');
        moveTooltip(ev);
    }
    function moveTooltip(ev) {
        const rect = wrap.getBoundingClientRect();
        tooltip.style.left = (ev.clientX - rect.left) + 'px';
    }
    function hideTooltip() { tooltip.classList.add('hidden'); }

    // utils
    function pctBetween(dt) { return ((dt - start) / (end - start)) * 100; }
    function posPct(dt) { return Math.max(0, Math.min(100, pctBetween(dt))); }
    function snapToMinutes(d, m) {
        const ms = m * 60 * 1000;
        return new Date(Math.round(d.getTime() / ms) * ms);
    }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
    function fmtHour(d) { return `${pad(d.getHours())}:00`; }
    function fmtDateTime(d) { return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
    function hexOr(color, alpha = .2) {
        // accetta hex #rrggbb o CSS color; per semplicità gestiamo solo hex con alpha
        if (/^#([0-9a-f]{6})$/i.test(color)) {
            const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
            return `rgba(${r},${g},${b},${alpha})`;
        }
        return color; // fallback
    }

    // funzione per creare array di date
    function dateRange(start, end, n) {
        const dates = [];
        const step = (end - start) / (n - 1);
        for (let i = 0; i < n; i++) {
            dates.push(new Date(start.getTime() + step * i));
        }
        return dates;
    }

    function registerTimestampItem(isoDate, item) {
        timestampRegister.set(
            isoDate, 
            timestampRegister.has(isoDate) ? [...timestampRegister.get(isoDate), item] : [item]
        );

        if (el && el.classList.contains('disabled')) {
            el.classList.remove('disabled');
        }
    }

    function getTimestampItems(isoDate, itemType = null) {
        const items = timestampRegister.get(isoDate) || [];
        return itemType ? items.filter(it => it.type === itemType) : items;
    }

    // public
    return { init, setRange, setValue, setIntervals, clearIntervals, play, pause, isPlaying, dateRange, timestampRegister, registerTimestampItem, getTimestampItems };
})();
