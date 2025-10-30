const Routes = (() => {

    const Agent = (() => {

        let localhost_base = 'agent'//'http://localhost:5000';
        let ngrock_base = ' https://bdc1201eff1b.ngrok-free.app';

        const BASE = localhost_base
        const NEWTHREAD = `${BASE}/t`;
        const THREAD = (threadId) => `${BASE}/t/${threadId}`;
        const USER = `${BASE}/user`;
        const LAYERS = (threadId) => `${THREAD(threadId)}/layers`;
        const RENDER = (threadId) => `${THREAD(threadId)}/render`;

        return { BASE, NEWTHREAD, THREAD, USER, LAYERS, RENDER };
    })();

    return { Agent };
})();