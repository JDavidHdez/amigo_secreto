    let participants = [];
    let currentMode = 'organizer';
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 segundo

    // Función para esperar
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Función para sanitizar nombres
    function sanitizeName(name) {
        return name.trim().replace(/['"\\]/g, '');
    }

    // Mostrar/ocultar loading
    function showLoading(text = 'Procesando...') {
        document.getElementById('loadingText').textContent = text;
        document.getElementById('loadingOverlay').classList.add('active');
    }

    function hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }

    function switchMode(mode) {
        currentMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
        
        if (mode === 'organizer') {
            document.querySelector('.mode-btn:first-child').classList.add('active');
            document.getElementById('organizerSection').classList.add('active');
        } else {
            document.querySelector('.mode-btn:last-child').classList.add('active');
            document.getElementById('participantSection').classList.add('active');
        }
    }

    function generateRandomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'REGALO-';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    function addParticipant() {
        const input = document.getElementById('nameInput');
        const name = sanitizeName(input.value);
        const errorMsg = document.getElementById('errorMsg');
        
        errorMsg.textContent = '';
        
        if (name === '') {
            errorMsg.textContent = 'Por favor ingresa un nombre';
            return;
        }
        
        if (participants.includes(name)) {
            errorMsg.textContent = 'Este nombre ya existe';
            return;
        }
        
        participants.push(name);
        input.value = '';
        updateParticipantsList();
    }

    function removeParticipant(name) {
        participants = participants.filter(p => p !== name);
        updateParticipantsList();
    }

    function updateParticipantsList() {
        const list = document.getElementById('participantsList');
        const generateBtn = document.getElementById('generateBtn');
        const cleanBtn = document.getElementById('cleanBtn');
        
        if (participants.length === 0) {
            list.innerHTML = '<div class="empty-state">Agrega al menos 3 participantes para comenzar</div>';
            generateBtn.style.display = 'none';
            cleanBtn.style.display = 'none';
        } else {
            list.innerHTML = participants.map(name => `
                <div class="participant-item">
                    <span class="participant-name">${name}</span>
                    <button class="btn-danger" onclick="removeParticipant('${name}')">Eliminar</button>
                </div>
            `).join('');
            
            generateBtn.style.display = participants.length >= 3 ? 'block' : 'none';
            cleanBtn.style.display = 'block';
        }
    }

    async function generateCodes() {
        if (participants.length < 3) {
            alert('Se necesitan al menos 3 participantes');
            return;
        }

        showLoading('Generando sorteo...');

        // Algoritmo para asignar amigos secretos
        let valid = false;
        let attempts = 0;
        let assignments = [];
        
        while (!valid && attempts < 100) {
            assignments = [];
            const available = [...participants];
            valid = true;
            
            for (let i = 0; i < participants.length; i++) {
                const giver = participants[i];
                const possibleReceivers = available.filter(p => p !== giver);
                
                if (possibleReceivers.length === 0) {
                    valid = false;
                    break;
                }
                
                const randomIndex = Math.floor(Math.random() * possibleReceivers.length);
                const receiver = possibleReceivers[randomIndex];
                
                const code = generateRandomCode();
                assignments.push({ giver, receiver, code });
                available.splice(available.indexOf(receiver), 1);
            }
            
            attempts++;
        }

        if (!valid) {
            hideLoading();
            alert('Error al generar el sorteo. Intenta de nuevo.');
            return;
        }

        // Guardar en almacenamiento persistente con reintentos
        try {
            const sorteoId = 'sorteo-' + Date.now();
            let successCount = 0;
            const errors = [];

            for (let i = 0; i < assignments.length; i++) {
                const assignment = assignments[i];
                showLoading(`Guardando código ${i + 1} de ${assignments.length}...`);
                
                const saved = await saveWithRetry(
                    assignment.code,
                    {
                        giver: assignment.giver,
                        receiver: assignment.receiver,
                        sorteoId: sorteoId,
                        createdAt: new Date().toISOString()
                    }
                );

                if (saved) {
                    successCount++;
                } else {
                    errors.push(assignment.giver);
                }
            }

            hideLoading();

            if (errors.length > 0) {
                const errorMsg = `
                    ⚠️ Algunos códigos no se pudieron guardar:
                    ${errors.join(', ')}
                    
                    Códigos guardados: ${successCount}/${assignments.length}
                    
                    Opciones:
                    1. Intentar de nuevo
                    2. Limpiar códigos antiguos y volver a intentar
                    3. Anotar los códigos manualmente
                `;
                
                if (confirm(errorMsg + '\n\n¿Quieres ver los códigos de todos modos?')) {
                    showCodes(assignments);
                }
            } else {
                // Todos guardados exitosamente
                showCodes(assignments);
            }

        } catch (error) {
            hideLoading();
            console.error('Error completo:', error);
            
            const errorMsg = `
❌ Error al guardar los códigos

Detalles: ${error.message || 'Error desconocido'}

Posibles causas:
• Límite de almacenamiento alcanzado
• Problemas de conectividad
• Demasiados sorteos anteriores

Soluciones:
1. Usa el botón "Limpiar códigos antiguos"
2. Verifica tu conexión a internet
3. Intenta con menos participantes
4. Recarga la página y vuelve a intentar
            `;
            
            alert(errorMsg);
        }
    }

    // Función para guardar con reintentos
    async function saveWithRetry(code, data, retries = MAX_RETRIES) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const result = await window.storage.set(
                    code,
                    JSON.stringify(data),
                    true // compartido
                );
                
                if (result) {
                    return true;
                }
                
                // Si no hay resultado pero tampoco error, esperamos y reintentamos
                if (attempt < retries) {
                    await sleep(RETRY_DELAY * attempt);
                }
            } catch (error) {
                console.error(`Intento ${attempt} fallido para ${code}:`, error);
                
                if (attempt < retries) {
                    await sleep(RETRY_DELAY * attempt);
                } else {
                    return false;
                }
            }
        }
        return false;
    }

    // Función para limpiar códigos antiguos
    async function cleanOldCodes() {
        if (!confirm('¿Estás seguro de que quieres limpiar todos los códigos antiguos? Esta acción no se puede deshacer.')) {
            return;
        }

        showLoading('Limpiando códigos antiguos...');

        try {
            const result = await window.storage.list('REGALO-', true);
            
            if (result && result.keys && result.keys.length > 0) {
                let deletedCount = 0;
                
                for (const key of result.keys) {
                    try {
                        await window.storage.delete(key, true);
                        deletedCount++;
                    } catch (error) {
                        console.error('Error eliminando:', key, error);
                    }
                }
                
                hideLoading();
                alert(`✅ Se eliminaron ${deletedCount} códigos antiguos.\n\nYa puedes generar nuevos códigos.`);
            } else {
                hideLoading();
                alert('No se encontraron códigos antiguos para limpiar.');
            }
        } catch (error) {
            hideLoading();
            console.error('Error al limpiar:', error);
            alert('Error al limpiar códigos antiguos. Intenta de nuevo.');
        }
    }

    function showCodes(assignments) {
        document.getElementById('setupPhase').style.display = 'none';
        document.getElementById('codesPhase').style.display = 'block';
        
        const codesList = document.getElementById('codesList');
        codesList.innerHTML = assignments.map(a => `
            <div class="code-display">
                <div class="name">👤 ${a.giver}</div>
                <div class="code">${a.code}</div>
                <button class="btn-primary copy-btn" onclick="copyCode('${a.code}')">
                    📋 Copiar código
                </button>
            </div>
        `).join('');
    }

    function copyCode(code) {
        navigator.clipboard.writeText(code).then(() => {
            alert('Código copiado: ' + code);
        });
    }

    async function revealWithCode() {
        const input = document.getElementById('codeInput');
        const code = input.value.trim().toUpperCase();
        const errorMsg = document.getElementById('codeError');
        
        errorMsg.innerHTML = '';
        
        if (code === '') {
            errorMsg.textContent = 'Por favor ingresa un código';
            return;
        }

        showLoading('Verificando código...');

        try {
            const result = await window.storage.get(code, true);
            
            hideLoading();

            if (!result) {
                errorMsg.innerHTML = `
                    <div class="error-detail">
                        ❌ Código inválido o ya usado
                        <br><br>
                        Verifica que:
                        <br>• El código esté escrito correctamente
                        <br>• No hayas usado este código antes
                        <br>• El organizador haya generado los códigos
                    </div>
                `;
                return;
            }

            const data = JSON.parse(result.value);
            
            // Mostrar resultado
            document.getElementById('giftName').textContent = data.receiver;
            document.getElementById('codeInputPhase').style.display = 'none';
            document.getElementById('resultPhase').style.display = 'block';
            
            // Eliminar el código para que no se pueda usar de nuevo
            try {
                await window.storage.delete(code, true);
            } catch (delError) {
                console.error('Error al eliminar código:', delError);
                // No mostramos error al usuario porque ya vio su resultado
            }
            
        } catch (error) {
            hideLoading();
            console.error('Error completo:', error);
            errorMsg.innerHTML = `
                <div class="error-detail">
                    ❌ Error al verificar el código
                    <br><br>
                    ${error.message || 'Error desconocido'}
                    <br><br>
                    Intenta:
                    <br>• Verificar tu conexión a internet
                    <br>• Recargar la página
                    <br>• Contactar al organizador
                </div>
            `;
        }
    }

    function resetOrganizer() {
        participants = [];
        document.getElementById('setupPhase').style.display = 'block';
        document.getElementById('codesPhase').style.display = 'none';
        updateParticipantsList();
    }

    function resetParticipant() {
        document.getElementById('codeInput').value = '';
        document.getElementById('codeError').textContent = '';
        document.getElementById('codeInputPhase').style.display = 'block';
        document.getElementById('resultPhase').style.display = 'none';
    }

    // Permitir agregar con Enter
    document.getElementById('nameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addParticipant();
        }
    });

    document.getElementById('codeInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            revealWithCode();
        }
    });

    // Inicializar
    updateParticipantsList();