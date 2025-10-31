/**
 * Bookmark-AI Bookmarklet (Source) - Mobile-Friendly Version
 *
 * This is the readable source code for the bookmarklet.
 * Works on iOS Safari and all mobile browsers by using a redirect approach
 * instead of popups (which are often blocked on mobile).
 *
 * To use this as a bookmarklet, you need to:
 * 1. Minify the code
 * 2. Replace WORKER_URL with your deployed Cloudflare Worker URL
 * 3. Replace API_KEY with your API key
 * 4. Prefix with 'javascript:'
 * 5. URL-encode if needed (though most browsers handle this)
 *
 * Or use the pre-built version:
 * - bookmarklet-production.js (template for your production URL)
 */

(function() {
    // Configuration - replace with your deployed Cloudflare Worker URL and API key
    const WORKER_URL = 'YOUR_WORKER_URL';
    const API_KEY = 'YOUR_API_KEY';
    const currentUrl = window.location.href;
    const currentTitle = document.title;

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'bookmark-ai-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:white;border-radius:12px;padding:30px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    // Initial prompt with Todoist checkbox
    modal.innerHTML = `
        <div>
            <h2 style="color:#667eea;margin-bottom:20px;">Analyze Bookmark</h2>
            <p style="margin-bottom:15px;color:#666;">URL: <span style="word-break:break-all;font-size:0.9em;">${currentUrl}</span></p>

            <div style="margin:20px 0;padding:15px;background:#f7fafc;border-radius:8px;">
                <label style="display:flex;align-items:center;cursor:pointer;">
                    <input type="checkbox" id="todoist-checkbox" style="margin-right:10px;width:18px;height:18px;cursor:pointer;">
                    <span style="color:#333;">Create task in Todoist</span>
                </label>
            </div>

            <div style="display:flex;gap:10px;margin-top:20px;">
                <button id="analyze-btn" style="flex:1;background:#667eea;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:1em;">
                    Analyze
                </button>
                <button class="bookmark-ai-close-btn" style="flex:1;background:#e2e8f0;color:#333;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:1em;">
                    Cancel
                </button>
            </div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on overlay click or close button click
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay || e.target.classList.contains('bookmark-ai-close-btn')) {
            overlay.remove();
        }
    });

    // Handle analyze button click - redirect to bridge page
    document.getElementById('analyze-btn').addEventListener('click', function() {
        const createTodoistTask = document.getElementById('todoist-checkbox').checked;

        // Build bridge URL with parameters
        const params = new URLSearchParams({
            url: currentUrl,
            title: currentTitle,
            todoist: createTodoistTask.toString(),
            apiKey: API_KEY,
            returnUrl: currentUrl
        });

        const bridgeUrl = WORKER_URL + '/bridge?' + params.toString();

        // Redirect to bridge page (works on all mobile browsers)
        window.location.href = bridgeUrl;
    });
})();
