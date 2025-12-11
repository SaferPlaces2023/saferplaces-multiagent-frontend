// ChatSettings: gestione switch globali e sotto-tool, persistenza e change event.
// Evento emesso: 'chatsettings:change' con { enabled: { families: {...}, tools: Set([...]) } }

const ChatSettings = (() => {
    const LS_KEY = 'chat_settings_v1';
    let syncDone = false;

    const state = {
        families: { sp: true, sc: true, geo: true },
        tools: new Set(['sp:digital_twin', 'sp:saferrain', 'sc:nowcast', 'sc:forecast'])
    };

    const toolSwitchIds = [
        'tool_sp_digital_twin', 'tool_sp_saferrain', 'tool_sp_saferbuildings',
        'tool_sc_dpc_retriever', 'tool_sc_icon2i_retriever',
        'tool_geospatial_ops'
    ]


    // refs
    let scPanel;
    let spAll, scAll, geoAll, subSP, subSC;

    let askToolDescriptionTemplate = (tool_name) => `
Explain in detail the tool called ${tool_name}. Your response must include the following sections:

1. A clear description of what the tool is for and the situations or use cases where it is useful.

2. A complete explanation of how the tool can be parameterized, describing every available parameter, what it represents, and how it affects the tool's behavior.

3. Provide at least two example of natural language prompts for using this tool:
   - one simple/basic example,
   - one advanced example with full or complex parameterization.

4. Explain what outputs the tool produces, in which format, and what these outputs represent.

Structure your response clearly, using well-separated sections and concise explanations.
`;
    const tooltipDataset = {
        'SaferPlacesApiToolsTooltip': {
            text: "The Safer Places API offers tools for creating digital twins, simulating floods, and detecting flooded buildings to support disaster planning and emergency response with geospatial insights.",
            askBotPrompt: "Provide a description of the SaferPlaces Tools family. Describe the family general purpose, the tools it contains, and their functionalities. Keep the description concise and focused on the tool family scope."
        },
        'DigitalTwinToolTooltip': {
            text: "The Digital Twin Tool creates a virtual representation of a geographical area, integrating real-time data to simulate and analyze flood scenarios. It supports disaster planning and response by visualizing potential impacts and resource needs.",
            askBotPrompt: askToolDescriptionTemplate('Digital-Twin Tool')
        },
        'SaferRainToolTooltip': {
            text: "The Safer Rain Tool provides flood simulation capabilities based on rainfall data, helping to predict and visualize flood risks in specific areas. It is essential for emergency planning and response, allowing for proactive measures.",
            askBotPrompt: askToolDescriptionTemplate('Safer-Rain Tool')
        },
        'SaferBuildingsToolTooltip': {
            text: "The Safer Buildings Tool detects flooded buildings using geospatial data and flood simulations. It identifies at-risk structures, enabling targeted emergency response and resource allocation during flood events.",
            askBotPrompt: askToolDescriptionTemplate('Safer-Buildings Tool')
        },

        'SaferCastApiToolsTooltip': {
            text: "The SaferCast tools provide high-resolution forecasts and real-time meteorological data to support disaster preparedness and emergency response. Combining the ICON-2I forecast system with DPC observational data, they enhance monitoring and decision-making during severe weather events.",
            askBotPrompt: "Provide a description of the SaferCast Tools family. Describe the family general purpose, the tools it contains, and their functionalities. Keep the description concise and focused on the tool family scope."
        },
        'DPCRetrieverToolTooltip': {
            text: "The DPC Retriever Tool retrieves meteorological datasets from the Italian Civil Protection Department for selected areas, supporting weather impact analysis and environmental assessments.",
            askBotPrompt: askToolDescriptionTemplate('DPC Retriever Tool')
        },
        'ICON2IRetrieverToolTooltip': {
            text: "The ICON2I Retriever Tool retrieves forecast data from the ICON-2I model, providing weather parameters like precipitation, temperature, wind, and cloud cover for chosen areas and time ranges.",
            askBotPrompt: askToolDescriptionTemplate('ICON-2I Retriever Tool')
        },

        'GeospatialOpsToolTooltip': {
            text: "The Geospatial Ops Tool performs geospatial analyses from natural-language requests, enabling tasks like spatial analysis, geometric operations, and vector/raster manipulation. It simplifies workflows by allowing users to specify formats, CRS, and outputs without needing programming skills.",
            askBotPrompt: askToolDescriptionTemplate('Geospatial Ops Tool')
        }
    }

    function init() {
        scPanel = document.getElementById('chatSettings');
        spAll = document.getElementById('csSaferPlacesAll');
        scAll = document.getElementById('csSaferCastAll');
        geoAll = document.getElementById('csGeoAll');

        subSP = Array.from(document.querySelectorAll('.cs-sub.cs-sp'));
        subSC = Array.from(document.querySelectorAll('.cs-sub.cs-sc'));

        // load saved
        load();

        // apply UI from state
        // syncUI();

        // wiring
        spAll?.addEventListener('change', () => { state.families.sp = spAll.checked; setFamilyEnabled('sp', spAll.checked); saveAndEmit(); });
        scAll?.addEventListener('change', () => { state.families.sc = scAll.checked; setFamilyEnabled('sc', scAll.checked); saveAndEmit(); });
        geoAll?.addEventListener('change', () => { state.families.geo = geoAll.checked; saveAndEmit(); });

        subSP.forEach(el => el.addEventListener('change', () => {
            toggleTool(el.dataset.key, el.checked);
            saveAndEmit();
        }));
        subSC.forEach(el => el.addEventListener('change', () => {
            toggleTool(el.dataset.key, el.checked);
            saveAndEmit();
        }));
        document.addEventListener('chatsettings:change', (e) => setAvailableTools());


        scPanel.querySelectorAll(".tooltip-icon-wrapper > .settings-info").forEach(el => {
            el.addEventListener("mouseenter", (e) => showTooltip(e, e.target.dataset.tooltipId));
        });
        
        // scPanel.querySelectorAll('.available-tools-switch').forEach(el => { el.addEventListener('click', (e) => { 
        //     setAvailableTools(); // TODO: to be implemented
        // }); });

        scPanel.querySelector('#csConfirmToolExecution').addEventListener('click', () => { toggleConfirmToolExecution(); });
    }


    function showTooltip(e, tooltipId) {
        let text = tooltipDataset[tooltipId]?.text;
        let askBotPrompt = tooltipDataset[tooltipId]?.askBotPrompt;
        
        if (!text) return;

        const tooltip = document.createElement("div");
        tooltip.className = "ai-chat-settings-tooltip";
        let pad = -5;
        tooltip.style.left = e.clientX + pad + "px";
        tooltip.style.top = e.clientY + pad + "px";
        tooltip.style.right = "32px";
        tooltip.textContent = text;
        tooltip.style.display = "block";
        tooltip.style.opacity = "0";
        tooltip.style.transition = "opacity 0.2s ease-in-out";

        if (askBotPrompt) {
            const askBotWrapper = document.createElement("span");
            askBotWrapper.className = "bot-help-wrapper icon-ask-bot";
            askBotWrapper.dataset.askBotPrompt = tooltipDataset[tooltipId]?.askBotPrompt || "";
            const askBotIcon = document.createElement("span");
            askBotIcon.className = "material-symbols-outlined ms-2 fs-6 fw-light icon-fix";
            askBotIcon.textContent = "robot_2";
            const askBotText = document.createElement("span");
            askBotText.className = "bot-help-text ms-1";
            askBotText.textContent = "Ask the bot";
            askBotWrapper.appendChild(askBotIcon);
            askBotWrapper.appendChild(askBotText);
            askBotWrapper.addEventListener('click', (e) => { AIChat.invokeSend(askBotPrompt); });
            tooltip.appendChild(askBotWrapper);
        }
        tooltip.addEventListener("mouseleave", hideTooltip);

        document.getElementById('appRoot').appendChild(tooltip);
        setTimeout(() => { tooltip.style.opacity = "1"; }, 10);
    }
    function hideTooltip() {
        const tooltips = document.querySelectorAll('.ai-chat-settings-tooltip');
        tooltips.forEach(tooltip => {
            tooltip.style.opacity = "0";
            setTimeout(() => {
                tooltip.remove();
            }, 200);
        })
    }


    function setFamilyEnabled(fam, enabled) {
        const list = fam === 'sp' ? subSP : fam === 'sc' ? subSC : [];
        list.forEach(el => {
            el.disabled = !enabled;
            if (enabled && !state.tools.has(el.dataset.key)) {
                // non forziamo ON, lasciamo scelta utente — rimuovi commento per forzare:
                // el.checked = true; state.tools.add(el.dataset.key);
            }
            if (!enabled) {
                // non spegniamo lo switch (solo disable), così l'utente ricorda le selezioni
            }
        });
    }

    function toggleTool(key, on) {
        if (!key) return;
        if (on) state.tools.add(key);
        else state.tools.delete(key);
    }

    function syncUI() {
        if (spAll) spAll.checked = !!state.families.sp;
        if (scAll) scAll.checked = !!state.families.sc;
        if (geoAll) geoAll.checked = !!state.families.geo;

        // set sub-switches
        subSP.forEach(el => { el.checked = state.tools.has(el.dataset.key); el.disabled = !state.families.sp; });
        subSC.forEach(el => { el.checked = state.tools.has(el.dataset.key); el.disabled = !state.families.sc; });

        setAvailableTools(); // inizializza gli strumenti disponibili
        // toggleConfirmToolExecution(); // inizializza lo stato del confirm tool execution
    }

    function save() {
        const payload = {
            families: state.families,
            tools: Array.from(state.tools)
        };
        localStorage.setItem(LS_KEY, JSON.stringify(payload));
    }

    function load() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data?.families) state.families = Object.assign({}, state.families, data.families);
            if (Array.isArray(data?.tools)) state.tools = new Set(data.tools);
        } catch { }
    }

    function saveAndEmit() {
        save();
        const detail = {
            enabled: {
                families: Object.assign({}, state.families),
                tools: new Set(state.tools)
            }
        };
        document.dispatchEvent(new CustomEvent('chatsettings:change', { detail }));
    }

    function getState() {
        return {
            families: Object.assign({}, state.families),
            tools: new Set(state.tools)
        };
    }

    function togglePanel() {
        if (!syncDone) {
            const t = Toasts.show(`Syncing chat settings...`);
            setTimeout(() => {
                syncUI();
                syncDone = true;
                Toasts.ok(t, `Chat settings synced.`);
                scPanel.classList.toggle('closed');
            }, 1000);
        } else {
            scPanel.classList.toggle('closed');
        }
    }


    function setAvailableTools() {
        const availableTools = toolSwitchIds
            .map(tsid => document.getElementById(tsid))
            .filter(ts => ts.checked && !ts.disabled)
            .map(ts => ts.dataset.toolName);

        if (availableTools.length > 0) { 
            const LS_THREAD = 'thread_id';
            let thread_id = localStorage.getItem(LS_THREAD)
            fetch(Routes.Agent.STATE(thread_id), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    state_updates: {
                        avaliable_tools: availableTools 
                    }
                })
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to update available tools');
                return response.json();
            })
            .then(data => {
                console.log('Available tools updated:', data);
            })
            .catch(error => {
                console.error('Error updating available tools:', error);
            });
        }
    }

    function toggleConfirmToolExecution() {
        const confirmExecution = document.getElementById('csConfirmToolExecution');
        let isEnabled = confirmExecution.checked;
        const LS_THREAD = 'thread_id';
        let thread_id = localStorage.getItem(LS_THREAD);
        fetch(Routes.Agent.STATE(thread_id), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                state_updates: {
                    confirm_tool_execution: isEnabled
                }
            })
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to update confirm tool execution');
            return response.json();
        })
        .then(data => {
            console.log('Confirm tool execution updated:', data);
        })
        .catch(error => {
            console.error('Error updating confirm tool execution:', error);
        });
    }

    return { init, getState, togglePanel };
})();

// opzionale: auto-init quando il partial è presente
// document.addEventListener('DOMContentLoaded', () => {
//   if (document.getElementById('chatSettings')) ChatSettings.init();
// });
