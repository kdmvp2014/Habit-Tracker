// Vite's module scripts no longer leak top-level declarations onto
// `window`, but the rendered HTML still relies on inline onclick="..."
// attribute strings (both static markup and strings generated inside
// render*() template literals), which are always evaluated against
// global scope. This list was derived by grepping index.html + every
// src/js/*.js file for on(click|change|input|submit|keydown|keyup|error)="name(".
import { applyManualFood, openFoodModal, toggleManualEntry, toggleMicroEntry, deleteFoodItem, setUsdaApiKey, searchFood, updateFoodCalc, openBarcodeScanner, stopScanner, saveFood, ernChangeDay } from './nutrition.js';
import { changeMonth, goToday } from './calendar.js';
import { closeModal, handleOverlay } from './modal-utils.js';
import { deleteEx, openExModal, toggleEx, openPlanModal, savePlan, deletePlan, renamePlan, saveExercise } from './workout.js';
import { deleteHabit, editHabit, openHabitModal, saveHabit } from './habits.js';
import { deleteTodo, openTodoModal, saveTodo, toggleTodoDone, setCatFilter, setFilter } from './todos.js';
import { handleLogin, handleLogout, handleResend, handleSignup, showAuthSection } from './auth.js';
import { openAiAdvice } from './ai.js';
import { showView, toggleDsTheme, openMobileMenu } from './nav.js';
import { toggleDetail } from './heute.js';
import { saveProfileSettings, saveProfileSetup } from './settings.js';

window.applyManualFood = applyManualFood;
window.changeMonth = changeMonth;
window.closeModal = closeModal;
window.deleteEx = deleteEx;
window.deleteFoodItem = deleteFoodItem;
window.deleteHabit = deleteHabit;
window.deletePlan = deletePlan;
window.deleteTodo = deleteTodo;
window.editHabit = editHabit;
window.ernChangeDay = ernChangeDay;
window.goToday = goToday;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.handleOverlay = handleOverlay;
window.handleResend = handleResend;
window.handleSignup = handleSignup;
window.openAiAdvice = openAiAdvice;
window.openBarcodeScanner = openBarcodeScanner;
window.openExModal = openExModal;
window.openFoodModal = openFoodModal;
window.openHabitModal = openHabitModal;
window.openMobileMenu = openMobileMenu;
window.openPlanModal = openPlanModal;
window.openTodoModal = openTodoModal;
window.renamePlan = renamePlan;
window.saveExercise = saveExercise;
window.saveFood = saveFood;
window.saveHabit = saveHabit;
window.saveProfileSettings = saveProfileSettings;
window.saveProfileSetup = saveProfileSetup;
window.savePlan = savePlan;
window.saveTodo = saveTodo;
window.searchFood = searchFood;
window.setCatFilter = setCatFilter;
window.setFilter = setFilter;
window.setUsdaApiKey = setUsdaApiKey;
window.showAuthSection = showAuthSection;
window.showView = showView;
window.stopScanner = stopScanner;
window.toggleDetail = toggleDetail;
window.toggleDsTheme = toggleDsTheme;
window.toggleEx = toggleEx;
window.toggleManualEntry = toggleManualEntry;
window.toggleMicroEntry = toggleMicroEntry;
window.toggleTodoDone = toggleTodoDone;
window.updateFoodCalc = updateFoodCalc;
