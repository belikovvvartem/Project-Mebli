export const config = { runtime: 'edge' };

export default function handler(req) {
    const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID,
    };

    // Check all required vars are set
    const missing = Object.entries(firebaseConfig)
        .filter(([, v]) => !v)
        .map(([k]) => k);

    if (missing.length > 0) {
        return new Response(
            JSON.stringify({ error: 'Missing env vars: ' + missing.join(', ') }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    return new Response(JSON.stringify(firebaseConfig), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            // Optional: cache for 1 hour in CDN, 5 min in browser
            'Cache-Control': 'public, s-maxage=3600, max-age=300',
        },
    });
}