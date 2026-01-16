document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const sourceLangSelect = document.getElementById('sourceLang');
    const targetLangSelect = document.getElementById('targetLang');
    const micButton = document.getElementById('micButton');
    const micStatus = document.getElementById('micStatus');
    const translateButton = document.getElementById('translateButton');
    const speakButton = document.getElementById('speakButton');
    const copyButton = document.getElementById('copyButton');
    const historyList = document.getElementById('historyList');
    const clearHistoryButton = document.getElementById('clearHistoryButton');

    // --- State ---
    let recognition;
    let isRecording = false;

    // --- 1. TRANSLATION LOGIC (MyMemory API) ---
    async function translateText() {
        const text = inputText.value.trim();
        if (!text) {
            outputText.value = "Please enter some text first.";
            return;
        }

        const source = sourceLangSelect.value;
        const target = targetLangSelect.value;

        if (source === target) {
            outputText.value = text;
            return;
        }

        outputText.value = "Translating...";

        try {
            // MyMemory API: Free, No Key, No CORS issues
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network error");

            const data = await response.json();
            
            if (data.responseData) {
                const result = data.responseData.translatedText;
                outputText.value = result;
                saveToHistory(text, result, source, target);
            } else {
                outputText.value = "Error: API limit reached or invalid response.";
            }
        } catch (error) {
            console.error("Translation Error:", error);
            outputText.value = "Connection Error. Check your internet.";
        }
    }

    // --- 2. SPEECH RECOGNITION (Mic Input) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false; // Stops after you finish a sentence
        recognition.interimResults = false;

        recognition.onstart = () => {
            isRecording = true;
            micButton.classList.add('recording');
            micStatus.textContent = "Listening...";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            inputText.value = transcript;
            // Auto-translate after speaking
            translateText();
        };

        recognition.onend = () => {
            isRecording = false;
            micButton.classList.remove('recording');
            micStatus.textContent = "";
        };

        micButton.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
            } else {
                recognition.lang = sourceLangSelect.value;
                recognition.start();
            }
        });
    } else {
        micButton.style.display = 'none';
        micStatus.textContent = "Mic not supported in this browser.";
    }

    // --- 3. SPEECH SYNTHESIS (Voice Output) ---
    speakButton.addEventListener('click', () => {
        const text = outputText.value;
        if (!text) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = targetLangSelect.value;
        
        // Find a matching voice for the target language
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.startsWith(targetLangSelect.value));
        if (voice) utterance.voice = voice;

        window.speechSynthesis.speak(utterance);
    });

    // --- 4. UTILITIES (History & Copy) ---
    function saveToHistory(sourceText, translatedText, sLang, tLang) {
        const history = JSON.parse(localStorage.getItem('translationHistory') || '[]');
        const entry = { sourceText, translatedText, sLang, tLang, id: Date.now() };
        
        history.unshift(entry);
        localStorage.setItem('translationHistory', JSON.stringify(history.slice(0, 10)));
        renderHistory();
    }

    function renderHistory() {
        const history = JSON.parse(localStorage.getItem('translationHistory') || '[]');
        historyList.innerHTML = history.map(item => `
            <div class="history-item">
                <strong>${item.sLang.toUpperCase()} ➔ ${item.tLang.toUpperCase()}</strong><br>
                <span>${item.sourceText}</span><br>
                <small style="color: #3498db">${item.translatedText}</small>
            </div>
        `).join('');
    }

    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(outputText.value);
        alert("Copied to clipboard!");
    });

    clearHistoryButton.addEventListener('click', () => {
        localStorage.removeItem('translationHistory');
        renderHistory();
    });

    translateButton.addEventListener('click', translateText);
    
    // Initialize History
    renderHistory();
});
