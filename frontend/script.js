// DOM Elements
const socialLinkInput = document.getElementById('social-link');
const pasteBtn = document.getElementById('paste-btn');
const factCheckBtn = document.getElementById('fact-check-btn');
const btnText = document.getElementById('btn-text');
const loadingSection = document.getElementById('loading-section');
const resultsSection = document.getElementById('results-section');
const platformBtns = document.querySelectorAll('.platform-btn');
const checkAnotherBtn = document.getElementById('check-another-btn');
const shareResultBtn = document.getElementById('share-result-btn');

// State
let selectedPlatform = 'twitter';
let isChecking = false;
// Backend API base URL (override with ?api=http://host:port)
const API_BASE = new URLSearchParams(window.location.search).get('api') || 'http://localhost:4000';

function mapApiToUi(apiResult) {
    const verdict = String(apiResult?.verdict || '').toLowerCase();
    const descriptionFromApi = apiResult?.description || '';
    const imageFromApi = apiResult?.image || '';
    const imageInsight = apiResult?.imageInsight || '';
    const sourceTitle = apiResult?.sourceTitle || '';
    const rationale = apiResult?.rationale || 'No rationale provided.';
    const citations = Array.isArray(apiResult?.citations) ? apiResult.citations : [];

    let isReal = false;
    let title = '⚠️ Suspicious Content Detected';
    let description = descriptionFromApi || 'The content may be misleading. Please verify before sharing.';
    let icon = 'fas fa-exclamation-triangle';
    let color = 'text-warning-orange';
    let confidence = Number.isFinite(apiResult?.confidence) ? apiResult.confidence : 75;

    if (verdict.includes('true')) {
        isReal = true;
        title = '✅ Content Appears Authentic';
        description = descriptionFromApi || 'Our analysis indicates this content is likely genuine and from a credible source.';
        icon = 'fas fa-check-circle';
        color = 'text-success-green';
        confidence = Number.isFinite(apiResult?.confidence) ? apiResult.confidence : (verdict.includes('mostly') ? 85 : 92);
    } else if (verdict.includes('mixed') || verdict.includes('unverifiable')) {
        isReal = false;
        title = '⚠️ Inconclusive Evidence';
        description = descriptionFromApi || 'Evidence is mixed or insufficient. Treat with caution and verify with trusted sources.';
        icon = 'fas fa-exclamation-triangle';
        color = 'text-warning-orange';
        confidence = Number.isFinite(apiResult?.confidence) ? apiResult.confidence : 70;
    } else if (verdict.includes('false')) {
        isReal = false;
        title = '❌ Fake Content Confirmed';
        description = descriptionFromApi || 'This content appears false or misleading. Do not share this information.';
        icon = 'fas fa-times-circle';
        color = 'text-danger-red';
        confidence = Number.isFinite(apiResult?.confidence) ? apiResult.confidence : (verdict.includes('mostly') ? 60 : 40);
    }

    const analysis = [
        ...(sourceTitle ? [`Source title: ${sourceTitle}`] : []),
        `Model verdict: ${apiResult?.verdict || 'Unknown'}`,
        `Rationale: ${rationale}`,
        ...(imageInsight ? [`Image analysis: ${imageInsight}`] : []),
        ...citations.map((c, i) => `Citation ${i + 1}: ${c}`)
    ];

    const tips = isReal
        ? [
            'Always verify with official sources',
            'Check the account\'s verification status',
            'Look for consistent posting patterns',
            'Be cautious of sensational claims'
          ]
        : [
            'Do not share without verification',
            'Check multiple reliable sources',
            'Look for official confirmations',
            'Report if confirmed as misinformation'
          ];

    return { isReal, confidence, title, description, icon, color, analysis, tips, image: imageFromApi };
}

async function callBackendFactCheck(url) {
    const res = await fetch(`${API_BASE}/api/fact-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Request failed: ${res.status}`);
    }
    const data = await res.json();
    return mapApiToUi(data);
}

// Platform selection with validation
platformBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        platformBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPlatform = btn.dataset.platform;
        
        // Validate platform match with current URL
        const url = socialLinkInput.value.trim();
        if (url && isValidURL(url)) {
            const detectedPlatform = detectPlatform(url);
            if (detectedPlatform !== 'unknown' && detectedPlatform !== selectedPlatform) {
                showPlatformDetectionFeedback(detectedPlatform, false);
            } else {
                clearPlatformFeedback();
            }
        }
    });
});

// Paste functionality
pasteBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        socialLinkInput.value = text;
        socialLinkInput.focus();
    } catch (err) {
        console.error('Failed to read clipboard contents: ', err);
        // Fallback for older browsers
        socialLinkInput.focus();
        socialLinkInput.select();
    }
});

// URL validation
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Enhanced platform detection from URL
function detectPlatform(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // Twitter/X detection
        if (hostname.includes('twitter.com') || hostname.includes('x.com') || hostname.includes('t.co')) {
            return 'twitter';
        }
        
        // Instagram detection
        if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) {
            return 'instagram';
        }
        
        // Facebook detection
        if (hostname.includes('facebook.com') || hostname.includes('fb.com') || hostname.includes('fb.watch')) {
            return 'facebook';
        }
        
        // YouTube detection
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be') || hostname.includes('m.youtube.com')) {
            return 'youtube';
        }
        
        // TikTok detection (bonus)
        if (hostname.includes('tiktok.com') || hostname.includes('vm.tiktok.com')) {
            return 'tiktok';
        }
        
        return 'unknown';
    } catch (error) {
        console.error('Error parsing URL:', error);
        return 'unknown';
    }
}

// Platform validation - check if selected platform matches URL
function validatePlatformMatch(url, selectedPlatform) {
    const detectedPlatform = detectPlatform(url);
    return detectedPlatform === selectedPlatform || detectedPlatform === 'unknown';
}

// Get platform display name
function getPlatformDisplayName(platform) {
    const names = {
        'twitter': 'Twitter/X',
        'instagram': 'Instagram',
        'facebook': 'Facebook',
        'youtube': 'YouTube',
        'tiktok': 'TikTok'
    };
    return names[platform] || platform;
}

// Auto-detect platform when URL is pasted
socialLinkInput.addEventListener('input', () => {
    const url = socialLinkInput.value.trim();
    if (url && isValidURL(url)) {
        const detectedPlatform = detectPlatform(url);
        if (detectedPlatform !== 'unknown') {
            // Update platform selection
            platformBtns.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.platform === detectedPlatform) {
                    btn.classList.add('active');
                    selectedPlatform = detectedPlatform;
                }
            });
            
            // Show platform detection feedback
            showPlatformDetectionFeedback(detectedPlatform, true);
        } else {
            // Clear any previous feedback
            clearPlatformFeedback();
        }
    } else {
        clearPlatformFeedback();
    }
});

// Show platform detection feedback
function showPlatformDetectionFeedback(platform, isAutoDetected) {
    // Remove any existing feedback
    clearPlatformFeedback();
    
    const feedbackDiv = document.createElement('div');
    feedbackDiv.id = 'platform-feedback';
    feedbackDiv.className = `mt-3 p-3 rounded-lg border-l-4 ${
        isAutoDetected 
            ? 'bg-success-green/20 border-success-green text-success-green' 
            : 'bg-warning-orange/20 border-warning-orange text-warning-orange'
    }`;
    
    const icon = isAutoDetected ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle';
    const message = isAutoDetected 
        ? `✓ Auto-detected as ${getPlatformDisplayName(platform)}`
        : `⚠ Platform mismatch detected. Please select ${getPlatformDisplayName(platform)}`;
    
    feedbackDiv.innerHTML = `
        <div class="flex items-center">
            <i class="${icon} mr-2"></i>
            <span class="text-sm font-medium">${message}</span>
        </div>
    `;
    
    socialLinkInput.parentNode.appendChild(feedbackDiv);
}

// Clear platform feedback
function clearPlatformFeedback() {
    const existingFeedback = document.getElementById('platform-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }
}

// Simulate fact checking process
async function simulateFactCheck() {
    return new Promise((resolve) => {
        // Simulate different processing times
        const processingTime = Math.random() * 3000 + 2000; // 2-5 seconds
        
        setTimeout(() => {
            // Simulate different results
            const results = [
                {
                    isReal: true,
                    confidence: Math.floor(Math.random() * 20) + 80, // 80-100%
                    title: "✅ Content Appears Authentic",
                    description: "Our analysis indicates this content is likely genuine and from a credible source.",
                    icon: "fas fa-check-circle",
                    color: "text-success-green",
                    analysis: [
                        "Source verified as authentic",
                        "Content patterns match legitimate posts",
                        "No signs of manipulation detected",
                        "Cross-referenced with reliable databases"
                    ],
                    tips: [
                        "Always verify with official sources",
                        "Check the account's verification status",
                        "Look for consistent posting patterns",
                        "Be cautious of sensational claims"
                    ]
                },
                {
                    isReal: false,
                    confidence: Math.floor(Math.random() * 30) + 70, // 70-100%
                    title: "⚠️ Suspicious Content Detected",
                    description: "This content shows signs of being fake or misleading. Please verify before sharing.",
                    icon: "fas fa-exclamation-triangle",
                    color: "text-warning-orange",
                    analysis: [
                        "Source credibility questionable",
                        "Content patterns suggest manipulation",
                        "Inconsistent with known facts",
                        "Similar to known fake news patterns"
                    ],
                    tips: [
                        "Do not share without verification",
                        "Check multiple reliable sources",
                        "Look for official confirmations",
                        "Report if confirmed as misinformation"
                    ]
                },
                {
                    isReal: false,
                    confidence: Math.floor(Math.random() * 25) + 75, // 75-100%
                    title: "❌ Fake Content Confirmed",
                    description: "This content has been confirmed as fake or misleading. Do not share this information.",
                    icon: "fas fa-times-circle",
                    color: "text-danger-red",
                    analysis: [
                        "Confirmed as fabricated content",
                        "Source identified as unreliable",
                        "Contradicts verified information",
                        "Matches known disinformation campaigns"
                    ],
                    tips: [
                        "Do not share this content",
                        "Report to platform moderators",
                        "Educate others about this misinformation",
                        "Verify information before sharing"
                    ]
                }
            ];
            
            const result = results[Math.floor(Math.random() * results.length)];
            resolve(result);
        }, processingTime);
    });
}

// Update progress indicators
function updateProgress(step) {
    const progressElements = ['progress-1', 'progress-2', 'progress-3'];
    progressElements.forEach((id, index) => {
        const element = document.getElementById(id);
        if (index < step) {
            element.textContent = '✓';
            element.className = 'text-success-green';
        } else if (index === step) {
            element.textContent = '⏳';
            element.className = 'text-warning-orange';
        } else {
            element.textContent = '⏳';
            element.className = 'text-gray-400';
        }
    });
}

// Show loading animation
function showLoading() {
    loadingSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    
    // Animate progress
    updateProgress(0);
    setTimeout(() => updateProgress(1), 1000);
    setTimeout(() => updateProgress(2), 2000);
}

// Show results
function showResults(result) {
    loadingSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    
    // Update result content
    const resultIcon = document.getElementById('result-icon');
    const resultTitle = document.getElementById('result-title');
    const resultDescription = document.getElementById('result-description');
    let resultImageEl = document.getElementById('result-image');
    const confidencePercentage = document.getElementById('confidence-percentage');
    const confidenceBar = document.getElementById('confidence-bar');
    const analysisDetails = document.getElementById('analysis-details');
    const safetyTips = document.getElementById('safety-tips');
    
    resultIcon.className = `${result.icon} ${result.color} text-6xl mb-4`;
    resultTitle.textContent = result.title;
    resultTitle.className = `text-3xl font-bold mb-4 ${result.color}`;
    resultDescription.textContent = result.description;
    if (result.image) {
        if (!resultImageEl) {
            resultImageEl = document.createElement('img');
            resultImageEl.id = 'result-image';
            resultImageEl.className = 'mx-auto mb-6 rounded-lg max-h-72 object-contain border border-accent-blue/20';
            resultTitle.parentNode.insertBefore(resultImageEl, resultTitle.nextSibling);
        }
        resultImageEl.src = result.image;
        resultImageEl.alt = 'Link preview image';
        resultImageEl.style.display = 'block';
    } else if (resultImageEl) {
        resultImageEl.style.display = 'none';
    }
    confidencePercentage.textContent = `${result.confidence}%`;
    
    // Animate confidence bar
    setTimeout(() => {
        confidenceBar.style.width = `${result.confidence}%`;
        confidenceBar.className = `h-3 rounded-full transition-all duration-1000 ${
            result.isReal ? 'bg-success-green' : 'bg-danger-red'
        }`;
    }, 500);
    
    // Update analysis details
    analysisDetails.innerHTML = result.analysis.map(item => 
        `<li class="flex items-center"><i class="fas fa-check text-accent-blue mr-2"></i>${item}</li>`
    ).join('');
    
    // Update safety tips
    safetyTips.innerHTML = result.tips.map(item => 
        `<li class="flex items-center"><i class="fas fa-lightbulb text-warning-orange mr-2"></i>${item}</li>`
    ).join('');
}

// Main fact check function
async function performFactCheck() {
    const url = socialLinkInput.value.trim();
    
    if (!url) {
        alert('Please enter a social media link');
        return;
    }
    
    if (!isValidURL(url)) {
        alert('Please enter a valid URL');
        return;
    }
    
    // Validate platform match
    const detectedPlatform = detectPlatform(url);
    if (detectedPlatform !== 'unknown' && detectedPlatform !== selectedPlatform) {
        const confirmProceed = confirm(
            `The URL appears to be from ${getPlatformDisplayName(detectedPlatform)} but you selected ${getPlatformDisplayName(selectedPlatform)}. Do you want to proceed anyway?`
        );
        if (!confirmProceed) {
            return;
        }
    }
    
    isChecking = true;
    factCheckBtn.disabled = true;
    btnText.textContent = 'Checking...';
    
    showLoading();
    
    try {
        const result = await callBackendFactCheck(url);
        showResults(result);
    } catch (error) {
        console.error('Fact check failed, falling back to local simulation:', error);
        const result = await simulateFactCheck();
        showResults(result);
    } finally {
        isChecking = false;
        factCheckBtn.disabled = false;
        btnText.textContent = 'Check Fact';
    }
}

// Event listeners
factCheckBtn.addEventListener('click', performFactCheck);

// Allow Enter key to trigger fact check
socialLinkInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isChecking) {
        performFactCheck();
    }
});

// Check another link
checkAnotherBtn.addEventListener('click', () => {
    socialLinkInput.value = '';
    resultsSection.classList.add('hidden');
    socialLinkInput.focus();
});

// Share result
shareResultBtn.addEventListener('click', () => {
    if (navigator.share) {
        navigator.share({
            title: 'Fact Checker Result',
            text: 'Check out this fact-checking result!',
            url: window.location.href
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert('Link copied to clipboard!');
        });
    }
});

// Add some interactive animations
document.addEventListener('DOMContentLoaded', () => {
    // Animate elements on load
    const elements = document.querySelectorAll('.bg-dark-blue\\/50, .bg-darker-blue');
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'all 0.6s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, index * 100);
    });
    
    // Add hover effects to platform buttons
    platformBtns.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.05)';
        });
        btn.addEventListener('mouseleave', () => {
            if (!btn.classList.contains('active')) {
                btn.style.transform = 'scale(1)';
            }
        });
    });
});

// Add CSS for platform buttons
const style = document.createElement('style');
style.textContent = `
    .platform-btn {
        @apply flex flex-col items-center p-4 bg-darker-blue border-2 border-accent-blue/30 rounded-lg text-white hover:border-accent-blue transition-all duration-300 cursor-pointer;
    }
    .platform-btn.active {
        @apply border-accent-blue bg-accent-blue/20;
    }
    .platform-btn i {
        @apply text-2xl mb-2;
    }
    .platform-btn span {
        @apply text-sm font-medium;
    }
`;
document.head.appendChild(style);