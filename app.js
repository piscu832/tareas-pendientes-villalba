/**
 * TAREAS PENDIENTES - Kanban Logic with Supabase Auth & DB
 */

// --- CONFIGURACIÓN DE BASE DE DATOS (SUPABASE) ---
const SUPABASE_URL = 'https://zjlktasqyztoxhjonppx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbGt0YXNxeXp0b3hoam9ucHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjEwNjEsImV4cCI6MjA5MzgzNzA2MX0.UdPqXOiW3tcADJepDNXMNND8Ui0-nCUGbA4STZyjNfk';

let supabaseClient = null;
if (SUPABASE_URL !== 'TU_URL_DE_SUPABASE') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let tasks = [];
let currentUser = null;
let isLoginMode = true;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const appContent = document.getElementById('app-content');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authConfirmPassword = document.getElementById('auth-confirm-password');
const confirmPasswordContainer = document.getElementById('confirm-password-container');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
const logoutBtn = document.getElementById('logout-btn');

const modal = document.getElementById('task-modal');
const modalContainer = document.getElementById('modal-container');
const taskForm = document.getElementById('task-form');
const addTaskBtn = document.getElementById('add-task-btn');
const closeModalBtn = document.getElementById('close-modal');
const cancelBtn = document.getElementById('cancel-btn');
const modalTitle = document.getElementById('modal-title');

// Form Inputs
const inputId = document.getElementById('task-id');
const inputTitle = document.getElementById('input-title');
const inputDesc = document.getElementById('input-desc');
const inputObs = document.getElementById('input-obs');
const inputPriority = document.getElementById('input-priority');

// Task Columns
const columns = {
    todo: document.getElementById('tasks-todo'),
    doing: document.getElementById('tasks-doing'),
    done: document.getElementById('tasks-done')
};

const counts = {
    todo: document.getElementById('count-todo'),
    doing: document.getElementById('count-doing'),
    done: document.getElementById('count-done')
};

// Initialize App
async function init() {
    setupAuthListeners();
    setupEventListeners();
    
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        handleAuthStateChange(session?.user || null);
    } else {
        // Fallback for LocalStorage only mode
        handleAuthStateChange({ id: 'local-user', email: 'offline@villalba.com' });
    }
}

// Auth Handlers
function setupAuthListeners() {
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            handleAuthStateChange(session?.user || null);
        });
    }

    toggleAuthModeBtn.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        authSubmitBtn.textContent = isLoginMode ? 'Iniciar Sesión' : 'Registrarse';
        toggleAuthModeBtn.textContent = isLoginMode ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión';
        
        // Show/Hide confirm password
        if (isLoginMode) {
            confirmPasswordContainer.classList.add('hidden');
            authConfirmPassword.removeAttribute('required');
        } else {
            confirmPasswordContainer.classList.remove('hidden');
            authConfirmPassword.setAttribute('required', '');
        }
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = authEmail.value;
        const password = authPassword.value;
        const confirmPassword = authConfirmPassword.value;

        if (!supabaseClient) {
            alert('Configura Supabase para habilitar el sistema de usuarios.');
            return;
        }

        try {
            let result;
            if (isLoginMode) {
                result = await supabaseClient.auth.signInWithPassword({ email, password });
            } else {
                if (password !== confirmPassword) {
                    alert('Las contraseñas no coinciden.');
                    return;
                }
                
                result = await supabaseClient.auth.signUp({ 
                    email, 
                    password,
                    options: {
                        emailRedirectTo: window.location.origin + window.location.pathname
                    }
                });
            }

            if (result.error) throw result.error;
            if (!isLoginMode && result.data.user) alert('Registro exitoso. Revisa tu email si es necesario.');
            
        } catch (err) {
            alert('Error de autenticación: ' + err.message);
        }
    });

    logoutBtn.addEventListener('click', async () => {
        if (supabaseClient) await supabaseClient.auth.signOut();
        else handleAuthStateChange(null);
    });
}

function handleAuthStateChange(user) {
    currentUser = user;
    if (user) {
        authScreen.classList.add('hidden');
        appContent.classList.remove('opacity-0', 'pointer-events-none');
        addTaskBtn.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        loadTasks();
    } else {
        authScreen.classList.remove('hidden');
        appContent.classList.add('opacity-0', 'pointer-events-none');
        addTaskBtn.classList.add('hidden');
        logoutBtn.classList.add('hidden');
        tasks = [];
        renderTasks();
    }
}

// Task Management
async function loadTasks() {
    if (supabaseClient && currentUser) {
        try {
            const { data, error } = await supabaseClient
                .from('tasks')
                .select('*')
                .eq('user_id', currentUser.id); // Filter by user_id
            
            if (error) throw error;
            tasks = data || [];
        } catch (err) {
            console.error('Error cargando de Supabase:', err);
            loadFromLocalStorage();
        }
    } else {
        loadFromLocalStorage();
    }
    renderTasks();
}

function loadFromLocalStorage() {
    const localData = JSON.parse(localStorage.getItem('antigravity_tasks')) || [];
    // Filter by local user if offline
    tasks = localData.filter(t => t.user_id === (currentUser?.id || 'local-user'));
}

function saveToLocalStorage() {
    localStorage.setItem('antigravity_tasks', JSON.stringify(tasks));
}

// Event Listeners
function setupEventListeners() {
    addTaskBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveTask();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

// Modal Functions
function openModal(taskId = null) {
    if (taskId) {
        const task = tasks.find(t => t.id.toString() === taskId.toString());
        if (task) {
            modalTitle.textContent = 'Editar Tarea';
            inputId.value = task.id;
            inputTitle.value = task.title;
            inputDesc.value = task.description;
            inputObs.value = task.observations;
            inputPriority.value = task.priority;
        }
    } else {
        modalTitle.textContent = 'Nueva Tarea';
        taskForm.reset();
        inputId.value = '';
    }
    
    modal.classList.add('active');
    setTimeout(() => modalContainer.classList.add('opacity-100', 'scale-100'), 10);
}

function closeModal() {
    modalContainer.classList.remove('opacity-100', 'scale-100');
    setTimeout(() => {
        modal.classList.remove('active');
        taskForm.reset();
    }, 200);
}

// Task CRUD
async function saveTask() {
    const taskId = inputId.value;
    const taskData = {
        title: inputTitle.value,
        description: inputDesc.value,
        observations: inputObs.value,
        priority: inputPriority.value,
        status: taskId ? tasks.find(t => t.id.toString() === taskId.toString()).status : 'todo',
        user_id: currentUser.id, // Assign to current user
        updated_at: new Date().toISOString()
    };

    if (supabaseClient && currentUser.id !== 'local-user') {
        try {
            if (taskId) {
                const { error } = await supabaseClient
                    .from('tasks')
                    .update(taskData)
                    .eq('id', taskId);
                if (error) throw error;
            } else {
                const { error } = await supabaseClient
                    .from('tasks')
                    .insert([{ ...taskData, created_at: new Date().toISOString() }]);
                if (error) throw error;
            }
            await loadTasks();
        } catch (err) {
            console.error('Error en Supabase:', err);
            handleLocalSave(taskId, taskData);
        }
    } else {
        handleLocalSave(taskId, taskData);
    }

    closeModal();
}

function handleLocalSave(taskId, taskData) {
    if (taskId) {
        tasks = tasks.map(t => t.id.toString() === taskId.toString() ? { ...t, ...taskData } : t);
    } else {
        tasks.push({ ...taskData, id: Date.now(), created_at: new Date().toISOString() });
    }
    saveToLocalStorage();
    renderTasks();
}

async function moveTask(id, newStatus) {
    if (supabaseClient && currentUser.id !== 'local-user') {
        try {
            const { error } = await supabaseClient
                .from('tasks')
                .update({ status: newStatus })
                .eq('id', id);
            if (error) throw error;
            await loadTasks();
        } catch (err) {
            moveTaskLocal(id, newStatus);
        }
    } else {
        moveTaskLocal(id, newStatus);
    }
}

function moveTaskLocal(id, newStatus) {
    tasks = tasks.map(t => t.id.toString() === id.toString() ? { ...t, status: newStatus } : t);
    saveToLocalStorage();
    renderTasks();
}

async function deleteTask(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta tarea?')) return;

    if (supabaseClient && currentUser.id !== 'local-user') {
        try {
            const { error } = await supabaseClient
                .from('tasks')
                .delete()
                .eq('id', id);
            if (error) throw error;
            await loadTasks();
        } catch (err) {
            deleteTaskLocal(id);
        }
    } else {
        deleteTaskLocal(id);
    }
}

function deleteTaskLocal(id) {
    tasks = tasks.filter(t => t.id.toString() !== id.toString());
    saveToLocalStorage();
    renderTasks();
}

// UI Rendering
function renderTasks() {
    Object.values(columns).forEach(col => col.innerHTML = '');
    const taskCounts = { todo: 0, doing: 0, done: 0 };
    const priorityWeight = { alta: 3, media: 2, baja: 1 };

    tasks.sort((a, b) => {
        if (priorityWeight[b.priority] !== priorityWeight[a.priority]) {
            return priorityWeight[b.priority] - priorityWeight[a.priority];
        }
        return new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt);
    }).forEach(task => {
        taskCounts[task.status]++;
        const taskCard = createTaskCard(task);
        columns[task.status].appendChild(taskCard);
    });

    Object.keys(taskCounts).forEach(status => {
        counts[status].textContent = taskCounts[status];
    });
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority} animate-fade-in`;
    
    const priorityLabels = { baja: 'Baja', media: 'Media', alta: 'Alta' };
    const priorityColors = {
        baja: 'bg-emerald-100 text-emerald-700',
        media: 'bg-amber-100 text-amber-700',
        alta: 'bg-rose-100 text-rose-700'
    };

    card.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${priorityColors[task.priority]}">
                ${priorityLabels[task.priority]}
            </span>
            <div class="flex gap-1">
                <button onclick="openModal('${task.id}')" class="p-1 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-[#1C3F87]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button onclick="deleteTask('${task.id}')" class="p-1 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-rose-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        </div>
        <h4 class="font-bold text-slate-800 leading-tight mb-1">${task.title}</h4>
        <p class="text-sm text-slate-600 line-clamp-3 mb-2">${task.description || 'Sin descripción'}</p>
        ${task.observations ? `
            <div class="mt-2 pt-2 border-t border-slate-50 text-[11px] text-slate-400 italic">
                <span class="font-semibold not-italic">Obs:</span> ${task.observations}
            </div>
        ` : ''}
        
        <div class="flex items-center justify-between mt-4">
            <div class="flex gap-1">
                ${task.status !== 'todo' ? `
                    <button onclick="moveTask('${task.id}', '${getPrevStatus(task.status)}')" class="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-md transition-all text-slate-500 hover:text-[#1C3F87] active:scale-90 border border-slate-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                ` : '<div class="w-7"></div>'}
                ${task.status !== 'done' ? `
                    <button onclick="moveTask('${task.id}', '${getNextStatus(task.status)}')" class="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-md transition-all text-slate-500 hover:text-[#1C3F87] active:scale-90 border border-slate-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                ` : '<div class="w-7"></div>'}
            </div>
            <span class="text-[10px] text-slate-400">${new Date(task.created_at || task.createdAt).toLocaleDateString()}</span>
        </div>
    `;
    return card;
}

function getNextStatus(status) {
    if (status === 'todo') return 'doing';
    if (status === 'doing') return 'done';
    return 'done';
}

function getPrevStatus(status) {
    if (status === 'done') return 'doing';
    if (status === 'doing') return 'todo';
    return 'todo';
}

window.openModal = openModal;
window.deleteTask = deleteTask;
window.moveTask = moveTask;

init();
