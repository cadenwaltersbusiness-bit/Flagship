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
const homeButton = document.getElementById('home-btn') as HTMLButtonElement;
const navOverlay = document.getElementById('nav-overlay') as HTMLDivElement;
const navClose = document.getElementById('nav-close') as HTMLButtonElement;
const navItems = document.querySelectorAll('.nav-item') as NodeListOf<HTMLDivElement>;
const mainInput = document.getElementById('main-input') as HTMLInputElement;
const submitButton = document.getElementById('submit-btn') as HTMLButtonElement;

// Live View Elements
const liveViewButton = document.getElementById('live-view-btn') as HTMLButtonElement;

// Variables to track loading
let progressValue = 0;
let progressInterval: number | null = null;
let serverUrl = '';
let currentSection = 'chat';

// Function to show navigation overlay
function showNavigation(): void {
  if (navOverlay) {
    navOverlay.classList.add('visible');
  }
}

// Function to hide navigation overlay
function hideNavigation(): void {
  if (navOverlay) {
    navOverlay.classList.remove('visible');
  }
}

// Function to handle section navigation
function navigateToSection(section: string): void {
  currentSection = section;
  hideNavigation();
  
  // Here you could show different views/forms based on the section
  console.log(`Navigating to section: ${section}`);
  
  // For now, just update the UI to show that a section was selected
  // In a full implementation, you'd show different forms/interfaces
  if (mainInput) {
    mainInput.placeholder = `Configure ${section} settings...`;
  }
}

// Function to handle task submission
function submitTask(): void {
  const input = mainInput?.value?.trim();
  if (!input) return;
  
  console.log(`Submitting task: ${input}`);
  
  // Clear the input
  if (mainInput) {
    mainInput.value = '';
    mainInput.placeholder = 'Type your command or ask me anything...';
  }
  
  // Here you would submit the task to the backend
  // For now, just log it
}

// Initialize the app
function init(): void {
  // Remove loading class immediately to show the Noshi interface
  document.body.classList.remove('loading');
  
  // Setup home button to show navigation
  if (homeButton) {
    homeButton.addEventListener('click', showNavigation);
  }
  
  // Setup navigation overlay close
  if (navClose) {
    navClose.addEventListener('click', hideNavigation);
  }
  
  // Setup navigation items
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.getAttribute('data-section');
      if (section) {
        navigateToSection(section);
      }
    });
  });
  
  // Setup input submission
  if (submitButton) {
    submitButton.addEventListener('click', submitTask);
  }
  
  if (mainInput) {
    mainInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitTask();
      }
    });
  }
  
  // Setup Live View button (simplified)
  if (liveViewButton) {
    liveViewButton.addEventListener('click', () => {
      console.log('Live View clicked');
      // In a full implementation, this would show a live screen popup
      alert('Live View feature will be implemented here');
    });
  }
  
  // Click outside to close navigation
  navOverlay?.addEventListener('click', (e) => {
    if (e.target === navOverlay) {
      hideNavigation();
    }
  });
  
  console.log('Noshi interface initialized');
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Clean up event listeners when window is closed
window.addEventListener('beforeunload', () => {
  // Clean up any remaining intervals or listeners
  if (progressInterval) {
    clearInterval(progressInterval);
  }
});
