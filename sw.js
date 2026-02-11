const CACHE_NAME = 'fgc-react-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    // 実際の動画ファイルパスをここに列挙する必要があります
    './assets/videos/mid_guard_success.mp4',
    './assets/videos/mid_attack_hit.mp4',
    './assets/videos/low_attack_seq.mp4',
    './assets/videos/throw_tech_success.mp4',
    './assets/videos/throw_hit.mp4',
    './assets/videos/counter_hit_success.mp4',
    './assets/videos/meaty_hit.mp4'
];

// インストール時に全てキャッシュ
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// キャッシュのみを使用（ネットワークには行かない）
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // キャッシュにあればそれを返す。なければ404（ローカル完結のためFetchしない）
            if (response) {
                return response;
            }
            // 開発中はデバッグ用にFetchしても良いが、本番はローカル完結を徹底
            return new Response('Offline content not found', { status: 404 });
        })
    );
});
