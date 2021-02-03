let baseURL = "https://earthquake.usgs.gov/fdsnws/event/1";
let queryURL = "/query?format=geojson&minmagnitude=4.5&limit=15&includeallmagnitudes";
let tabs;
let events;
let currentTab;
let content;
let screenH;
let modalCont;
let loaderCont, loader, loadBox1, loaderHTML;
let detailModalCont, detailMag, detailDepth, detailIntensity, detailLat, detailLong, detailPlace, detailTsu, detailExit;
let unitsMetric = true;



$(document).ready(function () {
    const clientId = "22C7S4";
    const redirectUri = "https%3A%2F%2Fgamesquatch.gitgub.io/authenticated/";
    const scopes = "activity";
    const oauthUrl = `https://www.fitbit.com/oauth2/authorize?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes}&expires_in=604800`;
    window.location.replace(oauthUrl);
    events = [];
    // this object will contain the tab content. Instead of loading a whole new page, I am just going to create the html
    // needed for each tab. This is for a very specific reason. The website www.sololearn.com can't use multiple pages,
    // and that's where I post a lot of my projects.
    tabs = {
        "Home": "",
        "Timeline": "",
        "Visual Map": "",
        "About": ""
    };
    currentTab = "Home";
    
    content = $("#content");
    modalCont = $("#modalContainer");
    // all detail DOM elements
    detailModalCont = $("#detailModalContainer");
    detailMag = $("#detailMagnitude");
    detailDepth = $("#detailDepth");
    detailIntensity = $("#detailIntensity");
    detailLat = $("#detailLatitude");
    detailLong = $("#detailLongitude");
    detailPlace = $("#detailPlace");
    detailTsu = $("#detailTsunami");
    detailExit = $("#detailExit");

    // create loader html since the #content div's html will be overwritten when tabbing
    loaderHTML =     '<div id="loaderContainer">' + 
                        '<div id="loader">' + 
                            '<div id="ldBx1" class="loadBox"></div>' + 
                            '<div id="ldBx2" class="loadBox"></div>' + 
                            '<div id="ldBx3" class="loadBox"></div>' + 
                        '</div>' + 
                    '</div>';
    $("body").append(loaderHTML);//append it to the DOM in #content

    // these MUST be defined after the html strings are appended in order to access them in the DOM.
    loaderCont = $("#loaderContainer");
    loader = $("#loader");
    loadBox1 = $("#ldBx1");

    let loaderW = parseInt(loader.css("width"));
    loader.css("height", loaderW + "px");

    let loadBox1W = parseInt(loadBox1.css("width"));
    $(".loadBox").css("height", loadBox1W + "px");

    // The modal should be the screen's height, so it's set to that here
    screenH = parseInt(window.innerHeight);
    modalCont.css("height", screenH + "px");
    detailModalCont.css("height", screenH + "px");

    // adjusting loader heights when resizing the window
    $(window).on("resize", () => {
        let loaderW = parseInt(loader.css("width"));
        loader.css("height", loaderW + "px");

        let loadBox1W = parseInt(loadBox1.css("width"));
        $(".loadBox").css("height", loadBox1W + "px");
    })

    // Selecting tab, adding class
    $("#tabs").children().click((event) => {
        // TODO add check to see if clicked same tab that you are already on
        if ($(event.target).hasClass("currentTab")) {
            $("html").scrollTop(0);
            $("body").scrollTop(0);
        }
        else {
            $("#tabs").children().removeClass("currentTab");
            $(event.target).addClass("currentTab");
            currentTab = event.target.innerHTML;
            changeContent(currentTab);
        }
    });

    // display search modal page
    $("#searchIcon").click(() => {
        screenH = parseInt(window.innerHeight);
        modalCont.css({"height": screenH + "px", "display": "block", "position": "fixed"});

        $("body").css("position", "fixed");
    });

    // hide the modal search page when exiting
    $("#modalExit").click(() => {
        modalCont.css({"display": "none", "position": "fixed"});
        $("body").css("position", "initial");
    });

    // hide the detail modal
    detailExit.click(() => {
        detailModalCont.css("display", "none");
    });
    
    // request to the api for information using the base url above plus the query url.
    // the query contains what is being requested. In this case it's 50 earthquakes with a minimum mag of 3
    $.ajax({
        type: "GET",                // it's getting information
        url: baseURL + queryURL,    // combining the url's to make a valid url
        dataType: "json",            // it's requesting info in json format
        success: getEvents        // this is the callback function used when the request is successful
    });

});

// our function used for the success of the api request. The information returned from the request is
// used as an argument for the callback function. Since we requested json, it's a json object.
function getEvents(obj) {

    // hide the loader when content is loaded
    loaderCont.css("display", "none");

    // logging the object to the console, so you can see what it's comprised of
    // console.log(obj);

    // obj["features"] is the object of the 50 earthquakes, and its keys are the details of each earthquake
    // fObj is featureObjects; fks is featureKeys
    let fObj = obj["features"];
    if (fObj.length == 0) {

        content.html("<div>No events exist with those search parameters. Please try again.</div>");

    } else {
        //create each of the tab's html in this function using the object returned from the api call.
        createTabHTML(obj);
        //then change to the Home tab to start
        changeContent("Home");
    }
    
}

// this is the function that the buttons use. When the buttons were created, each one was given a unique argument,
// so this will get the details from the array using that unique index. The details array was created using the same index.
function showDets(i) {
    let unit = unitsMetric ? "km" : "mi";
    // fill the detail modal with the info of the event that was clicked, i
    let eventProps = events[i]["properties"];
    
    detailMag.html(eventProps["mag"]);
    detailDepth.html(events[i]["geometry"]["coordinates"][2]);
    eventProps["cdi"] == "" ? detailIntensity.html(eventProps["cdi"]) : detailIntensity.html("No reports of a felt earthquake.");
    detailLat.html(events[i]["geometry"]["coordinates"][1]);
    detailLong.html(events[i]["geometry"]["coordinates"][0]);
    detailPlace.html(eventProps["place"]);
    detailTsu.html(eventProps["tsunami"]);

    // show the detail modal block
    detailModalCont.css({"height": screenH + "px", "display": "block", "position": "fixed"});
}
// the function when requesting details from the api succeeds
function getEventDets(obj) {
    // just logging it to the console for now :)
    // console.log(obj);
}

function createTabHTML(obj) {
    // obj["features"] is the object of the 50 earthquakes, and its keys are the details of each earthquake
    // fObj is featureObjects; fks is featureKeys
    let fObj = obj["features"];
    let fks = Object.keys(fObj);

    // Home tab HTML
    let html = "";
    events = [];

    // for every earthquake (fObj[fks[i]]) item:
    for (let i = 0; i < fks.length; ++i) {
        // make a new date object using the time integer in the ["properties"]["time"] of each earthquake
        let d = new Date(parseInt(fObj[fks[i]]["properties"]["time"]));

        events.push(fObj[fks[i]]);

        // add to the html. each earthquake is a paragraph tag. It's retrieving magnitude, and place, then
        // puts the date we got above into the html.
        html += "<div class='cardContainer'>";
        html += "<div class='bg'></div>";
        html += "<div class='magnitude'><span>" + fObj[fks[i]]["properties"]["mag"] + "</span></div>";
        html += "<div class='where'><span>" + fObj[fks[i]]["properties"]["place"] + "</span></div>";
        html += "<div class='when'><span>" + d.toUTCString() + "</span></div>";
        html += "<button class='btn' type='button' onclick='showDets(" + i + ")'>Details</button>";
        html += "</div>";

    }
    // store the html in the global tabs object
    tabs["Home"] = html;
    html = "";

    // Timeline HTML || they are all the same for now until I figure out what to do for those
    html = "<h4>Coming...soon?</h4>";
    tabs["Timeline"] = html;
    // Visual Map HTML
    tabs["Visual Map"] = html;
    // About
    tabs["About"] = html;
}

function changeContent(tabName) {
    
    content.html(tabs[tabName]);
}

function search() {
    queryURL = "/query?format=geojson";
    let queryStrings = ["minmagnitude", "maxmagnitude", "mindepth", "maxdepth", "latitude", "longitude", "maxradiuskm", "starttime", "endtime"];
    let inputs = $("#searchModal input");
    let sortMethod = $("#orderby");
    let allEmpty = true;

    // run a validity check. If there are invalid inputs (returns false), it won't run the api call
    let inputsValid = inputFieldsAreValid();
    
    if (inputsValid) {

        for (let i = 0; i < inputs.length; ++i) {
            inputValue = $(inputs[i]).val();
            if (inputValue != "") {
                allEmpty = false;
                queryURL += "&" + queryStrings[i] + "=" + inputValue;
            }
        }

        if (!allEmpty) {
            queryURL += "&limit=15&orderby=" + sortMethod.val();
            modalCont.css({"display": "none", "position": "fixed"});
            $("body").css("position", "initial");
            content.html("");
            loaderCont.css("display", "block");
            // console.log(queryURL);
            $.ajax({
                type: "GET",                // it's getting information
                url: baseURL + queryURL,    // combining the url's to make a valid url
                dataType: "json",            // it's requesting info in json format
                success: getEvents            // this is the callback function used when the request is successful
            });
        }

    }
    
}

// checks the validity of entered values before sending a request. As long as there are invalid entries, there will be no api call
function inputFieldsAreValid() {
    let searchInputs = $("#searchModal input");
    $("#locationErrorMessage").css("display", "none");
    $("#magErrorMessage").css("display", "none");
    let valid = true;

    for (let i = 0; i < searchInputs.length; ++i) {
        
        let fieldObj = $(searchInputs[i]);
        
        let fieldVal = fieldObj.val();
        fieldVal = (fieldVal == "" ? "" : parseInt(fieldVal));

        let fieldMin = (fieldObj.attr("min") ? parseInt(fieldObj.attr("min")) : null);
        let fieldMax = (fieldObj.attr("max") ? parseInt(fieldObj.attr("max")) : null);
        let errorElem = $(".searchValidation")[i];
        $(errorElem).css("display", "none");
        let errorText = "";

        if (fieldMin !== null && fieldVal != "" && fieldVal < fieldMin) {
            errorText += "Your input must be greater than the minimum accepted value, " + fieldMin + ".";
            $(errorElem).html(errorText);
            $(errorElem).css("display", "block");
            valid = false;
        }
        else if (fieldMax !== null && fieldVal != "" && fieldVal > fieldMax) {
            errorText += "Your input must be less than the maximum accepted value, " + fieldMax + ".";
            $(errorElem).html(errorText);
            $(errorElem).css("display", "block");
            valid = false;
        }
    }

    let latVal = $("input[name='latitude']").val();
    let longVal = $("input[name='longitude']").val();
    let radVal = $("input[name='maxRadius']").val();
    // if any one isn't blank AND any one of them is still blank, the api call will error500
    if ((latVal != "" || longVal != "" || radVal != "") && (latVal == "" || longVal == "" || radVal == "")) {
        $("#locationErrorMessage").css("display", "block");
        valid = false;
    }

    let minMag = $("input[name='minMagnitude']").val();
    let maxMag = $("input[name='maxMagnitude']").val();
    let minDepth = $("input[name='minDepth']").val();
    let maxDepth = $("input[name='maxDepth']").val();
    // if the mins are greater than the max's
    if ((minMag != "" && maxMag != "") && (parseFloat(minMag) >= parseFloat(maxMag))) {
        $("#magErrorMessage").css("display", "block");
        valid = false;
    }
    else if ((minDepth != "" && maxDepth != "") && (parseFloat(minDepth) >= parseFloat(maxDepth))) {
        $("#magErrorMessage").css("display", "block");
        valid = false;
    }

    // check min and max values
    return valid;
}

