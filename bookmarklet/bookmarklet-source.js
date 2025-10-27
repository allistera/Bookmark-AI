/**
 * Bookmark-AI Bookmarklet (Source)
 *
 * This is the readable source code for the bookmarklet.
 * To use this as a bookmarklet, you need to:
 * 1. Minify the code
 * 2. Replace API_URL with your deployed Cloudflare Worker URL
 * 3. Prefix with 'javascript:'
 * 4. URL-encode if needed (though most browsers handle this)
 *
 * Or use the pre-built version:
 * - bookmarklet-production.js (template for your production URL)
 */

(function() {
    // Configuration - replace with your deployed Cloudflare Worker URL
    const API_URL = 'YOUR_WORKER_URL/api/bookmarks';

    const currentUrl = window.location.href;

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

    // Handle analyze button click
    document.getElementById('analyze-btn').addEventListener('click', function() {
        const createTodoistTask = document.getElementById('todoist-checkbox').checked;

        // Show loading state
        modal.innerHTML = `
            <div style="text-align:center;">
                <h2 style="color:#667eea;margin-bottom:20px;">Analyzing...</h2>
                <div style="border:4px solid #f3f3f3;border-top:4px solid #667eea;border-radius:50%;width:50px;height:50px;animation:spin 1s linear infinite;margin:20px auto;"></div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        // Make API request
        fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: currentUrl,
                createTodoistTask: createTodoistTask
            })
        })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.data) {
            const result = data.data;
            const categories = result.categories ? result.categories.join(', ') : 'N/A';
            const matchedCategory = result.matchedCategory || 'N/A';
            const instapaperStatus = result.instapaper?.saved ?
                '<span style="color:#10b981;">✓ Saved</span>' :
                result.instapaper?.error ?
                '<span style="color:#ef4444;">✗ Error</span>' :
                '<span style="color:#6b7280;">Not saved</span>';

            const todoistStatus = result.todoist?.created ?
                '<span style="color:#10b981;">✓ Task created</span>' :
                result.todoist?.error ?
                '<span style="color:#ef4444;">✗ Error: ' + result.todoist.error + '</span>' :
                null;

            modal.innerHTML = `
                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                        <h2 style="color:#667eea;margin:0;">Analysis</h2>
                        <button class="bookmark-ai-close-btn"
                                style="background:#ef4444;color:white;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:20px;">×</button>
                    </div>

                    <div style="margin-bottom:15px;">
                        <strong style="color:#764ba2;">Title:</strong>
                        <p style="margin:5px 0 0 0;">${result.title}</p>
                    </div>

                    <div style="margin-bottom:15px;">
                        <strong style="color:#764ba2;">Content Type:</strong>
                        <p style="margin:5px 0 0 0;">
                            <span style="background:#e6f7ff;padding:4px 8px;border-radius:4px;">${result.contentType}</span>
                        </p>
                    </div>

                    <div style="margin-bottom:15px;">
                        <strong style="color:#764ba2;">Summary:</strong>
                        <p style="margin:5px 0 0 0;">${result.summary}</p>
                    </div>

                    <div style="margin-bottom:15px;">
                        <strong style="color:#764ba2;">Categories:</strong>
                        <p style="margin:5px 0 0 0;">${categories}</p>
                    </div>

                    ${result.matchedCategory ? `
                    <div style="margin-bottom:15px;">
                        <strong style="color:#764ba2;">Matched:</strong>
                        <p style="margin:5px 0 0 0;font-family:monospace;font-size:0.9em;">${matchedCategory}</p>
                    </div>
                    ` : ''}

                    <div style="margin-bottom:15px;">
                        <strong style="color:#764ba2;">Instapaper:</strong>
                        <p style="margin:5px 0 0 0;">${instapaperStatus}</p>
                    </div>

                    ${todoistStatus ? `
                    <div style="margin-bottom:15px;">
                        <strong style="color:#764ba2;">Todoist:</strong>
                        <p style="margin:5px 0 0 0;">${todoistStatus}</p>
                    </div>
                    ` : ''}

                    <button class="bookmark-ai-close-btn"
                            style="background:#667eea;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;width:100%;margin-top:20px;">
                        Close
                    </button>
                </div>
            `;
        } else {
            throw new Error(data.error || 'Failed to analyze');
        }
    })
        .catch(error => {
            modal.innerHTML = `
                <div>
                    <h2 style="color:#ef4444;margin-bottom:20px;">Error</h2>
                    <p style="margin-bottom:20px;">${error.message}</p>
                    <button class="bookmark-ai-close-btn"
                            style="background:#ef4444;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;width:100%;">
                        Close
                    </button>
                </div>
            `;
        });
    });
})();
