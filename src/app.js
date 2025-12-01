    let participants = [];
    let currentMode = 'organizer';

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
        const name = input.value.trim();
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
        
        if (participants.length === 0) {
            list.innerHTML = '<div class="empty-state">Agrega al menos 3 participantes para comenzar</div>';
            generateBtn.style.display = 'none';
        } else {
            list.innerHTML = participants.map(name => `
                <div class="participant-item">
                    <span class="participant-name">${name}</span>
                    <button class="btn-danger" onclick="removeParticipant('${name}')">Eliminar</button>
                </div>
            `).join('');
            
            generateBtn.style.display = participants.length >= 3 ? 'block' : 'none';
        }
    }

    async function generateCodes() {
        if (participants.length < 3) {
            alert('Se necesitan al menos 3 participantes');
            return;
        }

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
            alert('Error al generar el sorteo. Intenta de nuevo.');
            return;
        }

        // Guardar en almacenamiento persistente
        try {
            const sorteoId = 'sorteo-' + Date.now();
            for (const assignment of assignments) {
                await window.storage.set(
                    assignment.code, 
                    JSON.stringify({
                        giver: assignment.giver,
                        receiver: assignment.receiver,
                        sorteoId: sorteoId
                    }),
                    true // compartido
                );
            }

            // Mostrar códigos
            showCodes(assignments);
        } catch (error) {
            alert('Error al guardar los códigos. Por favor intenta de nuevo.');
            console.error(error);
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
        
        errorMsg.textContent = '';
        
        if (code === '') {
            errorMsg.textContent = 'Por favor ingresa un código';
            return;
        }

        try {
            const result = await window.storage.get(code, true);
            
            if (!result) {
                errorMsg.textContent = 'Código inválido o ya usado';
                return;
            }

            const data = JSON.parse(result.value);
            
            // Mostrar resultado
            document.getElementById('giftName').textContent = data.receiver;
            document.getElementById('codeInputPhase').style.display = 'none';
            document.getElementById('resultPhase').style.display = 'block';
            
            // Eliminar el código para que no se pueda usar de nuevo
            await window.storage.delete(code, true);
            
        } catch (error) {
            errorMsg.textContent = 'Código inválido o ya usado';
            console.error(error);
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