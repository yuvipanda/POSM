var map = null;

var currentChangesetID = null;
var OSMbaseURL = 'http://api.openstreetmap.org';
var overpassBaseURL = 'http://overpass.osm.rambler.ru/cgi/interpreter';
var autoPOI = false;
var updateLocation = true;

var newMarkerIconClass = L.Icon.extend({
    iconUrl: "img/new-marker.png",
});
var newMarkerIcon = new newMarkerIconClass();

var tapBarActions = {
    "login-start": {
        text: "Login",
        callback: function() {
            $("#login").click();
        }
    },
    "login-in-progress": {
        text: "Logging in",
        disabled: true
    },
    "login-failed": {
        text: "Logged in!",
        disabled: true,
        next: 'create-poi-start'
    },
    "login-success": {
        text: "Logged in!",
        disabled: true,
        next: 'create-poi-start'
    },
    "create-poi-start": {
        text: "Create POI",
        callback: function() {
            console.log("Creating poi");
            startAdd();
        }
    },
    "create-poi-place": {
        text: "Tap on location in map",
        disabled: true
    },
    "create-poi-save": {
        text: "Save location",
        callback: function() {
            stopAdd();
        }
    },
    "create-poi-failed": {
        text: "Creating Failed :(",
        disabled: true,
        next: 'create-poi-start'
    }, 
    "create-poi-cancelled": {
        text: "Creating Cancelled",
        disabled: true,
        next: 'create-poi-start'
    }, 
    "create-poi-creating": {
        text: "Creating...",
        disabled: true
    }, 
    "create-poi-created": {
        text: "Created!",
        disabled: true,
        next: 'create-poi-start'
    }
};
           
function setTapBarState(state_name) {
    var state = tapBarActions[state_name];
    $("#tap-bar").html(state.text).unbind('vclick').bind('vclick', state.callback);
    if(state.disabled) {
        $("#tap-bar").attr("disabled", "disabled").removeClass("img-btn").removeClass("ui-btn-up-a");
    } else {
        $("#tap-bar").removeAttr("disabled").addClass("img-btn").addClass("ui-btn-up-a");
    }

    if(state.next) {
        setTimeout(function() {
            setTapBarState(state.next);
        }, 2 * 1000);
    }
}

function onBodyLoad() {
    if(window.PhoneGap.available) {
        document.addEventListener("deviceready", function() { init(); }, true);
        document.addEventListener("resume", curPosManager.startWatching, false);
        document.addEventListener("pause", curPosManager.stopWatching, false);
    } else {
        $(function() {
            if(location.href.match(/^http/)) {
                OSMbaseURL = "/osm";
                overpassBaseURL = '/overpass';
            }
            init();
        });
    }
}

document.addEventListener("mobileinit", function() {
    $.mobile.page.prototype.options.backBtnText = "";
}, true);

function resizeContentArea() {
    var content, contentHeight, footer, header, viewportHeight;
    window.scroll(0, 0);
    header = $(":jqmData(role='header'):visible");
    footer = $(":jqmData(role='footer'):visible");
    content = $(":jqmData(role='content'):visible");
    viewportHeight = $(window).height();
    contentHeight = viewportHeight - header.outerHeight() - footer.outerHeight();
    $("article:jqmData(role='content')").first().height(contentHeight);
    return $("#map").height(contentHeight);
  };

function init() {
    $(window).bind('orientationchange pageshow resize', resizeContentArea);
    map = new L.Map('map');

    var tiles = new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        //attribution: 'Map data &copy; 2011 OpenStreetMap contributors'
        attribution: 'Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">. Map data &copy; 2012 OpenStreetMap contributors'
    });

    map.addLayer(tiles);
    map.locateAndSetView(18, {enableHighAccuracy: true});
    map.on('locationfound', function(pos) {
        curPosManager.showPosition(pos.latlng, pos.accuracy);
    });
    resizeContentArea();

    map.on('click', function(event) {
        if(adding) { 
            if(addMarker === null) {
                 addMarker = new L.Marker(event.latlng, {draggable: true, icon: newMarkerIcon});
                 map.addLayer(addMarker);
                 setTapBarState("create-poi-save");
            }
        }
    });
    map.on('moveend', function(event) {
        if(autoPOI) {
            updatePOIs();
        }
        return true;
    });
}

var addMarker = null;

function updatePOIs() {
    var bounds = map.getBounds();
    POIManager.getPOIsInBounds(bounds).done(POIManager.displayPOIMarkers);
};

var adding = false;
function startAdd() {
    adding = true;
    setTapBarState("create-poi-place");
    $("#add-poi").find('img').attr('src', 'img/save.png');
}

function stopAdd() {
    if(addMarker !== null) {
        setTapBarState("create-poi-creating");
        var name = prompt("Enter name");
        if(name) {
            var latlng = addMarker.getLatLng();
            POIManager.createPOI(latlng, name).then(function() {
                map.removeLayer(addMarker);
                addMarker = null;
                setTapBarState("create-poi-created");
            }).fail(function() {
                map.removeLayer(addMarker);
                addMarker = null;
                setTapBarState("create-poi-failed");
            });
        } else {
            map.removeLayer(addMarker);
            addMarker = null;
            setTapBarState("create-poi-cancelled");
        }
    }
    adding = false;
}

function startSpinImg(selector) {
    $(selector).addClass("spinner");
}

function stopSpinImg(selector) {
    $(selector).removeClass("spinner");
}

$(function() {
    $(".img-btn").bind('vmousedown', function() {
        if(!$(this).attr("disabled")) {
            $(this).addClass("ui-btn-down-e");
        }
    }).bind('vmouseup', function() {
        if(!$(this).attr("disabled")) {
            $(this).removeClass("ui-btn-down-e");
        }
    });
    $(".img-toggle").click(function() {
        if($(this).attr('pressed')) {
            $(this).removeClass("ui-btn-down-e");
            $(this).removeAttr('pressed');
        } else {
            $(this).attr("pressed", "pressed");
            $(this).addClass("ui-btn-down-e");
        }
    });

    $("#show-poi").click(function() {
        autoPOI = !autoPOI;
        if(autoPOI) {
            updatePOIs();
        }
    });

    $("#current-location").click(function() {
        map.locateAndSetView(map.getZoom(), {enableHighAccuracy: true});
    });


    $("#login").click(function() {
        $("#login-user-id").val(localStorage.userName);
        // Death by electrocution and a thousand hours of using PHP 3
        $("#login-password").val(localStorage.password);
        $.mobile.changePage("#login-dialog");
    });

    $("#save-login").click(function() {
        localStorage.userName = $.trim($("#login-user-id").val());
        localStorage.password = $.trim($("#login-password").val());
        $.mobile.showPageLoadingMsg();
        changesets.createChangeset().then(function(id) {
            currentChangesetID = id;
            $.mobile.hidePageLoadingMsg();
            setTapBarState("create-poi-start");
            history.back();
        }).fail(function(err) {
            console.log(JSON.stringify(err));
            $.mobile.hidePageLoadingMsg();
            if(err.statusText == "timeout") {
                alert("Network too slow");
            } else {
                alert("Error logging in. Wrong password?");
            }
        });
        return false;
    });

    // Because doing it immediately makes things block. WTF?
    setTimeout(function() {
        if(localStorage.userName && localStorage.password) {
            setTapBarState("login-in-progress");
            changesets.createChangeset().done(function(id) {
                currentChangesetID = id;
                setTapBarState("login-success");
            }).fail(function() {
                setTapBarState("login-failed");
            })
        } else {
            setTapBarState("login-start");
        }
    }, 300);
});

// getBeforeSend - return function that adds basic authentication and fakes request method.
function makeBeforeSend(method) {
    return function(xhr) {
        xhr.setRequestHeader("X_HTTP_METHOD_OVERRIDE", method);
        xhr.setRequestHeader("Authorization", "Basic " + btoa(localStorage.userName + ":" + localStorage.password));
    };
}


