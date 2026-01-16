document.addEventListener('DOMContentLoaded', () => {
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

    // --- Configuration ---
    const LIBRETRANSLATE_API_URL = 'https://libretranslate.com/translate'; // Public endpoint
    // Fallback if LibreTranslate is down or for testing
    // const LIBRETRANSLATE_API_URL = 'http://localhost:5000/translate'; 

    let recognition; // SpeechRecognition instance
    let isRecording = false;

    // --- Language Mappings (for Speech API - some might differ from LibreTranslate) ---
    const speechLangs = {
        'en': 'en-US',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'it': 'it-IT',
        'pt': 'pt-PT',
        'zh': 'zh-CN', // Mandarin China
        'ja': 'ja-JP',
        'ko': 'ko-KR'
    };

    // --- Speech Recognition ---
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true; // Keep listening
        recognition.interimResults = true; // Show results as they come in

        recognition.onstart = () => {
            isRecording = true;
            micButton.classList.add('recording');
            micStatus.textContent = `Listening in ${sourceLangSelect.options[sourceLangSelect.selectedIndex].text}...`;
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            inputText.value = finalTranscript || interimTranscript; // Show current spoken text
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            micStatus.textContent = `Error: ${event.error}. Click mic to retry.`;
            isRecording = false;
            micButton.classList.remove('recording');
        };

        recognition.onend = () => {
            if (isRecording) { // If it ended unexpectedly, try to restart unless user stopped it
                console.log('Speech recognition ended, restarting...');
                micStatus.textContent = 'Restarting microphone...';
                recognition.start();
            } else {
                micStatus.textContent = 'Microphone off.';
            }
        };

        micButton.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
                isRecording = false;
                micButton.classList.remove('recording');
                micStatus.textContent = 'Microphone off.';
            } else {
                const langCode = speechLangs[sourceLangSelect.value];
                if (langCode) {
                    recognition.lang = langCode;
                    recognition.start();
                } else {
                    micStatus.textContent = 'Speech recognition not available for selected source language.';
                    console.warn('Speech recognition not available for:', sourceLangSelect.value);
                }
            }
        });

        // Update recognition lang if source language changes while recording
        sourceLangSelect.addEventListener('change', () => {
            if (isRecording) {
                recognition.stop(); // Stop and restart with new language
                const langCode = speechLangs[sourceLangSelect.value];
                if (langCode) {
                    recognition.lang = langCode;
                    recognition.start();
                    micStatus.textContent = `Listening in ${sourceLangSelect.options[sourceLangSelect.selectedIndex].text}...`;
                } else {
                    micStatus.textContent = 'Speech recognition not available for selected source language.';
                    isRecording = false;
                    micButton.classList.remove('recording');
                }
            }
        });

    } else {
        micButton.disabled = true;
        micStatus.textContent = 'Speech Recognition not supported in this browser.';
        micButton.style.backgroundColor = '#ccc';
        console.warn('Web Speech Recognition API not supported.');
    }

    // --- Translation Logic ---
    async function translateText() {
        const text = inputText.value.trim();
        if (!text) {
            outputText.value = "Nothing to translate.";
            return;
        }

        const sourceLang = sourceLangSelect.value;
        const targetLang = targetLangSelect.value;

        if (sourceLang === targetLang) {
            outputText.value = text;
            addTranslationToHistory(text, text, sourceLang, targetLang);
            return;
        }

        outputText.value = "Translating...";

        try {
            const response = await fetch(LIBRETRANSLATE_API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    q: text,
                    source: sourceLang,
                    target: targetLang,
                    // api_key: "YOUR_API_KEY" // Uncomment and add if using a private LibreTranslate instance or other API
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`Translation API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const translatedText = data.translatedText;
            outputText.value = translatedText;
            addTranslationToHistory(text, translatedText, sourceLang, targetLang);

        } catch (error) {
            console.error('Error during translation:', error);
            outputText.value = `Error: Could not translate. ${error.message}`;
        }
    }

    translateButton.addEventListener('click', translateText);

    // Allow Enter key to trigger translation in input textarea
    inputText.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { // Shift+Enter for new line
            event.preventDefault(); // Prevent default new line
            translateText();
        }
    });

    // --- Speech Synthesis (Text-to-Speech) ---
    speakButton.addEventListener('click', () => {
        const textToSpeak = outputText.value;
        if (textToSpeak) {
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            const targetLangCode = speechLangs[targetLangSelect.value] || targetLangSelect.value;
            
            // Try to find a voice matching the target language
            const voices = window.speechSynthesis.getVoices();
            const targetVoice = voices.find(voice => voice.lang.startsWith(targetLangCode.split('-')[0]));
            
            if (targetVoice) {
                utterance.voice = targetVoice;
            } else {
                utterance.lang = targetLangCode; // Fallback to language code
            }
            
            window.speechSynthesis.speak(utterance);
        }
    });
    
    // Need to load voices AFTER the voiceschanged event
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
            // Re-trigger speak button logic when voices are available
            // This is especially important for Safari/iOS
            console.log("Speech voices loaded.");
        };
    }


    // --- Copy to Clipboard ---
    copyButton.addEventListener('click', () => {
        outputText.select();
        outputText.setSelectionRange(0, 99999); // For mobile devices
        try {
            document.execCommand('copy');
            alert('Copied to clipboard!'); // Simple feedback
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    });

    // --- Translation History (LocalStorage) ---
    function loadHistory() {
        const history = JSON.parse(localStorage.getItem('lingoLiftHistory')) || [];
        historyList.innerHTML = ''; // Clear current display
        history.forEach(item => displayHistoryItem(item.sourceText, item.translatedText, item.sourceLang, item.targetLang));
    }

    function addTranslationToHistory(sourceText, translatedText, sourceLang, targetLang) {
        const history = JSON.parse(localStorage.getItem('lingoLiftHistory')) || [];
        const newItem = { sourceText, translatedText, sourceLang, targetLang, timestamp: new Date().toISOString() };
        history.unshift(newItem); // Add to the beginning
        if (history.length > 10) { // Keep only last 10 items
            history.pop();
        }
        localStorage.setItem('lingoLiftHistory', JSON.stringify(history));
        displayHistoryItem(sourceText, translatedText, sourceLang, targetLang, true); // Display new item at top
    }

    function displayHistoryItem(sourceText, translatedText, sourceLang, targetLang, prepend = false) {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('history-item');
        itemDiv.innerHTML = `
            <div><span title="Original Language">${sourceLang.toUpperCase()}:</span> ${sourceText}</div>
            <div><span title="Translated Language">${targetLang.toUpperCase()}:</span> ${translatedText}</div>
        `;
        if (prepend) {
            historyList.prepend(itemDiv);
            if (historyList.children.length > 10) {
                historyList.lastChild.remove(); // Remove oldest if over limit
            }
        } else {
            historyList.appendChild(itemDiv);
        }
    }

    clearHistoryButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all translation history?')) {
            localStorage.removeItem('lingoLiftHistory');
            historyList.innerHTML = '';
        }
    });

    // Load history when the app starts
    loadHistory();
});
Error: Could not translate. Translation API error: 400 
