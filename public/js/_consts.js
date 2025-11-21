const Routes = (() => {

    const Agent = (() => {

        let flask_base = '';
        let localhost_base = 'http://localhost:5000';
        let agent_base = 'agent';
        let ngrock_base = ' https://bdc1201eff1b.ngrok-free.app';

        const BASE = flask_base
        const NEWTHREAD = `${BASE}/t`;
        const THREAD = (threadId) => `${BASE}/t/${threadId}`;
        const USER = `${BASE}/user`;
        const LAYERS = (threadId) => `${THREAD(threadId)}/layers`;
        const RENDER = (threadId) => `${THREAD(threadId)}/render`;

        return { BASE, NEWTHREAD, THREAD, USER, LAYERS, RENDER };
    })();

    return { Agent };
})();