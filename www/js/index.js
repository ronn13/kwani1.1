
(function () {
    "use strict";

    var client, // Connection to the Azure Mobile App backend
        store,  // Sqlite store to use for offline data sync
        syncContext, // Offline data sync context
        tableName = 'university',
        todoItemTable, courseTable, courseUnitTable, handoutTable, // Reference to a table endpoint on backend
        years = [], // Array used to create unique list of years;
        courseId, // used to store fk of course to help with course unit navigation
        old_varsity, old_course, old_year, old_cu, old_handout; //used to store the dataitem id's of the last clicked items for back navigation

    // Set useOfflineSync to true to use tables from local store.
    // Set useOfflineSync to false to use tables on the server.
    var useOfflineSync = false;

    // Add an event listener to call our initialization routine when the host is ready
    document.addEventListener('deviceready', onDeviceReady, false);

    /**
     * Event Handler, called when the host is ready
     *
     * @event
     */
    function onDeviceReady() {
        // Create a connection reference to our Azure Mobile Apps backend 
        client = new WindowsAzure.MobileServiceClient('https://kwani2.azurewebsites.net');

        if (useOfflineSync) {
            initializeStore().then(setup);
        } else {
            setup();
        }
    }
    
    /**
     * Set up and initialize the local store.
     */
    function initializeStore() {
        // Create the sqlite store
        store = new WindowsAzure.MobileServiceSqliteStore();

        // Define the table schema
        return store.defineTable({
            name: tableName,
            columnDefinitions: {
                id: 'string',
                deleted: 'boolean',
                name: 'string',
                shortName: 'string',
                version: 'string'
            }
        }).then(function () {
            // Initialize the sync context
            syncContext = client.getSyncContext();

            // Define an overly simplified push handler that discards
            // local changes whenever there is an error or conflict.
            // Note that a real world push handler will have to take action according
            // to the nature of conflict.
            syncContext.pushHandler = {
                onConflict: function (pushError) {
                    return pushError.cancelAndDiscard();
                },
                onError: function (pushError) {
                    return pushError.cancelAndDiscard();
                }
            };

            return syncContext.initialize(store);
        });
    }

    /**
     * Set up the tables, event handlers and load data from the server 
     */
    function setup() {

        // Create a table reference
        if (useOfflineSync) {
            todoItemTable = client.getSyncTable(tableName);
        } else {
            todoItemTable = client.getTable(tableName);            
        }

        // Refresh the todoItems
        refreshDisplay();
    }

    /**
     * Refresh the display with items from the table.
     * If offline sync is enabled, the local table will be synchronized
     * with the server table before displaying the todo items.
     */
    function refreshDisplay() {
        updateSummaryMessage('<div class="loader"></div>');        
        
        if (useOfflineSync) {
            syncLocalTable().then(displayItems);
        } else {
            displayItems();
        }
    }

    /**
     * Synchronize local table with the table on the server.
     * We do this by pushing local changes to the server and then
     * pulling the latest changes from the server.
     */
    function syncLocalTable() {
        return syncContext
                    .push()
                    .then(function () {
                        return syncContext.pull(new WindowsAzure.Query(tableName));
                    });
    }

    /**
     * Displays the todo items
     */
    function displayItems() {
        // Execute a query for uncompleted items and process
        todoItemTable
            .read()                         // Read the results
            .then(createTodoItemList, handleError);
    }

    /**
     * Updates the Summary Message
     * @param {string} msg the message to use
     * @returns {void}
     */
    function updateSummaryMessage(msg) {
        $('#summary').html(msg);
    }

    /**
     * Create the DOM for a single todo item
     * @param {Object} item the Todo Item
     * @param {string} item.id the ID of the item
     * @param {bool} item.complete true if the item is completed
     * @param {string} item.text the text value
     * @returns {jQuery} jQuery DOM object
     */
    function createTodoItem(item) {
        return $('<li class="item-course">')
            .attr('data-todoitem-id', item.id)
            .append($('<div class="item-content"><div class="item-inner"><div class="item-title color-deeporange"><strong>' + item.shortName + '</strong></div></div></div>'));
    }

    /**
     * Create a list of Todo Items
     * @param {TodoItem[]} items an array of todoitem objects
     * @returns {void}
     */
    function createTodoItemList(items) {
        // Cycle through each item received from Azure and add items to the item list
        var listItems = $.map(items, createTodoItem);
        $('#todo-items').empty().append(listItems).toggle(listItems.length > 0);
        
        // Wire up the event handlers for each item in the list
        $('.item-course').on('click', courseItemHandler);

        //change navbar
        document.getElementById("nav").innerHTML = '<div class="center"><strong>Kwani</strong>';

        updateSummaryMessage('');
    }

    function createCourseItem(item) {
        return $('<li class="item-year">')
            .attr('data-todoitem-id', item.id)
            .append($('<div class="item-content"><div class="item-inner"><div class="item-title color-deeporange"><strong>' + item.name + '</strong></div></div></div>'));
    }

    function createCourseList(items) {
        // Cycle through each item received from Azure and add items to the item list
        var listItems = $.map(items, createCourseItem);
        $('#todo-items').empty().append(listItems).toggle(listItems.length > 0);
        
        // Wire up the event handlers for each item in the list
        $('.item-year').on('click', yearItemHandler);

        //change navbar
        document.getElementById("nav").innerHTML = '<a class="back link" id="backu" href="#"><i class="icon icon-back" style="transform: translate3d(0px, 0px, 0px);"></i><span>Back</span></a><div class="center"><strong>Kwani</strong></div>';

        updateSummaryMessage('');

        //Back button handler
        $('#backu').on('click', refreshDisplay);
    }

    function createYearItem(item) {
        // check if year in loop has come before
        if ( !years.includes(item.year)) {
            // Add years to array to check if a record with the same year has already been seen
            years.push(item.year);
            return $('<li class="item-courseUnit">')
                .attr('data-todoitem-id', item.id)
                .append($('<div class="item-content"><div class="item-inner"><div class="item-title color-deeporange"><strong>Year ' + item.year + '</strong></div></div></div>'));
        }        
    }

    function createYearList(items) {
        // Cycle through each item received from Azure and add items to the item list
        var listItems = $.map(items, createYearItem);
        $('#todo-items').empty().append(listItems).toggle(listItems.length > 0);
        
        // Wire up the event handlers for each item in the list
        $('.item-courseUnit').on('click', courseUnitItemHandler);

        //change navbar
        document.getElementById("nav").innerHTML = '<a class="back link" id="backc" href="#"><i class="icon icon-back" style="transform: translate3d(0px, 0px, 0px);"></i><span>Back</span></a><div class="center"><strong>Kwani</strong></div>';

        updateSummaryMessage('');

        //Back button handler
        $('#backc').on('click', courseBackHandler);
    }

    function createCourseUnitItem(item) {
        return $('<li class="item-handout">')
            .attr('data-todoitem-id', item.id)
            .append($('<div class="item-content"><div class="item-inner"><div class="item-title color-deeporange"><strong>(' + item.code + ')' + item.name + '</strong></div></div></div>'));
    }

    function createCourseUnitList(items) {
        // Cycle through each item received from Azure and add items to the item list
        var listItems = $.map(items, createCourseUnitItem);
        $('#todo-items').empty().append(listItems).toggle(listItems.length > 0);
        
        // Wire up the event handlers for each item in the list
        $('.item-handout').on('click', handoutHandler);

        //change navbar
        document.getElementById("nav").innerHTML = '<a class="back link" id="backcu" href="#"><i class="icon icon-back" style="transform: translate3d(0px, 0px, 0px);"></i><span>Back</span></a><div class="center"><strong>Kwani</strong></div>';

        updateSummaryMessage('');

        //Back button handler
        $('#backcu').on('click', yearBackHandler);
    }

    function createHandoutItem(item) {
        return $('<li class="item-iframe">')
            .attr('data-todoitem-id', item.id)
            .append($('<div class="item-content"><div class="item-inner"><div class="item-title color-deeporange"><strong>' + item.name + '</strong></div></div></div>'));
    }

    function handoutList(items) {
        // Cycle through each item received from Azure and add items to the item list
        var listItems = $.map(items, createHandoutItem);
        $('#todo-items').empty().append(listItems).toggle(listItems.length > 0);
        
        // Wire up the event handlers for each item in the list
        $('.item-iframe').on('click', iframeHandler);

        //change navbar
        document.getElementById("nav").innerHTML = '<a class="back link" id="backh" href="#"><i class="icon icon-back" style="transform: translate3d(0px, 0px, 0px);"></i><span>Back</span></a><div class="center"><strong>Kwani</strong></div>';

        updateSummaryMessage('');

        //Back button handler
        $('#backh').on('click', courseUnitItemHandler);
    }

    function createIframeItem(item) {
        return $(item.iframe);
    }

    function iframeDisplay(items) {
        // Cycle through each item received from Azure and add items to the item list
        var iframeItem = $.map(items, createIframeItem);
        $('#todo-items').empty();

        document.getElementById("content").innerHTML = "";
        $('#content').append(iframeItem).toggle(true);
        
        //change navbar
        document.getElementById("nav").innerHTML = '<a class="back link" id="backi" href="#"><i class="icon icon-back" style="transform: translate3d(0px, 0px, 0px);"></i><span>Back</span></a><div class="center"><strong>Kwani</strong></div>';
        updateSummaryMessage('');
        //Back button handler
        $('#backi').on('click', handoutBackHandler);
    }
    
    /**
     * Handle error conditions
     * @param {Error} error the error that needs handling
     * @returns {void}
     */
    function handleError(error) {
        var text = error + (error.request ? ' - ' + error.request.status : '');
        console.error(text);
        $('#errorlog').append($('<li>').text(text));
    }

    /**
     * Given a sub-element of an LI, find the TodoItem ID associated with the list member
     *
     * @param {DOMElement} el the form element
     * @returns {string} the ID of the TodoItem
     */
    function getTodoItemId(el) {
        return $(el).closest('li').attr('data-todoitem-id');
    }

    //Event handler to load screen with Courses per university
    function courseItemHandler(event) {        
        var itemId = getTodoItemId(event.currentTarget);
        old_course = itemId;
        
        updateSummaryMessage('<div class="loader"></div>');
        courseTable = client.getTable('course');
        
        courseTable
            .where({ university:itemId })
            .read()   // Async send the deletion to backend
            .then(createCourseList, handleError); // Update the UI
        event.preventDefault();
    }

    //Event handler to go back to page with courses per University
    function courseBackHandler(event) {
        updateSummaryMessage('<div class="loader"></div>');
        courseTable = client.getTable('course');

        courseTable
            .where({ university: old_course })
            .read()   // Async send the deletion to backend
            .then(createCourseList, handleError); // Update the UI
        event.preventDefault();
    }

    function yearItemHandler(event) {
        courseId = getTodoItemId(event.currentTarget);
        old_year = courseId;
        years = [];

        updateSummaryMessage('<div class="loader"></div>');
        courseUnitTable = client.getTable('courseUnit');

        courseUnitTable
            .where({ course: courseId })
            .orderBy('year')
            .read()   // Async send the deletion to backend
            .then(createYearList, handleError); // Update the UI
        event.preventDefault();
    }

    function yearBackHandler(event) {
        years = [];

        updateSummaryMessage('<div class="loader"></div>');
        courseUnitTable = client.getTable('courseUnit');

        courseUnitTable
            .where({ course: old_year })
            .orderBy('year')
            .read()   // Async send the deletion to backend
            .then(createYearList, handleError); // Update the UI
        event.preventDefault();
    }

    function courseUnitItemHandler(event) {
        updateSummaryMessage('<div class="loader"></div>');
        courseUnitTable = client.getTable('courseUnit');

        courseUnitTable
            .where({ course: courseId })
            .read()   // Async send the deletion to backend
            .then(createCourseUnitList, handleError); // Update the UI
        event.preventDefault();
    }

    function handoutHandler(event) {
        var courseUnitId = getTodoItemId(event.currentTarget);
        old_cu = courseUnitId;

        updateSummaryMessage('<div class="loader"></div>');
        handoutTable = client.getTable('handout');

        handoutTable
            .where({ courseUnit: courseUnitId })
            .read()   // Async send the deletion to backend
            .then(handoutList, handleError); // Update the UI
        event.preventDefault();
    }

    function handoutBackHandler(event) {
        updateSummaryMessage('<div class="loader"></div>');

        //put required ui elements back in main page
        document.getElementById("content").innerHTML = "<p id='summary'></p><div class='list-block'><ul id='todo-items'></ul></div>";

        handoutTable = client.getTable('handout');

        handoutTable
            .where({ courseUnit: old_cu })
            .read()   // Async send the deletion to backend
            .then(handoutList, handleError); // Update the UI
        event.preventDefault();
    }

    function iframeHandler(event) {
        var handoutId = getTodoItemId(event.currentTarget);

        updateSummaryMessage('<div class="loader"></div>');
        handoutTable = client.getTable('handout');

        handoutTable
            .where({ id: handoutId })
            .read()   // Async send the deletion to backend
            .then(iframeDisplay, handleError);
            
        event.preventDefault();
    }    

})();