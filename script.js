import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getDatabase, ref, onValue, update, get, set } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyA-x8ZZvJXAOK7Q18PVWPybmfPZ7xDBNHo",
    authDomain: "tablero-pruebas.firebaseapp.com",
    databaseURL: "https://tablero-pruebas-default-rtdb.firebaseio.com",
    projectId: "tablero-pruebas"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUserRole = null; 
let isSuperAdmin = false; 
const passwords = {
    'jefe': '0520', 'daniel': '1234', 'luis': '5678', 'jorge': '0000'
};

// Lista Dinámica de Adicionales
let listaAdicionales = [];
onValue(ref(db, 'config_taller/adicionales'), (snapshot) => {
    listaAdicionales = snapshot.val() || ["Kit de Afinación", "Balatas Delanteras", "Balatas Traseras"];
});

// LÓGICA DE LOGIN Y ADMIN
document.getElementById('btnEntrar').addEventListener('click', () => {
    let user = document.getElementById('loginUser').value;
    let pin = document.getElementById('loginPin').value;

    if (pin === passwords[user] || pin === '2099') {
        currentUserRole = user;
        isSuperAdmin = (pin === '2099'); 
        
        document.getElementById('loginOverlay').style.display = 'none';
        
        let nombreDisplay = user === 'jefe' ? 'JEFE DE TALLER' : `🔧 TÉCNICO ${user.toUpperCase()}`;
        if(isSuperAdmin) {
            nombreDisplay += " - MODO ADMIN";
            document.getElementById('adminControlsTaller').style.display = 'flex';
        }
        document.getElementById('displayUser').innerText = nombreDisplay;
        
        document.getElementById('zonaBahias').style.display = 'block';
        document.getElementById('zonaTerminados').style.display = 'block';
        if(user === 'jefe' || isSuperAdmin) {
            document.getElementById('zonaJefe').style.display = 'block';
        }

        onValue(ref(db, 'citas_diarias'), (snapshot) => {
            renderizarTaller(snapshot.val() || {});
        });
    } else {
        alert("❌ PIN INCORRECTO.");
        document.getElementById('loginPin').value = '';
    }
});

document.getElementById('btnSalir').addEventListener('click', () => location.reload());

// Admin: Agregar/Quitar Adicionales
document.getElementById('btnAddAdicional').addEventListener('click', () => {
    let nuevo = prompt("Nuevo nombre de Trabajo Adicional:");
    if(nuevo && nuevo.trim() !== "") {
        listaAdicionales.push(nuevo);
        set(ref(db, 'config_taller/adicionales'), listaAdicionales);
    }
});

document.getElementById('btnDelAdicional').addEventListener('click', () => {
    let listadoTxt = listaAdicionales.map((m, i) => `${i + 1}. ${m}`).join("\n");
    let idx = prompt("Ingresa el NÚMERO del adicional que deseas eliminar:\n\n" + listadoTxt);
    if(idx && !isNaN(idx) && idx > 0 && idx <= listaAdicionales.length) {
        listaAdicionales.splice(idx - 1, 1);
        set(ref(db, 'config_taller/adicionales'), listaAdicionales);
    }
});

// RENDERIZADO DEL DASHBOARD Y TABLA KPI
function renderizarTaller(datos) {
    const gridEspera = document.getElementById('grid-espera');
    const gridBahias = document.getElementById('grid-bahias');
    const tbodyTerminados = document.getElementById('tbody-terminados');
    
    gridEspera.innerHTML = ''; gridBahias.innerHTML = ''; tbodyTerminados.innerHTML = '';
    
    let citasArray = Object.values(datos);

    citasArray.forEach(cita => {
        if (cita.asistio !== 'Sí' || cita.oculto) return;

        let adicTexto = '';
        if(cita.adicionales) {
            let tags = [];
            if(cita.adicionales.lista && cita.adicionales.lista.length > 0) {
                tags.push(...cita.adicionales.lista);
            }
            if(cita.adicionales.diagnostico_adicional) {
                tags.push("Diag: " + cita.adicionales.diagnostico_adicional);
            }
            adicTexto = tags.join(" | ");
        }

        let isConfirmado = (cita.estado_taller === 'confirmado');
        let isTerminado = (cita.estado_taller === 'terminado');

        // SI ESTÁ TERMINADO -> Va a la TABLA KPI
        if (isTerminado) {
            if(currentUserRole === 'jefe' || currentUserRole === cita.tecnico || isSuperAdmin) {
                let btnAdmin = isSuperAdmin ? `
                    <button class="btn-action btn-orange" style="padding:5px 10px; font-size:0.9rem;" onclick="revertirTrabajo('${cita.Folio}')">✏️ Revertir</button>
                    <button class="btn-action btn-red" style="padding:5px 10px; font-size:0.9rem; margin-top:5px;" onclick="eliminarRegistroTaller('${cita.Folio}')">🗑️ Ocultar</button>
                ` : '✔️ Terminado';

                let tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="color:#888;">${cita.Folio}</td>
                    <td><span class="placa">${cita.Placas}</span></td>
                    <td><strong style="color:var(--poke-blue);">${cita.Vehiculo}</strong><br><span style="font-size:0.9rem; color:#666;">${cita.Cliente}</span></td>
                    <td style="color:var(--poke-green); font-weight:700;">${cita.categoria}</td>
                    <td>${adicTexto || 'Ninguno'}</td>
                    <td style="font-weight:800;">${cita.tecnico.toUpperCase()}</td>
                    <td style="font-size:0.9rem; color:#666;">Asig: ${cita.hora_asignacion || '-'}<br>Fin: ${cita.hora_termino || '-'}</td>
                    <td>${btnAdmin}</td>
                `;
                tbodyTerminados.appendChild(tr);
            }
            return;
        }

        // SI NO ESTÁ TERMINADO -> PIT STOP O BAHÍAS
        let bloqueInfoCompleta = `
            <div class="info-grid">
                <div><p class="info-label">Fecha / Hora</p><p class="info-data">${cita.Fecha} | ${cita.Hora}</p></div>
                <div><p class="info-label">Asesor</p><p class="info-data">${cita.Asesor}</p></div>
                <div><p class="info-label">Folio</p><p class="info-data">${cita.Folio}</p></div>
                <div><p class="info-label">Placas</p><p class="info-data"><span class="placa">${cita.Placas}</span></p></div>
                <div class="info-full"><p class="info-label">Cliente</p><p class="info-data">${cita.Cliente}</p></div>
                <div class="info-full"><p class="info-label">Servicio Excel</p><p class="info-data" style="color:var(--poke-blue);">${cita.Servicio}</p></div>
            </div>
        `;

        // PIT STOP
        if (!cita.tecnico || cita.tecnico === "") {
            if(currentUserRole === 'jefe') {
                let magicBoxesHTML = listaAdicionales.map(item => `
                    <label class="magic-check">
                        <input type="checkbox" class="chk-adi-${cita.Folio}" value="${item}">
                        <div class="liquid-box"><div class="liquid-fill"></div><div class="sparkle"></div></div>
                        <span class="magic-label">${item}</span>
                    </label>
                `).join('');

                let card = document.createElement('div');
                card.className = 'car-card';
                if(cita.estado_taller === 'rechazado') card.style.borderLeftColor = 'var(--poke-red)';

                card.innerHTML = `
                    <div class="car-header"><span class="modelo">${cita.Vehiculo}</span></div>
                    ${cita.estado_taller === 'rechazado' ? '<p style="color:var(--poke-red); font-weight:bold; text-align:center;">⚠️ DEVUELTO POR TÉCNICO</p>' : ''}
                    ${bloqueInfoCompleta}
                    
                    <div class="assign-box">
                        <select class="assign-select" id="cat-${cita.Folio}">
                            <option value="">-- Categoría de Trabajo --</option>
                            <option value="Mantenimiento">Mantenimiento</option>
                            <option value="Diagnostico">Diagnóstico</option>
                            <option value="Reparacion">Reparación</option>
                            <option value="Mantenimiento y Diagnostico">Mantenimiento y Diagnóstico</option>
                            <option value="Mantenimiento y Reparacion">Mantenimiento y Reparación</option>
                            <option value="Diagnostico y Reparacion">Diagnóstico y Reparación</option>
                        </select>
                        <input type="text" class="assign-input" id="extra-${cita.Folio}" placeholder="Líneas Extra / Notas (Opcional)">
                        
                        <div style="margin-top: 15px; border-top: 2px dashed #eee; padding-top: 15px;">
                            <p style="color:var(--poke-blue); margin:0 0 10px 0; font-family:'Ubuntu', sans-serif; font-weight:700;">➕ ADICIONALES</p>
                            <div class="magic-checkbox-group">
                                ${magicBoxesHTML}
                            </div>
                            <input type="text" class="assign-input" id="diag-adi-${cita.Folio}" placeholder="Diagnósticos adicionales..." style="margin-top:15px;">
                        </div>

                        <select class="assign-select" id="tech-${cita.Folio}" style="margin-top:15px; border-color:var(--poke-dark);">
                            <option value="">-- Asignar a Técnico --</option>
                            <option value="daniel">Daniel</option>
                            <option value="jorge">Jorge</option>
                            <option value="luis">Luis</option>
                        </select>
                        <button class="btn-action btn-blue" onclick="asignarTrabajo('${cita.Folio}')" style="margin-top:10px; width:100%;">🚀 ASIGNAR A BAHÍA</button>
                    </div>
                `;
                gridEspera.appendChild(card);
            }
        } 
        // BAHÍAS
        else {
            if(currentUserRole === 'jefe' || currentUserRole === cita.tecnico || isSuperAdmin) {
                let badgeColor = isConfirmado ? 'background:var(--poke-yellow); color:var(--poke-dark);' : 'background:var(--poke-blue);';
                let labelStatus = isConfirmado ? 'TRABAJANDO' : cita.tecnico.toUpperCase();
                
                let actionBtns = '';
                if(currentUserRole === cita.tecnico) {
                    if (!isConfirmado) {
                        actionBtns = `
                            <div style="display:flex; gap:10px; margin-top:15px;">
                                <button class="btn-action btn-green" style="flex:1;" onclick="confirmarTrabajo('${cita.Folio}')">✔️ ACEPTAR</button>
                                <button class="btn-action btn-red" style="flex:1;" onclick="rechazarTrabajo('${cita.Folio}')">❌ DEVOLVER</button>
                            </div>`;
                    } else {
                        actionBtns = `<button class="btn-action btn-green" style="width:100%; margin-top:15px;" onclick="terminarTrabajo('${cita.Folio}')">🏁 TERMINAR TRABAJO</button>`;
                    }
                }
                if(currentUserRole === 'jefe' || isSuperAdmin) {
                    actionBtns += `<button class="btn-action btn-orange" style="width:100%; margin-top:15px;" onclick="desasignarTrabajo('${cita.Folio}')">↩️ DESASIGNAR</button>`;
                }

                let card = document.createElement('div');
                card.className = 'car-card';
                card.style.borderLeftColor = isConfirmado ? 'var(--poke-yellow)' : 'var(--poke-blue)';
                card.style.borderLeftWidth = '6px';
                card.innerHTML = `
                    <div class="tech-badge" style="${badgeColor}">${labelStatus}</div>
                    <div class="car-header"><span class="modelo">${cita.Vehiculo}</span></div>
                    ${bloqueInfoCompleta}
                    <div style="margin-top: 15px; border-top: 2px dashed #eee; padding-top: 15px;">
                        <p class="info-data" style="color:var(--poke-green);">📋 Cat Taller: <strong>${cita.categoria}</strong></p>
                        <p class="info-data" style="color:var(--poke-blue); font-size:0.95rem; margin-top:5px;">➕ Adicionales: ${adicTexto || 'Ninguno'}</p>
                        <p class="info-data" style="color:#666; font-size:0.95rem; margin-top:5px;">📝 Notas: ${cita.lineas_extra || 'Ninguna'}</p>
                    </div>
                    ${actionBtns}
                `;
                gridBahias.appendChild(card);
            }
        }
    });
}

// BUSCADOR EN TABLA KPI
document.getElementById('kpiSearch').addEventListener('keyup', function() {
    let filter = this.value.toLowerCase();
    let rows = document.querySelectorAll('#tbody-terminados tr');
    rows.forEach(row => {
        let text = row.innerText.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
    });
});

// FUNCIONES DE ACTUALIZACIÓN (ONCLICK)
window.asignarTrabajo = function(folio) {
    let cat = document.getElementById(`cat-${folio}`).value;
    let tech = document.getElementById(`tech-${folio}`).value;
    let extra = document.getElementById(`extra-${folio}`).value;
    let diagAdi = document.getElementById(`diag-adi-${folio}`).value;

    let checkboxes = document.querySelectorAll(`.chk-adi-${folio}:checked`);
    let seleccionados = Array.from(checkboxes).map(chk => chk.value);

    if(!cat || !tech) { alert("Debes seleccionar Categoría y Técnico."); return; }
    let hora = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    update(ref(db, `citas_diarias/${folio}`), { 
        tecnico: tech, 
        categoria: cat, 
        lineas_extra: extra, 
        estado_taller: "asignado", 
        hora_asignacion: hora,
        adicionales: {
            lista: seleccionados,
            diagnostico_adicional: diagAdi
        }
    });
};

window.confirmarTrabajo = function(folio) {
    let hora = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    update(ref(db, `citas_diarias/${folio}`), { estado_taller: "confirmado", hora_confirmacion: hora });
};

window.rechazarTrabajo = function(folio) {
    if(confirm("¿Seguro que deseas rechazar este trabajo? Regresará a Recepción.")) {
        update(ref(db, `citas_diarias/${folio}`), { tecnico: "", categoria: "", lineas_extra: "", adicionales: null, estado_taller: "rechazado" });
    }
};

window.desasignarTrabajo = function(folio) {
    if(confirm("¿Deseas quitarle este vehículo al técnico y devolverlo a Espera?")) {
        update(ref(db, `citas_diarias/${folio}`), { tecnico: "", categoria: "", lineas_extra: "", adicionales: null, estado_taller: "" });
    }
};

window.terminarTrabajo = function(folio) {
    if(confirm("🏁 ¿Confirmas que has terminado el trabajo al 100%?")) {
        let hora = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        update(ref(db, `citas_diarias/${folio}`), { estado_taller: "terminado", hora_termino: hora }).then(() => {
            get(ref(db, `citas_diarias/${folio}`)).then((snapshot) => {
                if (snapshot.exists()) {
                    set(ref(db, `kpi_taller/${folio}_${Date.now()}`), snapshot.val());
                }
            });
        });
    }
};

window.revertirTrabajo = function(folio) {
    if(confirm("✏️ ¿Deseas devolver este auto a estado TRABAJANDO?")) {
        update(ref(db, `citas_diarias/${folio}`), { estado_taller: "confirmado", hora_termino: null });
    }
};

window.eliminarRegistroTaller = function(folio) {
    if(confirm("⚠️ ¿Deseas quitar este vehículo permanentemente del tablero?")) {
        update(ref(db, `citas_diarias/${folio}`), { estado_taller: "archivado" });
    }
};
