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
const DEV_MODE = true;
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
        setMenu(PAGES.START);
    },
    //notebook page
    1: () => {
        document.getElementById("notebook-title").innerHTML = currentNotebook.name;
        refreshNotes();
        let content = document.getElementById("note-content");
        content.innerHTML = "";
        content.contentEditable = false;
        
        //re-initialize menu
        setMenu(PAGES.NOTEBOOK);
    }
}
//menus
const MENUS = {
    //start page
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
    //notebook page
    1: [
        {
            label: "File",
            submenu: [
                {
                    label: "Save Current Note",
                    click(){
                        if(!currentNote.id) return alert("No note selected!");
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
                    label: "Edit Current Note",
                    click(){
                        if(!currentNote.id) return alert("No note selected!");
                        document.getElementById("note-content").contentEditable = true;
                        document.getElementById("note-content").style.background = "white";
                        document.getElementById("note-content").focus();
                    },
                    accelerator: "CmdOrCtrl+E"
                },
                {type:'separator'},
                {
                    label: "Exit",
                    click(){
                        if(confirm("Are you sure you want to quit?")) app.quit();
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
//show popup
const togglePopup = (y, content) => {
    if (!(popup.style.display === "block")) {
        let popup = document.getElementById("popup");
        popup.style.display = "block";
        popup.style.position = "fixed";
        popup.style.top = y + "px";
        popup.style.left = "calc(80vw - 32px)"
        popup.innerHTML = "";
        for (let i = 0; i < content.length; i++) {
            popup.appendChild(content[i]);
        }
    } else {
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
//renames notebook
const renameNotebook = (name, id) => {
    db.run("UPDATE notebooks SET name = $name WHERE notebook_id = $id", {
        $name: name,
        $id: id
    }, (err) => {
        if(err) console.log(err);
        refresh();
    })
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
    button.addEventListener("click", (e) => {
        e.stopPropagation();
        let deleteButton = document.createElement("a");
        deleteButton.className = "popup-option";
        deleteButton.innerHTML = "Delete";
        deleteButton.addEventListener("click", () => {
            togglePopup();
            deleteNotebook(id);
        });
        let renameButton = document.createElement("a");
        renameButton.className = "popup-option";
        renameButton.innerHTML = "Rename";
        renameButton.addEventListener("click", () => {
            togglePopup();
            el.contentEditable = true;
            el.focus();
            document.execCommand('selectAll',false,null)
        })
        togglePopup((button.getBoundingClientRect().top + (button.offsetHeight / 2)), [deleteButton, renameButton]);
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
    document.getElementById("notebook-list").innerHTML = "<tr><th>Name</th><th>Date Modified</th><th></th></tr>";
    db.all("SELECT notebook_id, name, date_modified FROM notebooks", (err, rows) => {
        if (err) return console.log(err);
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
    document.getElementById("notes").appendChild(newNote);
}
//creates note
const createNote = () => {
    let noteName = document.getElementById("note-name").value;

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
                if (err) console.log(err);
            })
        })
    })
}
//refreshes the notes
const refreshNotes = () => {
    let el = document.getElementById("notes");
    el.innerHTML = "";
    db.all("SELECT note_id, name, date FROM notes WHERE notebook_id = $notebook_id", {
        $notebook_id: currentNotebook.id
    }, (err, rows) => {
        if (err) return console.log(err);
        rows = rows.sort((a, b) => {
            return b.date_modified - a.date_modified
        });
        for (let i = 0; i < rows.length; i++) {
            addNote(rows[i].name, rows[i].note_id, rows[i].date);
        }
        document.getElementById("note-actions").style.display = "none";
        document.getElementById("note-content").style.display = "none";
        document.getElementById("note-title").textContent = "There's nothing to show...";
        document.getElementById("note-content").style.display = "none";
    })
}
//load note
const loadNote = () => {
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
//set menu based on page
const setMenu = (page) => {
    const menu = Menu.buildFromTemplate(MENUS[page]);
    Menu.setApplicationMenu(menu);
}
//setup app
const setup = () => {
    if(DEV_MODE){
        for(let i in MENUS){
            MENUS[i].push(
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
    
    setMenu(PAGES.START);

    //initialize db
    db.run("CREATE TABLE IF NOT EXISTS notebooks (notebook_id INTEGER PRIMARY KEY, name TEXT, date_modified INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS notes(note_id INTEGER PRIMARY KEY, content TEXT, name TEXT, date INTEGER, notebook_id INTEGER, FOREIGN KEY(notebook_id) REFERENCES notebooks(notebook_id));");

    //initialize page
    refresh();
}

setup();

//style inputs
let inputs = document.getElementsByClassName("input");
for (let i = 0; i < inputs.length; i++) {
    inputs[i].innerHTML += "<div class = 'underline background-accent'></div>";
}

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
document.getElementById("create-note-button").addEventListener("click", createNote);
//do the same thing for the enter button
document.getElementById("note-name").addEventListener("keypress", (e) => {
    if (e.keyCode != 13) return;
    createNote();
})

//delete note button
document.getElementById("delete-note").addEventListener("click", () => {
    db.run("DELETE FROM notes WHERE note_id = $id", {
        $id: currentNote.id
    }, (err) => {
        if (err) return console.log(err);
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