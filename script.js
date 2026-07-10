const API_BASE = "https://api.pottanker.de";
const API_TEST = "https://dev.pottanker.de";
let currentPersonId = null; // Globale Variable, um die aktuelle Person zu speichern
let currentPersonName = null; // Globale Variable, um den aktuellen Personennamen zu speichern
let currentDebtId = null; // Globale Variable, um die aktuelle Schuld zu speichern
let currentDeletePersonId = null; // Globale Variable, um die aktuelle Person für das Löschen zu speichern
let currentDeleteDebtId = null; // Globale Variable, um die aktuelle Schuld für das Löschen zu speichern




document.addEventListener('DOMContentLoaded', () =>{
    const token = localStorage.getItem('token');
    if(!token){
        openModal('AuthModal');
    } else{
        loadFinancesFromDB();
    }
});




//#region Hilfsfunktionen
/* ==========================================================================
   0. HILFSFUNKTIONEN
   ========================================================================== */
// Hilfsfunktion: Blendet alle Sektionen aus
function hideAllSections() {
    document.getElementById("SchuldenSection").classList.add("hidden");
    document.getElementById("SchuldenDetailSection").classList.add("hidden");
    document.getElementById("FinanzSection").classList.add("hidden");
    
    const mainDashboard = document.querySelector("body > .app-container:not([id])");
    const mainSubtitle = document.querySelector(".subtitle");
    
    if (mainDashboard) mainDashboard.classList.add("hidden");
    if (mainSubtitle) mainSubtitle.classList.add("hidden");
}

// Hilfsfunktion: Vereinfacht den API Aufruf
async function authorizedFetch(endpoint, method = 'Get', body = null)
{
    const token = localStorage.getItem('token');        //Token aus dem Local Storage laden

    if(!token)      //Wenn kein Token -> Login
    {
        console.warn('Kein Token gefunden - Weiterleitung zum Login');

        openModal('authModal');
        return Promise.reject(new Error('Nicht authentifiziert'));
    }

    // Token direkt in den Headern verankern
    const options = {
        method: method,
        headers: {
            'Authorization': `Bearer ${token}`,
            }
        };

    // Body nur mitschicken wenn wirklich gebraucht wird
    if(body !== null && (method === 'POST' || method === 'PUT' || method === 'PATCH'))
    {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    try
    {
        const response = await fetch(`${API_TEST}/api/Schuldenbuch/${endpoint}`, options);

        if(!response.ok)
        {
            let errorMsg = `Felhler ${response.status}`;
            try
            {
                const errorData = await response.json();
                errorMsg = errorData.message || errorData.title || errorMsg;
            }
            catch (e){}
            throw new Error(errorMsg);
        }

        if(response.status === 204) {return null;}

        return await response.json();
    }
    catch (error)
    {
        console.error(`API Fehler bei ${method} ${endpoint}:`, error);
        throw error;
    }

}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}
//#endregion

//#region Navigation
/* ==========================================================================
   1. NAVIGATION (ANSICHTEN UMSCHALTEN)
   ========================================================================== */



// Ebene 1: Zurück zum Dashboard
function openDashboard() {
    hideAllSections();
    
    const mainDashboard = document.querySelector("body > .app-container:not([id])");
    const mainSubtitle = document.querySelector(".subtitle");
    
    if (mainDashboard) mainDashboard.classList.remove("hidden");
    if (mainSubtitle) mainSubtitle.classList.remove("hidden");
}

// Ebene 2a: Schulden-Personenübersicht öffnen
function openDebts() {
    hideAllSections();
    document.getElementById("SchuldenSection").classList.remove("hidden");
    loadPersonsFromDB();
}

// Ebene 2b: Eigene Finanzen / Raten öffnen
function openFinances() {
    hideAllSections();
    document.getElementById("FinanzSection").classList.remove("hidden");
    loadFinancesFromDB();
}

//#endregion

/* ==========================================================================
   2. DYNAMISCHES LADEN & DB-SCHNITTSTELLEN
   ========================================================================== */
//#region Dynamisches Personen laden
// Läuft beim Klick auf "Schuldenbuch"
async function loadPersonsFromDB() {
    console.log("DB-Aufruf: Lade alle Personen...");

    const container = document.getElementById("Schulden-Container");
    container.innerHTML = '<div class="loading">Lade Personen...</div>';

    try {
        
        const persons = await authorizedFetch('Person');

        if (persons.length === 0) {
            container.innerHTML = '<div class="empty-state">Keine Personen gefunden.</div>';
            return;
        }

        container.innerHTML = ''; 

        // Dynamisches Erstellen der Personenkacheln
        persons.forEach(person => {
            
            const personCard = `
                <div class="app" onclick="loadPersonDetails(${person.id}, '${escapeHtml(person.name)}')">
                    <h3>${escapeHtml(person.name)}</h3>
                    
                    <div class="details">${escapeHtml(person.street)}, ${escapeHtml(person.zipCode)} ${escapeHtml(person.city)}</div>
                    <button class="btn btn-danger" onclick="openDeletePersonModal(event, ${person.id})">Löschen</button>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', personCard);
        });

    } catch (error) { // Korrigiert: Hier hat der gesamte Catch-Block gefehlt!
        console.error("Fehler beim Laden der Personen:", error);
        container.innerHTML = '<div class="error-state">Fehler beim Laden der Daten vom Server.</div>';
    }
}
//#endregion

//#region Dynamisches Laden der Schulden einer Person
// Ebene 3: Läuft beim Klick auf eine Personenkachel
async function loadPersonDetails(personId) {
    currentPersonId = personId; 
    hideAllSections();

    document.getElementById("SchuldenDetailSection").classList.remove("hidden");
    
    const titelEl = document.getElementById("CurrentPersonName");
    titelEl.innerText = "Lade Details..."; // Setzt den Titel auf "Lade Details..." während der Datenabfrage
    titelEl.classList.add("pulse-loading"); // Optional: Füge eine Lade-Klasse hinzu, um visuelles Feedback zu geben
    
    const container = document.getElementById("Personen-Schulden-Container");
    container.innerHTML = '<div class="loading">Lade Schulden...</div>';

    try {
        
        const data = await authorizedFetch(`Person/${personId}`);

        const personObj = data.person;

        if (personObj) {
            // Namen setzen
            titelEl.innerText = `Schulden von ${personObj.name}`;
            titelEl.classList.remove("pulse-loading"); // Entfernt die Lade-Klasse, wenn die Daten geladen sind
            
            // Schulden-Array holen
            const debts = personObj.debts || [];

            if (debts.length === 0) {
                container.innerHTML = '<div class="empty-state">Keine Schulden gefunden.</div>';
                return;
            }

            container.innerHTML = ''; 

            // Kacheln rendern (mit debt.reason aus deinem Swagger)
            debts.forEach(debt => {
                const personCard = `
                    <div class="app app-schulden">
                        <h3>${formatCurrency(debt.amount)}</h3>
                        <div class="details">${escapeHtml(debt.reason || 'Kein Verwendungszweck')}</div>
                        <button class="btn btn-danger" onclick="openDeleteDebtModal(${debt.id})">Löschen</button>
                        <button class="btn btn-secondary" onclick="openUpdateDebtModal(${debt.id}, ${debt.amount})">Bearbeiten</button>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', personCard);
                
            });
        } else {
            throw new Error("Personen-Objekt fehlt in der Server-Antwort");
        }

    } catch (error) {
        console.error("Fehler beim Laden der Schulden:", error);
        titelEl.innerText = "Fehler beim Laden";
        titelEl.classList.remove("pulse-loading");
        container.innerHTML = '<div class="error-state">Fehler beim Laden der Daten vom Server.</div>';
    }
}

//#endregion

//#region Finanzen
// Läuft beim Klick auf "Finanzen"
function loadFinancesFromDB() {
    console.log("DB-Aufruf: Lade eigene Finanzen & Raten...");
    const container = document.getElementById("Finanzen-Container");
    
    container.innerHTML = `
        <div class="app">
            <h3>Fitnessstudio</h3>
            <div class="amount">29,90 €</div>
            <div class="details">Monatlich (1. des Monats)</div>
        </div>
    `;
}
//#endregion

//#region MODAL-FUNKTIONEN

function openModal(modalId) {
    document.getElementById(modalId).classList.remove("hidden");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add("hidden");
}

//#endregion

//#region Delete Person Modal öffnen
function openDeletePersonModal(event, personId) {
    event.stopPropagation(); // Verhindert das Auslösen des onclick-Events der Kachel
    currentDeletePersonId = personId; // Speichert die aktuelle Person-ID in der globalen Variable
    openModal('ConfirmDeletePersonModal');
}
//#endregion

//#region Delete Debt Modal öffnen
function openDeleteDebtModal(debtId) {
    currentDeleteDebtId = debtId; // Speichert die aktuelle Schuld-ID in der globalen Variable
    openModal('ConfirmDeleteDebtModal');
}
//#endregion

//#region Update Debt Modal öffnen
function openUpdateDebtModal(debtId) {
    currentDebtId = debtId; // Speichert die aktuelle Schuld-ID in der globalen Variable
    document.getElementById("update-debt-id").value = debtId; // Setzt die Schuld-ID im versteckten Input-Feld
    openModal('UpdateDebtModal');
}

//#endregion

//#region PERSONEN-HINZUFÜGEN
async function savePerson(event) {
    event.preventDefault(); 
    
    const personData = {
        name: document.getElementById("person-name").value,
        street: document.getElementById("street").value,
        zipcode: document.getElementById("ZipCode").value,
        city: document.getElementById("city").value
    };
    
    try 
    {
            await authorizedFetch('Person', 'POST', personData);
            console.log('Person erfolgreich gespeichert');
            closeModal('AddPersonModal');
            loadPersonsFromDB();
            document.getElementById("add-person-form").reset;
    }

    catch (error) 
    {
        console.error('Fehler beim Speichern der Person:' + error.message);
    }
}
//#endregion

//#region SCHULD-HINZUFÜGEN
async function saveEntry(event) {
    event.preventDefault(); 

    if (currentPersonId === null) {
        console.error('Keine Person ausgewählt.');
        alert('Keine Person ausgewählt.');
        return;
    }
    
    const entryData = {
        personId: currentPersonId, 
        amount: document.getElementById("entry-amount").value,
        description: document.getElementById("entry-purpose").value // Im HTML heißt die ID 'entry-purpose'
    };

    console.log("Sende Payload an API:", JSON.stringify(entryData));

    try {
            await authorizedFetch('Debt', 'POST', entryData);
            console.log('Schuld erfolgreich gespeichert');
            closeModal('AddEntryModal');
            document.getElementById("add-entry-form").reset;33

            loadPersonDetails(currentPersonId);
    }
    
    catch (error) {
        console.error('Fehler beim Speichern der Schuld:' + error.message);
    }
}
//#endregion

//#region SCHULD LÖSCHEN
async function deleteDebt() {
        
    try {
        await authorizedFetch(`Debt/${currentDeleteDebtId}`, 'DELETE');
        console.log('Schuld erfolgreich gelöscht');
        closeModal('ConfirmDeleteDebtModal');
        loadPersonDetails(currentPersonId);
    } catch (error) {
        console.error("Fehler beim Löschen:" + error.message);
    } finally {
        currentDeleteDebtId = null;
    }

}

//#endregion

//#region PERSON LÖSCHEN
async function deletePerson(event) {
    event.stopPropagation(); // Verhindert das Auslösen des onclick-Events der Kachel    

        try 
        {
            await authorizedFetch(`Person/${currentDeletePersonId}`, 'DELETE');
            console.log('Person erfolgreich gelöscht');
            closeModal('ConfirmDeletePersonModal');
            loadPersonsFromDB();   
        } 
        catch (error) {
            console.error("Fehler beim Löschen:" + error.message);
        }
        finally {
            currentDeletePersonId = null; // Setzt die globale Variable zurück
        }
}

//#endregion

//#region SCHULD AKTUALISIEREN
async function updateDebt(event) {
    event.preventDefault();
    
    
    const debtId = currentDebtId; // Verwendet die globale Variable, die beim Öffnen des Modals gesetzt wurde
    const updatedAmount = document.getElementById("update-debt-amount").value;


    try {
        await authorizedFetch(`Debt/${debtId}`, 'PUT', {amount: updatedAmount});
        console.log('Schuld erfolgreich aktualisiert');
        closeModal('UpdateDebtModal');
        
        loadPersonDetails(currentPersonId);
        currentDebtId = null;
        document.getElementById("update-debt-amount").value = "";
    
    } catch (error) {
        console.error("Fehler beim Aktualisieren:" + error.message);
    }
}

//#endregion

//#region Authentifizieren
async function login() {
    const username = document.getElementById('authUsername').value;
    const password = document.getElementById('authPassword').value;

    try {
        const response = await fetch(`${API_TEST}/api/Auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();   // <-- WICHTIG
            localStorage.setItem('token', data.token);
            loadPersonInfoModal();
        } else {
            const errorData = await response.json();
            let errorMsg = errorData.detail || errorData.message || JSON.stringify(errorData);
            alert(`Fehler: ${errorMsg}`);
        }
    } catch (error) {
        alert(`Fehler: ${error.message}`);
    }
}


async function register() {
    const username = document.getElementById('authUsername').value;
    const password = document.getElementById('authPassword').value;

    try{
        const response = await fetch(`${API_TEST}/api/Auth/register`,{
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({Username: username, Password: password})
        });

        if (!response.ok){
            let errorMsg = `HTTP ${response.status}`;

            try{
                const errorData = await response.json();
                errorMsg = errorData.detail
                        || errorData.title
                        || errorData.message
                        || JSON.stringify(errorData);
            } catch(e){
                try{errorMsg = await response.text()}catch(_){}
            }
        } 
            const data =  response.json();

            localStorage.setItem('token', data.token);
            closeModal('AuthModal');
            loadPersonsFromDB();
        
        
    } catch(error){
        alert('Fehler: '+ error.message);
    }
}


function logout(){
    localStorage.removeItem('token');
    openDashboard();
    start();

}

function start(){
    const token = localStorage.getItem('token');
    if(!token){
        openModal('AuthModal');
    } else{
        loadFinancesFromDB();
    }
}

//#endregion