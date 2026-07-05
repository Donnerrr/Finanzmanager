let currentPersonId = null; // Globale Variable, um die aktuelle Person zu speichern
let currentPersonName = null; // Globale Variable, um den aktuellen Personennamen zu speichern
let currentDebtId = null; // Globale Variable, um die aktuelle Schuld zu speichern
const API_BASE = "https://finanzen.pottanker.de";

/* ==========================================================================
   1. NAVIGATION (ANSICHTEN UMSCHALTEN)
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


/* ==========================================================================
   2. DYNAMISCHES LADEN & DB-SCHNITTSTELLEN
   ========================================================================== */
//#region Dynamisches Personen laden
// Läuft beim Klick auf "Schuldenbuch"
async function loadPersonsFromDB() {
    console.log("DB-Aufruf: Lade alle Personen...");
    const container = document.getElementById("Schulden-Container");

    container.innerHTML = '<div class="loading">Lade Personen...</div>'; // Korrigiert: "<" ergänzt

    try {
        const response = await fetch('${API_BASE}/api/Schuldenbuch/Person');
        
        if (!response.ok) {
            throw new Error(`Server-Fehler: ${response.status} ${response.statusText}`);
        }

        const persons = await response.json();

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
                    <button class="btn btn-primary" onclick="deletePerson(event, ${person.id})">Löschen</button>
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
    
    document.getElementById("CurrentPersonName").innerText = "Lade Details...";
    
    const container = document.getElementById("Personen-Schulden-Container");
    container.innerHTML = '<div class="loading">Lade Schulden...</div>';

    try {
        const response = await fetch(`${API_BASE}/api/Schuldenbuch/Person/${personId}`);
        
        if (!response.ok) {
            throw new Error(`Server-Fehler: ${response.status}`);
        }

        const data = await response.json();

        // 1. DA WAR DER FEHLER: Wir müssen über data.person gehen!
        const personObj = data.person;

        if (personObj) {
            // Namen setzen
            document.getElementById("CurrentPersonName").innerText = `Schulden von ${personObj.name}`;
            
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
                    <div class="app">
                        <h3>${formatCurrency(debt.amount)}</h3>
                        <div class="details">${escapeHtml(debt.reason || 'Kein Verwendungszweck')}</div>
                        <button class="btn btn-primary" onclick="deleteDebt(${debt.id})">Löschen</button>
                        <button class="btn btn-primary" onclick="openUpdateDebtModal(${debt.id}, ${debt.amount})">Bearbeiten</button>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', personCard);
                
            });
        } else {
            throw new Error("Personen-Objekt fehlt in der Server-Antwort");
        }

    } catch (error) {
        console.error("Fehler beim Laden der Schulden:", error);
        document.getElementById("CurrentPersonName").innerText = "Fehler beim Laden";
        container.innerHTML = '<div class="error-state">Fehler beim Laden der Daten vom Server.</div>';
    }
}

//#endregion

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

//#region MODAL-FUNKTIONEN

function openModal(modalId) {
    document.getElementById(modalId).classList.remove("hidden");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add("hidden");
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
    
    try {
        const response = await fetch('${API_BASE}/api/Schuldenbuch/Person', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(personData)
        });

        if (response.ok) {
            console.log('Person erfolgreich gespeichert!');
            closeModal('AddPersonModal'); 
            loadPersonsFromDB(); 
            document.getElementById("add-person-form").reset(); 
        } else {
            console.error('Fehler beim Speichern der Person:', response.statusText);
            alert('Fehler beim Speichern der Person. Bitte versuchen Sie es erneut.');
        }
    } catch (error) {
        console.error('Fehler beim Speichern der Person:', error);
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
        const response = await fetch('${API_BASE}/api/Schuldenbuch/Debt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(entryData)
        });

        if (response.ok) {
            console.log('Schuld erfolgreich gespeichert!');
            closeModal('AddEntryModal'); 
            document.getElementById("add-entry-form").reset(); 
            loadPersonDetails(currentPersonId); 

        } else {
    const errorText = await response.text();
    console.error('Fehler beim Speichern der Schuld:', errorText);
    alert('Fehler: ' + errorText);
}
    } catch (error) {
        console.error('Fehler beim Speichern der Schuld:', error);
    }
}
//#endregion

//#region HILFSFUNKTIONEN


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

//#region SCHULD LÖSCHEN
async function deleteDebt(debtId) {
    if (confirm("Sind Sie sicher, dass Sie diese Schuld löschen möchten?")) {
        
        const response = await fetch(`${API_BASE}/api/Schuldenbuch/Debt/${debtId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            console.log('Schuld erfolgreich gelöscht!');
            loadPersonDetails(currentPersonId); 
        } else {
            console.error("Fehler beim Löschen:", await response.text());
        }
    }

}

//#endregion

//#region PERSON LÖSCHEN
async function deletePerson(event, personId) {
    event.stopPropagation(); // Verhindert das Auslösen des onclick-Events der Kachel
    if (confirm("Sind Sie sicher, dass Sie diese Person löschen möchten?")) {

        const response = await fetch(`${API_BASE}/api/Schuldenbuch/Person/${personId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            console.log('Person erfolgreich gelöscht!');
            loadPersonsFromDB();
            
        } else {
            console.error("Fehler beim Löschen:", await response.text());
        }
    }
}

//#endregion

//#region Update Debt Modal öffnen
function openUpdateDebtModal(debtId) {
    currentDebtId = debtId; // Speichert die aktuelle Schuld-ID in der globalen Variable
    document.getElementById("update-debt-id").value = debtId; // Setzt die Schuld-ID im versteckten Input-Feld
    openModal('UpdateDebtModal');
}

//#endregion

//#region SCHULD AKTUALISIEREN
async function updateDebt(event) {
    event.preventDefault();
    
    
    const debtId = currentDebtId; // Verwendet die globale Variable, die beim Öffnen des Modals gesetzt wurde
    const updatedAmount = document.getElementById("update-debt-amount").value;


    try {
        const response = await fetch(`${API_BASE}/api/Schuldenbuch/Debt/${debtId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedAmount)
        });

        if (response.ok) {
            console.log('Schuld erfolgreich aktualisiert!');
            closeModal('UpdateDebtModal');
            loadPersonDetails(currentPersonId);
            currentDebtId = null; // Setzt die globale Variable zurück
            document.getElementById("update-debt-amount").value = ""; // Setzt das Formular zurück
        } else {
            console.error("Fehler beim Aktualisieren:", await response.text());
        }
    } catch (error) {
        console.error("Fehler beim Aktualisieren:", error);
    }
}

//#endregion
