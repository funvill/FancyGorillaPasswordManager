// SQLite initialization
// ---------------------
let SQL = null;
let db = null;
const DBPassword = 'password';

// Helpers
// ---------------------
function Debug(message) {
  console.log(message);
  // Update the LogResults with the message
  document.getElementById('LogResults').innerHTML += message + "<br>";

}

if (!crypto || !crypto.subtle) {
  alert("Web Crypto API is not available in this environment");
} else {
  Debug("Web Crypto API is available");
}





async function StartUp() {
  // Create a new SQL.js instance
  SQL = await initSqlJs({
    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${file}`
  });
  Debug("SQLite initialized");

  // Create a new in-memory database
  db = new SQL.Database();
}
try {
  StartUp();
} catch (error) {
  Alert("Error initializing SQLite: " + error);
}

// UI Functions
// ---------------------

// Result: [{"columns":["id","name","username","password"],"values":[[1,"Google","admin","447Witty-Pink-Flamingo"],[2,"Slack","admin","332#Funny-Green-Spider"],[3,"Twitter","admin","562.Beautiful-Magenta-Dove"]]}]
function DisplaySearchResults(results) {

  // Clear the LogResults
  let SearchResultsDOM = document.getElementById('SearchResults');

  SearchResultsDOM.innerHTML = "No results found for '" + document.getElementById('SearchBox').value + "'";

  if (!results || !results.length) {
    return;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  const tr = document.createElement('tr');

  // The first column is 'Actions'
  const th = document.createElement('th');
  th.appendChild(document.createTextNode('Actions'));
  tr.appendChild(th);

  // Create the header
  for (const column of results[0].columns) {
    const th = document.createElement('th');
    th.appendChild(document.createTextNode(column));
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  table.appendChild(thead);

  // Create the rows
  for (const row of results[0].values) {
    const tr = document.createElement('tr');

    // The first column is 'Actions'.
    // Add a button to edit the password
    const td = document.createElement('td');
    const button = document.createElement('button');
    button.appendChild(document.createTextNode('Edit'));
    button.onclick = function () {
      EditPassword(row[0]);
    };
    td.appendChild(button);
    tr.appendChild(td);

    for (const value of row) {
      const td = document.createElement('td');
      td.appendChild(document.createTextNode(value));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  SearchResultsDOM.innerHTML = "";
  SearchResultsDOM.appendChild(table);
}


// UX Functions 
// ---------------------
function CreateDatabase() {
  Debug('Creating Database...');

  if (!db) {
    Debug("SQLite not initialized");
    return;
  }

  const DEFAULT_DATABASE_SQL = `
create table passwords(id integer primary key, label, username, password, notes);
INSERT INTO passwords (label, username, password, notes) VALUES 
('Google', 'admin', '447Witty-Pink-Flamingo', 'This is a note for Google'),
('Slack', 'admin', '332#Funny-Green-Spider', 'This is a note for Slack'),
('Twitter', 'admin', '562.Beautiful-Magenta-Dove', 'This is a note for Twitter');
`;

  // Create a new table
  try {
    db.run(DEFAULT_DATABASE_SQL);
    Debug('Database created');
  } catch (error) {
    Debug("Error creating table: " + error);
  }

  SearchDatabase();
}

function UploadDatabase() {
  Debug("Uploading database...");

  // Trigger file picker so the user can select a file. Then read the file and load it into the database
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.password_db';

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) {
      Debug("No file selected");
      return;
    }
    Debug("File selected: " + file.name);

    const reader = new FileReader();
    reader.onload = function (event) {
      Debug("Database uploaded...");

      const buffer = event.target.result;
      const uInt8Array = new Uint8Array(buffer);

      // Decrypt the database
      decryptDataWithPassword(DBPassword, uInt8Array).then((decryptedBlob) => {
        Debug("Database decrypted...");

        db = new SQL.Database(decryptedBlob);

        Debug("Database loaded");
        SearchDatabase();
      });
    };
    reader.readAsArrayBuffer(file);
  };

  fileInput.click();
}

function DownloadDatabase() {
  Debug("Downloading database");

  if (!db) {
    Debug("SQLite not initialized");
    return;
  }

  // Get the database file
  const data = db.export();
  const buffer = new Uint8Array(data);

  // Encrypt the database  
  encryptDataWithPassword(DBPassword, buffer).then((encryptedBlob) => {
    // Create a download link
    const link = document.createElement('a');
    const blob = new Blob([encryptedBlob], {
      type: 'application/octet-stream'
    });
    link.href = URL.createObjectURL(blob);
    link.download = 'database.password_db';

    // Trigger the download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

function AddNewPassword() {
  Debug("Adding new password...");

  if (!db) {
    Debug("SQLite not initialized");
    return;
  }

  let label = document.getElementById('AddLabel').value;
  let username = document.getElementById('AddUsername').value;
  let password = document.getElementById('AddPassword').value;
  let notes = document.getElementById('AddNotes').value;

  Debug("Adding password: " + label + ", " + username + ", " + password);

  // Add the password
  try {
    db.run(`INSERT INTO passwords (label, username, password, notes) VALUES ('${label}', '${username}', '${password}', '${notes}')`);
    Debug("Password added");
  } catch (error) {
    Debug("Error adding password: " + error);
  }

  // Update the search text with the new label
  document.getElementById('SearchBox').value = label;
  // Search for the new password
  SearchDatabase();
}

function EditPassword(id) {

  if (!db) {
    Debug("SQLite not initialized");
    return;
  }

  if (!id) {
    Debug("No ID provided");
    return;
  }

  // Get the password details
  let results = db.exec(`SELECT * FROM passwords WHERE id=${id}`);

  if (!results || !results.length) {
    Debug("No results found for ID: " + id);
    return;
  }

  Debug("Editing password: " + id + ", " + results[0].values[0][1]);

  // Update the search text with the new label
  document.getElementById('SearchBox').value = results[0].values[0][1];
  // Search for the new password
  SearchDatabase();

  // Update the section #edit with a form to edit the password

  let EditForm = document.getElementById('Edit');
  EditForm.innerHTML = "<h2>Edit Password</h2>";

  // Create the form
  const form = document.createElement('form');
  form.id = 'EditPasswordForm';
  form.onsubmit = function (event) {
    event.preventDefault();
    UpdatePassword();
  };

  // Add the ID
  const idInput = document.createElement('input');
  idInput.type = 'hidden';
  idInput.id = 'EditID';
  idInput.value = id;
  form.appendChild(idInput);

  // Add the label
  const labelInputLabel = document.createElement('label');
  labelInputLabel.htmlFor = 'EditLabel';
  labelInputLabel.appendChild(document.createTextNode('Label'));
  form.appendChild(labelInputLabel);

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.id = 'EditLabel';
  labelInput.value = results[0].values[0][1];
  form.appendChild(labelInput);

  // Add the username
  const usernameInputLabel = document.createElement('label');
  usernameInputLabel.htmlFor = 'EditUsername';
  usernameInputLabel.appendChild(document.createTextNode('Username'));
  form.appendChild(usernameInputLabel);

  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.id = 'EditUsername';
  usernameInput.value = results[0].values[0][2];
  form.appendChild(usernameInput);

  // Add the password
  const passwordInputLabel = document.createElement('label');
  passwordInputLabel.htmlFor = 'EditPassword';
  passwordInputLabel.appendChild(document.createTextNode('Password'));
  form.appendChild(passwordInputLabel);

  const passwordInput = document.createElement('input');
  passwordInput.type = 'text';
  passwordInput.id = 'EditPassword';
  passwordInput.value = results[0].values[0][3];
  form.appendChild(passwordInput);

  // Add the notes
  const notesInputLabel = document.createElement('label');
  notesInputLabel.htmlFor = 'EditNotes';
  notesInputLabel.appendChild(document.createTextNode('Notes'));
  form.appendChild(notesInputLabel);

  const notesInput = document.createElement('textarea');
  notesInput.id = 'EditNotes';
  notesInput.value = results[0].values[0][4];
  form.appendChild(notesInput);
  form.appendChild(document.createElement('br'));

  // Add the submit button
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.appendChild(document.createTextNode('Update Password'));
  form.appendChild(submitButton);

  EditForm.appendChild(form);

}

function UpdatePassword() {

  if (!db) {
    Debug("SQLite not initialized");
    return;
  }

  let id = document.getElementById('EditID').value;
  let label = document.getElementById('EditLabel').value;
  let username = document.getElementById('EditUsername').value;
  let password = document.getElementById('EditPassword').value;
  let notes = document.getElementById('EditNotes').value;

  Debug("Updating password: " + id + ", " + label + ", " + username + ", " + password);

  // Update the password
  try {

    // Update the password in the database, the user submitted text may contain single quotes, so we need to escape them

    db.run(`UPDATE passwords SET label='${label.replace(/'/g, "''")}', username='${username.replace(/'/g, "''")}', password='${password.replace(/'/g, "''")}', notes='${notes.replace(/'/g, "''")}' WHERE id=${id}`);
    Debug("Password updated");

    // Remove the edit form
    document.getElementById('Edit').innerHTML = "";

  } catch (error) {
    Debug("Error updating password: " + error);
  }

  // Update the search text with the new label
  document.getElementById('SearchBox').value = label;
  // Search for the new password
  SearchDatabase();
}

function SearchDatabase() {
  Debug('Searching Database...');

  if (!db) {
    Debug("SQLite not initialized");
    return;
  }

  let SearchQuery = document.getElementById('SearchBox').value.trim();
  Debug("Search query: " + SearchQuery);

  // Search the database
  try {
    let results = db.exec(`SELECT * FROM passwords WHERE label LIKE '%${SearchQuery}%' OR username LIKE '%${SearchQuery}%' OR password LIKE '%${SearchQuery}%' OR notes LIKE '%${SearchQuery}%'`);

    DisplaySearchResults(results);
  } catch (error) {
    Debug("Error searching database: " + error);
    DisplaySearchResults(null);
  }
}

// Hardcoded constants
const ITERATIONS = 100000;
const SALT_LENGTH = 16; // 16 bytes salt
const IV_LENGTH = 12;   // 12 bytes IV (recommended for AES-GCM)
const KEY_LENGTH = 256; // AES-GCM 256-bit key length

// Encryption functions 
// --------------------



// Encrypt a text using the password, automatically generating salt and IV
async function encryptDataWithPassword(password, decrypted_uInt8Array) {

  return decrypted_uInt8Array;

  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  // Derive a key from the password
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), {
    name: 'PBKDF2'
  }, false, ['deriveBits', 'deriveKey']);

  const key = await crypto.subtle.deriveKey({
    name: 'PBKDF2',
    salt: salt,
    iterations: ITERATIONS,
    hash: 'SHA-256'
  }, keyMaterial, {
    name: 'AES-GCM',
    length: KEY_LENGTH
  }, true, ['encrypt']);

  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encrypt the data
  const encrypted = await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv: iv
  }, key, decrypted_uInt8Array);

  // Combine the salt, IV and the encrypted data
  const result = new Uint8Array(salt.byteLength + iv.byteLength + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.byteLength);
  result.set(new Uint8Array(encrypted), salt.byteLength + iv.byteLength);

  return result;

}

// Decrypt the data using the password
async function decryptDataWithPassword(password, encrypted_uInt8Array) {

  return encrypted_uInt8Array;

  // Get the salt, IV and the encrypted data
  const salt = encrypted_uInt8Array.slice(0, SALT_LENGTH);
  const iv = encrypted_uInt8Array.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const encrypted = encrypted_uInt8Array.slice(SALT_LENGTH + IV_LENGTH);

  // Derive the key
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), {
    name: 'PBKDF2'
  }, false, ['deriveBits', 'deriveKey']);

  const key = await crypto.subtle.deriveKey({
    name: 'PBKDF2',
    salt: salt,
    iterations: ITERATIONS,
    hash: 'SHA-256'
  }, keyMaterial, {
    name: 'AES-GCM',
    length: KEY_LENGTH
  }, true, ['decrypt']);

  // Decrypt the data
  const decrypted = await crypto.subtle.decrypt({
    name: 'AES-GCM',
    iv: iv
  }, key, encrypted);

  return decrypted;

}
