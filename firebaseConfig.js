let _configCache = null;

export async function getFirebaseConfig() {
    if (_configCache) return _configCache;

    const res = await fetch('/api/firebase-config');
    if (!res.ok) {
        throw new Error(`Failed to load Firebase config: ${res.status}`);
    }

    _configCache = await res.json();
    return _configCache;
}