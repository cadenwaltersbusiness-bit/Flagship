/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 */

import './index.css';
import { pythonCommand, chromeCommand } from './config';

// Define interface for Python bridge
interface PyBridge {
  onPyOutput: (callback: (data: { type: string; data: string }) => void) => void;
  onPyStarted: (callback: () => void) => void;
  onPyReady: (callback: (url: string) => void) => void;
  restartPython: () => void;
  removeAllListeners: () => void;
}

// Define interface for Chrome bridge
interface ChromeBridge {
  onChromeOutput: (callback: (data: { type: string; data: string }) => void) => void;
  onChromeStarted: (callback: () => void) => void;
  restartChrome: () => void;
  removeAllListeners: () => void;
}

// Access the exposed API from preload script
declare global {
  interface Window {
    pyBridge: PyBridge;
    chromeBridge: ChromeBridge;
    settingsBridge: {
      onDefaultSettings: (callback: (settings: any) => void) => void;
    };
  }
}

// DOM Elements
const consoleOutput = document.getElementById('console-output') as HTMLDivElement;
const consoleContent = document.getElementById('console-content') as HTMLDivElement;
const chromeConsoleContent = document.getElementById('chrome-console-content') as HTMLDivElement;
const loadingProgress = document.getElementById('loading-progress') as HTMLDivElement;
const loadingContainer = document.getElementById('loading-container') as HTMLDivElement;
const webviewContainer = document.getElementById('webview-container') as HTMLDivElement;
const webview = document.getElementById('webview') as HTMLElement;
const launchButton = document.getElementById('launch-button') as HTMLButtonElement;
const controls = document.getElementById('controls') as HTMLDivElement;
const toggleConsoleButton = document.getElementById('toggle-console') as HTMLButtonElement;
const closeConsoleButton = document.getElementById('close-console') as HTMLSpanElement;
const tabPython = document.getElementById('tab-python') as HTMLButtonElement;
const tabChrome = document.getElementById('tab-chrome') as HTMLButtonElement;
const restartPythonButton = document.getElementById('restart-python') as HTMLButtonElement;
const restartChromeButton = document.getElementById('restart-chrome') as HTMLButtonElement;
const pythonCommandDisplay = document.getElementById('python-command') as HTMLDivElement;
const chromeCommandDisplay = document.getElementById('chrome-command') as HTMLDivElement;
const actionRows = document.querySelectorAll('.action-row') as NodeListOf<HTMLDivElement>;

// New Navigation Elements
const navButtons = document.querySelectorAll('.nav-button') as NodeListOf<HTMLButtonElement>;
const tabContents = document.querySelectorAll('.tab-content') as NodeListOf<HTMLDivElement>;

// Live View Elements
const liveViewButton = document.getElementById('live-view-btn') as HTMLButtonElement;
const liveViewPopup = document.getElementById('floating-screen-window') as HTMLDivElement;
const closeLiveViewButton = document.getElementById('close-live-view') as HTMLButtonElement;
const liveTabButtons = document.querySelectorAll('.popup-tab') as NodeListOf<HTMLButtonElement>;
const liveContents = document.querySelectorAll('.live-content') as NodeListOf<HTMLDivElement>;
const liveConsoleContent = document.getElementById('live-console-content') as HTMLDivElement;
const liveChromeConsoleContent = document.getElementById('live-chrome-console-content') as HTMLDivElement;

// Settings Elements
const temperatureSlider = document.getElementById('temperature') as HTMLInputElement;
const temperatureValue = document.querySelector('.slider-value') as HTMLSpanElement;

// Variables to track loading
let progressValue = 0;
let progressInterval: number | null = null;
let serverUrl = '';

// Function to append output to the console
function appendToConsole(message: string, type: string, target: HTMLElement = consoleContent): void {
  const element = document.createElement('div');
  element.className = type;
  element.textContent = message;
  target.appendChild(element);
  target.scrollTop = target.scrollHeight;
}

// Function to simulate loading progress
function simulateProgress(): void {
  progressInterval = window.setInterval(() => {
    if (progressValue < 90) {
      progressValue += Math.random() * 10;
      loadingProgress.style.width = `${progressValue}%`;
    }
  }, 300);
}

// Function to complete the loading progress
function completeProgress(): void {
  clearInterval(progressInterval!);
  progressValue = 100;
  loadingProgress.style.width = '100%';
  
  // Hide loading container after a short delay
  setTimeout(() => {
    loadingContainer.style.display = 'none';
    // Don't show the launch button if we're auto-loading the UI
    if (!serverUrl) {
      launchButton.style.display = 'block';
    }
  }, 500);
}

// Function to switch between navigation tabs
function switchTab(tabName: string): void {
  // Update navigation buttons
  navButtons.forEach(button => {
    button.classList.remove('active');
    if (button.getAttribute('data-tab') === tabName) {
      button.classList.add('active');
    }
  });

  // Update tab content
  tabContents.forEach(content => {
    content.classList.remove('active');
    if (content.id === `tab-${tabName}`) {
      content.classList.add('active');
    }
  });
}

// Function to switch between Live View tabs
function switchLiveViewTab(tabName: string): void {
  // Update popup tab buttons
  liveTabButtons.forEach(button => {
    button.classList.remove('active');
    if (button.id === `live-tab-${tabName}`) {
      button.classList.add('active');
    }
  });

  // Update live content
  liveContents.forEach(content => {
    content.classList.remove('active');
    if (content.id === `live-${tabName}-content`) {
      content.classList.add('active');
    }
  });
}

// Function to toggle Live View popup
function toggleLiveView(): void {
  const isVisible = liveViewPopup.classList.contains('visible');
  
  if (isVisible) {
    liveViewPopup.classList.remove('visible');
  } else {
    liveViewPopup.classList.add('visible');
    // Scroll to latest output when opening
    const activeContent = document.querySelector('.live-content.active .console-content') as HTMLElement;
    if (activeContent) {
      activeContent.scrollTop = activeContent.scrollHeight;
    }
  }
}

// Function to append output to live view consoles
function appendToLiveView(message: string, type: string, isChrome = false): void {
  const targetContent = isChrome ? liveChromeConsoleContent : liveConsoleContent;
  const element = document.createElement('div');
  element.className = type;
  element.textContent = message;
  targetContent.appendChild(element);
  targetContent.scrollTop = targetContent.scrollHeight;
  
  // Limit the number of lines to prevent memory issues
  const maxLines = 1000;
  const lines = targetContent.children;
  if (lines.length > maxLines) {
    for (let i = 0; i < lines.length - maxLines; i++) {
      lines[0].remove();
    }
  }
}

// Function to update settings sliders
function updateSliderValue(slider: HTMLInputElement, valueSpan: HTMLSpanElement): void {
  valueSpan.textContent = slider.value;
}

// Function to load webview in background (keeping original behavior)
function loadWebViewBackground(url: string): void {
  const webviewElement = document.querySelector('webview') as Electron.WebviewTag;
  if (webviewElement) {
    webviewElement.src = url;
    
    webviewElement.addEventListener('dom-ready', () => {
      console.log('WebView DOM ready');
    });
    
    webviewElement.addEventListener('did-finish-load', () => {
      console.log('WebView finished loading');
      document.body.classList.remove('loading');
    });
    
    webviewElement.addEventListener('did-fail-load', (e) => {
      console.error('WebView failed to load:', e);
      appendToConsole(`Failed to load webview: ${JSON.stringify(e)}`, 'error');
      appendToLiveView(`Failed to load webview: ${JSON.stringify(e)}`, 'error');
    });
  }
}

// Function to switch between console tabs
function switchConsoleTab(tab: 'python' | 'chrome'): void {
  if (tab === 'python') {
    tabPython.classList.add('active');
    tabChrome.classList.remove('active');
    consoleContent.style.display = 'block';
    chromeConsoleContent.style.display = 'none';
    consoleContent.scrollTop = consoleContent.scrollHeight;
    // Show Python action row, hide Chrome action row
    actionRows[0].style.display = 'flex';
    actionRows[1].style.display = 'none';
  } else {
    tabPython.classList.remove('active');
    tabChrome.classList.add('active');
    consoleContent.style.display = 'none';
    chromeConsoleContent.style.display = 'block';
    chromeConsoleContent.scrollTop = chromeConsoleContent.scrollHeight;
    // Hide Python action row, show Chrome action row
    actionRows[0].style.display = 'none';
    actionRows[1].style.display = 'flex';
  }
}

// Function to load the web UI
function loadWebUI(url: string): void {
  // Instead of showing webview, we keep our custom interface
  // and load webview in background for data
  loadWebViewBackground(url);
  
  // Remove loading class to show main interface
  document.body.classList.remove('loading');
  
  // Don't show webview container, keep our custom interface
  // webviewContainer.style.display = 'block';
  // controls.style.display = 'block';
  
  // Hide loading elements
  loadingContainer.style.display = 'none';
  launchButton.style.display = 'none';
}

// Initialize the app
function init(): void {
  // Start simulating progress
  simulateProgress();
  
  // Show our custom interface immediately (remove loading after server starts)
  // Don't auto-show console anymore since we have Live View
  
  // Set the command displays for backwards compatibility
  if (pythonCommandDisplay) pythonCommandDisplay.textContent = pythonCommand.display;
  if (chromeCommandDisplay) chromeCommandDisplay.textContent = chromeCommand.display;
  
  // Setup navigation
  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      if (tabName) {
        switchTab(tabName);
      }
    });
  });
  
  // Setup Live View
  if (liveViewButton) {
    liveViewButton.addEventListener('click', toggleLiveView);
  }
  
  if (closeLiveViewButton) {
    closeLiveViewButton.addEventListener('click', () => {
      liveViewPopup.classList.remove('visible');
    });
  }
  
  // Setup Live View tabs
  liveTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.id.replace('live-tab-', '');
      switchLiveViewTab(tabName);
    });
  });
  
  // Setup settings sliders
  if (temperatureSlider && temperatureValue) {
    temperatureSlider.addEventListener('input', () => {
      updateSliderValue(temperatureSlider, temperatureValue);
    });
  }
  
  // Listen for Python process output
  window.pyBridge.onPyOutput((data) => {
    appendToConsole(data.data, data.type);
    appendToLiveView(data.data, data.type, false);
    
    // Automatically detect when server is ready from the output
    if (data.data.includes('Server is ready') || data.data.includes('Running on http://')) {
      if (!serverUrl) {
        serverUrl = 'http://127.0.0.1:7788';
        appendToConsole(`Detected server is ready at: ${serverUrl}`, 'info');
        appendToLiveView(`Detected server is ready at: ${serverUrl}`, 'info');
        completeProgress();
        loadWebUI(serverUrl);
      }
    }
  });
  
  // Listen for Python process started event
  window.pyBridge.onPyStarted(() => {
    appendToConsole('Python process started', 'info');
    appendToLiveView('Python process started', 'info');
  });
  
  // Listen for Python ready event
  window.pyBridge.onPyReady((url) => {
    serverUrl = url;
    appendToConsole(`Server is ready at: ${url}`, 'info');
    appendToLiveView(`Server is ready at: ${url}`, 'info');
    completeProgress();
    // Automatically load the web UI
    loadWebUI(url);
  });
  
  // Listen for Chrome process output
  window.chromeBridge.onChromeOutput((data) => {
    appendToConsole(data.data, data.type, chromeConsoleContent);
    appendToLiveView(data.data, data.type, true);
  });
  
  // Listen for Chrome process started event
  window.chromeBridge.onChromeStarted(() => {
    appendToConsole('Chrome process started', 'info', chromeConsoleContent);
    appendToLiveView('Chrome process started', 'info', true);
  });
  
  // Setup tab switching (backwards compatibility)
  if (tabPython) {
    tabPython.addEventListener('click', () => {
      switchConsoleTab('python');
      if (restartPythonButton) restartPythonButton.style.display = 'block';
      if (restartChromeButton) restartChromeButton.style.display = 'none';
    });
  }
  
  if (tabChrome) {
    tabChrome.addEventListener('click', () => {
      switchConsoleTab('chrome');
      if (restartPythonButton) restartPythonButton.style.display = 'none';
      if (restartChromeButton) restartChromeButton.style.display = 'block';
    });
  }
  
  // Setup restart buttons
  if (restartPythonButton) {
    restartPythonButton.addEventListener('click', () => {
      // Clear console
      consoleContent.innerHTML = '';
      liveConsoleContent.innerHTML = '';
      
      // Add message about restart
      appendToConsole('Restarting Python process...', 'info');
      appendToLiveView('Restarting Python process...', 'info');
      
      // Restart the process
      window.pyBridge.restartPython();
    });
  }
  
  if (restartChromeButton) {
    restartChromeButton.addEventListener('click', () => {
      // Clear console
      chromeConsoleContent.innerHTML = '';
      liveChromeConsoleContent.innerHTML = '';
      
      // Add message about restart
      appendToConsole('Restarting Chrome process...', 'info', chromeConsoleContent);
      appendToLiveView('Restarting Chrome process...', 'info', true);
      
      // Restart the process
      window.chromeBridge.restartChrome();
    });
  }
  
  // Setup launch button click handler (backwards compatibility)
  if (launchButton) {
    launchButton.addEventListener('click', () => {
      loadWebUI(serverUrl);
    });
  }
  
  // Setup toggle console button (backwards compatibility)
  if (toggleConsoleButton) {
    toggleConsoleButton.addEventListener('click', () => {
      // Show Live View instead of old console
      toggleLiveView();
    });
  }
  
  // Setup close console button (backwards compatibility)
  if (closeConsoleButton) {
    closeConsoleButton.addEventListener('click', () => {
      if (consoleOutput) {
        consoleOutput.classList.remove('visible');
      }
      if (toggleConsoleButton) {
        toggleConsoleButton.textContent = 'Show Console';
      }
    });
  }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Clean up event listeners when window is closed
window.addEventListener('beforeunload', () => {
  window.pyBridge.removeAllListeners();
  window.chromeBridge.removeAllListeners();
  if (progressInterval) {
    clearInterval(progressInterval);
  }
});
