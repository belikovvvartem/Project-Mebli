export default function handler(req, res) {
    const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID,
    };

    const missing = Object.entries(firebaseConfig)
        .filter(([, v]) => !v)
        .map(([k]) => k);

    if (missing.length > 0) {
        return res.status(500).json({ error: 'Missing env vars: ' + missing.join(', ') });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=300');
    res.status(200).json(firebaseConfig);
}