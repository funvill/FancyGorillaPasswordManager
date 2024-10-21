// Start the web server with HTTPs
// 
// openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem
// http-server -S

// SQLite initialization
// ---------------------
let SQL = null;
let db = null;
// const DBPassword = 'password';
const DB_EXTENSION = '.password_db';
// const DB_EXTENSION = '.sqlite';

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
  fileInput.accept = DB_EXTENSION;

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) {
      Debug("No file selected");
      return;
    }
    Debug("File selected: " + file.name);

    // Get the database password 
    let DBPassword = prompt("Enter the database password");
    Debug("Database password: " + DBPassword);

    const reader = new FileReader();
    reader.onload = async function (event) {
      Debug("Database uploaded...");

      const buffer = event.target.result;
      const uInt8Array = new Uint8Array(buffer);

      try {
        // Decrypt the database
        let decryptedBlob = await decryptDataWithPassword(DBPassword, uInt8Array);
        Debug("Database decrypted...");

        const decryptedUint8Array = new Uint8Array(decryptedBlob);
        db = new SQL.Database(decryptedUint8Array);

      } catch (error) {
        alert("Error decrypting database: " + error);
        return;
      }

      Debug("Database loaded");
      SearchDatabase();

    };
    reader.readAsArrayBuffer(file);
  };

  fileInput.click();
}

async function DownloadDatabase() {
  Debug("Downloading database");

  if (!db) {
    Debug("SQLite not initialized");
    return;
  }

  let DBPassword = prompt("Enter the database password");
  Debug("Database password: " + DBPassword);

  // Get the database file
  const data = db.export();
  const buffer = new Uint8Array(data);

  // Encrypt the database  
  let encryptedBlob = await encryptDataWithPassword(DBPassword, buffer);

  // Create a download link
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([encryptedBlob]));
  link.download = 'database' + DB_EXTENSION;

  // Trigger the download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

// Encryption functions 
// --------------------

// Constants
const SALT_LENGTH = 16; // Length of the salt (in bytes)
const IV_LENGTH = 12;   // Length of the initialization vector (in bytes)
const PBKDF2_ITERATIONS = 100000; // Number of PBKDF2 iterations
const KEY_LENGTH = 256; // Length of the AES-GCM key (in bits)
const HASH_ALGORITHM = "SHA-256"; // Hash algorithm for PBKDF2

async function encryptDataWithPassword(password, decryptedArrayBuffer) {
  const encoder = new TextEncoder();

  // Generate a random salt and initialization vector (IV)
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive a key from the password using PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password), // Encode the password
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS, // Use the constant for iterations
      hash: HASH_ALGORITHM, // Use the constant for the hash algorithm
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH }, // Use the constant for key length
    true,
    ["encrypt"]
  );

  // Encrypt the data
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv, // Use the generated IV
    },
    key,
    decryptedArrayBuffer // The data to encrypt, must be an ArrayBuffer
  );

  // Concatenate salt, IV, and encrypted data into one buffer for easy storage
  const encryptedArrayBuffer = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
  encryptedArrayBuffer.set(salt, 0); // Add the salt at the beginning
  encryptedArrayBuffer.set(iv, salt.length); // Add the IV after the salt
  encryptedArrayBuffer.set(new Uint8Array(encryptedData), salt.length + iv.length); // Add encrypted data

  return encryptedArrayBuffer; // Return the full encrypted data (including salt and IV)

}
async function decryptDataWithPassword(password, encryptedArrayBuffer) {
  const encoder = new TextEncoder();

  // Extract the salt, IV, and encrypted data from the buffer
  const salt = encryptedArrayBuffer.slice(0, SALT_LENGTH);
  const iv = encryptedArrayBuffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const encryptedData = encryptedArrayBuffer.slice(SALT_LENGTH + IV_LENGTH);

  // Derive the key using PBKDF2 (same process as encryption)
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password), // Encode the password
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS, // Use the constant for iterations
      hash: HASH_ALGORITHM, // Use the constant for the hash algorithm
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH }, // Use the constant for key length
    true,
    ["decrypt"]
  );

  // Decrypt the data
  const decryptedData = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv, // Use the IV from the encrypted buffer
    },
    key,
    encryptedData // Encrypted data (extracted from buffer)
  );

  return decryptedData; // Return the decrypted data (ArrayBuffer)
}

