//dependencies
const sqlite3 = require("sqlite3");
const moment = require("moment");
const remote = require('electron').remote;
const app = remote.app;
const {
    Menu,
    MenuItem
} = remote;

/*global variables*/
let currentNotebook = {};
let currentNote = {};

/*constants*/
//dev mode
const DEV_MODE = false;
//names corresponding to page #'s
const PAGES = {
    START: 0,
    NOTEBOOK: 1
}
//code to run when page is shown
const SETUPS = {
    //start page
    0: () => {
        refresh();
        setMenu(MENUS.START);
    },
    //notebook page
    1: () => {
        document.getElementById("notebook-title").innerHTML = currentNotebook.name;
        refreshNotes();
        let content = document.getElementById("note-content");
        content.innerHTML = "";
        content.contentEditable = false;
        
        //change menu
        setMenu(MENUS.NOTEBOOK);
    }
}
//menu names
const MENUS = {
    START: 0,
    NOTEBOOK: 1,
    NOTE: 2
}
//some common menu items
const MENU_ITEMS = {
    EXIT: {
        label:"Exit",
        click(){
            if(confirm("Are you sure you want to quit?")) app.quit();
        }
    },
    RENAME_NOTEBOOK: {
        label: "Rename Notebook",
        click(){
            let titleEl = document.getElementById("notebook-title");
            titleEl.contentEditable = true;
            titleEl.focus();
            document.execCommand('selectAll',false,null);
        }
    },
    DELETE_NOTEBOOK: {
        label: "Delete Notebook",
        click(){
            deleteNotebook(currentNotebook.id);
            showPage(PAGES.START);
        }
    },
    NEW_NOTE: {
        label: "New Note",
        click(){
            createNote("Untitled Note", () => {
                loadNewestNote(() => {
                    let titleEl = document.getElementById("note-title");
                    titleEl.contentEditable = true;
                    titleEl.focus();
                    document.execCommand('selectAll',false,null);
                });
            })
        },
        accelerator: "CmdOrCtrl+N"
    }
}
//menus
const MENU_TEMPLATES = {
    //start
    0: [
        {
            label: "File",
            submenu: [
                {
                    label: "Exit",
                    click(){
                        if(confirm("Are you sure you want to quit?")) app.quit();
                    }
                }
            ]
        }
    ],
    //notebook
    1: [
        {
            label: "File",
            submenu: [
                MENU_ITEMS.RENAME_NOTEBOOK,
                MENU_ITEMS.DELETE_NOTEBOOK,
                {type: "separator"},
                MENU_ITEMS.NEW_NOTE,
                {type: "separator"},
                MENU_ITEMS.EXIT
            ]
        }
    ],
    //note
    2: [
        {
            label: "File",
            submenu: [
                MENU_ITEMS.RENAME_NOTEBOOK,
                MENU_ITEMS.DELETE_NOTEBOOK,
                {type: "separator"},
                MENU_ITEMS.NEW_NOTE,
                {type: "separator"},
                MENU_ITEMS.EXIT
            ]
        },
        {
            label: "Note",
            submenu: [
                {
                    label: "Save Note",
                    click(){
                        db.run("UPDATE notes SET content = $content, date = $date WHERE note_id = $id", {
                            $content: document.getElementById("note-content").innerHTML,
                            $date: new Date(),
                            $id: currentNote.id
                        }, (err) => {
                            if (err) return console.log(err);
                            alert("Note saved!");
                        });

                        db.run("UPDATE notebooks SET date_modified = $date WHERE notebook_id = $id", {
                            $id: currentNotebook.id,
                            $date: new Date()
                        }, err => {
                            if (err) return console.log(err)
                        });
                    },
                    accelerator: "CmdOrCtrl+S"
                },
                {
                    label: "Edit Note",
                    click(){
                        document.getElementById("note-content").contentEditable = true;
                        document.getElementById("note-content").style.background = "white";
                        document.getElementById("note-content").focus();
                    },
                    accelerator: "CmdOrCtrl+E"
                },
                {
                    label: "Rename Note",
                    click(){
                        document.getElementById("note-title").contentEditable = true;
                        document.getElementById("note-title").focus();
                        document.execCommand('selectAll',false,null);
                    }
                }
            ]
        }
    ]
}
//our lovely db
const db = new sqlite3.Database(app.getPath("userData") + '/db.sqlite');

/*helper functions*/
//change page
const showPage = (index) => {
    let pages = document.getElementsByClassName("page");
    for (let i = 0; i < pages.length; i++) {
        pages[i].style.display = "none";
    }
    pages[index].style.display = "block";
    SETUPS[index]();
}
//toggle popup
const togglePopup = (x, y, content) => {
    let popup = document.getElementById("popup");
    if (!(popup.style.display === "block")) {
        popup.style.display = "block";
        popup.style.position = "fixed";
        popup.style.left = (x + 8) + "px";
        popup.style.top = (y + 8) + "px";
        popup.innerHTML = "";
        for (let i = 0; i < content.length; i++) {
            popup.appendChild(content[i]);
        }
        if(x + 8 + popup.offsetWidth > document.body.offsetWidth){
            popup.style.left = (x - 8 - popup.offsetWidth) + "px";
        }
    } else {
        popup.style.display = "none";
    }
}
//hides popup
const hidePopup = () => {
    document.getElementById("popup").style.display = "none";
}
//deletes a notebook based on id
const deleteNotebook = (id) => {
    db.run("DELETE FROM notebooks WHERE notebook_id = $id", {
        $id: id
    });
    db.run("DELETE FROM notes WHERE notebook_id = $id", {
        $id: id
    });
};
//renames notebook
const renameNotebook = (name, id) => {
    db.run("UPDATE notebooks SET name = $name, date_modified = $date WHERE notebook_id = $id", {
        $name: name,
        $date: new Date(),
        $id: id
    }, (err) => {
        if(err) console.log(err);
        refresh();
    });
}
//add a notebook to the list
let addNotebook = (name, date, id) => {
    let newNotebook = document.createElement("tr");
    newNotebook.innerHTML = `<td data-index = "${id}">${name}</td><td>${moment(date).fromNow()}</td><td><i class = "material-icons more-icon">more_vert</i></td>`;
    newNotebook.addEventListener("click", (e) => {
        currentNotebook.id = id;
        currentNotebook.name = name;
        currentNotebook.date = date;
        showPage(PAGES.NOTEBOOK);
    });
    let button = newNotebook.getElementsByClassName("more-icon")[0];
    let el = newNotebook.querySelector("[data-index]");
    el.addEventListener("click" , (e) => {
        if(el.contentEditable === "true") return e.stopPropagation();
    })
    el.addEventListener("keypress", (e) => {
        if(e.keyCode != 13) return;
        e.preventDefault();
        el.contentEditable = false;
        renameNotebook(el.innerHTML, id);
    });
    el.addEventListener("blur", () => {
        el.contentEditable = false;
        renameNotebook(el.innerHTML, id);
    })
    button.addEventListener("click", (e) => {
        e.stopPropagation();
        let deleteButton = document.createElement("a");
        deleteButton.className = "popup-option";
        deleteButton.innerHTML = "Delete";
        deleteButton.addEventListener("click", () => {
            deleteNotebook(id);
            refresh();
            hidePopup();
        });
        let renameButton = document.createElement("a");
        renameButton.className = "popup-option";
        renameButton.innerHTML = "Rename";
        renameButton.addEventListener("click", () => {
            hidePopup();
            el.contentEditable = true;
            el.focus();
            document.execCommand('selectAll',false,null);
        })
        togglePopup(e.clientX, e.clientY, [deleteButton, renameButton]);
    })
    document.getElementById("notebook-list").appendChild(newNotebook);

}
//creates notebook
const createNotebook = () => {
    let notebookName = document.getElementById("notebook-name").value;

    //check if a name has actually been entered
    if (notebookName.length === 0) return;

    //check if a notebook with the same name already exists
    db.get("SELECT name FROM notebooks WHERE name = $name", {
        $name: notebookName
    }, (err, row) => {
        if (err) return console.log(err);
        if (row) return alert("A notebook with this name already exists!");

        //create notebook; all is well
        db.run("INSERT INTO notebooks (name, date_modified) VALUES ($name, $date)", {
            $name: notebookName,
            $date: new Date()
        }, (err) => {
            if (err) return console.log(err);
            refresh();
            document.getElementById("notebook-name").value = "";
        });
    })
}
//refresh the notebooks
const refresh = () => {
    db.all("SELECT notebook_id, name, date_modified FROM notebooks", (err, rows) => {
        if (err) return console.log(err);
        document.getElementById("notebook-list").innerHTML = "<tr><th>Name</th><th>Date Modified</th><th></th></tr>";
        rows = rows.sort((a, b) => {
            return b.date_modified - a.date_modified
        });
        for (let i = 0; i < rows.length; i++) {
            addNotebook(rows[i].name, rows[i].date_modified, rows[i].notebook_id);
        }
    });
}
//adds note
const addNote = (name, id, date) => {
    let newNote = document.createElement("a");
    newNote.className = "note";
    newNote.textContent = name;
    newNote.addEventListener("click", () => {
        currentNote.id = id;
        currentNote.name = name;
        currentNote.date = date;
        loadNote(id);
    });
    newNote.dataset.id = id;
    newNote.dataset.name = name;
    newNote.dataset.date = date;
    document.getElementById("notes").appendChild(newNote);
}
//creates note, returns note id
const createNote = (name, callback) => {
    let noteName = name;

    document.getElementById("note-name").value = "";

    //check if name has been entered
    if (noteName.length === 0) return;

    db.get("SELECT name FROM notes WHERE name = $name AND notebook_id = $notebook_id", {
        $name: noteName,
        $notebook_id: currentNotebook.id
    }, (err, row) => {
        if (err) return console.log(err);
        if (row) return alert("A note with this name already exists in this notebook!");

        //create note; all is well
        db.run("INSERT INTO notes (name, date, notebook_id) VALUES ($name, $date, $notebook_id)", {
            $name: noteName,
            $date: new Date(),
            $notebook_id: currentNotebook.id
        }, (err) => {
            if (err) return console.log(err);
            refreshNotes();
            db.run("UPDATE notebooks SET date_modified = $date WHERE notebook_id = $id", {
                $date: Date.now(),
                $id: currentNotebook.id
            }, (err) => {
                if (err) return console.log(err);
                callback();
            })
        })
    })
}
//refreshes the notes
const refreshNotes = (callback) => {
    let el = document.getElementById("notes");
    db.all("SELECT note_id, name, date FROM notes WHERE notebook_id = $notebook_id", {
        $notebook_id: currentNotebook.id
    }, (err, rows) => {
        if (err) return console.log(err);
        el.innerHTML = "";
        rows = rows.sort((a, b) => {
            return b.date - a.date
        });
        for (let i = 0; i < rows.length; i++) {
            addNote(rows[i].name, rows[i].note_id, rows[i].date);
        }
        document.getElementById("note-actions").style.display = "none";
        document.getElementById("note-content").style.display = "none";
        document.getElementById("note-title").innerHTML = "There's nothing to show...<p>Create or select a note to get started!</p>";
        document.getElementById("note-content").style.display = "none";
        
        if(callback) callback();
    })
}
//load note
const loadNote = () => {
    setMenu(MENUS.NOTE);
    
    //edit note details
    document.getElementById("note-title").textContent = currentNote.name;

    //show content of note
    let content = document.getElementById("note-content");
    content.style.display = "block";
    content.innerHTML = "";
    content.contentEditable = false;
    content.style.background = "none";
    db.get("SELECT content FROM notes WHERE note_id = $id", {
        $id: currentNote.id
    }, (err, row) => {
        if (err) return console.log(err);
        content.innerHTML = row.content;

        //show note actions
        document.getElementById("note-actions").style.display = "block";
    })
}
//rename note
const renameNote = (name, id) => {
    let date = new Date();
    db.run("UPDATE notebooks SET date_modified = $date WHERE notebook_id = $id", {
        $date: date,
        $id: currentNotebook.id
    }, (err) => {
        if(err) console.log(err);
    });
    db.run("UPDATE notes SET date = $date, name = $name WHERE note_id = $id", {
        $date: date,
        $name: name,
        $id: id
    }, (err) => {
        if(err) return console.log(err);
        currentNote.date = date;
        currentNote.name = name;
        refreshNotes(loadNote);
    });
}
//load most recent note
const loadNewestNote = (callback) => {
    callback = callback || loadNote;
    
    let el = document.getElementsByClassName("note")[0];
    currentNote.id = el.dataset.id;
    currentNote.name = el.dataset.name;
    currentNote.date = el.dataset.date;
    loadNote();
    
    callback();
}
//set menu based on page
const setMenu = (menu_id) => {
    const menu = Menu.buildFromTemplate(MENU_TEMPLATES[menu_id]);
    Menu.setApplicationMenu(menu);
}
//setup app
const setup = () => {
    if(DEV_MODE){
        for(let i in MENU_TEMPLATES){
            MENU_TEMPLATES[i].push(
            {
                label: "Debug",
                submenu: [
                    {
                        label: "Inspect Element",
                        click(){
                            remote.BrowserWindow.getAllWindows()[0].openDevTools();
                        },
                        accelerator: 'CmdOrCtrl+Shift+I'
                    },
                    {
                        label: "Reload Page",
                        click(){
                            remote.BrowserWindow.getAllWindows()[0].reload();
                        },
                        accelerator: "CmdOrCtrl+R"
                    }
                ]
            });
        }
    }
    
    setMenu(MENUS.START);

    //initialize db
    db.run("CREATE TABLE IF NOT EXISTS notebooks (notebook_id INTEGER PRIMARY KEY, name TEXT, date_modified INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS notes(note_id INTEGER PRIMARY KEY, content TEXT, name TEXT, date INTEGER, notebook_id INTEGER, FOREIGN KEY(notebook_id) REFERENCES notebooks(notebook_id));");

    //initialize page
    refresh();
    
    //set up stuff so renaming notes works
    let noteTitle = document.getElementById("note-title");
    noteTitle.addEventListener("keypress", (e) => {
        if(e.keyCode !== 13) return;
        e.preventDefault();
        noteTitle.contentEditable = false;
        renameNote(noteTitle.innerHTML, currentNote.id);
    });
    noteTitle.addEventListener("blur", () => {
        noteTitle.contentEditable = false;
        renameNote(noteTitle.innerHTML, currentNote.id);
    });
    
    //set up stuff so renaming notebooks works
    let notebookTitle = document.getElementById("notebook-title");
    notebookTitle.addEventListener("keypress", (e) => {
        if(e.keyCode !== 13) return;
        e.preventDefault();
        notebookTitle.contentEditable = false;
        renameNotebook(notebookTitle.innerHTML, currentNotebook.id);
    });
    notebookTitle.addEventListener("blur", () => {
        notebookTitle.contentEditable = false;
        renameNotebook(notebookTitle.innerHTML, currentNotebook.id);
    });
}

setup();

//style inputs
let inputs = document.getElementsByClassName("input");
for (let i = 0; i < inputs.length; i++) {
    inputs[i].innerHTML += "<div class = 'underline background-accent'></div>";
}

//hide popup when clicked on outside
document.addEventListener("click", hidePopup);

//create notebook button
document.getElementById("create-button").addEventListener("click", createNotebook);
//do the same thing for enter button
document.getElementById("notebook-name").addEventListener("keypress", (e) => {
    if (e.keyCode != 13) return;
    createNotebook();
})

//handle back button press
document.getElementById("back-button").addEventListener("click", () => {
    currentNote = {};
    currentNotebook = {};
    showPage(PAGES.START);
});

//create note button
document.getElementById("create-note-button").addEventListener("click", () => {
    createNote(document.getElementById("note-name").value, loadNewestNote);
});
//do the same thing for the enter button
document.getElementById("note-name").addEventListener("keypress", (e) => {
    if (e.keyCode != 13) return;
    createNote(document.getElementById("note-name").value ,loadNewestNote);
})

//delete note button
document.getElementById("delete-note").addEventListener("click", () => {
    db.run("DELETE FROM notes WHERE note_id = $id", {
        $id: currentNote.id
    }, (err) => {
        if (err) return console.log(err);
        currentNote = {};
        document.getElementById("note-title").textContent = "There's nothing to show...<p>Create or select a note to get started!</p>";
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

    db.run("UPDATE notes SET content = $content, date = $date WHERE note_id = $id", {
        $content: document.getElementById("note-content").innerHTML,
        $date: new Date(),
        $id: currentNote.id
    }, (err) => {
        if (err) return console.log(err);
    });

    db.run("UPDATE notebooks SET date_modified = $date WHERE notebook_id = $id", {
        $id: currentNotebook.id,
        $date: new Date()
    }, err => {
        if (err) return console.log(err)
    });
});
//rename note button
document.getElementById("rename-note").addEventListener("click", () => {
    let noteTitle = document.getElementById("note-title");
    noteTitle.contentEditable = true;
    noteTitle.focus();
    document.execCommand('selectAll',false,null);
});

//make shadow appear under note-header
document.getElementById("note-content").addEventListener("scroll", () => {
    let el = document.getElementById("note-header");
    if (document.getElementById("note-content").scrollTop > 0) {
        el.style.boxShadow = "0 2px 2px 0 rgba(0,0,0,.14),0 3px 1px -2px rgba(0,0,0,.2),0 1px 5px 0 rgba(0,0,0,.12)";
        document.getElementById("note-content").style.marginTop = "64px";
    } else {
        el.style.boxShadow = "none";
    }
})

//notebook options button
document.getElementById("notebook-options").addEventListener("click", (e) => {
    e.stopPropagation();
    let deleteButton = document.createElement("a");
    deleteButton.className = "popup-option";
    deleteButton.innerHTML = "Delete Notebook";
    deleteButton.addEventListener("click", () => {
        deleteNotebook(currentNotebook.id);
        showPage(PAGES.START);
        hidePopup();
    });
    let renameButton = document.createElement("a");
    renameButton.className = "popup-option";
    renameButton.innerHTML = "Rename";
    renameButton.addEventListener("click", () => {
        hidePopup();
        let el = document.getElementById("notebook-title");
        el.contentEditable = true;
        el.focus();
        document.execCommand('selectAll',false,null);
    })
    togglePopup(e.clientX, e.clientY, [deleteButton, renameButton]);
});