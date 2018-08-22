//dependencies
const sqlite3 = require("sqlite3");
const moment = require("moment");

/*global variables*/
let currentNotebook = {};
let currentNote = {};

/*constants*/
const PAGES = {
    START: 0,
    NOTEBOOK: 1
}
//code to run when page is shown
const SETUPS = {
    //start page
    0: () => {
        refresh();
    },
    //notebook page
    1: () => {
        document.getElementById("notebook-title").innerHTML = currentNotebook.name;
        refreshNotes();
        let content = document.getElementById("note-content");
        content.innerHTML = "";
        content.contentEditable = false;
    }
}

/*helper functions*/
//change page
let showPage = (index) => {
    let pages = document.getElementsByClassName("page");
    for(let i = 0; i < pages.length; i++){
        pages[i].style.display = "none";
    }
    pages[index].style.display = "block";
    SETUPS[index]();
}
//show popup
let togglePopup = (y, content) => {
    if(!(popup.style.display === "block")){
        let popup = document.getElementById("popup");
        popup.style.display = "block";
        popup.style.position = "fixed";
        popup.style.top = y + "px";
        popup.style.left = "calc(80vw - 32px)"
        popup.innerHTML = "";
        for(let i = 0; i < content.length; i++){
            popup.appendChild(content[i]);
        }
    }else{
        popup.style.display = "none";
    }
}
//deletes a notebook based on id
const deleteNotebook = (id) => {
    db.run("DELETE FROM notebooks WHERE notebook_id = $id", {
        $id: id
    });
    db.run("DELETE FROM notes WHERE notebook_id = $id", {
        $id: id
    });
    refresh();
    togglePopup();
};
//add a notebook to the list
let addNotebook = (name, date, id) => {
    let newNotebook = document.createElement("tr");
    newNotebook.innerHTML = `<td>${name}</td><td>${moment(date).fromNow()}</td><td><i class = "material-icons more-icon" data-index = "${id}">more_vert</i></td>`;
    newNotebook.addEventListener("click", (e) => {
        currentNotebook.id = id;
        currentNotebook.name = name;
        currentNotebook.date = date;
        showPage(PAGES.NOTEBOOK);
    });
    let button = newNotebook.getElementsByClassName("more-icon")[0];
    button.addEventListener("click", (e) => {
        e.stopPropagation();
        let deleteButton = document.createElement("a");
        deleteButton.className = "popup-option";
        deleteButton.innerHTML = "Delete";
        deleteButton.addEventListener("click", () => {
            deleteNotebook(id);
        });
        togglePopup((button.getBoundingClientRect().top + (button.offsetHeight/2)), [deleteButton]);
    })
    document.getElementById("notebook-list").appendChild(newNotebook);
    
}
//creates notebook
let createNotebook = () => {
    let notebookName = document.getElementById("notebook-name").value;
    
    //check if a name has actually been entered
    if(notebookName.length === 0) return;
    
    //check if a notebook with the same name already exists
    db.get("SELECT name FROM notebooks WHERE name = $name", {
        $name: notebookName
    }, (err, row) => {
        if(err) return console.log(err);
        if(row) return alert("A notebook with this name already exists!");
        
        //create notebook; all is well
        db.run("INSERT INTO notebooks (name, date_modified) VALUES ($name, $date)", {
            $name: notebookName,
            $date: new Date()
        }, (err) => {
            if(err) return console.log(err);
            refresh();
            document.getElementById("notebook-name").value = "";
        });
    })
}
//refresh the notebooks
let refresh = () => {
    document.getElementById("notebook-list").innerHTML = "<tr><th>Name</th><th>Date Modified</th><th></th></tr>";
    db.all("SELECT notebook_id, name, date_modified FROM notebooks", (err, rows) => {
        if(err) return console.log(err);
        rows = rows.sort((a,b) => {return b.date_modified - a.date_modified});
        for(let i = 0; i < rows.length; i++){
            addNotebook(rows[i].name, rows[i].date_modified, rows[i].notebook_id);
        }
    });
}
//adds note
let addNote = (name, id, date) => {
    let newNote = document.createElement("a");
    newNote.className = "note";
    newNote.textContent = name;
    newNote.addEventListener("click", () => {
        currentNote.id = id;
        currentNote.name = name;
        currentNote.date = date;
        loadNote(id);
    });
    document.getElementById("notes").appendChild(newNote);
}
//creates note
let createNote = () => {
    let noteName = document.getElementById("note-name").value;
    
    document.getElementById("note-name").value = "";
    
    //check if name has been entered
    if(noteName.length === 0) return;
    
    db.get("SELECT name FROM notes WHERE name = $name AND notebook_id = $notebook_id", {
        $name: noteName,
        $notebook_id: currentNotebook.id
    }, (err, row) => {
        if(err) return console.log(err);
        if(row) return alert("A note with this name already exists in this notebook!");
        
        //create note; all is well
        db.run("INSERT INTO notes (name, date, notebook_id) VALUES ($name, $date, $notebook_id)", {
            $name: noteName,
            $date: new Date(),
            $notebook_id: currentNotebook.id
        }, (err) => {
            if(err) return console.log(err);
            refreshNotes();
            db.run("UPDATE notebooks SET date_modified = $date WHERE notebook_id = $id", {
                $date: Date.now(),
                $id: currentNotebook.id
            }, (err) => {
                if(err) console.log(err);
            })
        })
    })
}
//refreshes the notes
let refreshNotes = () => {
    let el = document.getElementById("notes");
    el.innerHTML = "";
    db.all("SELECT note_id, name, date FROM notes WHERE notebook_id = $notebook_id", {
        $notebook_id: currentNotebook.id
    }, (err, rows) => {
        if(err) return console.log(err);
        rows = rows.sort((a,b) => {return b.date_modified - a.date_modified});
        for(let i = 0; i < rows.length; i++){
            addNote(rows[i].name, rows[i].note_id, rows[i].date);
        }
        document.getElementById("note-actions").style.display = "none";
        document.getElementById("note-content").style.display = "none";
        document.getElementById("note-title").textContent = "There's nothing to show...";
        document.getElementById("note-content").style.display = "none";
    })
}
//load note
let loadNote = () => {    
    //edit note details
    document.getElementById("note-title").textContent = currentNote.name;
    document.getElementById("note-date").textContent = "Last modified on: " + moment(currentNote.date).format("dddd, MMMM Do YYYY, h:mm:ss a");
    
    //show content of note
    let content = document.getElementById("note-content");
    content.style.display = "block";
    content.innerHTML = "";
    content.contentEditable = false;
    db.get("SELECT content FROM notes WHERE note_id = $id", {
        $id: currentNote.id
    }, (err, row) => {
        if(err) return console.log(err);
        content.innerHTML = row.content;
        
        //show note actions
        document.getElementById("note-actions").style.display = "block";
    })
}


//initialize db
let db = new sqlite3.Database('./db.sqlite');
db.run("CREATE TABLE IF NOT EXISTS notebooks (notebook_id INTEGER PRIMARY KEY, name TEXT, date_modified INTEGER)");
db.run("CREATE TABLE IF NOT EXISTS notes(note_id INTEGER PRIMARY KEY, content TEXT, name TEXT, date INTEGER, notebook_id INTEGER, FOREIGN KEY(notebook_id) REFERENCES notebooks(notebook_id));");

//initialize page
refresh();

//style inputs
let inputs = document.getElementsByClassName("input");
for(let i = 0; i < inputs.length; i++){
    inputs[i].innerHTML += "<div class = 'underline background-accent'></div>";
}

//create notebook button
document.getElementById("create-button").addEventListener("click", createNotebook);
//do the same thing for enter button
document.getElementById("notebook-name").addEventListener("keypress", (e) => {
    if(e.keyCode != 13) return;
    createNotebook();
})

//handle back button press
document.getElementById("back-button").addEventListener("click", () => {
    showPage(PAGES.START);
});

//create note button
document.getElementById("create-note-button").addEventListener("click", createNote);
//do the same thing for the enter button
document.getElementById("note-name").addEventListener("keypress", (e) => {
    if(e.keyCode != 13) return;
    createNote();
})

//delete note button
document.getElementById("delete-note").addEventListener("click", () => {
    db.run("DELETE FROM notes WHERE note_id = $id", {
        $id: currentNote.id
    }, (err) => {
        if(err) return console.log(err);
        currentNote = {};
        document.getElementById("note-title").textContent = "There's nothing to show...";
        document.getElementById("note-date").textContent = "Select a note or create one to get started!";
        document.getElementById("note-content").style.display = "none";
        refreshNotes();
    })
});
//edit note button
document.getElementById("edit-note").addEventListener("click", () => {
    document.getElementById("note-content").contentEditable = true;
    document.getElementById("note-content").style.background = "white";
    document.getElementById("note-content").focus();
});

//save note button
document.getElementById("save-note").addEventListener("click", () => {
    let content = document.getElementById("note-content");
    content.contentEditable = false;
    content.style.background = "none";
    
    db.run("UPDATE notes SET content = $content WHERE note_id = $id", {
        $content: document.getElementById("note-content").innerHTML,
        $id: currentNote.id
    }, (err) => {
        if(err) return console.log(err);
    })
});